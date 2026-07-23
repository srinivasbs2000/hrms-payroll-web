import {FormEvent,ReactNode,useCallback,useEffect,useMemo,useState} from 'react';
import {currentPermissions} from '../organisation/organisation-api';
import {
  EmployeePayrollApi,
  EmployeePayrollProfileView,
  httpEmployeePayrollApi,
  PayGroupAssignmentView,
  PayGroupAssignmentWrite,
  PayrollAssignmentView,
  PayrollAssignmentWrite,
  PayrollProfileStatus,
  PayrollRelationshipView,
  PayrollRelationshipWrite,
  SalaryAssignmentView,
  SalaryAssignmentWrite
} from './employee-payroll-api';

type Props={api?:EmployeePayrollApi;permissions?:Set<string>};
const today=()=>new Date().toISOString().slice(0,10);

export function EmployeePayrollPage({api=httpEmployeePayrollApi,permissions}:Props){
  const effectivePermissions=useMemo(()=>permissions??currentPermissions(),[permissions]);
  const [asOf,setAsOf]=useState(today);
  const [relationships,setRelationships]=useState<PayrollRelationshipView[]>([]);
  const [relationship,setRelationship]=useState<PayrollRelationshipView|null>(null);
  const [relationshipHistory,setRelationshipHistory]=useState<PayrollRelationshipView[]>([]);
  const [assignments,setAssignments]=useState<PayrollAssignmentView[]>([]);
  const [assignment,setAssignment]=useState<PayrollAssignmentView|null>(null);
  const [assignmentHistory,setAssignmentHistory]=useState<PayrollAssignmentView[]>([]);
  const [profile,setProfile]=useState<EmployeePayrollProfileView|null>(null);
  const [payGroups,setPayGroups]=useState<PayGroupAssignmentView[]>([]);
  const [salaries,setSalaries]=useState<SalaryAssignmentView[]>([]);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const [success,setSuccess]=useState('');

  const canRead=effectivePermissions.has('employee-payroll.relationship.read');
  const canReadAssignments=effectivePermissions.has('employee-payroll.assignment.read');
  const canReadProfile=effectivePermissions.has('employee-payroll.profile.read');

  const loadRelationships=useCallback(async()=>{
    if(!canRead)return;
    setLoading(true);setError('');
    try{setRelationships(await api.listRelationships(asOf))}
    catch(value){setError((value as Error).message)}
    finally{setLoading(false)}
  },[api,asOf,canRead]);

  useEffect(()=>{void loadRelationships()},[loadRelationships]);

  async function selectRelationship(item:PayrollRelationshipView){
    setRelationship(item);setAssignment(null);setAssignmentHistory([]);setPayGroups([]);setSalaries([]);
    setError('');setSuccess('');
    try{
      const [history,employeeAssignments,employeeProfile]=await Promise.all([
        api.relationshipHistory(item.identityId),
        canReadAssignments?api.listAssignments(item.identityId,asOf):Promise.resolve([]),
        canReadProfile?api.profileForRelationship(item.identityId):Promise.resolve(null)
      ]);
      setRelationshipHistory(history);setAssignments(employeeAssignments);setProfile(employeeProfile);
    }catch(value){setError((value as Error).message)}
  }

  async function selectAssignment(item:PayrollAssignmentView){
    setAssignment(item);setError('');setSuccess('');
    try{
      const [history,groupAssignments,salaryAssignments]=await Promise.all([
        api.assignmentHistory(item.identityId),
        effectivePermissions.has('employee-payroll.pay-group-assignment.read')
          ?api.listPayGroupAssignments(item.versionId):Promise.resolve([]),
        effectivePermissions.has('employee-payroll.salary-assignment.read')
          ?api.listSalaryAssignments(item.versionId):Promise.resolve([])
      ]);
      setAssignmentHistory(history);setPayGroups(groupAssignments);setSalaries(salaryAssignments);
    }catch(value){setError((value as Error).message)}
  }

  async function createRelationship(input:PayrollRelationshipWrite){
    await perform('Payroll relationship draft created',async()=>{
      const created=await api.createRelationship(input);
      await loadRelationships();await selectRelationship(created);
    });
  }

  async function addRelationshipVersion(input:PayrollRelationshipWrite){
    if(!relationship)return;
    await perform('Payroll relationship version created',async()=>{
      const created=await api.addRelationshipVersion(relationship.identityId,input);
      await loadRelationships();await selectRelationship(created);
    });
  }

  async function correctRelationship(input:PayrollRelationshipWrite){
    if(!relationship)return;
    await perform('Future payroll relationship draft corrected',async()=>{
      const corrected=await api.correctRelationship(relationship.identityId,relationship.versionId,input);
      await loadRelationships();await selectRelationship(corrected);
    });
  }

  async function approveRelationship(item:PayrollRelationshipView){
    await perform('Payroll relationship approved',async()=>{
      const approved=await api.approveRelationship(item.identityId,item.versionId);
      await loadRelationships();await selectRelationship(approved);
    });
  }

  async function endDateRelationship(value:string){
    if(!relationship)return;
    await perform('Payroll relationship end-dated',async()=>{
      const ended=await api.endDateRelationship(
        relationship.identityId,relationship.versionId,relationship.versionNo,value);
      await loadRelationships();await selectRelationship(ended);
    });
  }

  async function createAssignment(input:PayrollAssignmentWrite){
    await perform('Payroll assignment draft created',async()=>{
      const created=await api.createAssignment(input);
      if(relationship)await selectRelationship(relationship);
      await selectAssignment(created);
    });
  }

  async function addAssignmentVersion(input:PayrollAssignmentWrite){
    if(!assignment)return;
    await perform('Payroll assignment version created',async()=>{
      const created=await api.addAssignmentVersion(assignment.identityId,input);
      if(relationship)await selectRelationship(relationship);
      await selectAssignment(created);
    });
  }

  async function correctAssignment(input:PayrollAssignmentWrite){
    if(!assignment)return;
    await perform('Future payroll assignment draft corrected',async()=>{
      const corrected=await api.correctAssignment(assignment.identityId,assignment.versionId,input);
      if(relationship)await selectRelationship(relationship);
      await selectAssignment(corrected);
    });
  }

  async function approveAssignment(item:PayrollAssignmentView){
    await perform('Payroll assignment approved',async()=>{
      const approved=await api.approveAssignment(item.identityId,item.versionId);
      if(relationship)await selectRelationship(relationship);
      await selectAssignment(approved);
    });
  }

  async function endDateAssignment(value:string){
    if(!assignment)return;
    await perform('Payroll assignment end-dated',async()=>{
      const ended=await api.endDateAssignment(
        assignment.identityId,assignment.versionId,assignment.versionNo,value);
      if(relationship)await selectRelationship(relationship);
      await selectAssignment(ended);
    });
  }

  async function createProfile(){
    if(!relationship)return;
    await perform('Employee payroll profile created',async()=>{
      setProfile(await api.createProfile(relationship.identityId));
    });
  }

  async function updateProfile(status:PayrollProfileStatus){
    if(!profile)return;
    await perform(`Payroll profile moved to ${status.replaceAll('_',' ').toLowerCase()}`,async()=>{
      setProfile(await api.updateProfileStatus(profile.id,profile.versionNo,status));
    });
  }

  async function createPayGroupAssignment(input:PayGroupAssignmentWrite){
    await perform('Pay-group assignment draft created',async()=>{
      const created=await api.createPayGroupAssignment(input);
      setPayGroups(current=>[...current,created]);
    });
  }

  async function correctPayGroupAssignment(item:PayGroupAssignmentView,input:PayGroupAssignmentWrite){
    await perform('Future pay-group assignment draft corrected',async()=>{
      const corrected=await api.correctPayGroupAssignment(item.id,input);
      setPayGroups(current=>current.map(value=>value.id===item.id?{...value,superseded:true}:value).concat(corrected));
    });
  }

  async function approvePayGroupAssignment(item:PayGroupAssignmentView){
    await perform('Pay-group assignment approved',async()=>{
      const approved=await api.approvePayGroupAssignment(item.id);
      replacePayGroup(approved);
    });
  }

  async function endDatePayGroupAssignment(item:PayGroupAssignmentView,value:string){
    await perform('Pay-group assignment end-dated',async()=>{
      replacePayGroup(await api.endDatePayGroupAssignment(item.id,item.versionNo,value));
    });
  }

  async function createSalaryAssignment(input:SalaryAssignmentWrite){
    await perform('Salary assignment draft created',async()=>{
      const created=await api.createSalaryAssignment(input);
      setSalaries(current=>[...current,created]);
    });
  }

  async function correctSalaryAssignment(item:SalaryAssignmentView,input:SalaryAssignmentWrite){
    await perform('Future salary assignment draft corrected',async()=>{
      const corrected=await api.correctSalaryAssignment(item.id,input);
      setSalaries(current=>current.map(value=>value.id===item.id?{...value,superseded:true}:value).concat(corrected));
    });
  }

  async function approveSalaryAssignment(item:SalaryAssignmentView){
    await perform('Salary assignment approved',async()=>{
      const approved=await api.approveSalaryAssignment(item.id);
      replaceSalary(approved);
    });
  }

  async function endDateSalaryAssignment(item:SalaryAssignmentView,value:string){
    await perform('Salary assignment end-dated',async()=>{
      replaceSalary(await api.endDateSalaryAssignment(item.id,item.versionNo,value));
    });
  }

  function replacePayGroup(item:PayGroupAssignmentView){
    setPayGroups(current=>current.map(value=>value.id===item.id?item:value));
  }

  function replaceSalary(item:SalaryAssignmentView){
    setSalaries(current=>current.map(value=>value.id===item.id?item:value));
  }

  async function perform(message:string,work:()=>Promise<void>){
    setError('');setSuccess('');
    try{await work();setSuccess(message)}
    catch(value){setError((value as Error).message)}
  }

  if(!canRead)return <section className="card" aria-labelledby="employee-payroll-title">
    <h2 id="employee-payroll-title">Employee payroll</h2>
    <p role="alert">You do not have permission to view payroll relationships.</p>
  </section>;

  return <section aria-labelledby="employee-payroll-title">
    <div className="page-heading">
      <div>
        <p className="eyebrow">Sprint 2 employee configuration</p>
        <h2 id="employee-payroll-title">Employee payroll</h2>
        <p>Configure the approved relationship, assignment, pay group and salary lineage required before payroll processing.</p>
      </div>
      <label>Effective date<input aria-label="Employee payroll effective date" type="date" value={asOf} onChange={event=>setAsOf(event.target.value)}/></label>
    </div>
    {loading&&<p role="status">Loading payroll relationships...</p>}
    {error&&<p className="error" role="alert">{error}</p>}
    {success&&<p className="success" role="status">{success}</p>}

    <div className="employee-payroll-layout">
      <div>
        <section className="card">
          <div className="section-heading">
            <h3>Effective payroll relationships</h3>
            <span className="count-badge">{relationships.length}</span>
          </div>
          {relationships.length===0
            ?<p className="empty compact">No approved payroll relationships are effective on {asOf}.</p>
            :<div className="employee-list">{relationships.map(item=><button
                key={item.versionId}
                className={`employee-item ${relationship?.versionId===item.versionId?'selected':''}`}
                onClick={()=>void selectRelationship(item)}>
                <span><strong>{item.employeeNumber}</strong><small>{item.externalEmployeeId}</small></span>
                <span><strong>{item.approvalStatus}</strong><small>{item.relationshipStart} to {item.relationshipEnd??'open'}</small></span>
              </button>)}</div>}
        </section>
        {effectivePermissions.has('employee-payroll.relationship.create')
          ?<RelationshipEditor title="Create payroll relationship" submitLabel="Create relationship draft" requireIdentity onSubmit={createRelationship}/>
          :<p className="permission-note">Relationship create controls require <code>employee-payroll.relationship.create</code>.</p>}
      </div>

      <div>
        {!relationship&&<section className="card empty"><h3>Select a payroll relationship</h3><p>The setup workspace opens after a relationship is selected or created.</p></section>}
        {relationship&&<>
          <RelationshipLifecycle
            selected={relationship}
            history={relationshipHistory}
            permissions={effectivePermissions}
            onApprove={approveRelationship}
            onAdd={addRelationshipVersion}
            onCorrect={correctRelationship}
            onEndDate={endDateRelationship}/>
          <ProfilePanel
            relationship={relationship}
            profile={profile}
            permissions={effectivePermissions}
            onCreate={createProfile}
            onStatus={updateProfile}/>
          <AssignmentPanel
            relationship={relationship}
            assignments={assignments}
            selected={assignment}
            permissions={effectivePermissions}
            onSelect={selectAssignment}
            onCreate={createAssignment}/>
          {assignment&&<>
            <AssignmentLifecycle
              selected={assignment}
              history={assignmentHistory}
              permissions={effectivePermissions}
              onApprove={approveAssignment}
              onAdd={addAssignmentVersion}
              onCorrect={correctAssignment}
              onEndDate={endDateAssignment}/>
            <PayGroupAssignmentPanel
              assignment={assignment}
              items={payGroups}
              permissions={effectivePermissions}
              onCreate={createPayGroupAssignment}
              onCorrect={correctPayGroupAssignment}
              onApprove={approvePayGroupAssignment}
              onEndDate={endDatePayGroupAssignment}/>
            <SalaryAssignmentPanel
              assignment={assignment}
              items={salaries}
              permissions={effectivePermissions}
              onCreate={createSalaryAssignment}
              onCorrect={correctSalaryAssignment}
              onApprove={approveSalaryAssignment}
              onEndDate={endDateSalaryAssignment}/>
          </>}
        </>}
      </div>
    </div>
  </section>;
}

