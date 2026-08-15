import {FormEvent,useCallback,useEffect,useMemo,useState} from 'react';
import {currentPermissions} from '../organisation/organisation-api';
import {
  httpPayGroupApi,PayGroupApi,PayGroupRoutingReadiness,PayGroupRoutingReadinessQuery,
  PayGroupRoutingRule,PayGroupRoutingRuleWrite,PayGroupVersion,PayGroupWrite
} from './pay-group-api';

type Props={api?:PayGroupApi;permissions?:Set<string>};

const today=()=>new Date().toISOString().slice(0,10);

export function PayGroupPage({api=httpPayGroupApi,permissions}:Props){
  const effectivePermissions=useMemo(()=>permissions??currentPermissions(),[permissions]);
  const [asOf,setAsOf]=useState(today);
  const [groups,setGroups]=useState<PayGroupVersion[]>([]);
  const [history,setHistory]=useState<PayGroupVersion[]>([]);
  const [selected,setSelected]=useState<PayGroupVersion|null>(null);
  const [routingRules,setRoutingRules]=useState<PayGroupRoutingRule[]>([]);
  const [routingReadiness,setRoutingReadiness]=useState<PayGroupRoutingReadiness|null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const canRead=effectivePermissions.has('pay-group.read');
  const canCreate=effectivePermissions.has('pay-group.create');

  const load=useCallback(async()=>{
    if(!canRead)return;
    setLoading(true);setError('');
    try{
      const [effectiveGroups,effectiveRules]=await Promise.all([
        api.list(asOf),api.routingRules(asOf)
      ]);
      setGroups(effectiveGroups);setRoutingRules(effectiveRules);
    }
    catch(e){setError((e as Error).message);}
    finally{setLoading(false)}
  },[api,asOf,canRead]);

  useEffect(()=>{void load()},[load]);

  async function select(item:PayGroupVersion){
    setSelected(item);setError('');
    try{setHistory(await api.history(item.identityId));}
    catch(e){setError((e as Error).message)}
  }

  async function create(input:PayGroupWrite){
    setError('');
    try{
      const result=await api.create(input);
      await select(result);
      await load();
    }catch(e){setError((e as Error).message)}
  }

  async function approve(item:PayGroupVersion){
    setError('');
    try{
      const result=await api.approve(item.identityId,item.versionId);
      await select(result);await load();
    }catch(e){setError((e as Error).message)}
  }

  async function addVersion(item:PayGroupVersion,input:PayGroupWrite){
    setError('');
    try{
      const result=await api.addVersion(item.identityId,input);
      await select(result);await load();
    }catch(e){setError((e as Error).message)}
  }

  async function correct(item:PayGroupVersion,input:PayGroupWrite){
    setError('');
    try{
      const result=await api.correct(item.identityId,item.versionId,input);
      await select(result);await load();
    }catch(e){setError((e as Error).message)}
  }

  async function endDate(item:PayGroupVersion,effectiveTo:string){
    setError('');
    try{
      const result=await api.endDate(
        item.identityId,item.versionId,item.versionNo,effectiveTo);
      await select(result);await load();
    }catch(e){setError((e as Error).message)}
  }

  async function createRoutingRule(input:PayGroupRoutingRuleWrite){
    setError('');
    try{await api.createRoutingRule(input);setRoutingRules(await api.routingRules(asOf));}
    catch(e){setError((e as Error).message)}
  }

  async function endDateRoutingRule(item:PayGroupRoutingRule,effectiveTo:string){
    setError('');
    try{
      await api.endDateRoutingRule(item.id,item.versionNo,effectiveTo);
      setRoutingRules(await api.routingRules(asOf));
    }catch(e){setError((e as Error).message)}
  }

  async function inspectRoutingReadiness(query:PayGroupRoutingReadinessQuery){
    setError('');setRoutingReadiness(null);
    try{setRoutingReadiness(await api.routingReadiness(query))}
    catch(e){setError((e as Error).message)}
  }

  if(!canRead){
    return <section className="card" aria-labelledby="pay-group-title">
      <h2 id="pay-group-title">Pay-group foundation</h2>
      <p role="alert">You do not have permission to view pay groups.</p>
    </section>;
  }

  return <section aria-labelledby="pay-group-title">
    <div className="page-heading">
      <div>
        <p className="eyebrow">Sprint 2 configuration</p>
        <h2 id="pay-group-title">Pay groups</h2>
        <p>Monthly INR payroll groups with immutable effective-dated history.</p>
      </div>
      <label>
        Effective date
        <input
          aria-label="Pay-group effective date"
          type="date"
          value={asOf}
          onChange={event=>setAsOf(event.target.value)}
        />
      </label>
    </div>

    {loading&&<p role="status">Loading pay groups...</p>}
    {error&&<p className="error" role="alert">{error}</p>}

    {!loading&&groups.length===0&&
      <div className="card empty">
        <h3>No approved pay groups</h3>
        <p>Create a draft and approve it to make it effective.</p>
      </div>}

    {groups.length>0&&
      <div className="card">
        <h3>Effective on {asOf}</h3>
        <div className="pay-group-list">
          {groups.map(item=>
            <button
              key={item.versionId}
              className="tree-item"
              onClick={()=>void select(item)}>
              <strong>{item.code}</strong>
              <span>{item.name}</span>
              <small>{item.currency} Â· {item.prorationMethod.replaceAll('_',' ')}</small>
            </button>)}
        </div>
      </div>}

    {canCreate
      ?<CreatePayGroupForm onCreate={create}/>
      :<p className="permission-note">
        Create controls are hidden because <code>pay-group.create</code> is not granted.
      </p>}

    <RoutingWorkspace groups={groups} rules={routingRules} permissions={effectivePermissions}
      onCreate={createRoutingRule} onEndDate={endDateRoutingRule}
      readiness={routingReadiness} onInspectReadiness={inspectRoutingReadiness}/>

    {selected&&
      <PayGroupTimeline
        selected={selected}
        history={history}
        permissions={effectivePermissions}
        onApprove={approve}
        onAddVersion={addVersion}
        onCorrect={correct}
        onEndDate={endDate}
      />}
  </section>;
}

