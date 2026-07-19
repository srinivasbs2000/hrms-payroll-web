import {FormEvent,useCallback,useEffect,useMemo,useState} from 'react';
import {currentPermissions,HierarchyNode,httpOrganisationApi,OrganisationApi,OrganisationVersion,OrganisationWrite} from './organisation-api';

type Props={api?:OrganisationApi;permissions?:Set<string>};
const collections={LEGAL_ENTITY:'legal-entities',PAYROLL_STATUTORY_UNIT:'payroll-statutory-units',ESTABLISHMENT:'establishments'} as const;

export function SetupPage({api=httpOrganisationApi,permissions}:Props){
  const effectivePermissions=useMemo(()=>permissions??currentPermissions(),[permissions]);
  const [asOf,setAsOf]=useState(()=>new Date().toISOString().slice(0,10));
  const [hierarchy,setHierarchy]=useState<Awaited<ReturnType<OrganisationApi['hierarchy']>>|null>(null);
  const [history,setHistory]=useState<OrganisationVersion[]>([]);
  const [selected,setSelected]=useState<OrganisationVersion|null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const canRead=effectivePermissions.has('organisation.read');
  const canCreate=effectivePermissions.has('organisation.create');

  const load=useCallback(async()=>{
    if(!canRead)return;
    setLoading(true);setError('');
    try{setHierarchy(await api.hierarchy(asOf));}catch(e){setError((e as Error).message);}finally{setLoading(false)}
  },[api,asOf,canRead]);
  useEffect(()=>{void load()},[load]);

  async function select(item:OrganisationVersion){setSelected(item);setError('');try{setHistory(await api.history(collections[item.kind],item.identityId));}catch(e){setError((e as Error).message)}}
  async function create(kind:keyof typeof collections,input:OrganisationWrite){setError('');try{await api.create(collections[kind],input);await load()}catch(e){setError((e as Error).message)}}
  async function approve(item:OrganisationVersion){setError('');try{const result=await api.approve(collections[item.kind],item.identityId,item.versionId);await select(result);await load()}catch(e){setError((e as Error).message)}}
  async function addVersion(item:OrganisationVersion,input:OrganisationWrite){setError('');try{const result=await api.addVersion(collections[item.kind],item.identityId,input);await select(result);await load()}catch(e){setError((e as Error).message)}}
  async function correct(item:OrganisationVersion,input:OrganisationWrite){setError('');try{const result=await api.correct(collections[item.kind],item.identityId,item.versionId,input);await select(result);await load()}catch(e){setError((e as Error).message)}}
  async function endDate(item:OrganisationVersion,effectiveTo:string){setError('');try{const result=await api.endDate(collections[item.kind],item.identityId,item.versionId,item.versionNo,effectiveTo);await select(result);await load()}catch(e){setError((e as Error).message)}}

  if(!canRead)return <section className="card" aria-labelledby="org-title"><h2 id="org-title">Organisation foundation</h2><p role="alert">You do not have permission to view organisation data.</p></section>;
  return <section aria-labelledby="org-title">
    <div className="page-heading"><div><p className="eyebrow">Sprint 1 foundation</p><h2 id="org-title">Organisation hierarchy</h2><p>Stable identities with immutable, effective-dated version history.</p></div><label>Effective date<input aria-label="Effective date" type="date" value={asOf} onChange={event=>setAsOf(event.target.value)}/></label></div>
    {loading&&<p role="status">Loading organisation hierarchy...</p>}{error&&<p className="error" role="alert">{error}</p>}
    {!loading&&hierarchy?.legalEntities.length===0&&<div className="card empty"><h3>No organisation configured</h3><p>Create the first legal entity to begin the hierarchy.</p></div>}
    {hierarchy&&hierarchy.legalEntities.length>0&&<div className="card"><h3>Effective on {hierarchy.asOf}</h3><ul className="tree">{hierarchy.legalEntities.map(node=><TreeNode key={node.value.versionId} node={node} onSelect={select}/>)}</ul></div>}
    {canCreate?<OrganisationForms hierarchy={hierarchy} onCreate={create}/>:<p className="permission-note">Create controls are hidden because <code>organisation.create</code> is not granted.</p>}
    {selected&&<VersionTimeline selected={selected} history={history} permissions={effectivePermissions} onApprove={approve} onAddVersion={addVersion} onCorrect={correct} onEndDate={endDate}/>}
  </section>
}

function TreeNode({node,onSelect}:{node:HierarchyNode;onSelect:(version:OrganisationVersion)=>void}){
  return <li><button className="tree-item" onClick={()=>void onSelect(node.value)}><strong>{node.value.code}</strong><span>{node.value.name}</span><small>{node.value.kind.replaceAll('_',' ')}</small></button>{node.children.length>0&&<ul>{node.children.map(child=><TreeNode key={child.value.versionId} node={child} onSelect={onSelect}/>)}</ul>}</li>
}

