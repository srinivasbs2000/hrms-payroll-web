import {FormEvent,useCallback,useEffect,useState} from 'react';
import {PayGroupAssignmentView,PayrollAssignmentView,PayrollRelationshipView,SalaryAssignmentView} from './employee-payroll-api';
import {
  AffectedPeriodView,
  AuditEventView,
  CompensationChangeView,
  CompensationEventType,
  EmployeeComponentOverrideView,
  EmployeeComponentOverrideWrite,
  EmployeePayrollBindingApi,
  httpEmployeePayrollBindingApi,
  LifecycleEventType,
  OverrideKind,
  PayrollLifecycleLineageView,
  RelationshipDecision
} from './employee-payroll-binding-api';

type Props={
  relationship:PayrollRelationshipView;
  assignment:PayrollAssignmentView;
  payGroups:PayGroupAssignmentView[];
  salaries:SalaryAssignmentView[];
  permissions:Set<string>;
  api?:EmployeePayrollBindingApi;
};

const today=()=>new Date().toISOString().slice(0,10);

export function EmployeePayrollBindingPanel({
  relationship,assignment,payGroups,salaries,permissions,api=httpEmployeePayrollBindingApi
}:Props){
  const [changes,setChanges]=useState<CompensationChangeView[]>([]);
  const [overrides,setOverrides]=useState<EmployeeComponentOverrideView[]>([]);
  const [lineage,setLineage]=useState<PayrollLifecycleLineageView[]>([]);
  const [periods,setPeriods]=useState<Record<string,AffectedPeriodView[]>>({});
  const [audits,setAudits]=useState<Record<string,AuditEventView[]>>({});
  const [error,setError]=useState('');
  const [success,setSuccess]=useState('');

  const canReadChanges=permissions.has('employee-payroll.compensation-change.read');
  const canReadOverrides=permissions.has('employee-payroll.component-override.read');
  const canReadLineage=permissions.has('employee-payroll.lifecycle-lineage.read');

  const refresh=useCallback(async()=>{
    setError('');
    try{
      const [nextChanges,nextOverrides,nextLineage]=await Promise.all([
        canReadChanges?api.listCompensationChanges(assignment.identityId):Promise.resolve([]),
        canReadOverrides?api.listOverrides(assignment.versionId):Promise.resolve([]),
        canReadLineage?api.listLineage(relationship.identityId):Promise.resolve([])
      ]);
      setChanges(nextChanges);setOverrides(nextOverrides);setLineage(nextLineage);
    }catch(value){setError((value as Error).message)}
  },[
    api,assignment.identityId,assignment.versionId,canReadChanges,canReadLineage,
    canReadOverrides,relationship.identityId
  ]);

  useEffect(()=>{void refresh()},[refresh]);

  async function perform(message:string,work:()=>Promise<void>){
    setError('');setSuccess('');
    try{await work();setSuccess(message)}catch(value){setError((value as Error).message)}
  }

  async function inspectPayGroupImpact(item:PayGroupAssignmentView){
    await perform('Affected pay-group periods loaded',async()=>{
      const result=await api.payGroupImpact(item.id);
      setPeriods(current=>({...current,[`pg:${item.id}`]:result}));
    });
  }

  async function inspectChangeImpact(item:CompensationChangeView){
    await perform('Compensation-change impact loaded',async()=>{
      const result=await api.compensationChangeImpact(item.id);
      setPeriods(current=>({...current,[`cc:${item.id}`]:result}));
    });
  }

  async function inspectAudit(key:string,load:()=>Promise<AuditEventView[]>){
    await perform('Audit trail loaded',async()=>{
      const result=await load();
      setAudits(current=>({...current,[key]:result}));
    });
  }

  return <section className="card" aria-labelledby="employee-binding-title">
    <div className="section-heading"><div>
      <p className="eyebrow">P5-EPA-01 governed binding</p>
      <h3 id="employee-binding-title">Assignment, compensation & lifecycle evidence</h3>
    </div></div>
    <p>Review affected-period and lineage evidence only. This workspace does not calculate payroll, taxes, balances, payments or accounting entries.</p>
    {error&&<p className="error" role="alert">{error}</p>}
    {success&&<p className="success" role="status">{success}</p>}

    <section aria-labelledby="pay-group-impact-title">
      <h4 id="pay-group-impact-title">Pay-group affected periods</h4>
      {payGroups.length===0?<p>No pay-group assignment is selected for impact evidence.</p>:
        payGroups.map(item=><article className="configuration-item" key={item.id}>
          <div><strong>{item.payGroupVersionId}</strong><small>
            Assessment through {item.impactAssessmentThrough??'not assessed'} · {item.impactedPeriodCount} affected periods
          </small></div>
          <span>{item.approvalStatus}</span>
          <div className="configuration-actions">
            {permissions.has('employee-payroll.pay-group-assignment.read')&&
              <button type="button" onClick={()=>void inspectPayGroupImpact(item)}>Inspect affected periods</button>}
          </div>
          <AffectedPeriods items={periods[`pg:${item.id}`]}/>
        </article>)}
    </section>

    <section aria-labelledby="comp-change-title">
      <div className="section-heading"><h4 id="comp-change-title">Compensation changes</h4><span className="count-badge">{changes.length}</span></div>
      {!canReadChanges&&<PermissionNote permission="employee-payroll.compensation-change.read"/>}
      {canReadChanges&&changes.map(item=><article className="configuration-item" key={item.id}>
        <div><strong>{item.eventType} · {item.effectiveDate}</strong><small>{item.reason}</small><small>
          Assessment through {item.assessmentThrough??'pending'} · {item.impactedPeriodCount} affected periods
        </small></div>
        <span>{item.approvalStatus}</span>
        <div className="configuration-actions">
          {item.approvalStatus==='DRAFT'&&permissions.has('employee-payroll.compensation-change.assess')&&
            <AssessmentForm initial={item.assessmentThrough??item.effectiveDate} onSubmit={value=>perform(
              'Compensation impact assessed',async()=>{
                await api.assessCompensationChange(item.id,value);await refresh();
              })}/>}
          {permissions.has('employee-payroll.compensation-change.read')&&
            <button type="button" onClick={()=>void inspectChangeImpact(item)}>View affected periods</button>}
          {item.approvalStatus==='DRAFT'&&item.assessmentThrough!==null&&permissions.has('employee-payroll.compensation-change.approve')&&
            <button type="button" onClick={()=>void perform('Compensation change approved',async()=>{
              await api.approveCompensationChange(item.id);await refresh();
            })}>Approve</button>}
          {item.approvalStatus==='DRAFT'&&item.assessmentThrough===null&&permissions.has('employee-payroll.compensation-change.approve')&&
            <span className="permission-note">Impact assessment is required before approval.</span>}
          {permissions.has('audit.read')&&<button type="button" onClick={()=>void inspectAudit(
            `cc:${item.id}`,()=>api.compensationChangeAudit(item.id))}>Audit</button>}
        </div>
        <AffectedPeriods items={periods[`cc:${item.id}`]}/>
        <AuditTrail items={audits[`cc:${item.id}`]}/>
      </article>)}
      {permissions.has('employee-payroll.compensation-change.create')
        ?<CompensationChangeEditor assignment={assignment} onSubmit={input=>perform(
          'Compensation change draft created',async()=>{await api.createCompensationChange(input);await refresh()})}/>
        :<PermissionNote permission="employee-payroll.compensation-change.create"/>}
    </section>

    <section aria-labelledby="override-title">
      <div className="section-heading"><h4 id="override-title">Employee component overrides</h4><span className="count-badge">{overrides.length}</span></div>
      {!canReadOverrides&&<PermissionNote permission="employee-payroll.component-override.read"/>}
      {canReadOverrides&&overrides.map(item=><article className="configuration-item" key={item.id}>
        <div><strong>{item.overrideKind} · {item.overrideValue}</strong><small>{item.componentVersionId}</small><small>
          {item.effectiveFrom} to {item.effectiveTo??'open'}
        </small></div>
        <span>{item.superseded?'SUPERSEDED':item.approvalStatus}</span>
        <div className="configuration-actions">
          {item.approvalStatus==='DRAFT'&&!item.superseded&&permissions.has('employee-payroll.component-override.correct')&&
            <details><summary>Correct</summary><OverrideEditor assignment={assignment} salaries={salaries} initial={item}
              submitLabel="Correct override" onSubmit={input=>perform('Override corrected',async()=>{
                await api.correctOverride(item.id,input);await refresh();
              })}/></details>}
          {item.approvalStatus==='DRAFT'&&!item.superseded&&permissions.has('employee-payroll.component-override.approve')&&
            <button type="button" onClick={()=>void perform('Override approved',async()=>{
              await api.approveOverride(item.id);await refresh();
            })}>Approve</button>}
          {permissions.has('audit.read')&&<button type="button" onClick={()=>void inspectAudit(
            `ov:${item.id}`,()=>api.overrideAudit(item.id))}>Audit</button>}
        </div>
        <AuditTrail items={audits[`ov:${item.id}`]}/>
      </article>)}
      {permissions.has('employee-payroll.component-override.create')
        ?<OverrideEditor assignment={assignment} salaries={salaries} submitLabel="Create component override draft"
          onSubmit={input=>perform('Component override draft created',async()=>{await api.createOverride(input);await refresh()})}/>
        :<PermissionNote permission="employee-payroll.component-override.create"/>}
    </section>

    <section aria-labelledby="lineage-title">
      <div className="section-heading"><h4 id="lineage-title">Transfer, rehire & concurrent assignment lineage</h4><span className="count-badge">{lineage.length}</span></div>
      {!canReadLineage&&<PermissionNote permission="employee-payroll.lifecycle-lineage.read"/>}
      {canReadLineage&&lineage.map(item=><article className="configuration-item" key={item.id}>
        <div><strong>{item.eventType} · {item.relationshipDecision}</strong><small>{item.effectiveDate} · {item.reason}</small></div>
        <span>{item.approvalStatus}</span>
        <div className="configuration-actions">
          {item.approvalStatus==='DRAFT'&&permissions.has('employee-payroll.lifecycle-lineage.approve')&&
            <button type="button" onClick={()=>void perform('Lifecycle lineage approved',async()=>{
              await api.approveLineage(item.id);await refresh();
            })}>Approve</button>}
          {permissions.has('audit.read')&&<button type="button" onClick={()=>void inspectAudit(
            `ln:${item.id}`,()=>api.lineageAudit(item.id))}>Audit</button>}
        </div>
        <AuditTrail items={audits[`ln:${item.id}`]}/>
      </article>)}
      {permissions.has('employee-payroll.lifecycle-lineage.create')
        ?<LifecycleEditor relationship={relationship} assignment={assignment} onSubmit={input=>perform(
          'Lifecycle lineage draft created',async()=>{await api.createLineage(input);await refresh()})}/>
        :<PermissionNote permission="employee-payroll.lifecycle-lineage.create"/>}
    </section>
  </section>;
}

