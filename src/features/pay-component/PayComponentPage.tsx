import {FormEvent,useCallback,useEffect,useMemo,useState} from 'react';
import {currentPermissions} from '../organisation/organisation-api';
import {
  ComponentCategory,
  ComponentType,
  FormulaType,
  httpPayComponentApi,
  PayComponentApi,
  PayComponentCreate,
  PayComponentVersion,
  PayComponentVersionWrite
} from './pay-component-api';

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
  async function execute(work:()=>Promise<PayComponentVersion>){
    setError('');
    try{const result=await work();await select(result);await load()}
    catch(value){setError((value as Error).message)}
  }

  if(!canRead)return <section className="card" aria-labelledby="pay-component-title">
    <h2 id="pay-component-title">Pay-component catalogue</h2>
    <p role="alert">You do not have permission to view pay components.</p>
  </section>;

  return <section aria-labelledby="pay-component-title">
    <div className="page-heading">
      <div><p className="eyebrow">P5-A2 compensation configuration</p><h2 id="pay-component-title">Pay-component catalogue</h2>
        <p>Stable calculation direction plus complete, effective-dated business behaviour.</p></div>
      <label>Effective date<input aria-label="Pay-component effective date" type="date" value={asOf} onChange={event=>setAsOf(event.target.value)}/></label>
    </div>
    {loading&&<p role="status">Loading pay components...</p>}
    {error&&<p className="error" role="alert">{error}</p>}
    {!loading&&items.length===0&&<div className="card empty"><h3>No approved pay components</h3><p>Create a complete draft and use an independent checker to approve it.</p></div>}
    {items.length>0&&<div className="card"><h3>Effective on {asOf}</h3><div className="pay-group-list">
      {items.map(item=><button key={item.versionId} className="tree-item" onClick={()=>void select(item)}>
        <strong>{item.code}</strong><span>{item.name}</span><small>{item.componentType.toLowerCase()} · {item.componentCategory?.replaceAll('_',' ').toLowerCase()??'legacy classification'}</small>
      </button>)}</div></div>}
    {canCreate?<CreateForm onCreate={input=>execute(()=>api.create(input))}/>:<p className="permission-note">Create controls require <code>compensation.component.create</code>.</p>}
    {selected&&<Timeline
      selected={selected}
      history={history}
      permissions={effectivePermissions}
      onApprove={item=>execute(()=>api.approve(item.identityId,item.versionId))}
      onAddVersion={(item,input)=>execute(()=>api.addVersion(item.identityId,input))}
      onCorrect={(item,input)=>execute(()=>api.correct(item.identityId,item.versionId,input))}
      onEndDate={(item,effectiveTo)=>execute(()=>api.endDate(item.identityId,item.versionId,item.versionNo,effectiveTo))}
      onRetire={(item,effectiveDate,reason)=>execute(()=>api.retire(item.identityId,item.identityVersionNo,effectiveDate,reason))}
    />}
  </section>;
}

function CreateForm({onCreate}:{onCreate:(input:PayComponentCreate)=>Promise<void>}){
  const [code,setCode]=useState('');const [name,setName]=useState('');
  const [componentType,setComponentType]=useState<ComponentType>('EARNING');
  const [countryCode,setCountryCode]=useState('');
  const [classification,setClassification]=useState<VersionFormState>(()=>defaultVersion('EARNING'));
  function changeType(next:ComponentType){setComponentType(next);setClassification(state=>({...state,...classificationDefaults(next)}))}
  async function submit(event:FormEvent){
    event.preventDefault();
    await onCreate({
      code,name,componentType,ownershipScope:'TENANT',countryCode:countryCode||undefined,
      protectedFlag:false,confidentialityLevel:'STANDARD',version:buildVersion(classification)
    });
    setCode('');setName('');
  }
  return <form className="card form-grid catalogue-form" onSubmit={event=>void submit(event)}>
    <h3>Create complete pay-component draft</h3>
    <label>Code<input required pattern="[A-Z][A-Z0-9_]{1,39}" value={code} onChange={event=>setCode(event.target.value.toUpperCase())}/></label>
    <label>Name<input required value={name} onChange={event=>setName(event.target.value)}/></label>
    <label>Component type<select value={componentType} onChange={event=>changeType(event.target.value as ComponentType)}>
      <option value="EARNING">Earning</option><option value="DEDUCTION">Deduction</option><option value="INFORMATION">Information</option>
    </select></label>
    <label>Country owner (optional)<input aria-label="Country owner" pattern="[A-Z]{2}" maxLength={2} value={countryCode} onChange={event=>setCountryCode(event.target.value.toUpperCase())}/></label>
    <VersionFields state={classification} setState={setClassification}/>
    <button type="submit">Create complete component draft</button>
  </form>;
}

