import {FormEvent,useCallback,useEffect,useMemo,useState} from 'react';
import {currentPermissions} from '../organisation/organisation-api';
import {httpPayGroupApi,PayGroupApi,PayGroupVersion,PayGroupWrite} from './pay-group-api';

type Props={api?:PayGroupApi;permissions?:Set<string>};

const today=()=>new Date().toISOString().slice(0,10);

export function PayGroupPage({api=httpPayGroupApi,permissions}:Props){
  const effectivePermissions=useMemo(()=>permissions??currentPermissions(),[permissions]);
  const [asOf,setAsOf]=useState(today);
  const [groups,setGroups]=useState<PayGroupVersion[]>([]);
  const [history,setHistory]=useState<PayGroupVersion[]>([]);
  const [selected,setSelected]=useState<PayGroupVersion|null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const canRead=effectivePermissions.has('pay-group.read');
  const canCreate=effectivePermissions.has('pay-group.create');

  const load=useCallback(async()=>{
    if(!canRead)return;
    setLoading(true);setError('');
    try{setGroups(await api.list(asOf));}
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
    try{await api.create(input);await load()}
    catch(e){setError((e as Error).message)}
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