function CompensationChangeEditor({assignment,onSubmit}:{
  assignment:PayrollAssignmentView;
  onSubmit:(input:{payrollAssignmentId:string;eventType:CompensationEventType;effectiveDate:string;sourceEventId?:string;reason:string})=>Promise<void>;
}){
  const [eventType,setEventType]=useState<CompensationEventType>('CURRENT_PERIOD');
  const [effectiveDate,setEffectiveDate]=useState(today());
  const [sourceEventId,setSourceEventId]=useState('');
  const [reason,setReason]=useState('');
  const lineageRequired=eventType==='CORRECTION'||eventType==='REVERSAL';
  async function submit(event:FormEvent){event.preventDefault();await onSubmit({
    payrollAssignmentId:assignment.identityId,eventType,effectiveDate,
    sourceEventId:lineageRequired?sourceEventId:undefined,reason
  })}
  return <form className="form-grid lifecycle-form" aria-label="Create compensation change" onSubmit={event=>void submit(event)}>
    <h4>Create compensation change</h4>
    <label>Compensation event type<select value={eventType} onChange={event=>setEventType(event.target.value as CompensationEventType)}>
      {(['PROSPECTIVE','CURRENT_PERIOD','RETROSPECTIVE','CORRECTION','REVERSAL'] as CompensationEventType[]).map(value=><option key={value}>{value}</option>)}
    </select></label>
    <label>Compensation effective date<input required type="date" value={effectiveDate} onChange={event=>setEffectiveDate(event.target.value)}/></label>
    {lineageRequired&&<label>Source compensation event ID<input required value={sourceEventId} onChange={event=>setSourceEventId(event.target.value)}/></label>}
    <label>Compensation change reason<input required value={reason} onChange={event=>setReason(event.target.value)}/></label>
    <button type="submit">Create compensation change draft</button>
  </form>;
}