type VersionFormState={
  formulaType:FormulaType;value:string;roundingScale:string;componentCategory:ComponentCategory;
  componentSubcategory:string;cashImpact:PayComponentVersionWrite['cashImpact'];
  payeeType:PayComponentVersionWrite['payeeType'];paymentChannel:PayComponentVersionWrite['paymentChannel'];
  settlementTiming:PayComponentVersionWrite['settlementTiming'];payslipVisibility:PayComponentVersionWrite['payslipVisibility'];
  zeroValueVisibility:PayComponentVersionWrite['zeroValueVisibility'];negativeValuePolicy:PayComponentVersionWrite['negativeValuePolicy'];
  frequency:PayComponentVersionWrite['frequency'];valueNature:PayComponentVersionWrite['valueNature'];
  amountRepresentation:PayComponentVersionWrite['amountRepresentation'];taxTreatment:PayComponentVersionWrite['taxTreatment'];
  payrollTiming:PayComponentVersionWrite['payrollTiming'];effectiveFrom:string;effectiveTo:string;
};

function classificationDefaults(type:ComponentType):Pick<VersionFormState,'componentCategory'|'cashImpact'|'payeeType'|'paymentChannel'> {
  if(type==='DEDUCTION')return {componentCategory:'EMPLOYEE_DEDUCTION',cashImpact:'DECREASE',payeeType:'AUTHORITY',paymentChannel:'STATUTORY_REMITTANCE'};
  if(type==='INFORMATION')return {componentCategory:'NOTIONAL',cashImpact:'NONE',payeeType:'NONE',paymentChannel:'NONE'};
  return {componentCategory:'CASH_EARNING',cashImpact:'INCREASE',payeeType:'EMPLOYEE',paymentChannel:'PAYROLL_BANK'};
}
function defaultVersion(type:ComponentType):VersionFormState{return {
  formulaType:'FIXED',value:'',roundingScale:'2',componentSubcategory:'',
  ...classificationDefaults(type),settlementTiming:'CURRENT_PERIOD',payslipVisibility:'SHOW',
  zeroValueVisibility:'SUPPRESS',negativeValuePolicy:'PROHIBIT',frequency:'MONTHLY',
  valueNature:'FIXED',amountRepresentation:'MONTHLY_AMOUNT',taxTreatment:'DELEGATED',
  payrollTiming:'REGULAR',effectiveFrom:today(),effectiveTo:''
}}
function stateFrom(item:PayComponentVersion):VersionFormState{return {
  formulaType:item.formulaType,value:item.formulaType==='FIXED'?String(item.fixedAmount??''):item.formulaExpression??'',
  roundingScale:String(item.roundingScale),componentCategory:item.componentCategory??classificationDefaults(item.componentType).componentCategory,
  componentSubcategory:item.componentSubcategory??'',cashImpact:item.cashImpact??classificationDefaults(item.componentType).cashImpact,
  payeeType:item.payeeType??classificationDefaults(item.componentType).payeeType,
  paymentChannel:item.paymentChannel??classificationDefaults(item.componentType).paymentChannel,
  settlementTiming:item.settlementTiming??'CURRENT_PERIOD',payslipVisibility:item.payslipVisibility??'SHOW',
  zeroValueVisibility:item.zeroValueVisibility??'SUPPRESS',negativeValuePolicy:item.negativeValuePolicy??'PROHIBIT',
  frequency:item.frequency??'MONTHLY',valueNature:item.valueNature??'FIXED',
  amountRepresentation:item.amountRepresentation??'MONTHLY_AMOUNT',taxTreatment:item.taxTreatment??'DELEGATED',
  payrollTiming:item.payrollTiming??'REGULAR',effectiveFrom:item.effectiveFrom,effectiveTo:item.effectiveTo??''
}}
function buildVersion(state:VersionFormState):PayComponentVersionWrite{
  const result:PayComponentVersionWrite={
    formulaType:state.formulaType,roundingScale:Number(state.roundingScale),componentCategory:state.componentCategory,
    componentSubcategory:state.componentSubcategory||undefined,cashImpact:state.cashImpact,payeeType:state.payeeType,
    paymentChannel:state.paymentChannel,settlementTiming:state.settlementTiming,payslipVisibility:state.payslipVisibility,
    zeroValueVisibility:state.zeroValueVisibility,negativeValuePolicy:state.negativeValuePolicy,frequency:state.frequency,
    valueNature:state.valueNature,amountRepresentation:state.amountRepresentation,taxTreatment:state.taxTreatment,
    payrollTiming:state.payrollTiming,effectiveFrom:state.effectiveFrom,effectiveTo:state.effectiveTo||undefined
  };
  if(state.formulaType==='FIXED')result.fixedAmount=Number(state.value);else result.formulaExpression=state.value;
  return result;
}

