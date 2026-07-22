import {FormEvent,useCallback,useEffect,useMemo,useState} from 'react';
import {currentPermissions} from '../organisation/organisation-api';
import {httpPayComponentApi,PayComponentApi,PayComponentVersion,PayComponentWrite} from './pay-component-api';

type Props={api?:PayComponentApi;permissions?:Set<string>};
const today=()=>new Date().toISOString().slice(0,10);

export function PayComponentPage({api=httpPayComponentApi,permissions}:Props){
  const effectivePermissions=useMemo(()=>permissions??currentPermissions(),[permissions]);
  const [asOf,setAsOf]=useState(today);
  const [items,setItems]=useState<PayComponentVersion[]>([]);
  const [history,setHistory]=useState<PayComponentVersion[]>([]);
  const [selected,setSelected]=useState<PayComponentVersion|null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const canRead=effectivePermissions.has('compensation.component.read');
  const canCreate=effectivePermissions.has('compensation.component.create');

  const load=useCallback(async()=>{
    if(!canRead)return;
    setLoading(true);setError('');
    try{setItems(await api.list(asOf))}
    catch(value){setError((value as Error).message)}
    finally{setLoading(false)}
  },[api,asOf,canRead]);

  useEffect(()=>{void load()},[load]);

  async function select(item:PayComponentVersion){
    setSelected(item);setError('');
    try{setHistory(await api.history(item.identityId))}
    catch(value){setError((value as Error).message)}
  }

  async function create(input:PayComponentWrite){
    setError('');
    try{await api.create(input);await load()}
    catch(value){setError((value as Error).message)}
  }

  async function approve(item:PayComponentVersion){
    setError('');
    try{const result=await api.approve(item.identityId,item.versionId);await select(result);await load()}
    catch(value){setError((value as Error).message)}
  }

  async function addVersion(item:PayComponentVersion,input:PayComponentWrite){
    setError('');
    try{const result=await api.addVersion(item.identityId,input);await select(result);await load()}
    catch(value){setError((value as Error).message)}
  }

  async function correct(item:PayComponentVersion,input:PayComponentWrite){
    setError('');
    try{const result=await api.correct(item.identityId,item.versionId,input);await select(result);await load()}
    catch(value){setError((value as Error).message)}
  }

  async function endDate(item:PayComponentVersion,effectiveTo:string){
    setError('');
    try{const result=await api.endDate(item.identityId,item.versionId,item.versionNo,effectiveTo);await select(result);await load()}
    catch(value){setError((value as Error).message)}
  }

  if(!canRead)return <section className="card" aria-labelledby="pay-component-title">
    <h2 id="pay-component-title">Pay-component foundation</h2>
    <p role="alert">You do not have permission to view pay components.</p>
  </section>;

  return <section aria-labelledby="pay-component-title">
    <div className="page-heading">
      <div><p className="eyebrow">Sprint 2 compensation</p><h2 id="pay-component-title">Pay components</h2>
        <p>Effective-dated earning, deduction and informational calculation rules.</p></div>
      <label>Effective date<input aria-label="Pay-component effective date" type="date" value={asOf} onChange={event=>setAsOf(event.target.value)}/></label>
    </div>
    {loading&&<p role="status">Loading pay components...</p>}
    {error&&<p className="error" role="alert">{error}</p>}
    {!loading&&items.length===0&&<div className="card empty"><h3>No approved pay components</h3><p>Create a draft and approve it to make it effective.</p></div>}
    {items.length>0&&<div className="card"><h3>Effective on {asOf}</h3><div className="pay-group-list">
      {items.map(item=><button key={item.versionId} className="tree-item" onClick={()=>void select(item)}>
        <strong>{item.code}</strong><span>{item.name}</span><small>{item.componentType.toLowerCase()} Â· {summary(item)}</small>
      </button>)}</div></div>}
    {canCreate?<CreateForm onCreate={create}/>:<p className="permission-note">Create controls are hidden because <code>compensation.component.create</code> is not granted.</p>}
    {selected&&<Timeline selected={selected} history={history} permissions={effectivePermissions} onApprove={approve} onAddVersion={addVersion} onCorrect={correct} onEndDate={endDate}/>} 
  </section>;
}