function RelationshipLifecycle({selected,history,permissions,onApprove,onAdd,onCorrect,onEndDate}:{
  selected:PayrollRelationshipView;
  history:PayrollRelationshipView[];
  permissions:Set<string>;
  onApprove:(item:PayrollRelationshipView)=>Promise<void>;
  onAdd:(input:PayrollRelationshipWrite)=>Promise<void>;
  onCorrect:(input:PayrollRelationshipWrite)=>Promise<void>;
  onEndDate:(value:string)=>Promise<void>;
}){
  const [endDate,setEndDate]=useState(selected.relationshipEnd??'');
  useEffect(()=>setEndDate(selected.relationshipEnd??''),[selected]);
  return <section className="card">
    <div className="section-heading"><h3>{selected.employeeNumber} relationship timeline</h3><StatusBadge value={selected.approvalStatus}/></div>
    <ol className="timeline">{history.map(item=><li key={item.versionId}>
      <strong>Version {item.versionSequence}</strong>
      <span>{item.relationshipStart} to {item.relationshipEnd??'open'}</span>
      <span>{item.superseded?'Superseded':item.approvalStatus}</span>
      {item.approvalStatus==='DRAFT'&&permissions.has('employee-payroll.relationship.approve')
        ?<button onClick={()=>void onApprove(item)}>Approve</button>:<span/>}
    </li>)}</ol>
    {permissions.has('employee-payroll.relationship.version.create')&&<RelationshipEditor
      title="Add relationship version" submitLabel="Add relationship version" initial={selected} onSubmit={onAdd}/>}
    {selected.approvalStatus==='DRAFT'&&!selected.superseded&&permissions.has('employee-payroll.relationship.version.correct')&&<RelationshipEditor
      title="Correct future relationship draft" submitLabel="Correct relationship draft" initial={selected} onSubmit={onCorrect}/>}
    {permissions.has('employee-payroll.relationship.version.end-date')&&<form className="form-grid lifecycle-form" onSubmit={event=>{event.preventDefault();void onEndDate(endDate)}}>
      <label>Relationship end date<input required type="date" value={endDate} onChange={event=>setEndDate(event.target.value)}/></label>
      <button type="submit">End-date relationship</button>
    </form>}
  </section>;
}