function OrganisationForms({hierarchy,onCreate}:{hierarchy:Awaited<ReturnType<OrganisationApi['hierarchy']>>|null;onCreate:(kind:keyof typeof collections,input:OrganisationWrite)=>Promise<void>}){
  const [kind,setKind]=useState<keyof typeof collections>('LEGAL_ENTITY');
  const [name,setName]=useState('');const [code,setCode]=useState('');const [parent,setParent]=useState('');const [state,setState]=useState('KA');const [from,setFrom]=useState(()=>new Date().toISOString().slice(0,10));
  const parents=useMemo(()=>kind==='PAYROLL_STATUTORY_UNIT'?hierarchy?.legalEntities.map(node=>node.value)??[]:kind==='ESTABLISHMENT'?hierarchy?.legalEntities.flatMap(node=>node.children.map(child=>child.value))??[]:[],[hierarchy,kind]);
  async function submit(event:FormEvent){event.preventDefault();await onCreate(kind,{code,name,effectiveFrom:from,parentVersionId:parent||undefined,stateCode:kind==='ESTABLISHMENT'?state:undefined,countryCode:kind==='LEGAL_ENTITY'?'IN':undefined,currency:kind==='LEGAL_ENTITY'?'INR':undefined});setName('');setCode('')}
  return <form className="card form-grid" onSubmit={event=>void submit(event)}><h3>Create organisation identity</h3><label>Type<select value={kind} onChange={event=>{setKind(event.target.value as keyof typeof collections);setParent('')}}><option value="LEGAL_ENTITY">Legal entity</option><option value="PAYROLL_STATUTORY_UNIT">Payroll statutory unit</option><option value="ESTABLISHMENT">Establishment</option></select></label><label>Code<input required pattern="[A-Z][A-Z0-9_]{1,39}" value={code} onChange={event=>setCode(event.target.value.toUpperCase())}/></label><label>Name<input required value={name} onChange={event=>setName(event.target.value)}/></label>{kind!=='LEGAL_ENTITY'&&<label>Parent version<select required value={parent} onChange={event=>setParent(event.target.value)}><option value="">Select parent</option>{parents.map(item=><option key={item.versionId} value={item.versionId}>{item.code} - {item.name}</option>)}</select></label>}{kind==='ESTABLISHMENT'&&<label>State code<input required value={state} onChange={event=>setState(event.target.value.toUpperCase())}/></label>}<label>Effective from<input required type="date" value={from} onChange={event=>setFrom(event.target.value)}/></label><button type="submit">Create draft</button></form>
}

type TimelineProps={
  selected:OrganisationVersion;history:OrganisationVersion[];permissions:Set<string>;
  onApprove:(version:OrganisationVersion)=>Promise<void>;
  onAddVersion:(version:OrganisationVersion,input:OrganisationWrite)=>Promise<void>;
  onCorrect:(version:OrganisationVersion,input:OrganisationWrite)=>Promise<void>;
  onEndDate:(version:OrganisationVersion,effectiveTo:string)=>Promise<void>;
};

function VersionTimeline({selected,history,permissions,onApprove,onAddVersion,onCorrect,onEndDate}:TimelineProps){
  const [name,setName]=useState(selected.name);const [from,setFrom]=useState(selected.effectiveFrom);const [to,setTo]=useState(selected.effectiveTo??'');
  useEffect(()=>{setName(selected.name);setFrom(selected.effectiveFrom);setTo(selected.effectiveTo??'')},[selected]);
  const input:OrganisationWrite={name,effectiveFrom:from,effectiveTo:to||undefined,countryCode:selected.countryCode??undefined,currency:selected.currency??undefined,stateCode:selected.stateCode??undefined,parentVersionId:selected.parentVersionId??undefined};
  return <section className="card" aria-labelledby="history-title">
    <div className="section-heading"><h3 id="history-title">{selected.code} version timeline</h3><span className={`badge ${selected.approvalStatus.toLowerCase()}`}>{selected.approvalStatus}</span></div>
    {history.length===0?<p role="status">Loading version history...</p>:<ol className="timeline">{history.map(item=><li key={item.versionId}><strong>Version {item.versionSequence}: {item.name}</strong><span>{item.effectiveFrom} to {item.effectiveTo??'open'}</span><span>{item.superseded?'Superseded':item.approvalStatus}</span>{item.approvalStatus==='DRAFT'&&permissions.has('organisation.approve')&&<button onClick={()=>void onApprove(item)}>Approve</button>}</li>)}</ol>}
    {(permissions.has('organisation.version.create')||permissions.has('organisation.version.correct'))&&<form className="form-grid lifecycle-form" onSubmit={event=>event.preventDefault()} aria-label="Version lifecycle"><label>Version name<input required value={name} onChange={event=>setName(event.target.value)}/></label><label>Version effective from<input required type="date" value={from} onChange={event=>setFrom(event.target.value)}/></label><label>Version effective to<input type="date" value={to} onChange={event=>setTo(event.target.value)}/></label><div className="button-row">{permissions.has('organisation.version.create')&&<button type="button" onClick={()=>void onAddVersion(selected,input)}>Add version</button>}{selected.approvalStatus==='DRAFT'&&permissions.has('organisation.version.correct')&&<button type="button" onClick={()=>void onCorrect(selected,input)}>Correct future draft</button>}</div></form>}
    {permissions.has('organisation.version.end-date')&&<form className="form-grid lifecycle-form" onSubmit={event=>{event.preventDefault();void onEndDate(selected,to)}} aria-label="End-date version"><label>End date<input required type="date" value={to} onChange={event=>setTo(event.target.value)}/></label><button type="submit">End-date active version</button></form>}
    <div className="action-summary" aria-label="Available lifecycle permissions"><span>Add version: {permissions.has('organisation.version.create')?'allowed':'not allowed'}</span><span>Correct future: {permissions.has('organisation.version.correct')?'allowed':'not allowed'}</span><span>End-date: {permissions.has('organisation.version.end-date')?'allowed':'not allowed'}</span></div>
  </section>
}
