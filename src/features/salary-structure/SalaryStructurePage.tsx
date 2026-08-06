import {useCallback,useEffect,useMemo,useState} from 'react';
import type {FormEvent} from 'react';
import {currentPermissions} from '../organisation/organisation-api';
import {CtcPolicyPanel} from './CtcPolicyPanel';
import {EligibilityRulePanel} from './EligibilityRulePanel';
import {SalaryStructureSimulationPanel} from './SalaryStructureSimulationPanel';
import {httpCompensationConfigurationApi} from './salary-structure-api';
import type {
  CompensationConfigurationApi,CtcPolicyVersion,EligibilityRuleVersion,
  OverridePolicy,SalaryLineType,SalaryStructureComponentOption,
  SalaryStructureLineView,SalaryStructureVersion,SalaryStructureWrite
} from './salary-structure-api';

type Props={api?:CompensationConfigurationApi;permissions?:Set<string>};
type Tab='STRUCTURES'|'CTC'|'ELIGIBILITY';
type DraftLine={
  key:string;componentVersionId:string;lineType:SalaryLineType;value:string;
  baseCode:string;minimumAmount:string;maximumAmount:string;mandatory:boolean;
  overridePolicy:OverridePolicy;ctcDisplayOrder:number;payslipDisplayOrder:number;
};
type EditorAction={label:string;run:(input:SalaryStructureWrite)=>Promise<void>};
let sequence=0;
const today=()=>new Date().toISOString().slice(0,10);
const newLine=(type:SalaryLineType):DraftLine=>({
  key:`line-${++sequence}`,componentVersionId:'',lineType:type,value:'',baseCode:'',
  minimumAmount:'',maximumAmount:'',mandatory:true,overridePolicy:'CONTROLLED',
  ctcDisplayOrder:sequence,payslipDisplayOrder:sequence
});