type RoutingWorkspaceProps={
  groups:PayGroupVersion[];
  rules:PayGroupRoutingRule[];
  permissions:Set<string>;
  readiness:PayGroupRoutingReadiness|null;
  onCreate:(input:PayGroupRoutingRuleWrite)=>Promise<void>;
  onEndDate:(item:PayGroupRoutingRule,effectiveTo:string)=>Promise<void>;
  onInspectReadiness:(query:PayGroupRoutingReadinessQuery)=>Promise<void>;
};

function RoutingWorkspace({groups,rules,permissions,readiness,onCreate,onEndDate,onInspectReadiness}:RoutingWorkspaceProps){
  const canCreate=permissions.has('pay-group.create');
  const canEndDate=permissions.has('pay-group.version.end-date');
  return <section className="card" aria-labelledby="routing-title">
    <div className="section-heading"><div><h3 id="routing-title">Assignment routing & readiness</h3>
      <p>Ranked PSU/establishment rules, deterministic resolution and bounded compatibility evidence.</p>
    </div><span className="count-badge">{rules.length} effective rules</span></div>
    <RoutingRuleTable rules={rules} canEndDate={canEndDate} onEndDate={onEndDate}/>
    {canCreate?<RoutingRuleForm groups={groups} onCreate={onCreate}/>:<p className="permission-note">
      Routing-rule creation requires <code>pay-group.create</code>.</p>}
    <RoutingReadinessForm groups={groups} onInspect={onInspectReadiness}/>
    {readiness&&<RoutingReadinessEvidence evidence={readiness}/>}
  </section>;
}

function RoutingRuleTable({rules,canEndDate,onEndDate}:{
  rules:PayGroupRoutingRule[];canEndDate:boolean;
  onEndDate:(item:PayGroupRoutingRule,effectiveTo:string)=>Promise<void>;
}){
  if(rules.length===0)return <p>No routing rules are effective on the selected date.</p>;
  return <div className="table-scroll"><table aria-label="Effective pay-group routing rules">
    <thead><tr><th>Priority</th><th>Pay group</th><th>PSU</th><th>Establishment</th>
      <th>Effective range</th><th>Status/version</th><th>Action</th></tr></thead>
    <tbody>{rules.map(rule=><RoutingRuleRow key={rule.id} rule={rule}
      canEndDate={canEndDate} onEndDate={onEndDate}/>)}</tbody></table></div>;
}

