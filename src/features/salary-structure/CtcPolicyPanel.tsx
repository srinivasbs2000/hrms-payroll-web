import {useEffect,useState} from 'react';
import type {FormEvent} from 'react';
import type {CompensationConfigurationApi,CtcPolicyCreate,CtcPolicyVersion,SalaryStructureComponentOption} from './salary-structure-api';
const views=['OFFERED','TARGET','ACCRUED','ACTUAL_EMPLOYER_COST'] as const;
export function CtcPolicyPanel({api,permissions,asOf,components}:{api:CompensationConfigurationApi;permissions:Set<string>;asOf:string;components:SalaryStructureComponentOption[]}){
 const [items,setItems]=useState<CtcPolicyVersion[]>([]);const [history,setHistory]=useState<CtcPolicyVersion[]>([]);const [error,setError]=useState('');
 const canRead=permissions.has('compensation.ctc-policy.read');
 useEffect(()=>{if(!canRead)return;void api.ctcList(asOf).then(setItems).catch(value=>setError((value as Error).message))},[api,asOf,canRead]);
 async function select(item:CtcPolicyVersion){setError('');try{setHistory(await api.ctcHistory(item.identityId))}catch(value){setError((value as Error).message)}}
 async function create(input:CtcPolicyCreate){setError('');try{await api.ctcCreate(input);setItems(await api.ctcList(asOf))}catch(value){setError((value as Error).message)}}
 async function approve(item:CtcPolicyVersion){setError('');try{await api.ctcApprove(item.identityId,item.versionId);setHistory(await api.ctcHistory(item.identityId))}catch(value){setError((value as Error).message)}}
 if(!canRead)return <section className="configuration-panel"><h3>CTC policies</h3><p role="alert">You do not have permission to view CTC policies.</p></section>;
 return <section className="configuration-panel" aria-labelledby="ctc-panel-title"><div className="section-heading"><div><p className="eyebrow">Cost views</p><h3 id="ctc-panel-title">CTC policies</h3></div><span className="count-badge">{items.length}</span></div>{error&&<p className="error" role="alert">{error}</p>}
  <div className="configuration-list">{items.length===0?<p>No approved CTC policies effective on {asOf}.</p>:items.map(item=><button className="configuration-button" key={item.versionId} onClick={()=>void select(item)}><strong>{item.code}</strong><span>{item.name}</span><small>{item.annualisationMethod} · residual {item.residualComponentCode}</small></button>)}</div>
  {permissions.has('compensation.ctc-policy.create')&&<CtcEditor components={components} submit={create}/>}
  {history.length>0&&<ol className="compact-timeline">{history.map(item=><li key={item.versionId}><span><strong>v{item.versionSequence} {item.name}</strong><small>{item.approvalStatus} · {item.treatments.length} treatments</small></span>{item.approvalStatus==='DRAFT'&&permissions.has('compensation.ctc-policy.approve')&&<button onClick={()=>void approve(item)}>Approve CTC policy</button>}</li>)}</ol>}
 </section>;
}
function CtcEditor({components,submit}:{components:SalaryStructureComponentOption[];submit:(input:CtcPolicyCreate)=>Promise<void>}){
 const [code,setCode]=useState('');const [name,setName]=useState('');const [componentVersionId,setComponentVersionId]=useState('');const [effectiveFrom,setEffectiveFrom]=useState(new Date().toISOString().slice(0,10));
 async function save(event:FormEvent){event.preventDefault();const component=components.find(value=>value.versionId===componentVersionId);if(!component)return;await submit({code,version:{name,currency:'INR',annualisationMethod:'MONTHLY_X_12',toleranceAmount:0.01,residualComponentId:component.identityId,residualComponentVersionId:component.versionId,effectiveFrom,treatments:views.map((costView,index)=>({componentId:component.identityId,componentVersionId:component.versionId,treatmentSequence:index+1,costView,treatmentType:'INFORMATIONAL'}))}})}
 return <form className="panel-form" onSubmit={event=>void save(event)}><h4>Create policy draft</h4><label>CTC policy code<input required value={code} pattern="[A-Z][A-Z0-9_]{1,39}" onChange={event=>setCode(event.target.value.toUpperCase())}/></label><label>CTC policy name<input required value={name} onChange={event=>setName(event.target.value)}/></label><label>Residual component<select required value={componentVersionId} onChange={event=>setComponentVersionId(event.target.value)}><option value="">Select approved component</option>{components.map(item=><option key={item.versionId} value={item.versionId}>{item.code} - {item.name}</option>)}</select></label><label>Policy effective from<input required type="date" value={effectiveFrom} onChange={event=>setEffectiveFrom(event.target.value)}/></label><button type="submit">Create CTC policy draft</button></form>;
}