function RelationshipEditor({title,submitLabel,requireIdentity=false,initial,onSubmit}:{
  title:string;submitLabel:string;requireIdentity?:boolean;initial?:PayrollRelationshipView;
  onSubmit:(input:PayrollRelationshipWrite)=>Promise<void>;
}){
  const [externalId,setExternalId]=useState(initial?.externalEmployeeId??'');
  const [employeeNumber,setEmployeeNumber]=useState(initial?.employeeNumber??'');
  const [legalVersion,setLegalVersion]=useState(initial?.legalEntityVersionId??'');
  const [from,setFrom]=useState(initial?.relationshipStart??today());
  const [to,setTo]=useState(initial?.relationshipEnd??'');
  async function submit(event:FormEvent){
    event.preventDefault();
    await onSubmit({
      externalEmployeeId:requireIdentity?externalId:undefined,
      employeeNumber:requireIdentity?employeeNumber:undefined,
      legalEntityVersionId:legalVersion,
      relationshipStart:from,
      relationshipEnd:to||undefined
    });
  }
  return <form className="card form-grid" onSubmit={event=>void submit(event)}>
    <h3>{title}</h3>
    {requireIdentity&&<label>External employee ID<input required value={externalId} onChange={event=>setExternalId(event.target.value)}/></label>}
    {requireIdentity&&<label>Employee number<input required value={employeeNumber} onChange={event=>setEmployeeNumber(event.target.value)}/></label>}
    <label>Legal entity version ID<input required value={legalVersion} onChange={event=>setLegalVersion(event.target.value)}/></label>
    <label>Relationship start<input required type="date" value={from} onChange={event=>setFrom(event.target.value)}/></label>
    <label>Relationship end<input type="date" value={to} onChange={event=>setTo(event.target.value)}/></label>
    <button type="submit">{submitLabel}</button>
  </form>;
}