function RoutingRuleRow({rule,canEndDate,onEndDate}:{
  rule:PayGroupRoutingRule;canEndDate:boolean;
  onEndDate:(item:PayGroupRoutingRule,effectiveTo:string)=>Promise<void>;
}){
  const [effectiveTo,setEffectiveTo]=useState(rule.effectiveTo??'');
  return <tr><td>{rule.priority}</td><td><code>{rule.payGroupVersionId}</code></td>
    <td><code>{rule.payrollStatutoryUnitVersionId}</code></td>
    <td>{rule.establishmentVersionId?<code>{rule.establishmentVersionId}</code>:'All establishments'}</td>
    <td>{rule.effectiveFrom} → {rule.effectiveTo??'open'}</td>
    <td>{rule.status} / v{rule.versionNo}</td><td>{canEndDate&&rule.status==='ACTIVE'?
      <form className="inline-form" aria-label={`End-date routing rule ${rule.id}`}
        onSubmit={event=>{event.preventDefault();void onEndDate(rule,effectiveTo)}}>
        <label>End date<input required type="date" value={effectiveTo}
          onChange={event=>setEffectiveTo(event.target.value)}/></label>
        <button type="submit">End-date rule</button>
      </form>:'—'}</td></tr>;
}

function RoutingRuleForm({groups,onCreate}:{groups:PayGroupVersion[];
  onCreate:(input:PayGroupRoutingRuleWrite)=>Promise<void>}){
  const [payGroupVersionId,setPayGroupVersionId]=useState(groups[0]?.versionId??'');
  const [psuVersionId,setPsuVersionId]=useState('');
  const [establishmentVersionId,setEstablishmentVersionId]=useState('');
  const [priority,setPriority]=useState(100);
  const [effectiveFrom,setEffectiveFrom]=useState(today);
  const [effectiveTo,setEffectiveTo]=useState('');
  useEffect(()=>{if(!payGroupVersionId&&groups[0])setPayGroupVersionId(groups[0].versionId)},[groups,payGroupVersionId]);
  return <form className="form-grid lifecycle-form" aria-label="Create pay-group routing rule"
    onSubmit={event=>{event.preventDefault();void onCreate({payGroupVersionId,
      payrollStatutoryUnitVersionId:psuVersionId,
      establishmentVersionId:establishmentVersionId||null,priority,effectiveFrom,
      effectiveTo:effectiveTo||null})}}>
    <h4>Create routing rule</h4>
    <label>Pay group<select required value={payGroupVersionId}
      onChange={event=>setPayGroupVersionId(event.target.value)}>
      <option value="">Select a pay group</option>{groups.map(group=><option key={group.versionId}
        value={group.versionId}>{group.code} — {group.name} (v{group.versionSequence})</option>)}
    </select></label>
    <label>Routing payroll statutory unit version ID<input required value={psuVersionId}
      onChange={event=>setPsuVersionId(event.target.value)}/></label>
    <label>Establishment version ID (optional)<input value={establishmentVersionId}
      onChange={event=>setEstablishmentVersionId(event.target.value)}/></label>
    <label>Priority<input required type="number" min={1} value={priority}
      onChange={event=>setPriority(Number(event.target.value))}/></label>
    <label>Routing effective from<input required type="date" value={effectiveFrom}
      onChange={event=>setEffectiveFrom(event.target.value)}/></label>
    <label>Routing effective to<input type="date" value={effectiveTo}
      onChange={event=>setEffectiveTo(event.target.value)}/></label>
    <button type="submit">Create routing rule</button>
  </form>;
}

function RoutingReadinessForm({groups,onInspect}:{groups:PayGroupVersion[];
  onInspect:(query:PayGroupRoutingReadinessQuery)=>Promise<void>}){
  const [assignmentVersionId,setAssignmentVersionId]=useState('');
  const [payGroupVersionId,setPayGroupVersionId]=useState(groups[0]?.versionId??'');
  const [effectiveFrom,setEffectiveFrom]=useState(today);
  const [effectiveTo,setEffectiveTo]=useState(()=>{
    const value=new Date();value.setUTCDate(value.getUTCDate()+1);return value.toISOString().slice(0,10);
  });
  useEffect(()=>{if(!payGroupVersionId&&groups[0])setPayGroupVersionId(groups[0].versionId)},[groups,payGroupVersionId]);
  return <form className="form-grid lifecycle-form" aria-label="Inspect routing readiness"
    onSubmit={event=>{event.preventDefault();void onInspect({payrollAssignmentVersionId:assignmentVersionId,
      payGroupVersionId,effectiveFrom,effectiveTo})}}>
    <h4>Inspect bounded routing readiness</h4>
    <label>Payroll assignment version ID<input required value={assignmentVersionId}
      onChange={event=>setAssignmentVersionId(event.target.value)}/></label>
    <label>Requested pay group<select required value={payGroupVersionId}
      onChange={event=>setPayGroupVersionId(event.target.value)}>
      <option value="">Select a pay group</option>{groups.map(group=><option key={group.versionId}
        value={group.versionId}>{group.code} — {group.name}</option>)}</select></label>
    <label>Readiness effective from<input required type="date" value={effectiveFrom}
      onChange={event=>setEffectiveFrom(event.target.value)}/></label>
    <label>Readiness effective to<input required type="date" value={effectiveTo}
      onChange={event=>setEffectiveTo(event.target.value)}/></label>
    <button type="submit">Inspect routing readiness</button>
  </form>;
}