export function SalaryStructurePage({api=httpCompensationConfigurationApi,permissions}:Props){
  const granted=useMemo(()=>permissions??currentPermissions(),[permissions]);
  const [tab,setTab]=useState<Tab>('STRUCTURES');
  const [asOf,setAsOf]=useState(today());
  const [items,setItems]=useState<SalaryStructureVersion[]>([]);
  const [history,setHistory]=useState<SalaryStructureVersion[]>([]);
  const [components,setComponents]=useState<SalaryStructureComponentOption[]>([]);
  const [ctc,setCtc]=useState<CtcPolicyVersion[]>([]);
  const [rules,setRules]=useState<EligibilityRuleVersion[]>([]);
  const [selected,setSelected]=useState<SalaryStructureVersion|null>(null);
  const [endDateValue,setEndDateValue]=useState('');
  const [error,setError]=useState('');
  const canRead=granted.has('compensation.structure.read');

  const load=useCallback(async()=>{
    if(!canRead)return;
    setError('');
    try{
      const [structures,componentOptions,policies,eligibility]=await Promise.all([
        api.listStructures(asOf),
        granted.has('compensation.component.read')?api.listComponents(asOf):Promise.resolve([]),
        granted.has('compensation.ctc-policy.read')?api.ctcList(asOf):Promise.resolve([]),
        granted.has('compensation.eligibility-rule.read')?api.eligibilityList(asOf):Promise.resolve([])
      ]);
      setItems(structures);
      setComponents(componentOptions.filter(item=>
        item.approvalStatus===undefined||item.approvalStatus==='APPROVED'));
      setCtc(policies);
      setRules(eligibility);
    }catch(value){setError((value as Error).message)}
  },[api,asOf,canRead,granted]);

  useEffect(()=>{void load()},[load]);

  async function select(item:SalaryStructureVersion){
    setSelected(item);setEndDateValue(item.effectiveTo??'');setError('');
    try{setHistory(await api.structureHistory(item.identityId))}
    catch(value){setError((value as Error).message)}
  }
  async function create(input:SalaryStructureWrite){
    setError('');try{const result=await api.createStructure(input);await load();await select(result)}
    catch(value){setError((value as Error).message)}
  }
  async function addVersion(input:SalaryStructureWrite){
    if(!selected)return;setError('');
    try{const result=await api.addStructureVersion(selected.identityId,input);await load();await select(result)}
    catch(value){setError((value as Error).message)}
  }
  async function correct(input:SalaryStructureWrite){
    if(!selected)return;setError('');
    try{const result=await api.correctStructure(selected.identityId,selected.versionId,input);await load();await select(result)}
    catch(value){setError((value as Error).message)}
  }
  async function endDate(event:FormEvent){
    event.preventDefault();if(!selected)return;setError('');
    try{const result=await api.endDateStructure(
      selected.identityId,selected.versionId,selected.versionNo,endDateValue);
      await load();await select(result)}
    catch(value){setError((value as Error).message)}
  }
  async function approve(item:SalaryStructureVersion){
    setError('');try{const result=await api.approveStructure(item.identityId,item.versionId);await load();await select(result)}
    catch(value){setError((value as Error).message)}
  }

  if(!canRead)return <section className="card"><h2>Compensation design</h2>
    <p role="alert">You do not have permission to view salary structures.</p></section>;

  const lifecycleActions:EditorAction[]=[];
  if(selected&&granted.has('compensation.structure.version.create')){
    lifecycleActions.push({label:'Add structure version',run:addVersion});
  }
  if(selected&&selected.approvalStatus==='DRAFT'
      &&granted.has('compensation.structure.version.correct')){
    lifecycleActions.push({label:'Correct future structure draft',run:correct});
  }

  return <section aria-labelledby="salary-structure-title">
    <div className="page-heading"><div><p className="eyebrow">P5-A3 compensation design</p>
      <h2 id="salary-structure-title">Salary structure, CTC and eligibility</h2>
      <p>Version-pinned configuration with deterministic design-time validation.</p></div>
      <label>Effective date<input aria-label="Compensation design effective date" type="date"
        value={asOf} onChange={event=>setAsOf(event.target.value)}/></label></div>
    {error&&<p className="error" role="alert">{error}</p>}
    <div className="workbench-tabs" role="tablist" aria-label="Compensation design sections">
      <button role="tab" aria-selected={tab==='STRUCTURES'} onClick={()=>setTab('STRUCTURES')}>Salary structures</button>
      <button role="tab" aria-selected={tab==='CTC'} onClick={()=>setTab('CTC')}>CTC policies</button>
      <button role="tab" aria-selected={tab==='ELIGIBILITY'} onClick={()=>setTab('ELIGIBILITY')}>Eligibility rules</button>
    </div>
    {tab==='CTC'&&<CtcPolicyPanel api={api} permissions={granted} asOf={asOf} components={components}/>}
    {tab==='ELIGIBILITY'&&<EligibilityRulePanel api={api} permissions={granted} asOf={asOf}/>}
    {tab==='STRUCTURES'&&<>
      <section className="card"><h3>Effective structures</h3>
        {items.length===0?<p>No approved structures effective on {asOf}.</p>:
          <div className="configuration-list">{items.map(item=><button
            className="configuration-button" key={item.versionId} onClick={()=>void select(item)}>
            <strong>{item.code}</strong><span>{item.name}</span>
            <small>{item.targetType} · {item.targetAnnualAmount} INR</small></button>)}</div>}
      </section>
      {granted.has('compensation.structure.create')&&<StructureEditor
        title="Create schema-1 structure draft" requireCode components={components}
        policies={ctc} rules={rules} submitLabel="Create schema-1 structure draft" submit={create}/>}
      {selected&&<section className="card">
        <div className="section-heading"><h3>{selected.code} version timeline</h3>
          <span className={`badge ${selected.approvalStatus.toLowerCase()}`}>{selected.approvalStatus}</span></div>
        <ol className="compact-timeline">{history.map(item=><li key={item.versionId}>
          <span><strong>v{item.versionSequence} {item.name}</strong>
            <small>{item.structureType} · {item.payFrequency} · validation {item.validationFingerprint?'bound':'not bound'}</small></span>
          {item.approvalStatus==='DRAFT'&&item.validationFingerprint
            &&granted.has('compensation.structure.approve')
            &&<button onClick={()=>void approve(item)}>Approve validated structure</button>}
        </li>)}</ol>
        {lifecycleActions.length>0&&<StructureEditor key={selected.versionId}
          title="Salary-structure version lifecycle" initial={selected}
          components={components} policies={ctc} rules={rules} actions={lifecycleActions}/>}
        {granted.has('compensation.structure.version.end-date')&&<form
          className="form-grid lifecycle-form" aria-label="End-date structure version"
          onSubmit={event=>void endDate(event)}><label>Structure end date<input required type="date"
          value={endDateValue} onChange={event=>setEndDateValue(event.target.value)}/></label>
          <button type="submit">End-date structure version</button></form>}
        <SalaryStructureSimulationPanel api={api} permissions={granted} structure={selected}/>
      </section>}
    </>}
  </section>;
}

