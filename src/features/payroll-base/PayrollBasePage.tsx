import {FormEvent,useCallback,useEffect,useMemo,useState} from 'react';
import {currentPermissions} from '../organisation/organisation-api';
import {PayComponentVersion} from '../pay-component/pay-component-api';
import {
  ComponentBaseMembership,
  httpPayrollBaseApi,
  MembershipWrite,
  PayrollBaseApi,
  PayrollBaseCreate,
  PayrollBaseVersion,
  PayrollBaseVersionWrite
} from './payroll-base-api';

type Props={api?:PayrollBaseApi;permissions?:Set<string>};
const today=()=>new Date().toISOString().slice(0,10);

export function PayrollBasePage({api=httpPayrollBaseApi,permissions}:Props){
  const effectivePermissions=useMemo(()=>permissions??currentPermissions(),[permissions]);
  const [asOf,setAsOf]=useState(today);
  const [items,setItems]=useState<PayrollBaseVersion[]>([]);
  const [selected,setSelected]=useState<PayrollBaseVersion|null>(null);
  const [history,setHistory]=useState<PayrollBaseVersion[]>([]);
  const [memberships,setMemberships]=useState<ComponentBaseMembership[]>([]);
  const [components,setComponents]=useState<PayComponentVersion[]>([]);
  const [loading,setLoading]=useState(false);const [error,setError]=useState('');
  const canRead=effectivePermissions.has('compensation.base.read');

  const load=useCallback(async()=>{
    if(!canRead)return;
    setLoading(true);setError('');
    try{const [bases,available]=await Promise.all([api.list(asOf),api.components(asOf)]);setItems(bases);setComponents(available)}
    catch(value){setError((value as Error).message)}finally{setLoading(false)}
  },[api,asOf,canRead]);
  useEffect(()=>{void load()},[load]);

  async function select(item:PayrollBaseVersion){
    setSelected(item);setError('');
    try{const [versions,members]=await Promise.all([api.history(item.identityId),api.memberships(item.identityId,asOf,true)]);setHistory(versions);setMemberships(members)}
    catch(value){setError((value as Error).message)}
  }
  async function execute(work:()=>Promise<PayrollBaseVersion>){
    setError('');try{const result=await work();await select(result);await load()}catch(value){setError((value as Error).message)}
  }
  async function executeMembership(work:()=>Promise<ComponentBaseMembership>){
    setError('');try{await work();if(selected)setMemberships(await api.memberships(selected.identityId,asOf,true))}catch(value){setError((value as Error).message)}
  }

  if(!canRead)return <section className="card" aria-labelledby="payroll-base-title"><h2 id="payroll-base-title">Named payroll bases</h2><p role="alert">You do not have permission to view payroll bases.</p></section>;
  return <section aria-labelledby="payroll-base-title">
    <div className="page-heading"><div><p className="eyebrow">P5-A2 compensation configuration</p><h2 id="payroll-base-title">Named payroll bases</h2><p>Versioned base definitions with exact, append-only component membership.</p></div>
      <label>Effective date<input aria-label="Payroll-base effective date" type="date" value={asOf} onChange={event=>setAsOf(event.target.value)}/></label></div>
    {loading&&<p role="status">Loading payroll bases...</p>}{error&&<p className="error" role="alert">{error}</p>}
    {!loading&&items.length===0&&<div className="card empty"><h3>No approved payroll bases</h3><p>Create a draft and approve it through an independent checker.</p></div>}
    {items.length>0&&<div className="card"><h3>Effective bases</h3><div className="pay-group-list">{items.map(item=><button key={item.versionId} className="tree-item" onClick={()=>void select(item)}><strong>{item.code}</strong><span>{item.name}</span><small>{item.baseCategory.toLowerCase()} · {item.aggregationMethod.toLowerCase()}</small></button>)}</div></div>}
    {effectivePermissions.has('compensation.base.create')&&<CreateBaseForm onCreate={input=>execute(()=>api.create(input))}/>}
    {selected&&<BaseWorkspace selected={selected} history={history} memberships={memberships} components={components} permissions={effectivePermissions}
      onApprove={item=>execute(()=>api.approve(item.identityId,item.versionId))}
      onAddVersion={(item,input)=>execute(()=>api.addVersion(item.identityId,input))}
      onCorrect={(item,input)=>execute(()=>api.correct(item.identityId,item.versionId,input))}
      onEndDate={(item,date)=>execute(()=>api.endDate(item.identityId,item.versionId,item.versionNo,date))}
      onRetire={(item,date,reason)=>execute(()=>api.retire(item.identityId,item.identityVersionNo,date,reason))}
      onCreateMembership={input=>executeMembership(()=>api.createMembership(selected.identityId,input))}
      onCorrectMembership={(membership,input)=>executeMembership(()=>api.correctMembership(selected.identityId,membership.membershipId,input))}
      onApproveMembership={membership=>executeMembership(()=>api.approveMembership(selected.identityId,membership.membershipId))}
      onEndDateMembership={(membership,date)=>executeMembership(()=>api.endDateMembership(selected.identityId,membership.membershipId,membership.versionNo,date))}
    />}
  </section>;
}