function RoutingReadinessEvidence({evidence}:{evidence:PayGroupRoutingReadiness}){
  return <section className="readiness-evidence" aria-labelledby="routing-readiness-title">
    <div className="section-heading"><h4 id="routing-readiness-title">Routing readiness evidence</h4>
      <span className={`badge ${evidence.ready?'approved':'draft'}`}>{evidence.ready?'READY':'BLOCKED'}</span></div>
    <div className="action-summary"><span>Compatible: {yesNo(evidence.compatible)}</span>
      <span>Interval covered: {yesNo(evidence.routingCoverageComplete)}</span>
      <span>Requested group matched: {yesNo(evidence.routingMatchesRequestedPayGroup)}</span>
      <span>Calendar: {evidence.calendarFrequency??'unresolved'} / {evidence.calendarTimezone??'unresolved'}</span>
      <span>Resolution at start: {evidence.resolutionAtEffectiveFrom?.resolutionSource??'unresolved'}</span></div>
    {evidence.issues.length>0&&<ul aria-label="Routing compatibility blockers">{evidence.issues.map(issue=><li
      key={`${issue.issueCode}:${issue.issueDetail}`}><strong>{issue.issueCode}</strong>: {issue.issueDetail}</li>)}</ul>}
    <div className="table-scroll"><table aria-label="Routing resolution checkpoints"><thead><tr>
      <th>As of</th><th>Resolved pay group</th><th>Source</th><th>Rule</th><th>Match</th></tr></thead>
      <tbody>{evidence.resolutionCheckpoints.map(checkpoint=><tr key={`${checkpoint.asOf}:${checkpoint.routingRuleId??'none'}`}>
        <td>{checkpoint.asOf}</td><td>{checkpoint.payGroupVersionId??'Unresolved'}</td>
        <td>{checkpoint.resolutionSource??'Unresolved'}</td><td>{checkpoint.routingRuleId??'—'}</td>
        <td>{yesNo(checkpoint.matchesRequestedPayGroup)}</td></tr>)}</tbody></table></div>
  </section>;
}

const yesNo=(value:boolean)=>value?'Yes':'No';

function CreatePayGroupForm({onCreate}:{onCreate:(input:PayGroupWrite)=>Promise<void>}){
  const [code,setCode]=useState('');
  const [name,setName]=useState('');
  const [psuVersionId,setPsuVersionId]=useState('');
  const [calendarId,setCalendarId]=useState('');
  const [from,setFrom]=useState(today);
  const [to,setTo]=useState('');

  async function submit(event:FormEvent){
    event.preventDefault();
    await onCreate({
      code,
      name,
      payrollStatutoryUnitVersionId:psuVersionId,
      calendarId,
      currency:'INR',
      prorationMethod:'CALENDAR_DAYS',
      effectiveFrom:from,
      effectiveTo:to||undefined
    });
    setCode('');setName('');
  }

  return <form className="card form-grid" onSubmit={event=>void submit(event)}>
    <h3>Create pay-group identity</h3>
    <label>
      Code
      <input
        required
        pattern="[A-Z][A-Z0-9_]{1,39}"
        value={code}
        onChange={event=>setCode(event.target.value.toUpperCase())}
      />
    </label>
    <label>
      Name
      <input required value={name} onChange={event=>setName(event.target.value)}/>
    </label>
    <label>
      PSU version ID
      <input
        required
        aria-label="Payroll statutory unit version ID"
        value={psuVersionId}
        onChange={event=>setPsuVersionId(event.target.value)}
      />
    </label>
    <label>
      Calendar ID
      <input
        required
        value={calendarId}
        onChange={event=>setCalendarId(event.target.value)}
      />
    </label>
    <label>
      Currency
      <input value="INR" readOnly/>
    </label>
    <label>
      Proration method
      <input value="CALENDAR_DAYS" readOnly/>
    </label>
    <label>
      Effective from
      <input
        required
        type="date"
        value={from}
        onChange={event=>setFrom(event.target.value)}
      />
    </label>
    <label>
      Effective to
      <input type="date" value={to} onChange={event=>setTo(event.target.value)}/>
    </label>
    <button type="submit">Create pay-group draft</button>
  </form>;
}