function StructureEditor({
  title,components,policies,rules,requireCode=false,submitLabel,submit,initial,actions=[]
}:{
  title:string;components:SalaryStructureComponentOption[];policies:CtcPolicyVersion[];
  rules:EligibilityRuleVersion[];requireCode?:boolean;submitLabel?:string;
  submit?:(input:SalaryStructureWrite)=>Promise<void>;initial?:SalaryStructureVersion;
  actions?:EditorAction[];key?:string;
}){
  const [code,setCode]=useState(initial?.code??'');
  const [name,setName]=useState(initial?.name??'');
  const [policy,setPolicy]=useState(initial?.ctcPolicyVersionId??'');
  const [rule,setRule]=useState(initial?.eligibilityRuleVersionId??'');
  const [target,setTarget]=useState(String(initial?.targetAnnualAmount??1200000));
  const [effectiveFrom,setEffectiveFrom]=useState(initial?.effectiveFrom??today());
  const [effectiveTo,setEffectiveTo]=useState(initial?.effectiveTo??'');
  const [lines,setLines]=useState<DraftLine[]>(initial?.lines.map(toDraftLine)
    ??[newLine('FIXED'),newLine('RESIDUAL')]);
  const [formError,setFormError]=useState('');
  const availableComponents=mergeComponents(components,initial?.lines??[]);

  function update(key:string,change:Partial<DraftLine>){
    setLines(current=>current.map(line=>line.key===key?{...line,...change}:line));
  }
  function remove(key:string){
    setLines(current=>current.length<=2?current:current.filter(line=>line.key!==key));
  }
  function build():SalaryStructureWrite|null{
    const residuals=lines.filter(line=>line.lineType==='RESIDUAL');
    if(residuals.length!==1||lines.at(-1)?.lineType!=='RESIDUAL'){
      setFormError('Exactly one residual line is required and it must be final.');return null;
    }
    setFormError('');
    return {
      code:requireCode?code:undefined,name,currency:'INR',
      structureType:initial?.structureType??'STANDARD',
      payFrequency:initial?.payFrequency??'MONTHLY',
      confidentialityLevel:initial?.confidentialityLevel??'STANDARD',
      ctcPolicyVersionId:policy,eligibilityRuleVersionId:rule||undefined,
      targetType:initial?.targetType??'ANNUAL_CTC',targetAnnualAmount:Number(target),
      toleranceAmount:initial?.toleranceAmount??0.01,
      residualComponentVersionId:residuals[0].componentVersionId,
      effectiveFrom,effectiveTo:effectiveTo||undefined,
      lines:lines.map((line,index)=>({
        componentVersionId:line.componentVersionId,sequenceNo:index+1,lineType:line.lineType,
        targetAmount:line.lineType==='FIXED'?Number(line.value):undefined,
        targetPercentage:line.lineType==='PERCENTAGE'?Number(line.value):undefined,
        percentageBaseCode:line.lineType==='PERCENTAGE'?line.baseCode:undefined,
        minimumAmount:line.minimumAmount?Number(line.minimumAmount):undefined,
        maximumAmount:line.maximumAmount?Number(line.maximumAmount):undefined,
        mandatory:line.mandatory,overridePolicy:line.overridePolicy,
        ctcDisplayOrder:line.ctcDisplayOrder||index+1,
        payslipDisplayOrder:line.payslipDisplayOrder||index+1
      }))
    };
  }
  async function save(event:FormEvent){event.preventDefault();const input=build();if(input&&submit)await submit(input)}
  async function run(action:EditorAction){const input=build();if(input)await action.run(input)}

  const policyOptions=policies.some(item=>item.versionId===policy)?policies:
    policy?[...policies,{versionId:policy,code:'PINNED',versionSequence:0} as CtcPolicyVersion]:policies;
  const ruleOptions=rules.some(item=>item.versionId===rule)?rules:
    rule?[...rules,{versionId:rule,code:'PINNED',versionSequence:0} as EligibilityRuleVersion]:rules;

  return <form className="card form-grid" onSubmit={event=>void save(event)}>
    <h3>{title}</h3>{formError&&<p className="error" role="alert">{formError}</p>}
    {requireCode&&<label>Structure code<input required value={code}
      pattern="[A-Z][A-Z0-9_]{1,39}" onChange={event=>setCode(event.target.value.toUpperCase())}/></label>}
    <label>Structure name<input required value={name} onChange={event=>setName(event.target.value)}/></label>
    <label>CTC policy version<select required value={policy} onChange={event=>setPolicy(event.target.value)}>
      <option value="">Select approved policy</option>{policyOptions.map(item=><option
        key={item.versionId} value={item.versionId}>{item.code} v{item.versionSequence}</option>)}</select></label>
    <label>Eligibility rule version<select value={rule} onChange={event=>setRule(event.target.value)}>
      <option value="">No rule</option>{ruleOptions.map(item=><option key={item.versionId}
        value={item.versionId}>{item.code} v{item.versionSequence}</option>)}</select></label>
    <label>Target annual CTC<input required type="number" min="0.0001" step="0.0001"
      value={target} onChange={event=>setTarget(event.target.value)}/></label>
    <label>Structure effective from<input required type="date" value={effectiveFrom}
      onChange={event=>setEffectiveFrom(event.target.value)}/></label>
    <label>Structure effective to<input type="date" value={effectiveTo}
      onChange={event=>setEffectiveTo(event.target.value)}/></label>
    <fieldset><legend>Ordered calculation lines</legend>{lines.map((line,index)=><div
      className="line-editor" key={line.key}>
      <label>Line {index+1} component<select required aria-label={`Line ${index+1} component`}
        value={line.componentVersionId} onChange={event=>update(line.key,{componentVersionId:event.target.value})}>
        <option value="">Select approved component</option>{availableComponents.map(item=><option
          key={item.versionId} value={item.versionId}>{item.code} - {item.name}</option>)}</select></label>
      <label>Line {index+1} type<select aria-label={`Line ${index+1} type`} value={line.lineType}
        onChange={event=>update(line.key,{lineType:event.target.value as SalaryLineType,value:'',baseCode:''})}>
        <option>FIXED</option><option>PERCENTAGE</option><option>RESIDUAL</option></select></label>
      {line.lineType!=='RESIDUAL'&&<label>Line {index+1} value<input required
        aria-label={`Line ${index+1} value`} type="number" value={line.value}
        onChange={event=>update(line.key,{value:event.target.value})}/></label>}
      {line.lineType==='PERCENTAGE'&&<label>Line {index+1} base code<input required
        aria-label={`Line ${index+1} base code`} value={line.baseCode}
        onChange={event=>update(line.key,{baseCode:event.target.value.toUpperCase()})}/></label>}
      <button type="button" disabled={lines.length<=2} onClick={()=>remove(line.key)}>Remove line {index+1}</button>
    </div>)}
      <button type="button" onClick={()=>setLines(current=>{
        const residualIndex=current.findIndex(line=>line.lineType==='RESIDUAL');
        const addition=newLine('FIXED');
        return residualIndex<0?[...current,addition]:[
          ...current.slice(0,residualIndex),addition,...current.slice(residualIndex)];
      })}>Add structure line</button>
    </fieldset>
    {submitLabel&&<button type="submit">{submitLabel}</button>}
    {actions.length>0&&<div className="button-row">{actions.map(action=><button
      key={action.label} type="button" onClick={()=>void run(action)}>{action.label}</button>)}</div>}
  </form>;
}

function toDraftLine(line:SalaryStructureLineView):DraftLine{
  return {key:`line-${++sequence}`,componentVersionId:line.componentVersionId,
    lineType:line.lineType,value:String(line.targetAmount??line.targetPercentage??''),
    baseCode:line.percentageBaseCode??'',minimumAmount:String(line.minimumAmount??''),
    maximumAmount:String(line.maximumAmount??''),mandatory:line.mandatory,
    overridePolicy:line.overridePolicy,ctcDisplayOrder:line.ctcDisplayOrder,
    payslipDisplayOrder:line.payslipDisplayOrder};
}
function mergeComponents(options:SalaryStructureComponentOption[],lines:SalaryStructureLineView[]){
  const result=[...options];for(const line of lines){if(!result.some(item=>item.versionId===line.componentVersionId)){
    result.push({identityId:line.componentId,versionId:line.componentVersionId,code:line.componentCode,
      name:line.componentName,componentType:line.componentType,formulaType:line.componentFormulaType,
      approvalStatus:'APPROVED'});}}
  return result;
}