function CreateBaseForm({onCreate}:{onCreate:(input:PayrollBaseCreate)=>Promise<void>}){
  const [code,setCode]=useState('');const [name,setName]=useState('');const [country,setCountry]=useState('');
  const [state,setState]=useState<VersionState>(()=>defaultVersion());
  async function submit(event:FormEvent){event.preventDefault();await onCreate({code,name,countryCode:country||undefined,ownershipScope:'TENANT',confidentialityLevel:'STANDARD',version:buildVersion(state)});setCode('');setName('')}
  return <form className="card form-grid" onSubmit={event=>void submit(event)}><h3>Create payroll-base draft</h3>
    <label>Base code<input required pattern="[A-Z][A-Z0-9_]{1,59}" value={code} onChange={event=>setCode(event.target.value.toUpperCase())}/></label>
    <label>Base name<input required value={name} onChange={event=>setName(event.target.value)}/></label>
    <label>Country owner (optional)<input pattern="[A-Z]{2}" maxLength={2} value={country} onChange={event=>setCountry(event.target.value.toUpperCase())}/></label>
    <BaseVersionFields state={state} setState={setState}/><button type="submit">Create payroll-base draft</button>
  </form>;
}

type VersionState={baseCategory:PayrollBaseVersion['baseCategory'];aggregationMethod:PayrollBaseVersion['aggregationMethod'];description:string;effectiveFrom:string;effectiveTo:string};
const defaultVersion=():VersionState=>({baseCategory:'CALCULATION',aggregationMethod:'SUM',description:'',effectiveFrom:today(),effectiveTo:''});
const fromVersion=(item:PayrollBaseVersion):VersionState=>({baseCategory:item.baseCategory,aggregationMethod:item.aggregationMethod,description:item.description??'',effectiveFrom:item.effectiveFrom,effectiveTo:item.effectiveTo??''});
const buildVersion=(state:VersionState):PayrollBaseVersionWrite=>({baseCategory:state.baseCategory,aggregationMethod:state.aggregationMethod,description:state.description||undefined,effectiveFrom:state.effectiveFrom,effectiveTo:state.effectiveTo||undefined});
function BaseVersionFields({state,setState,prefix=''}:{state:VersionState;setState:(state:VersionState)=>void;prefix?:string}){
  const update=<K extends keyof VersionState>(key:K,value:VersionState[K])=>setState({...state,[key]:value});
  return <><label>{prefix}Base category<select aria-label={`${prefix}Base category`.trim()} value={state.baseCategory} onChange={event=>update('baseCategory',event.target.value as VersionState['baseCategory'])}>{['CALCULATION','STATUTORY','TAX','CTC','REPORTING'].map(v=><option key={v}>{v}</option>)}</select></label>
    <label>{prefix}Aggregation method<select aria-label={`${prefix}Aggregation method`.trim()} value={state.aggregationMethod} onChange={event=>update('aggregationMethod',event.target.value as VersionState['aggregationMethod'])}>{['SUM','AVERAGE','MAXIMUM','MINIMUM','CUSTOM'].map(v=><option key={v}>{v}</option>)}</select></label>
    <label>{prefix}Description<input aria-label={`${prefix}Description`.trim()} maxLength={1000} value={state.description} onChange={event=>update('description',event.target.value)}/></label>
    <label>{prefix}Effective from<input required aria-label={`${prefix}Effective from`.trim()} type="date" value={state.effectiveFrom} onChange={event=>update('effectiveFrom',event.target.value)}/></label>
    <label>{prefix}Effective to<input aria-label={`${prefix}Effective to`.trim()} type="date" value={state.effectiveTo} onChange={event=>update('effectiveTo',event.target.value)}/></label></>;
}