type TimelineProps={
  selected:PayGroupVersion;
  history:PayGroupVersion[];
  permissions:Set<string>;
  onApprove:(version:PayGroupVersion)=>Promise<void>;
  onAddVersion:(version:PayGroupVersion,input:PayGroupWrite)=>Promise<void>;
  onCorrect:(version:PayGroupVersion,input:PayGroupWrite)=>Promise<void>;
  onEndDate:(version:PayGroupVersion,effectiveTo:string)=>Promise<void>;
};

function PayGroupTimeline({
  selected,history,permissions,onApprove,onAddVersion,onCorrect,onEndDate
}:TimelineProps){
  const [name,setName]=useState(selected.name);
  const [psuVersionId,setPsuVersionId]=useState(selected.payrollStatutoryUnitVersionId);
  const [calendarId,setCalendarId]=useState(selected.calendarId);
  const [from,setFrom]=useState(selected.effectiveFrom);
  const [to,setTo]=useState(selected.effectiveTo??'');

  useEffect(()=>{
    setName(selected.name);
    setPsuVersionId(selected.payrollStatutoryUnitVersionId);
    setCalendarId(selected.calendarId);
    setFrom(selected.effectiveFrom);
    setTo(selected.effectiveTo??'');
  },[selected]);

  const input:PayGroupWrite={
    name,
    payrollStatutoryUnitVersionId:psuVersionId,
    calendarId,
    currency:'INR',
    prorationMethod:'CALENDAR_DAYS',
    effectiveFrom:from,
    effectiveTo:to||undefined
  };

  return <section className="card" aria-labelledby="pay-group-history-title">
    <div className="section-heading">
      <h3 id="pay-group-history-title">{selected.code} version timeline</h3>
      <span className={`badge ${selected.approvalStatus.toLowerCase()}`}>
        {selected.approvalStatus}
      </span>
    </div>

    {history.length===0
      ?<p role="status">Loading pay-group version history...</p>
      :<ol className="timeline">
        {history.map(item=>
          <li key={item.versionId}>
            <strong>Version {item.versionSequence}: {item.name}</strong>
            <span>{item.effectiveFrom} to {item.effectiveTo??'open'}</span>
            <span>{item.superseded?'Superseded':item.approvalStatus}</span>
            {item.approvalStatus==='DRAFT'
              &&permissions.has('pay-group.approve')
              &&<button onClick={()=>void onApprove(item)}>Approve</button>}
          </li>)}
      </ol>}

    {(permissions.has('pay-group.version.create')
      ||permissions.has('pay-group.version.correct'))&&
      <form
        className="form-grid lifecycle-form"
        onSubmit={event=>event.preventDefault()}
        aria-label="Pay-group version lifecycle">
        <label>
          Version name
          <input required value={name} onChange={event=>setName(event.target.value)}/>
        </label>
        <label>
          PSU version ID
          <input
            required
            aria-label="Version PSU version ID"
            value={psuVersionId}
            onChange={event=>setPsuVersionId(event.target.value)}
          />
        </label>
        <label>
          Calendar ID
          <input
            required
            aria-label="Version calendar ID"
            value={calendarId}
            onChange={event=>setCalendarId(event.target.value)}
          />
        </label>
        <label>
          Version effective from
          <input
            required
            type="date"
            value={from}
            onChange={event=>setFrom(event.target.value)}
          />
        </label>
        <label>
          Version effective to
          <input type="date" value={to} onChange={event=>setTo(event.target.value)}/>
        </label>
        <div className="button-row">
          {permissions.has('pay-group.version.create')&&
            <button type="button" onClick={()=>void onAddVersion(selected,input)}>
              Add version
            </button>}
          {selected.approvalStatus==='DRAFT'
            &&permissions.has('pay-group.version.correct')
            &&<button type="button" onClick={()=>void onCorrect(selected,input)}>
              Correct future draft
            </button>}
        </div>
      </form>}

    {permissions.has('pay-group.version.end-date')&&
      <form
        className="form-grid lifecycle-form"
        onSubmit={event=>{event.preventDefault();void onEndDate(selected,to)}}
        aria-label="End-date pay-group version">
        <label>
          End date
          <input
            required
            type="date"
            value={to}
            onChange={event=>setTo(event.target.value)}
          />
        </label>
        <button type="submit">End-date pay-group version</button>
      </form>}

    <div className="action-summary" aria-label="Available pay-group permissions">
      <span>Add version: {permissions.has('pay-group.version.create')?'allowed':'not allowed'}</span>
      <span>Correct future: {permissions.has('pay-group.version.correct')?'allowed':'not allowed'}</span>
      <span>End-date: {permissions.has('pay-group.version.end-date')?'allowed':'not allowed'}</span>
    </div>
  </section>;
}