function VersionFields({state,setState,prefix=''}:{state:VersionFormState;setState:(next:VersionFormState)=>void;prefix?:string}){
  const update=<K extends keyof VersionFormState>(key:K,value:VersionFormState[K])=>setState({...state,[key]:value});
  const valueLabel=state.formulaType==='FIXED'?`${prefix}Fixed amount`.trim():`${prefix}Formula expression`.trim();
  return <>
    <label>{prefix}Formula type<select aria-label={`${prefix}Formula type`.trim()} value={state.formulaType} onChange={event=>update('formulaType',event.target.value as FormulaType)}>
      <option value="FIXED">Fixed</option><option value="PERCENTAGE_OF_COMPONENT">Percentage of component</option><option value="RESIDUAL">Residual</option>
    </select></label>
    <label>{valueLabel}<input required aria-label={valueLabel} type={state.formulaType==='FIXED'?'number':'text'} min={state.formulaType==='FIXED'?'0':undefined} step={state.formulaType==='FIXED'?'0.0001':undefined} value={state.value} onChange={event=>update('value',event.target.value)}/></label>
    <label>{prefix}Rounding scale<input required aria-label={`${prefix}Rounding scale`.trim()} type="number" min="0" max="4" value={state.roundingScale} onChange={event=>update('roundingScale',event.target.value)}/></label>
    <label>{prefix}Business category<select aria-label={`${prefix}Business category`.trim()} value={state.componentCategory} onChange={event=>update('componentCategory',event.target.value as ComponentCategory)}>
      {['CASH_EARNING','EMPLOYEE_DEDUCTION','EMPLOYER_CONTRIBUTION','EMPLOYER_PROVISION','REIMBURSEMENT','BENEFIT','TAXABLE_PERQUISITE','NOTIONAL','ACCRUAL'].map(value=><option key={value}>{value}</option>)}
    </select></label>
    <label>{prefix}Subcategory<input aria-label={`${prefix}Subcategory`.trim()} pattern="[A-Z][A-Z0-9_]{1,59}" value={state.componentSubcategory} onChange={event=>update('componentSubcategory',event.target.value.toUpperCase())}/></label>
    <label>{prefix}Cash impact<select aria-label={`${prefix}Cash impact`.trim()} value={state.cashImpact} onChange={event=>update('cashImpact',event.target.value as VersionFormState['cashImpact'])}>{['INCREASE','DECREASE','NONE'].map(v=><option key={v}>{v}</option>)}</select></label>
    <label>{prefix}Payee<select aria-label={`${prefix}Payee`.trim()} value={state.payeeType} onChange={event=>update('payeeType',event.target.value as VersionFormState['payeeType'])}>{['EMPLOYEE','AUTHORITY','LENDER','BENEFIT_PROVIDER','INTERNAL','NONE'].map(v=><option key={v}>{v}</option>)}</select></label>
    <label>{prefix}Payment channel<select aria-label={`${prefix}Payment channel`.trim()} value={state.paymentChannel} onChange={event=>update('paymentChannel',event.target.value as VersionFormState['paymentChannel'])}>{['PAYROLL_BANK','SEPARATE_BANK','VENDOR','STATUTORY_REMITTANCE','NONE'].map(v=><option key={v}>{v}</option>)}</select></label>
    <label>{prefix}Settlement timing<select aria-label={`${prefix}Settlement timing`.trim()} value={state.settlementTiming} onChange={event=>update('settlementTiming',event.target.value as VersionFormState['settlementTiming'])}>{['CURRENT_PERIOD','DEFERRED','ACCRUAL','EXIT','ANNUAL','NONE'].map(v=><option key={v}>{v}</option>)}</select></label>
    <label>{prefix}Payslip visibility<select aria-label={`${prefix}Payslip visibility`.trim()} value={state.payslipVisibility} onChange={event=>update('payslipVisibility',event.target.value as VersionFormState['payslipVisibility'])}>{['SHOW','SUMMARISE','HIDE','CONDITIONAL'].map(v=><option key={v}>{v}</option>)}</select></label>
    <label>{prefix}Zero-value visibility<select aria-label={`${prefix}Zero-value visibility`.trim()} value={state.zeroValueVisibility} onChange={event=>update('zeroValueVisibility',event.target.value as VersionFormState['zeroValueVisibility'])}>{['SHOW','SUPPRESS'].map(v=><option key={v}>{v}</option>)}</select></label>
    <label>{prefix}Negative-value policy<select aria-label={`${prefix}Negative-value policy`.trim()} value={state.negativeValuePolicy} onChange={event=>update('negativeValuePolicy',event.target.value as VersionFormState['negativeValuePolicy'])}>{['ALLOW','PROHIBIT','REVERSAL_ONLY'].map(v=><option key={v}>{v}</option>)}</select></label>
    <label>{prefix}Frequency<select aria-label={`${prefix}Frequency`.trim()} value={state.frequency} onChange={event=>update('frequency',event.target.value as VersionFormState['frequency'])}>{['PER_PAYROLL_PERIOD','MONTHLY','WEEKLY','DAILY','ANNUAL','ONE_TIME','EVENT_DRIVEN','AD_HOC','ON_EXIT','ON_JOINING','ON_CONFIRMATION','ON_ANNIVERSARY'].map(v=><option key={v}>{v}</option>)}</select></label>
    <label>{prefix}Value nature<select aria-label={`${prefix}Value nature`.trim()} value={state.valueNature} onChange={event=>update('valueNature',event.target.value as VersionFormState['valueNature'])}>{['FIXED','VARIABLE','DERIVED','EXTERNAL_INPUT','EMPLOYEE_ELECTION','EMPLOYER_DISCRETION','STATUTORY','BALANCE_RECOVERY','PROVISION','NOTIONAL'].map(v=><option key={v}>{v}</option>)}</select></label>
    <label>{prefix}Amount representation<select aria-label={`${prefix}Amount representation`.trim()} value={state.amountRepresentation} onChange={event=>update('amountRepresentation',event.target.value as VersionFormState['amountRepresentation'])}>{['ANNUAL_AMOUNT','MONTHLY_AMOUNT','DAILY_RATE','HOURLY_RATE','PER_UNIT_RATE','PERCENTAGE','SLAB','QUANTITY_RATE','FORMULA_RESULT','EXTERNAL_VALUE'].map(v=><option key={v}>{v}</option>)}</select></label>
    <label>{prefix}Tax treatment<select aria-label={`${prefix}Tax treatment`.trim()} value={state.taxTreatment} onChange={event=>update('taxTreatment',event.target.value as VersionFormState['taxTreatment'])}>{['DELEGATED','TAXABLE','EXEMPT','PARTIALLY_EXEMPT','PROOF_DEPENDENT','REGIME_DEPENDENT','PERQUISITE','REIMBURSEMENT','TAX_ONLY_NOTIONAL'].map(v=><option key={v}>{v}</option>)}</select></label>
    <label>{prefix}Payroll timing<select aria-label={`${prefix}Payroll timing`.trim()} value={state.payrollTiming} onChange={event=>update('payrollTiming',event.target.value as VersionFormState['payrollTiming'])}>{['REGULAR','OFF_CYCLE_ONLY','REGULAR_AND_OFF_CYCLE','FINAL_SETTLEMENT_ONLY','ANNUAL','CORRECTION','NON_PAYROLL_REPORTING'].map(v=><option key={v}>{v}</option>)}</select></label>
    <label>{prefix}Effective from<input required aria-label={`${prefix}Effective from`.trim()} type="date" value={state.effectiveFrom} onChange={event=>update('effectiveFrom',event.target.value)}/></label>
    <label>{prefix}Effective to<input aria-label={`${prefix}Effective to`.trim()} type="date" value={state.effectiveTo} onChange={event=>update('effectiveTo',event.target.value)}/></label>
  </>;
}