type WorkspaceProps={selected:PayrollBaseVersion;history:PayrollBaseVersion[];memberships:ComponentBaseMembership[];components:PayComponentVersion[];permissions:Set<string>;
  onApprove:(item:PayrollBaseVersion)=>Promise<void>;onAddVersion:(item:PayrollBaseVersion,input:PayrollBaseVersionWrite)=>Promise<void>;
  onCorrect:(item:PayrollBaseVersion,input:PayrollBaseVersionWrite)=>Promise<void>;onEndDate:(item:PayrollBaseVersion,date:string)=>Promise<void>;
  onRetire:(item:PayrollBaseVersion,date:string,reason:string)=>Promise<void>;onCreateMembership:(input:MembershipWrite)=>Promise<void>;
  onCorrectMembership:(membership:ComponentBaseMembership,input:MembershipWrite)=>Promise<void>;onApproveMembership:(membership:ComponentBaseMembership)=>Promise<void>;
  onEndDateMembership:(membership:ComponentBaseMembership,date:string)=>Promise<void>};
function BaseWorkspace(props:WorkspaceProps){
  const {selected,history,memberships,components,permissions}=props;
  const [state,setState]=useState(()=>fromVersion(selected));const [endDate,setEndDate]=useState(selected.effectiveTo??'');
  const [retireDate,setRetireDate]=useState(today);const [reason,setReason]=useState('');
  useEffect(()=>{setState(fromVersion(selected));setEndDate(selected.effectiveTo??'')},[selected]);
  return <>
    <section className="card"><div className="section-heading"><div><h3>{selected.code} definition history</h3><p>{selected.lifecycleStatus} · schema {selected.catalogueSchemaVersion}</p></div><span className={`badge ${selected.approvalStatus.toLowerCase()}`}>{selected.approvalStatus}</span></div>
      <ol className="timeline">{history.map(item=><li key={item.versionId}><strong>Version {item.versionSequence}: {item.baseCategory}</strong><span>{item.effectiveFrom} to {item.effectiveTo??'open'}</span><span>{item.aggregationMethod}</span>{item.approvalStatus==='DRAFT'&&permissions.has('compensation.base.approve')&&<button onClick={()=>void props.onApprove(item)}>Approve</button>}</li>)}</ol>
      {(permissions.has('compensation.base.version.create')||permissions.has('compensation.base.version.correct'))&&<form className="form-grid lifecycle-form" onSubmit={event=>event.preventDefault()}><h4>Base version</h4><BaseVersionFields state={state} setState={setState} prefix="Version "/><div className="button-row">{permissions.has('compensation.base.version.create')&&<button type="button" onClick={()=>void props.onAddVersion(selected,buildVersion(state))}>Add base version</button>}{selected.approvalStatus==='DRAFT'&&permissions.has('compensation.base.version.correct')&&<button type="button" onClick={()=>void props.onCorrect(selected,buildVersion(state))}>Correct future base draft</button>}</div></form>}
      {permissions.has('compensation.base.version.end-date')&&<form className="form-grid lifecycle-form" onSubmit={event=>{event.preventDefault();void props.onEndDate(selected,endDate)}}><label>Base version end date<input required type="date" value={endDate} onChange={event=>setEndDate(event.target.value)}/></label><button type="submit">End-date base version</button></form>}
      {permissions.has('compensation.base.retire')&&selected.lifecycleStatus!=='RETIRED'&&<form className="form-grid lifecycle-form" onSubmit={event=>{event.preventDefault();void props.onRetire(selected,retireDate,reason)}}><label>Base retirement date<input required type="date" value={retireDate} onChange={event=>setRetireDate(event.target.value)}/></label><label>Base retirement reason<input required maxLength={500} value={reason} onChange={event=>setReason(event.target.value)}/></label><button type="submit">Retire payroll base</button></form>}
    </section>
    <MembershipWorkspace base={selected} memberships={memberships} components={components} permissions={permissions} onCreate={props.onCreateMembership} onCorrect={props.onCorrectMembership} onApprove={props.onApproveMembership} onEndDate={props.onEndDateMembership}/>
  </>;
}