function ProfilePanel({relationship,profile,permissions,onCreate,onStatus}:{
  relationship:PayrollRelationshipView;profile:EmployeePayrollProfileView|null;permissions:Set<string>;
  onCreate:()=>Promise<void>;onStatus:(status:PayrollProfileStatus)=>Promise<void>;
}){
  return <section className="card">
    <div className="section-heading"><h3>Employee payroll profile</h3>{profile&&<StatusBadge value={profile.payrollStatus}/>}</div>
    {!permissions.has('employee-payroll.profile.read')&&<p className="permission-note">Profile details require <code>employee-payroll.profile.read</code>.</p>}
    {permissions.has('employee-payroll.profile.read')&&!profile&&<>
      <p>No profile exists for {relationship.employeeNumber}.</p>
      {permissions.has('employee-payroll.profile.create')&&<button onClick={()=>void onCreate()}>Create INR payroll profile</button>}
    </>}
    {profile&&<>
      <dl className="summary-grid"><div><dt>Employee</dt><dd>{profile.employeeNumber}</dd></div><div><dt>Currency</dt><dd>{profile.currency}</dd></div><div><dt>Version</dt><dd>{profile.versionNo}</dd></div></dl>
      {permissions.has('employee-payroll.profile.status.update')&&<div className="button-row">
        {(['READY','ON_HOLD','INACTIVE'] as PayrollProfileStatus[]).map(status=><button key={status} disabled={profile.payrollStatus===status} onClick={()=>void onStatus(status)}>{status.replaceAll('_',' ')}</button>)}
      </div>}
    </>}
  </section>;
}