function AssessmentForm({initial,onSubmit}:{initial:string;onSubmit:(value:string)=>Promise<void>}){
  const [value,setValue]=useState(initial);
  return <form className="inline-form" aria-label="Assess compensation change" onSubmit={event=>{event.preventDefault();void onSubmit(value)}}>
    <input aria-label="Assessment through" required type="date" value={value} onChange={event=>setValue(event.target.value)}/>
    <button type="submit">Assess impact</button>
  </form>;
}

function OverrideEditor({assignment,salaries,initial,submitLabel,onSubmit}:{
  assignment:PayrollAssignmentView;salaries:SalaryAssignmentView[];initial?:EmployeeComponentOverrideView;
  submitLabel:string;onSubmit:(input:EmployeeComponentOverrideWrite)=>Promise<void>;
}){
  const [salaryAssignmentId,setSalaryAssignmentId]=useState(initial?.salaryAssignmentId??salaries[0]?.id??'');
  const [lineId,setLineId]=useState(initial?.salaryStructureLineId??'');
  const [componentId,setComponentId]=useState(initial?.componentVersionId??'');
  const [kind,setKind]=useState<OverrideKind>(initial?.overrideKind??'AMOUNT');
  const [value,setValue]=useState(initial?String(initial.overrideValue):'');
  const [from,setFrom]=useState(initial?.effectiveFrom??assignment.assignmentStart);
  const [to,setTo]=useState(initial?.effectiveTo??assignment.assignmentEnd??'');
  async function submit(event:FormEvent){event.preventDefault();await onSubmit({
    payrollAssignmentVersionId:assignment.versionId,salaryAssignmentId,salaryStructureLineId:lineId,
    componentVersionId:componentId,overrideKind:kind,overrideValue:Number(value),effectiveFrom:from,effectiveTo:to||undefined
  })}
  return <form className="form-grid lifecycle-form" aria-label={submitLabel} onSubmit={event=>void submit(event)}>
    <h4>Employee component override</h4>
    <label>Salary assignment ID<input required value={salaryAssignmentId} onChange={event=>setSalaryAssignmentId(event.target.value)}/></label>
    <label>Salary structure line ID<input required value={lineId} onChange={event=>setLineId(event.target.value)}/></label>
    <label>Component version ID<input required value={componentId} onChange={event=>setComponentId(event.target.value)}/></label>
    <label>Override kind<select value={kind} onChange={event=>setKind(event.target.value as OverrideKind)}><option>AMOUNT</option><option>PERCENTAGE</option></select></label>
    <label>Override value<input required type="number" min="0" step="0.0001" value={value} onChange={event=>setValue(event.target.value)}/></label>
    <label>Override effective from<input required type="date" value={from} onChange={event=>setFrom(event.target.value)}/></label>
    <label>Override effective to<input type="date" value={to} onChange={event=>setTo(event.target.value)}/></label>
    <button type="submit">{submitLabel}</button>
  </form>;
}