function MembershipWorkspace({base,memberships,components,permissions,onCreate,onCorrect,onApprove,onEndDate}:{base:PayrollBaseVersion;memberships:ComponentBaseMembership[];components:PayComponentVersion[];permissions:Set<string>;onCreate:(input:MembershipWrite)=>Promise<void>;onCorrect:(membership:ComponentBaseMembership,input:MembershipWrite)=>Promise<void>;onApprove:(membership:ComponentBaseMembership)=>Promise<void>;onEndDate:(membership:ComponentBaseMembership,date:string)=>Promise<void>}){
  const [componentVersionId,setComponentVersionId]=useState(components[0]?.versionId??'');const [type,setType]=useState<MembershipWrite['membershipType']>('INCLUDE');const [percent,setPercent]=useState('100.00000000');const [from,setFrom]=useState(base.effectiveFrom);const [to,setTo]=useState(base.effectiveTo??'');
  useEffect(()=>{if(!components.some(component=>component.versionId===componentVersionId))setComponentVersionId(components[0]?.versionId??'')},[components,componentVersionId]);
  const component=components.find(item=>item.versionId===componentVersionId);
  const input=():MembershipWrite=>({payrollBaseVersionId:base.versionId,componentId:component?.identityId??'',componentVersionId,membershipType:type,inclusionPercent:percent,effectiveFrom:from,effectiveTo:to||undefined});
  return <section className="card"><div className="section-heading"><div><h3>Exact component membership</h3><p>Percentages remain decimal strings with eight fractional digits.</p></div><span className="count-badge">{memberships.length} records</span></div>
    {memberships.length===0?<p className="empty compact">No component memberships.</p>:<div className="table-scroll"><table><thead><tr><th>Component</th><th>Base version</th><th>Type</th><th>Percent</th><th>Range</th><th>Status</th><th>Actions</th></tr></thead><tbody>{memberships.map(membership=><tr key={membership.membershipId}><td>{membership.componentCode} v{membership.componentVersionSequence}</td><td>v{membership.payrollBaseVersionSequence}</td><td>{membership.membershipType}</td><td>{membership.inclusionPercent}</td><td>{membership.effectiveFrom}–{membership.effectiveTo??'open'}</td><td>{membership.superseded?'SUPERSEDED':membership.approvalStatus}</td><td><div className="button-row">{membership.approvalStatus==='DRAFT'&&permissions.has('compensation.base.membership.approve')&&<button onClick={()=>void onApprove(membership)}>Approve</button>}{membership.approvalStatus==='DRAFT'&&permissions.has('compensation.base.membership.correct')&&<button onClick={()=>void onCorrect(membership,input())}>Correct</button>}{permissions.has('compensation.base.membership.end-date')&&<button onClick={()=>void onEndDate(membership,to)}>End-date</button>}</div></td></tr>)}</tbody></table></div>}
    {permissions.has('compensation.base.membership.create')&&<form className="form-grid lifecycle-form" onSubmit={event=>{event.preventDefault();void onCreate(input())}}><h4>Add exact membership</h4>
      <label>Component version<select aria-label="Membership component version" required value={componentVersionId} onChange={event=>setComponentVersionId(event.target.value)}>{components.map(item=><option key={item.versionId} value={item.versionId}>{item.code} · v{item.versionSequence}</option>)}</select></label>
      <label>Membership type<select value={type} onChange={event=>setType(event.target.value as MembershipWrite['membershipType'])}>{['INCLUDE','EXCLUDE','ADD_BACK','ELIGIBILITY_ONLY','CONTRIBUTION_ONLY','NOTIONAL'].map(value=><option key={value}>{value}</option>)}</select></label>
      <label>Inclusion percent<input required inputMode="decimal" pattern="(100([.]0{1,8})?|[1-9][0-9]?([.][0-9]{1,8})?|0[.](?=[0-9]{0,7}[1-9])[0-9]{1,8})" value={percent} onChange={event=>setPercent(event.target.value)}/></label>
      <label>Membership effective from<input required type="date" value={from} onChange={event=>setFrom(event.target.value)}/></label><label>Membership effective to<input type="date" value={to} onChange={event=>setTo(event.target.value)}/></label>
      <button type="submit" disabled={!component}>Create membership draft</button></form>}
  </section>;
}