function summary(item:PayComponentVersion){
  return item.formulaType==='FIXED'?`fixed ${item.fixedAmount??0}`:item.formulaType.replaceAll('_',' ').toLowerCase();
}

function CreateForm({onCreate}:{onCreate:(input:PayComponentWrite)=>Promise<void>}){
  const [code,setCode]=useState('');const [name,setName]=useState('');
  const [componentType,setComponentType]=useState<PayComponentVersion['componentType']>('EARNING');
  const [formulaType,setFormulaType]=useState<PayComponentVersion['formulaType']>('FIXED');
  const [value,setValue]=useState('');const [scale,setScale]=useState('2');
  const [from,setFrom]=useState(today);const [to,setTo]=useState('');
  async function submit(event:FormEvent){event.preventDefault();await onCreate(build({code,name,componentType,formulaType,value,scale,from,to}));setCode('');setName('');setValue('')}
  return <form className="card form-grid" onSubmit={event=>void submit(event)}><h3>Create pay-component identity</h3>
    <label>Code<input required pattern="[A-Z][A-Z0-9_]{1,39}" value={code} onChange={event=>setCode(event.target.value.toUpperCase())}/></label>
    <label>Name<input required value={name} onChange={event=>setName(event.target.value)}/></label>
    <label>Component type<select value={componentType} onChange={event=>setComponentType(event.target.value as PayComponentVersion['componentType'])}>
      <option value="EARNING">Earning</option><option value="DEDUCTION">Deduction</option><option value="INFORMATION">Information</option>
    </select></label>
    <FormulaFields formulaType={formulaType} value={value} scale={scale} prefix="" onFormulaType={setFormulaType} onValue={setValue} onScale={setScale}/>
    <label>Effective from<input required type="date" value={from} onChange={event=>setFrom(event.target.value)}/></label>
    <label>Effective to<input type="date" value={to} onChange={event=>setTo(event.target.value)}/></label>
    <button type="submit">Create pay-component draft</button>
  </form>;
}

type BuildInput={code?:string;name?:string;componentType?:PayComponentVersion['componentType'];formulaType:PayComponentVersion['formulaType'];value:string;scale:string;from:string;to:string};
function build(input:BuildInput):PayComponentWrite{
  const result:PayComponentWrite={formulaType:input.formulaType,roundingScale:Number(input.scale),effectiveFrom:input.from,effectiveTo:input.to||undefined};
  if(input.code)result.code=input.code;if(input.name)result.name=input.name;if(input.componentType)result.componentType=input.componentType;
  if(input.formulaType==='FIXED')result.fixedAmount=Number(input.value);else result.formulaExpression=input.value;
  return result;
}

type FormulaProps={formulaType:PayComponentVersion['formulaType'];value:string;scale:string;prefix:string;onFormulaType:(value:PayComponentVersion['formulaType'])=>void;onValue:(value:string)=>void;onScale:(value:string)=>void};
function FormulaFields({formulaType,value,scale,prefix,onFormulaType,onValue,onScale}:FormulaProps){
  const valueLabel=formulaType==='FIXED'?`${prefix}Fixed amount`.trim():`${prefix}Formula expression`.trim();
  return <><label>{prefix}Formula type<select aria-label={`${prefix}Formula type`.trim()} value={formulaType} onChange={event=>onFormulaType(event.target.value as PayComponentVersion['formulaType'])}>
    <option value="FIXED">Fixed</option><option value="PERCENTAGE_OF_COMPONENT">Percentage of component</option><option value="RESIDUAL">Residual</option>
  </select></label>
  <label>{valueLabel}<input required aria-label={valueLabel} type={formulaType==='FIXED'?'number':'text'} min={formulaType==='FIXED'?'0':undefined} step={formulaType==='FIXED'?'0.0001':undefined} value={value} onChange={event=>onValue(event.target.value)}/></label>
  <label>{prefix}Rounding scale<input required aria-label={`${prefix}Rounding scale`.trim()} type="number" min="0" max="4" value={scale} onChange={event=>onScale(event.target.value)}/></label></>;
}