type TimelineProps={selected:PayComponentVersion;history:PayComponentVersion[];permissions:Set<string>;
  onApprove:(item:PayComponentVersion)=>Promise<void>;onAddVersion:(item:PayComponentVersion,input:PayComponentVersionWrite)=>Promise<void>;
  onCorrect:(item:PayComponentVersion,input:PayComponentVersionWrite)=>Promise<void>;onEndDate:(item:PayComponentVersion,effectiveTo:string)=>Promise<void>;
  onRetire:(item:PayComponentVersion,effectiveDate:string,reason:string)=>Promise<void>};
function Timeline({selected,history,permissions,onApprove,onAddVersion,onCorrect,onEndDate,onRetire}:TimelineProps){
  const [state,setState]=useState(()=>stateFrom(selected));
  const [endDate,setEndDate]=useState(selected.effectiveTo??'');
  const [retirementDate,setRetirementDate]=useState(today);const [retirementReason,setRetirementReason]=useState('');
  useEffect(()=>{setState(stateFrom(selected));setEndDate(selected.effectiveTo??'')},[selected]);
  return <section className="card" aria-labelledby="pay-component-history-title">
    <div className="section-heading"><div><h3 id="pay-component-history-title">{selected.code} version timeline</h3><p>{selected.lifecycleStatus} · {selected.classificationStatus}</p></div><span className={`badge ${selected.approvalStatus.toLowerCase()}`}>{selected.approvalStatus}</span></div>
    {history.length===0?<p role="status">Loading pay-component version history...</p>:<ol className="timeline">{history.map(item=><li key={item.versionId}>
      <strong>Version {item.versionSequence}: {item.formulaType==='FIXED'?`fixed ${item.fixedAmount??0}`:item.formulaType.replaceAll('_',' ').toLowerCase()}</strong>
      <span>{item.effectiveFrom} to {item.effectiveTo??'open'}</span><span>{item.classificationStatus}</span>
      {item.approvalStatus==='DRAFT'&&item.catalogueSchemaVersion===1&&permissions.has('compensation.component.approve')&&<button onClick={()=>void onApprove(item)}>Approve</button>}
    </li>)}</ol>}
    {(permissions.has('compensation.component.version.create')||permissions.has('compensation.component.version.correct'))&&<form className="form-grid lifecycle-form catalogue-form" onSubmit={event=>event.preventDefault()} aria-label="Pay-component version lifecycle">
      <h4>Complete replacement classification</h4><VersionFields state={state} setState={setState} prefix="Version "/>
      <div className="button-row">{permissions.has('compensation.component.version.create')&&<button type="button" onClick={()=>void onAddVersion(selected,buildVersion(state))}>Add version</button>}{selected.approvalStatus==='DRAFT'&&permissions.has('compensation.component.version.correct')&&<button type="button" onClick={()=>void onCorrect(selected,buildVersion(state))}>Correct future draft</button>}</div>
    </form>}
    {permissions.has('compensation.component.version.end-date')&&<form className="form-grid lifecycle-form" onSubmit={event=>{event.preventDefault();void onEndDate(selected,endDate)}} aria-label="End-date pay-component version">
      <label>End date<input required type="date" value={endDate} onChange={event=>setEndDate(event.target.value)}/></label><button type="submit">End-date pay-component version</button>
    </form>}
    {permissions.has('compensation.component.retire')&&selected.lifecycleStatus!=='RETIRED'&&<form className="form-grid lifecycle-form" onSubmit={event=>{event.preventDefault();void onRetire(selected,retirementDate,retirementReason)}} aria-label="Retire pay component">
      <label>Retirement date<input required type="date" value={retirementDate} onChange={event=>setRetirementDate(event.target.value)}/></label>
      <label>Retirement reason<input required maxLength={500} value={retirementReason} onChange={event=>setRetirementReason(event.target.value)}/></label>
      <button type="submit">Retire pay component</button>
    </form>}
  </section>;
}