function AssignmentPanel({relationship,assignments,selected,permissions,onSelect,onCreate}:{
  relationship:PayrollRelationshipView;assignments:PayrollAssignmentView[];selected:PayrollAssignmentView|null;
  permissions:Set<string>;onSelect:(item:PayrollAssignmentView)=>Promise<void>;
  onCreate:(input:PayrollAssignmentWrite)=>Promise<void>;
}){
  return <section className="card">
    <div className="section-heading"><h3>Payroll assignments</h3><span className="count-badge">{assignments.length}</span></div>
    {permissions.has('employee-payroll.assignment.read')&&assignments.length===0&&<p>No approved assignments are effective on the selected date.</p>}
    <div className="employee-list">{assignments.map(item=><button key={item.versionId} className={`employee-item ${selected?.versionId===item.versionId?'selected':''}`} onClick={()=>void onSelect(item)}>
      <span><strong>{item.assignmentNumber}</strong><small>{item.identityStatus}</small></span>
      <span><strong>{item.approvalStatus}</strong><small>{item.assignmentStart} to {item.assignmentEnd??'open'}</small></span>
    </button>)}</div>
    {permissions.has('employee-payroll.assignment.create')&&<AssignmentEditor
      title="Create payroll assignment"
      submitLabel="Create assignment draft"
      requireIdentity
      relationship={relationship}
      onSubmit={onCreate}/>}
  </section>;
}