function LifecycleEditor({relationship,assignment,onSubmit}:{
  relationship:PayrollRelationshipView;assignment:PayrollAssignmentView;
  onSubmit:(input:{eventType:LifecycleEventType;relationshipDecision:RelationshipDecision;predecessorRelationshipId:string;successorRelationshipId:string;predecessorAssignmentId?:string;successorAssignmentId?:string;effectiveDate:string;reason:string})=>Promise<void>;
}){
  const [eventType,setEventType]=useState<LifecycleEventType>('CONCURRENT_ASSIGNMENT');
  const [decision,setDecision]=useState<RelationshipDecision>('CONTINUE');
  const [preRelationship,setPreRelationship]=useState(relationship.identityId);
  const [nextRelationship,setNextRelationship]=useState(relationship.identityId);
  const [preAssignment,setPreAssignment]=useState(assignment.identityId);
  const [nextAssignment,setNextAssignment]=useState('');
  const [effectiveDate,setEffectiveDate]=useState(today());
  const [reason,setReason]=useState('');
  const [validationError,setValidationError]=useState('');
  const concurrent=eventType==='CONCURRENT_ASSIGNMENT';
  const continuing=concurrent||decision==='CONTINUE';
  const successorRelationship=continuing?preRelationship:nextRelationship;

  async function submit(event:FormEvent){
    event.preventDefault();setValidationError('');
    if(concurrent&&(!preAssignment||!nextAssignment||preAssignment===nextAssignment)){
      setValidationError('Concurrent assignment requires distinct predecessor and successor assignment IDs.');
      return;
    }
    if(!concurrent&&decision==='SUCCESSOR'&&successorRelationship===preRelationship){
      setValidationError('SUCCESSOR requires a distinct successor relationship ID.');
      return;
    }
    await onSubmit({
      eventType,relationshipDecision:concurrent?'CONTINUE':decision,
      predecessorRelationshipId:preRelationship,successorRelationshipId:successorRelationship,
      predecessorAssignmentId:preAssignment||undefined,successorAssignmentId:nextAssignment||undefined,
      effectiveDate,reason
    });
  }

  return <form className="form-grid lifecycle-form" aria-label="Create payroll lifecycle lineage" onSubmit={event=>void submit(event)}>
    <h4>Create payroll lifecycle lineage</h4>
    {validationError&&<p className="error" role="alert">{validationError}</p>}
    <label>Lifecycle event type<select value={eventType} onChange={event=>{
      const value=event.target.value as LifecycleEventType;setEventType(value);
      if(value==='CONCURRENT_ASSIGNMENT')setDecision('CONTINUE');
    }}><option>TRANSFER</option><option>REHIRE</option><option>CONCURRENT_ASSIGNMENT</option></select></label>
    <label>Relationship decision<select disabled={concurrent} value={concurrent?'CONTINUE':decision} onChange={event=>setDecision(event.target.value as RelationshipDecision)}><option>CONTINUE</option><option>SUCCESSOR</option></select></label>
    <label>Predecessor relationship ID<input required value={preRelationship} onChange={event=>setPreRelationship(event.target.value)}/></label>
    <label>Successor relationship ID<input required readOnly={continuing} value={successorRelationship} onChange={event=>setNextRelationship(event.target.value)}/></label>
    <label>Predecessor assignment ID<input required={concurrent} value={preAssignment} onChange={event=>setPreAssignment(event.target.value)}/></label>
    <label>Successor assignment ID<input required={concurrent} value={nextAssignment} onChange={event=>setNextAssignment(event.target.value)}/></label>
    <label>Lifecycle effective date<input required type="date" value={effectiveDate} onChange={event=>setEffectiveDate(event.target.value)}/></label>
    <label>Lifecycle reason<input required value={reason} onChange={event=>setReason(event.target.value)}/></label>
    <button type="submit">Create lifecycle lineage draft</button>
  </form>;
}

function AffectedPeriods({items}:{items:AffectedPeriodView[]|undefined}){
  if(!items)return null;
  if(items.length===0)return <p className="empty compact">No affected pay periods were returned.</p>;
  return <table aria-label="Affected pay periods"><thead><tr><th>Period</th><th>Range</th><th>Reason</th></tr></thead><tbody>
    {items.map(item=><tr key={`${item.payPeriodId}-${item.reasonCode}`}><td>{item.periodCode}</td><td>{item.periodStart} to {item.periodEnd}</td><td>{item.reasonCode}</td></tr>)}
  </tbody></table>;
}

function AuditTrail({items}:{items:AuditEventView[]|undefined}){
  if(!items)return null;
  if(items.length===0)return <p className="empty compact">No audit events were returned.</p>;
  return <ol className="timeline" aria-label="Audit trail">{items.map(item=><li key={item.id}><strong>{item.action}</strong><span>{item.actor}</span><span>{item.occurredAt}</span></li>)}</ol>;
}

function PermissionNote({permission}:{permission:string}){
  return <p className="permission-note">Controls require <code>{permission}</code>.</p>;
}