type TimelineProps={selected:PayComponentVersion;history:PayComponentVersion[];permissions:Set<string>;onApprove:(item:PayComponentVersion)=>Promise<void>;onAddVersion:(item:PayComponentVersion,input:PayComponentWrite)=>Promise<void>;onCorrect:(item:PayComponentVersion,input:PayComponentWrite)=>Promise<void>;onEndDate:(item:PayComponentVersion,effectiveTo:string)=>Promise<void>};
function Timeline({selected,history,permissions,onApprove,onAddVersion,onCorrect,onEndDate}:TimelineProps){
  const [formulaType,setFormulaType]=useState(selected.formulaType);const [value,setValue]=useState(selected.formulaType==='FIXED'?String(selected.fixedAmount??''):selected.formulaExpression??'');
  const [scale,setScale]=useState(String(selected.roundingScale));const [from,setFrom]=useState(selected.effectiveFrom);const [to,setTo]=useState(selected.effectiveTo??'');
  useEffect(()=>{setFormulaType(selected.formulaType);setValue(selected.formulaType==='FIXED'?String(selected.fixedAmount??''):selected.formulaExpression??'');setScale(String(selected.roundingScale));setFrom(selected.effectiveFrom);setTo(selected.effectiveTo??'')},[selected]);
  const input=build({formulaType,value,scale,from,to});
  return <section className="card" aria-labelledby="pay-component-history-title"><div className="section-heading"><h3 id="pay-component-history-title">{selected.code} version timeline</h3><span className={`badge ${selected.approvalStatus.toLowerCase()}`}>{selected.approvalStatus}</span></div>
    {history.length===0?<p role="status">Loading pay-component version history...</p>:<ol className="timeline">{history.map(item=><li key={item.versionId}><strong>Version {item.versionSequence}: {summary(item)}</strong><span>{item.effectiveFrom} to {item.effectiveTo??'open'}</span><span>{item.superseded?'Superseded':item.approvalStatus}</span>{item.approvalStatus==='DRAFT'&&permissions.has('compensation.component.approve')&&<button onClick={()=>void onApprove(item)}>Approve</button>}</li>)}</ol>}
    {(permissions.has('compensation.component.version.create')||permissions.has('compensation.component.version.correct'))&&<form className="form-grid lifecycle-form" onSubmit={event=>event.preventDefault()} aria-label="Pay-component version lifecycle">
      <FormulaFields formulaType={formulaType} value={value} scale={scale} prefix="Version " onFormulaType={setFormulaType} onValue={setValue} onScale={setScale}/>
      <label>Version effective from<input required type="date" value={from} onChange={event=>setFrom(event.target.value)}/></label>
      <label>Version effective to<input type="date" value={to} onChange={event=>setTo(event.target.value)}/></label>
      <div className="button-row">{permissions.has('compensation.component.version.create')&&<button type="button" onClick={()=>void onAddVersion(selected,input)}>Add version</button>}{selected.approvalStatus==='DRAFT'&&permissions.has('compensation.component.version.correct')&&<button type="button" onClick={()=>void onCorrect(selected,input)}>Correct future draft</button>}</div>
    </form>}
    {permissions.has('compensation.component.version.end-date')&&<form className="form-grid lifecycle-form" onSubmit={event=>{event.preventDefault();void onEndDate(selected,to)}} aria-label="End-date pay-component version"><label>End date<input required type="date" value={to} onChange={event=>setTo(event.target.value)}/></label><button type="submit">End-date pay-component version</button></form>}
  </section>;
}