function AssignmentLifecycle({selected,history,permissions,onApprove,onAdd,onCorrect,onEndDate}:{
  selected:PayrollAssignmentView;history:PayrollAssignmentView[];permissions:Set<string>;
  onApprove:(item:PayrollAssignmentView)=>Promise<void>;
  onAdd:(input:PayrollAssignmentWrite)=>Promise<void>;
  onCorrect:(input:PayrollAssignmentWrite)=>Promise<void>;
  onEndDate:(value:string)=>Promise<void>;
}){
  const [endDate,setEndDate]=useState(selected.assignmentEnd??'');
  useEffect(()=>setEndDate(selected.assignmentEnd??''),[selected]);
  return <section className="card">
    <div className="section-heading"><h3>{selected.assignmentNumber} assignment timeline</h3><StatusBadge value={selected.approvalStatus}/></div>
    <ol className="timeline">{history.map(item=><li key={item.versionId}>
      <strong>Version {item.versionSequence}</strong>
      <span>{item.assignmentStart} to {item.assignmentEnd??'open'}</span>
      <span>{item.superseded?'Superseded':item.approvalStatus}</span>
      {item.approvalStatus==='DRAFT'&&permissions.has('employee-payroll.assignment.approve')
        ?<button onClick={()=>void onApprove(item)}>Approve</button>:<span/>}
    </li>)}</ol>
    {permissions.has('employee-payroll.assignment.version.create')&&<AssignmentEditor title="Add assignment version" submitLabel="Add assignment version" initial={selected} onSubmit={onAdd}/>}
    {selected.approvalStatus==='DRAFT'&&!selected.superseded&&permissions.has('employee-payroll.assignment.version.correct')&&<AssignmentEditor title="Correct future assignment draft" submitLabel="Correct assignment draft" initial={selected} onSubmit={onCorrect}/>}
    {permissions.has('employee-payroll.assignment.version.end-date')&&<form className="form-grid lifecycle-form" onSubmit={event=>{event.preventDefault();void onEndDate(endDate)}}>
      <label>Assignment end date<input required type="date" value={endDate} onChange={event=>setEndDate(event.target.value)}/></label>
      <button type="submit">End-date assignment</button>
    </form>}
  </section>;
}

function AssignmentEditor({title,submitLabel,requireIdentity=false,relationship,initial,onSubmit}:{
  title:string;submitLabel:string;requireIdentity?:boolean;relationship?:PayrollRelationshipView;initial?:PayrollAssignmentView;
  onSubmit:(input:PayrollAssignmentWrite)=>Promise<void>;
}){
  const [number,setNumber]=useState(initial?.assignmentNumber??'');
  const [relationshipVersion,setRelationshipVersion]=useState(initial?.payrollRelationshipVersionId??relationship?.versionId??'');
  const [establishmentVersion,setEstablishmentVersion]=useState(initial?.establishmentVersionId??'');
  const [from,setFrom]=useState(initial?.assignmentStart??relationship?.relationshipStart??today());
  const [to,setTo]=useState(initial?.assignmentEnd??relationship?.relationshipEnd??'');
  async function submit(event:FormEvent){
    event.preventDefault();
    await onSubmit({
      payrollRelationshipId:requireIdentity?relationship?.identityId:undefined,
      assignmentNumber:requireIdentity?number:undefined,
      payrollRelationshipVersionId:relationshipVersion,
      establishmentVersionId:establishmentVersion,
      assignmentStart:from,
      assignmentEnd:to||undefined
    });
  }
  return <form className="form-grid lifecycle-form" onSubmit={event=>void submit(event)}>
    <h3>{title}</h3>
    {requireIdentity&&<label>Assignment number<input required value={number} onChange={event=>setNumber(event.target.value)}/></label>}
    <label>Relationship version ID<input required value={relationshipVersion} onChange={event=>setRelationshipVersion(event.target.value)}/></label>
    <label>Establishment version ID<input required value={establishmentVersion} onChange={event=>setEstablishmentVersion(event.target.value)}/></label>
    <label>Assignment start<input required type="date" value={from} onChange={event=>setFrom(event.target.value)}/></label>
    <label>Assignment end<input type="date" value={to} onChange={event=>setTo(event.target.value)}/></label>
    <button type="submit">{submitLabel}</button>
  </form>;
}

function PayGroupAssignmentPanel({assignment,items,permissions,onCreate,onCorrect,onApprove,onEndDate}:{
  assignment:PayrollAssignmentView;items:PayGroupAssignmentView[];permissions:Set<string>;
  onCreate:(input:PayGroupAssignmentWrite)=>Promise<void>;
  onCorrect:(item:PayGroupAssignmentView,input:PayGroupAssignmentWrite)=>Promise<void>;
  onApprove:(item:PayGroupAssignmentView)=>Promise<void>;
  onEndDate:(item:PayGroupAssignmentView,value:string)=>Promise<void>;
}){
  return <AssignmentConfigurationPanel title="Pay-group assignments">
    {items.length===0&&<p>No pay-group assignments exist for this assignment version.</p>}
    {items.map(item=><ConfigurationItem key={item.id} label={item.payGroupVersionId} from={item.effectiveFrom} to={item.effectiveTo} status={item.superseded?'SUPERSEDED':item.approvalStatus}>
      {item.approvalStatus==='DRAFT'&&permissions.has('employee-payroll.pay-group-assignment.approve')&&<button onClick={()=>void onApprove(item)}>Approve</button>}
      {permissions.has('employee-payroll.pay-group-assignment.end-date')&&<InlineEndDate label="End-date pay-group assignment" initial={item.effectiveTo} onSubmit={value=>onEndDate(item,value)}/>}
      {item.approvalStatus==='DRAFT'&&!item.superseded&&item.effectiveFrom>today()&&permissions.has('employee-payroll.pay-group-assignment.correct')&&<details>
        <summary>Correct future draft</summary>
        <PayGroupAssignmentEditor assignment={assignment} initial={item} submitLabel="Correct pay-group assignment" onSubmit={input=>onCorrect(item,input)}/>
      </details>}
    </ConfigurationItem>)}
    {permissions.has('employee-payroll.pay-group-assignment.create')&&<PayGroupAssignmentEditor assignment={assignment} submitLabel="Create pay-group assignment draft" onSubmit={onCreate}/>}
  </AssignmentConfigurationPanel>;
}

function PayGroupAssignmentEditor({assignment,initial,submitLabel,onSubmit}:{assignment:PayrollAssignmentView;initial?:PayGroupAssignmentView;submitLabel:string;onSubmit:(input:PayGroupAssignmentWrite)=>Promise<void>}){
  const [versionId,setVersionId]=useState(initial?.payGroupVersionId??'');
  const [from,setFrom]=useState(initial?.effectiveFrom??assignment.assignmentStart);
  const [to,setTo]=useState(initial?.effectiveTo??assignment.assignmentEnd??'');
  async function submit(event:FormEvent){event.preventDefault();await onSubmit({payrollAssignmentVersionId:assignment.versionId,payGroupVersionId:versionId,effectiveFrom:from,effectiveTo:to||undefined})}
  return <form className="form-grid lifecycle-form" onSubmit={event=>void submit(event)}>
    <h4>Assign pay group</h4>
    <label>Pay-group version ID<input required value={versionId} onChange={event=>setVersionId(event.target.value)}/></label>
    <label>Effective from<input required type="date" value={from} onChange={event=>setFrom(event.target.value)}/></label>
    <label>Effective to<input type="date" value={to} onChange={event=>setTo(event.target.value)}/></label>
    <button type="submit">{submitLabel}</button>
  </form>;
}

function SalaryAssignmentPanel({assignment,items,permissions,onCreate,onCorrect,onApprove,onEndDate}:{
  assignment:PayrollAssignmentView;items:SalaryAssignmentView[];permissions:Set<string>;
  onCreate:(input:SalaryAssignmentWrite)=>Promise<void>;
  onCorrect:(item:SalaryAssignmentView,input:SalaryAssignmentWrite)=>Promise<void>;
  onApprove:(item:SalaryAssignmentView)=>Promise<void>;
  onEndDate:(item:SalaryAssignmentView,value:string)=>Promise<void>;
}){
  return <AssignmentConfigurationPanel title="Salary assignments">
    {items.length===0&&<p>No salary assignments exist for this assignment version.</p>}
    {items.map(item=><ConfigurationItem key={item.id} label={`${item.salaryStructureVersionId} · INR ${item.monthlyAmount}`} from={item.effectiveFrom} to={item.effectiveTo} status={item.superseded?'SUPERSEDED':item.approvalStatus}>
      {item.approvalStatus==='DRAFT'&&permissions.has('employee-payroll.salary-assignment.approve')&&<button onClick={()=>void onApprove(item)}>Approve</button>}
      {permissions.has('employee-payroll.salary-assignment.end-date')&&<InlineEndDate label="End-date salary assignment" initial={item.effectiveTo} onSubmit={value=>onEndDate(item,value)}/>}
      {item.approvalStatus==='DRAFT'&&!item.superseded&&item.effectiveFrom>today()&&permissions.has('employee-payroll.salary-assignment.correct')&&<details>
        <summary>Correct future draft</summary>
        <SalaryAssignmentEditor assignment={assignment} initial={item} submitLabel="Correct salary assignment" onSubmit={input=>onCorrect(item,input)}/>
      </details>}
    </ConfigurationItem>)}
    {permissions.has('employee-payroll.salary-assignment.create')&&<SalaryAssignmentEditor assignment={assignment} submitLabel="Create salary assignment draft" onSubmit={onCreate}/>}
  </AssignmentConfigurationPanel>;
}

function SalaryAssignmentEditor({assignment,initial,submitLabel,onSubmit}:{assignment:PayrollAssignmentView;initial?:SalaryAssignmentView;submitLabel:string;onSubmit:(input:SalaryAssignmentWrite)=>Promise<void>}){
  const [structureVersion,setStructureVersion]=useState(initial?.salaryStructureVersionId??'');
  const [amount,setAmount]=useState(initial?String(initial.monthlyAmount):'');
  const [from,setFrom]=useState(initial?.effectiveFrom??assignment.assignmentStart);
  const [to,setTo]=useState(initial?.effectiveTo??assignment.assignmentEnd??'');
  async function submit(event:FormEvent){
    event.preventDefault();
    await onSubmit({payrollAssignmentVersionId:assignment.versionId,salaryStructureVersionId:structureVersion,monthlyAmount:Number(amount),currency:'INR',effectiveFrom:from,effectiveTo:to||undefined});
  }
  return <form className="form-grid lifecycle-form" onSubmit={event=>void submit(event)}>
    <h4>Assign salary</h4>
    <label>Salary-structure version ID<input required value={structureVersion} onChange={event=>setStructureVersion(event.target.value)}/></label>
    <label>Monthly amount<input required type="number" min="0" step="0.0001" value={amount} onChange={event=>setAmount(event.target.value)}/></label>
    <label>Currency<input value="INR" readOnly/></label>
    <label>Effective from<input required type="date" value={from} onChange={event=>setFrom(event.target.value)}/></label>
    <label>Effective to<input type="date" value={to} onChange={event=>setTo(event.target.value)}/></label>
    <button type="submit">{submitLabel}</button>
  </form>;
}

function AssignmentConfigurationPanel({title,children}:{title:string;children:ReactNode}){
  return <section className="card"><h3>{title}</h3>{children}</section>;
}

function ConfigurationItem({label,from,to,status,children}:{label:string;from:string;to:string|null;status:string;children:ReactNode}){
  return <article className="configuration-item">
    <div><strong>{label}</strong><small>{from} to {to??'open'}</small></div>
    <StatusBadge value={status}/>
    <div className="configuration-actions">{children}</div>
  </article>;
}

function InlineEndDate({label,initial,onSubmit}:{label:string;initial:string|null;onSubmit:(value:string)=>Promise<void>}){
  const [value,setValue]=useState(initial??'');
  return <form className="inline-form" aria-label={label} onSubmit={event=>{event.preventDefault();void onSubmit(value)}}>
    <input aria-label={`${label} date`} required type="date" value={value} onChange={event=>setValue(event.target.value)}/>
    <button type="submit">End-date</button>
  </form>;
}

function StatusBadge({value}:{value:string}){
  return <span className={`badge ${value.toLowerCase().replaceAll('_','-')}`}>{value.replaceAll('_',' ')}</span>;
}
