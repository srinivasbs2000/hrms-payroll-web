import {FormEvent,useCallback,useEffect,useMemo,useState} from 'react';
import {currentPermissions} from '../organisation/organisation-api';
import {PayComponentVersion} from '../pay-component/pay-component-api';
import {
  AuditEventView,
  CalculationPhase,
  ComponentControlApi,
  ControlledComponentVersionWrite,
  DimensionDataType,
  FormulaValidationView,
  httpComponentControlApi,
  NegativeTreatment,
  ProrationBasis,
  ProrationEvent,
  ProrationMethod,
  ProrationPolicyView,
  ProrationVersionWrite,
  RateCellWrite,
  RateDimensionWrite,
  RateLookupView,
  RateTableVersionWrite,
  RateTableView,
  RateValueType,
  RoundingMethod,
  RoundingPolicyView,
  RoundingStage,
  RoundingVersionWrite,
  StatutoryWageReferenceView
} from './component-controls-api';

type Props={api?:ComponentControlApi;permissions?:Set<string>};
const today=()=>new Date().toISOString().slice(0,10);

export function ComponentControlsPage({
  api=httpComponentControlApi,
  permissions
}:Props){
  const effectivePermissions=useMemo(
    ()=>permissions??currentPermissions(),
    [permissions]
  );
  const [asOf,setAsOf]=useState(today);
  const [components,setComponents]=useState<PayComponentVersion[]>([]);
  const [rates,setRates]=useState<RateTableView[]>([]);
  const [rounding,setRounding]=useState<RoundingPolicyView[]>([]);
  const [proration,setProration]=useState<ProrationPolicyView[]>([]);
  const [selectedComponent,setSelectedComponent]=useState<PayComponentVersion|null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');

  const canRead=effectivePermissions.has('compensation.component.read');

  const load=useCallback(async()=>{
    if(!canRead)return;
    setLoading(true);setError('');
    try{
      const [nextComponents,nextRates,nextRounding,nextProration]=await Promise.all([
        api.listComponents(asOf),
        api.listRateTables(asOf),
        api.listRoundingPolicies(asOf),
        api.listProrationPolicies(asOf)
      ]);
      setComponents(nextComponents);
      setRates(nextRates);
      setRounding(nextRounding);
      setProration(nextProration);
    }catch(value){setError((value as Error).message)}
    finally{setLoading(false)}
  },[api,asOf,canRead]);

  useEffect(()=>{void load()},[load]);

  if(!canRead)return <section className="card" aria-labelledby="component-controls-title">
    <h2 id="component-controls-title">Component formula & controls</h2>
    <p role="alert">You do not have permission to view component controls.</p>
  </section>;

  return <section aria-labelledby="component-controls-title">
    <div className="page-heading">
      <div>
        <p className="eyebrow">P5-CCF-01 component catalogue controls</p>
        <h2 id="component-controls-title">Component formula & controls</h2>
        <p>Formula evidence, dependency impact, wage-rule references, rate tables, rounding and event proration.</p>
      </div>
      <label>Effective date
        <input aria-label="Component controls effective date" type="date" value={asOf}
          onChange={event=>setAsOf(event.target.value)}/>
      </label>
    </div>
    <p className="permission-note">
      Named payroll bases remain governed in <a href="/payroll-bases">Payroll bases</a>.
    </p>
    {loading&&<p role="status">Loading component controls...</p>}
    {error&&<p className="error" role="alert">{error}</p>}

    <div className="card">
      <h3>Component control target</h3>
      {components.length===0?<p>No approved components are effective on {asOf}.</p>:
        <div className="pay-group-list">
          {components.map(component=><button key={component.versionId}
            className="tree-item"
            aria-pressed={selectedComponent?.identityId===component.identityId}
            onClick={()=>setSelectedComponent(component)}>
            <strong>{component.code}</strong><span>{component.name}</span>
            <small>{component.componentType.toLowerCase()} · {component.approvalStatus.toLowerCase()}</small>
          </button>)}
        </div>}
    </div>

    {selectedComponent&&<ComponentIntelligence
      api={api}
      component={selectedComponent}
      permissions={effectivePermissions}
      onChanged={load}
    />}

    <RateTablesPanel
      api={api}
      asOf={asOf}
      items={rates}
      permissions={effectivePermissions}
      onChanged={load}
    />

    <RoundingPanel
      api={api}
      components={components}
      items={rounding}
      permissions={effectivePermissions}
      onChanged={load}
    />

    <ProrationPanel
      api={api}
      components={components}
      items={proration}
      permissions={effectivePermissions}
      onChanged={load}
    />
  </section>;
}

function ComponentIntelligence({
  api,component,permissions,onChanged
}:{
  api:ComponentControlApi;
  component:PayComponentVersion;
  permissions:Set<string>;
  onChanged:()=>Promise<void>;
}){
  const [expression,setExpression]=useState(
    component.formulaExpression??component.code
  );
  const [phase,setPhase]=useState<CalculationPhase>(
    component.formulaType==='FIXED'?'INPUT':'PRE_TAX'
  );
  const [validation,setValidation]=useState<FormulaValidationView|null>(null);
  const [intelligence,setIntelligence]=useState<{
    impact:Awaited<ReturnType<ComponentControlApi['impact']>>;
    wageRefs:StatutoryWageReferenceView[];
  }|null>(null);
  const [audit,setAudit]=useState<AuditEventView[]|null>(null);
  const [error,setError]=useState('');

  async function validate(event:FormEvent){
    event.preventDefault();setError('');
    try{setValidation(await api.validateFormula(expression,phase))}
    catch(value){setError((value as Error).message)}
  }
  async function inspect(){
    setError('');
    try{
      const [impact,wageRefs]=await Promise.all([
        api.impact(component.identityId),
        api.statutoryWageReferences(component.identityId)
      ]);
      setIntelligence({impact,wageRefs});
    }catch(value){setError((value as Error).message)}
  }

  return <div className="card">
    <h3>{component.code} · formula, dependency and wage classification</h3>
    {error&&<p className="error" role="alert">{error}</p>}
    <form className="form-grid" aria-label="Validate component formula" onSubmit={event=>void validate(event)}>
      <label>Formula expression
        <input aria-label="Formula expression" required value={expression}
          onChange={event=>setExpression(event.target.value)}/>
      </label>
      <label>Calculation phase
        <select aria-label="Calculation phase" value={phase}
          onChange={event=>setPhase(event.target.value as CalculationPhase)}>
          {(['INPUT','PRE_TAX','TAX','POST_TAX','NET'] as CalculationPhase[]).map(value=>
            <option key={value}>{value}</option>
          )}
        </select>
      </label>
      <button type="submit">Validate formula</button>
    </form>
    {validation&&<div aria-label="Formula validation result">
      <p><strong>Canonical:</strong> <code>{validation.canonicalExpression}</code></p>
      <p><strong>Phase:</strong> {validation.calculationPhase} · <strong>Result:</strong> {validation.resultContract}</p>
      <p><strong>Dependencies:</strong> {validation.dependencies.join(', ')||'None'}</p>
      <p><strong>Fingerprint:</strong> <code>{validation.formulaFingerprint}</code></p>
    </div>}
    <button className="secondary-button" onClick={()=>void inspect()}>
      Inspect dependency impact & statutory references
    </button>
    {permissions.has('audit.read')&&<button className="secondary-button" onClick={async()=>{
      setError('');
      try{setAudit(await api.componentAudit(component.identityId))}
      catch(value){setError((value as Error).message)}
    }}>Load component audit</button>}
    {intelligence&&<div aria-label="Component impact">
      <h4>Dependency impact</h4>
      <p>Outgoing dependencies: {intelligence.impact.outgoingDependencies.length}</p>
      <p>Formula dependants: {intelligence.impact.formulaDependants.length}</p>
      <p>Payroll bases: {intelligence.impact.payrollBaseIds.length} · Salary structures: {intelligence.impact.salaryStructureIds.length}</p>
      <p>Rounding policies: {intelligence.impact.roundingPolicyIds.length} · Proration policies: {intelligence.impact.prorationPolicyIds.length}</p>
      <h4>Exact statutory wage-rule references</h4>
      {intelligence.wageRefs.length===0?<p>No statutory wage-rule references.</p>:
        <table aria-label="Statutory wage references"><thead><tr>
          <th>Rule</th><th>Category</th><th>Rule version</th><th>Effective range</th>
        </tr></thead><tbody>{intelligence.wageRefs.map(reference=><tr
          key={`${reference.componentVersionId}-${reference.statutoryRuleVersionId}`}>
          <td>{reference.statutoryRuleCode}</td>
          <td>{reference.ruleCategory}</td>
          <td><code>{reference.statutoryRuleVersionId}</code></td>
          <td>{reference.ruleEffectiveFrom} → {reference.ruleEffectiveTo??'open'}</td>
        </tr>)}</tbody></table>}
    </div>}
    {audit&&<AuditEvidence events={audit} label="Component audit evidence"/>}
    {permissions.has('compensation.component.version.create')?
      <AdvancedComponentVersionForm
        api={api}
        component={component}
        onChanged={onChanged}
      />:<p className="permission-note">
        Advanced version creation requires <code>compensation.component.version.create</code>.
      </p>}
  </div>;
}

function AdvancedComponentVersionForm({
  api,component,onChanged
}:{
  api:ComponentControlApi;
  component:PayComponentVersion;
  onChanged:()=>Promise<void>;
}){
  const [formulaType,setFormulaType]=useState(component.formulaType);
  const [formulaValue,setFormulaValue]=useState(
    component.formulaType==='FIXED'
      ?String(component.fixedAmount??'')
      :component.formulaExpression??''
  );
  const [phase,setPhase]=useState<CalculationPhase>(
    component.formulaType==='FIXED'?'INPUT':'PRE_TAX'
  );
  const [effectiveFrom,setEffectiveFrom]=useState(today);
  const [effectiveTo,setEffectiveTo]=useState('');
  const [references,setReferences]=useState('');
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');

  function parseReferences(){
    if(!references.trim())return [];
    return references.split(/\r?\n/).filter(Boolean).map((line,index)=>{
      const [statutoryRuleId,statutoryRuleVersionId,...extra]=line.split(',').map(value=>value.trim());
      if(!statutoryRuleId||!statutoryRuleVersionId||extra.length){
        throw new Error(`Statutory reference line ${index+1} must be ruleId,ruleVersionId`);
      }
      return {statutoryRuleId,statutoryRuleVersionId};
    });
  }

  async function submit(event:FormEvent){
    event.preventDefault();setError('');setMessage('');
    const required=[
      component.componentCategory,component.cashImpact,component.payeeType,
      component.paymentChannel,component.settlementTiming,component.payslipVisibility,
      component.zeroValueVisibility,component.negativeValuePolicy,component.frequency,
      component.valueNature,component.amountRepresentation,component.taxTreatment,
      component.payrollTiming
    ];
    if(required.some(value=>value===null)){
      setError('Legacy-incomplete components must be classified before advanced versioning.');
      return;
    }
    try{
      const input:ControlledComponentVersionWrite={
        formulaType,
        roundingScale:component.roundingScale,
        componentCategory:component.componentCategory!,
        componentSubcategory:component.componentSubcategory??undefined,
        cashImpact:component.cashImpact!,
        payeeType:component.payeeType!,
        paymentChannel:component.paymentChannel!,
        settlementTiming:component.settlementTiming!,
        payslipVisibility:component.payslipVisibility!,
        zeroValueVisibility:component.zeroValueVisibility!,
        negativeValuePolicy:component.negativeValuePolicy!,
        frequency:component.frequency!,
        valueNature:component.valueNature!,
        amountRepresentation:component.amountRepresentation!,
        taxTreatment:component.taxTreatment!,
        payrollTiming:component.payrollTiming!,
        effectiveFrom,
        effectiveTo:effectiveTo||undefined,
        statutoryWageReferences:parseReferences(),
        calculationPhase:phase,
        resultContract:'DECIMAL'
      };
      if(formulaType==='FIXED')input.fixedAmount=Number(formulaValue);
      else input.formulaExpression=formulaValue;
      await api.addComponentVersion(component.identityId,input);
      setMessage('Advanced component version created as draft.');
      await onChanged();
    }catch(value){setError((value as Error).message)}
  }

  return <form className="form-grid" aria-label="Create advanced component version"
    onSubmit={event=>void submit(event)}>
    <h4>Create controlled component version</h4>
    {error&&<p className="error" role="alert">{error}</p>}
    {message&&<p role="status">{message}</p>}
    <label>Version formula type
      <select aria-label="Version formula type" value={formulaType}
        onChange={event=>setFormulaType(event.target.value as typeof formulaType)}>
        <option value="FIXED">FIXED</option>
        <option value="PERCENTAGE_OF_COMPONENT">PERCENTAGE_OF_COMPONENT</option>
        <option value="RESIDUAL">RESIDUAL</option>
      </select>
    </label>
    <label>{formulaType==='FIXED'?'Version fixed amount':'Version formula expression'}
      <input aria-label={formulaType==='FIXED'?'Version fixed amount':'Version formula expression'}
        required value={formulaValue} onChange={event=>setFormulaValue(event.target.value)}
        type={formulaType==='FIXED'?'number':'text'} min={formulaType==='FIXED'?'0':undefined}/>
    </label>
    <label>Version calculation phase
      <select aria-label="Version calculation phase" value={phase}
        onChange={event=>setPhase(event.target.value as CalculationPhase)}>
        {(['INPUT','PRE_TAX','TAX','POST_TAX','NET'] as CalculationPhase[]).map(value=>
          <option key={value}>{value}</option>
        )}
      </select>
    </label>
    <label>Version effective from
      <input aria-label="Version effective from" required type="date" value={effectiveFrom}
        onChange={event=>setEffectiveFrom(event.target.value)}/>
    </label>
    <label>Version effective to
      <input aria-label="Version effective to" type="date" value={effectiveTo}
        onChange={event=>setEffectiveTo(event.target.value)}/>
    </label>
    <label className="span-two">Statutory wage references
      <textarea aria-label="Statutory wage references" rows={3}
        placeholder="statutoryRuleId,statutoryRuleVersionId — one exact pair per line"
        value={references} onChange={event=>setReferences(event.target.value)}/>
    </label>
    <button type="submit">Create controlled version</button>
  </form>;
}

type RateDraft={
  valueType:RateValueType;
  unitCode:string;
  effectiveFrom:string;
  effectiveTo:string;
  dimensions:RateDimensionWrite[];
  cells:RateCellWrite[];
};
const newRateDraft=():RateDraft=>({
  valueType:'AMOUNT',
  unitCode:'INR',
  effectiveFrom:today(),
  effectiveTo:'',
  dimensions:[{code:'GRADE',name:'Grade',dataType:'TEXT'}],
  cells:[{dimensionValues:{GRADE:''},rateValue:''}]
});

function RateVersionFields({
  value,onChange,prefix=''
}:{
  value:RateDraft;
  onChange:(next:RateDraft)=>void;
  prefix?:string;
}){
  function updateDimension(index:number,next:RateDimensionWrite){
    const previous=value.dimensions[index];
    const dimensions=value.dimensions.map((item,itemIndex)=>itemIndex===index?next:item);
    const cells=value.cells.map(cell=>{
      const dimensionValues={...cell.dimensionValues};
      if(previous.code!==next.code){
        const oldValue=dimensionValues[previous.code]??'';
        delete dimensionValues[previous.code];
        dimensionValues[next.code]=oldValue;
      }
      return {...cell,dimensionValues};
    });
    onChange({...value,dimensions,cells});
  }
  function addDimension(){
    const code=`DIM_${value.dimensions.length+1}`;
    onChange({
      ...value,
      dimensions:[...value.dimensions,{code,name:`Dimension ${value.dimensions.length+1}`,dataType:'TEXT'}],
      cells:value.cells.map(cell=>({
        ...cell,dimensionValues:{...cell.dimensionValues,[code]:''}
      }))
    });
  }
  function removeDimension(index:number){
    if(value.dimensions.length===1)return;
    const removed=value.dimensions[index];
    onChange({
      ...value,
      dimensions:value.dimensions.filter((_,itemIndex)=>itemIndex!==index),
      cells:value.cells.map(cell=>{
        const dimensionValues={...cell.dimensionValues};
        delete dimensionValues[removed.code];
        return {...cell,dimensionValues};
      })
    });
  }
  function updateCell(index:number,next:RateCellWrite){
    onChange({...value,cells:value.cells.map((cell,itemIndex)=>itemIndex===index?next:cell)});
  }
  return <>
    <label>{prefix}Rate value type
      <select aria-label={`${prefix}Rate value type`.trim()} value={value.valueType}
        onChange={event=>{
          const nextType=event.target.value as RateValueType;
          const defaultUnit=nextType==='AMOUNT'?'INR':nextType==='PERCENTAGE'?'PERCENT':nextType==='FACTOR'?'FACTOR':'UNIT';
          onChange({...value,valueType:nextType,unitCode:defaultUnit});
        }}>
        {(['AMOUNT','PERCENTAGE','FACTOR','QUANTITY'] as RateValueType[]).map(item=>
          <option key={item}>{item}</option>
        )}
      </select>
    </label>
    <label>{prefix}Unit code
      <input aria-label={`${prefix}Unit code`.trim()} required value={value.unitCode}
        onChange={event=>onChange({...value,unitCode:event.target.value.toUpperCase()})}/>
    </label>
    <label>{prefix}Effective from
      <input aria-label={`${prefix}Effective from`.trim()} required type="date" value={value.effectiveFrom}
        onChange={event=>onChange({...value,effectiveFrom:event.target.value})}/>
    </label>
    <label>{prefix}Effective to
      <input aria-label={`${prefix}Effective to`.trim()} type="date" value={value.effectiveTo}
        onChange={event=>onChange({...value,effectiveTo:event.target.value})}/>
    </label>
    <fieldset className="span-two">
      <legend>{prefix}Dimensions</legend>
      {value.dimensions.map((dimension,index)=><div className="form-grid" key={`${index}-${dimension.code}`}>
        <label>Dimension code
          <input aria-label={`${prefix}Dimension ${index+1} code`.trim()} required value={dimension.code}
            onChange={event=>updateDimension(index,{...dimension,code:event.target.value.toUpperCase()})}/>
        </label>
        <label>Dimension name
          <input aria-label={`${prefix}Dimension ${index+1} name`.trim()} required value={dimension.name}
            onChange={event=>updateDimension(index,{...dimension,name:event.target.value})}/>
        </label>
        <label>Dimension type
          <select aria-label={`${prefix}Dimension ${index+1} type`.trim()} value={dimension.dataType}
            onChange={event=>updateDimension(index,{...dimension,dataType:event.target.value as DimensionDataType})}>
            {(['TEXT','NUMBER','BOOLEAN','DATE'] as DimensionDataType[]).map(item=>
              <option key={item}>{item}</option>
            )}
          </select>
        </label>
        <button type="button" className="secondary-button" disabled={value.dimensions.length===1}
          onClick={()=>removeDimension(index)}>Remove dimension</button>
      </div>)}
      <button type="button" className="secondary-button" onClick={addDimension}>Add dimension</button>
    </fieldset>
    <fieldset className="span-two">
      <legend>{prefix}Rate cells</legend>
      {value.cells.map((cell,index)=><div className="form-grid" key={index}>
        {value.dimensions.map(dimension=><label key={dimension.code}>{dimension.code}
          <input aria-label={`${prefix}Cell ${index+1} ${dimension.code}`.trim()} required
            value={cell.dimensionValues[dimension.code]??''}
            onChange={event=>updateCell(index,{
              ...cell,
              dimensionValues:{...cell.dimensionValues,[dimension.code]:event.target.value}
            })}/>
        </label>)}
        <label>Rate value
          <input aria-label={`${prefix}Cell ${index+1} rate value`.trim()} required
            inputMode="decimal" value={cell.rateValue}
            onChange={event=>updateCell(index,{...cell,rateValue:event.target.value})}/>
        </label>
        <button type="button" className="secondary-button" disabled={value.cells.length===1}
          onClick={()=>onChange({...value,cells:value.cells.filter((_,itemIndex)=>itemIndex!==index)})}>
          Remove cell
        </button>
      </div>)}
      <button type="button" className="secondary-button" onClick={()=>onChange({
        ...value,cells:[...value.cells,{
          dimensionValues:Object.fromEntries(value.dimensions.map(item=>[item.code,''])),
          rateValue:''
        }]
      })}>Add rate cell</button>
    </fieldset>
  </>;
}

function rateWrite(draft:RateDraft):RateTableVersionWrite{
  return {
    valueType:draft.valueType,
    unitCode:draft.unitCode,
    effectiveFrom:draft.effectiveFrom,
    effectiveTo:draft.effectiveTo||undefined,
    dimensions:draft.dimensions,
    cells:draft.cells
  };
}

function rateDraftFrom(item:RateTableView):RateDraft{
  return {
    valueType:item.valueType,unitCode:item.unitCode,
    effectiveFrom:item.effectiveFrom,effectiveTo:item.effectiveTo??'',
    dimensions:item.dimensions.map(({code,name,dataType})=>({code,name,dataType})),
    cells:item.cells.map(({dimensionValues,rateValue})=>({dimensionValues:{...dimensionValues},rateValue}))
  };
}

function RateTablesPanel({
  api,asOf,items,permissions,onChanged
}:{
  api:ComponentControlApi;
  asOf:string;
  items:RateTableView[];
  permissions:Set<string>;
  onChanged:()=>Promise<void>;
}){
  const [selected,setSelected]=useState<RateTableView|null>(null);
  const [code,setCode]=useState('');
  const [name,setName]=useState('');
  const [draft,setDraft]=useState<RateDraft>(newRateDraft);
  const [history,setHistory]=useState<RateTableView[]>([]);
  const [versionDraft,setVersionDraft]=useState<RateDraft>(newRateDraft);
  const [lookupValues,setLookupValues]=useState<Record<string,string>>({});
  const [lookup,setLookup]=useState<RateLookupView|null>(null);
  const [audit,setAudit]=useState<AuditEventView[]|null>(null);
  const [endDate,setEndDate]=useState('');
  const [retireDate,setRetireDate]=useState('');
  const [retireReason,setRetireReason]=useState('');
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');

  const canCreate=permissions.has('compensation.component.create');
  const canVersion=permissions.has('compensation.component.version.create');
  const canCorrect=permissions.has('compensation.component.version.correct');
  const canApprove=permissions.has('compensation.component.approve');
  const canEnd=permissions.has('compensation.component.version.end-date');
  const canRetire=permissions.has('compensation.component.retire');
  const canAudit=permissions.has('audit.read');

  function choose(item:RateTableView){
    setSelected(item);setVersionDraft(rateDraftFrom(item));
    setLookupValues(Object.fromEntries(item.dimensions.map(dimension=>[dimension.code,''])));
    setLookup(null);setAudit(null);setHistory([]);setError('');setMessage('');
  }
  async function action(work:()=>Promise<RateTableView>,success:string){
    setError('');setMessage('');
    try{
      const result=await work();choose(result);setMessage(success);await onChanged()
    }catch(value){setError((value as Error).message)}
  }
  async function create(event:FormEvent){
    event.preventDefault();
    await action(
      ()=>api.createRateTable({code,name,version:rateWrite(draft)}),
      'Rate table draft created.'
    );
  }
  async function loadHistory(){
    if(!selected)return;
    setError('');
    try{setHistory(await api.rateHistory(selected.identityId))}
    catch(value){setError((value as Error).message)}
  }
  async function performLookup(event:FormEvent){
    event.preventDefault();if(!selected)return;setError('');
    try{setLookup(await api.lookupRate(selected.identityId,asOf,lookupValues))}
    catch(value){setError((value as Error).message)}
  }
  async function loadAudit(){
    if(!selected)return;setError('');
    try{setAudit(await api.rateAudit(selected.identityId))}
    catch(value){setError((value as Error).message)}
  }

  return <div className="card">
    <h3>Multidimensional rate tables</h3>
    <p>Exact typed dimensions, effective dating and deterministic lookup.</p>
    {error&&<p className="error" role="alert">{error}</p>}
    {message&&<p role="status">{message}</p>}
    {items.length>0&&<div className="pay-group-list">
      {items.map(item=><button key={item.versionId} className="tree-item"
        onClick={()=>choose(item)}>
        <strong>{item.code}</strong><span>{item.name}</span>
        <small>{item.valueType} {item.unitCode} · {item.approvalStatus}</small>
      </button>)}
    </div>}
    {canCreate?<form className="form-grid" aria-label="Create rate table" onSubmit={event=>void create(event)}>
      <h4>Create rate table draft</h4>
      <label>Rate table code<input aria-label="Rate table code" required value={code}
        onChange={event=>setCode(event.target.value.toUpperCase())}/></label>
      <label>Rate table name<input aria-label="Rate table name" required value={name}
        onChange={event=>setName(event.target.value)}/></label>
      <RateVersionFields value={draft} onChange={setDraft}/>
      <button type="submit">Create rate table</button>
    </form>:<p className="permission-note">Rate creation requires <code>compensation.component.create</code>.</p>}

    {selected&&<div aria-label="Rate table lifecycle">
      <h4>{selected.code} lifecycle</h4>
      <p>{selected.lifecycleStatus} · {selected.approvalStatus} · version {selected.versionSequence}</p>
      <button className="secondary-button" onClick={()=>void loadHistory()}>Load rate history</button>
      {canAudit&&<button className="secondary-button" onClick={()=>void loadAudit()}>Load rate audit</button>}
      {history.length>0&&<ul aria-label="Rate history">{history.map(item=>
        <li key={item.versionId}>v{item.versionSequence} · {item.approvalStatus} · {item.effectiveFrom} → {item.effectiveTo??'open'}</li>
      )}</ul>}
      {audit&&<AuditEvidence events={audit} label="Rate audit evidence"/>}

      {(canVersion||canCorrect)&&<form className="form-grid" aria-label="Rate version lifecycle"
        onSubmit={event=>event.preventDefault()}>
        <RateVersionFields prefix="Lifecycle " value={versionDraft} onChange={setVersionDraft}/>
        {canVersion&&<button type="button" onClick={()=>void action(
          ()=>api.addRateVersion(selected.identityId,rateWrite(versionDraft)),
          'Rate-table version created.'
        )}>Add rate version</button>}
        {canCorrect&&selected.approvalStatus==='DRAFT'&&<button type="button"
          className="secondary-button" onClick={()=>void action(
            ()=>api.correctRateVersion(selected.identityId,selected.versionId,rateWrite(versionDraft)),
            'Draft rate-table version corrected.'
          )}>Correct selected rate draft</button>}
      </form>}

      {canApprove&&selected.approvalStatus==='DRAFT'&&<button onClick={()=>void action(
        ()=>api.approveRate(selected.identityId,selected.versionId,selected.versionNo),
        'Rate-table version approved.'
      )}>Approve rate version</button>}

      {canEnd&&<form className="form-grid" aria-label="End-date rate version"
        onSubmit={event=>{event.preventDefault();void action(
          ()=>api.endDateRate(selected.identityId,selected.versionId,selected.versionNo,endDate),
          'Rate-table version end-dated.'
        )}}>
        <label>Rate end date<input aria-label="Rate end date" required type="date" value={endDate}
          onChange={event=>setEndDate(event.target.value)}/></label>
        <button type="submit">End-date rate version</button>
      </form>}

      {canRetire&&<form className="form-grid" aria-label="Retire rate table"
        onSubmit={event=>{event.preventDefault();void action(
          ()=>api.retireRate(selected.identityId,selected.identityVersionNo,retireDate,retireReason),
          'Rate table retired.'
        )}}>
        <label>Rate retirement date<input aria-label="Rate retirement date" required type="date"
          value={retireDate} onChange={event=>setRetireDate(event.target.value)}/></label>
        <label>Rate retirement reason<input aria-label="Rate retirement reason" required
          value={retireReason} onChange={event=>setRetireReason(event.target.value)}/></label>
        <button type="submit">Retire rate table</button>
      </form>}

      <form className="form-grid" aria-label="Lookup rate" onSubmit={event=>void performLookup(event)}>
        <h4>Deterministic lookup for {asOf}</h4>
        {selected.dimensions.map(dimension=><label key={dimension.code}>{dimension.name}
          <input aria-label={`Lookup ${dimension.code}`} required
            value={lookupValues[dimension.code]??''}
            onChange={event=>setLookupValues({
              ...lookupValues,[dimension.code]:event.target.value
            })}/>
        </label>)}
        <button type="submit">Lookup rate</button>
      </form>
      {lookup&&<p aria-label="Rate lookup result">
        Result: <strong>{lookup.rateValue}</strong> {lookup.unitCode}
      </p>}
    </div>}
  </div>;
}

function RoundingPanel({
  api,components,items,permissions,onChanged
}:{
  api:ComponentControlApi;
  components:PayComponentVersion[];
  items:RoundingPolicyView[];
  permissions:Set<string>;
  onChanged:()=>Promise<void>;
}){
  const [componentId,setComponentId]=useState('');
  const [selected,setSelected]=useState<RoundingPolicyView|null>(null);
  const [version,setVersion]=useState<RoundingVersionWrite>({
    method:'HALF_UP',scale:2,stage:'COMPONENT',negativeTreatment:'SYMMETRIC',
    effectiveFrom:today()
  });
  const [history,setHistory]=useState<RoundingPolicyView[]>([]);
  const [audit,setAudit]=useState<AuditEventView[]|null>(null);
  const [endDate,setEndDate]=useState('');
  const [retireDate,setRetireDate]=useState('');
  const [retireReason,setRetireReason]=useState('');
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');

  const canCreate=permissions.has('compensation.component.create');
  const canVersion=permissions.has('compensation.component.version.create');
  const canCorrect=permissions.has('compensation.component.version.correct');
  const canApprove=permissions.has('compensation.component.approve');
  const canEnd=permissions.has('compensation.component.version.end-date');
  const canRetire=permissions.has('compensation.component.retire');
  const canAudit=permissions.has('audit.read');

  function choose(item:RoundingPolicyView){
    setSelected(item);setVersion({
      method:item.method,scale:item.scale,stage:item.stage,negativeTreatment:item.negativeTreatment,
      effectiveFrom:item.effectiveFrom,effectiveTo:item.effectiveTo??undefined
    });setHistory([]);setAudit(null);setError('');setMessage('');
  }
  async function action(work:()=>Promise<RoundingPolicyView>,success:string){
    setError('');setMessage('');
    try{const result=await work();choose(result);setMessage(success);await onChanged()}
    catch(value){setError((value as Error).message)}
  }

  return <div className="card">
    <h3>Rounding policies</h3>
    {error&&<p className="error" role="alert">{error}</p>}
    {message&&<p role="status">{message}</p>}
    {items.length>0&&<div className="pay-group-list">{items.map(item=>
      <button key={item.versionId} className="tree-item" onClick={()=>choose(item)}>
        <strong>{item.componentCode}</strong><span>{item.method} · scale {item.scale}</span>
        <small>{item.stage} · {item.approvalStatus}</small>
      </button>
    )}</div>}
    {canCreate&&<form className="form-grid" aria-label="Create rounding policy"
      onSubmit={event=>{event.preventDefault();void action(
        ()=>api.createRoundingPolicy(componentId,version),
        'Rounding-policy draft created.'
      )}}>
      <label>Rounding component<select aria-label="Rounding component" required value={componentId}
        onChange={event=>setComponentId(event.target.value)}>
        <option value="">Select component</option>
        {components.map(component=><option key={component.identityId}
          value={component.identityId}>{component.code}</option>)}
      </select></label>
      <RoundingFields value={version} onChange={setVersion}/>
      <button type="submit">Create rounding policy</button>
    </form>}
    {selected&&<div aria-label="Rounding lifecycle">
      <h4>{selected.componentCode} rounding lifecycle</h4>
      <button className="secondary-button" onClick={async()=>{
        try{setHistory(await api.roundingHistory(selected.identityId))}
        catch(value){setError((value as Error).message)}
      }}>Load rounding history</button>
      {canAudit&&<button className="secondary-button" onClick={async()=>{
        try{setAudit(await api.roundingAudit(selected.identityId))}
        catch(value){setError((value as Error).message)}
      }}>Load rounding audit</button>}
      {history.length>0&&<ul aria-label="Rounding history">{history.map(item=>
        <li key={item.versionId}>v{item.versionSequence} · {item.approvalStatus} · {item.effectiveFrom}</li>
      )}</ul>}
      {audit&&<AuditEvidence events={audit} label="Rounding audit evidence"/>}
      {(canVersion||canCorrect)&&<form className="form-grid" aria-label="Rounding version lifecycle"
        onSubmit={event=>event.preventDefault()}>
        <RoundingFields prefix="Lifecycle " value={version} onChange={setVersion}/>
        {canVersion&&<button type="button" onClick={()=>void action(
          ()=>api.addRoundingVersion(selected.identityId,version),'Rounding version created.'
        )}>Add rounding version</button>}
        {canCorrect&&selected.approvalStatus==='DRAFT'&&<button type="button"
          className="secondary-button" onClick={()=>void action(
            ()=>api.correctRoundingVersion(selected.identityId,selected.versionId,version),
            'Rounding draft corrected.'
          )}>Correct selected rounding draft</button>}
      </form>}
      {canApprove&&selected.approvalStatus==='DRAFT'&&<button onClick={()=>void action(
        ()=>api.approveRounding(selected.identityId,selected.versionId,selected.versionNo),
        'Rounding version approved.'
      )}>Approve rounding version</button>}
      {canEnd&&<form className="form-grid" aria-label="End-date rounding version"
        onSubmit={event=>{event.preventDefault();void action(
          ()=>api.endDateRounding(selected.identityId,selected.versionId,selected.versionNo,endDate),
          'Rounding version end-dated.'
        )}}>
        <label>Rounding end date<input aria-label="Rounding end date" required type="date"
          value={endDate} onChange={event=>setEndDate(event.target.value)}/></label>
        <button type="submit">End-date rounding version</button>
      </form>}
      {canRetire&&<form className="form-grid" aria-label="Retire rounding policy"
        onSubmit={event=>{event.preventDefault();void action(
          ()=>api.retireRounding(selected.identityId,selected.identityVersionNo,retireDate,retireReason),
          'Rounding policy retired.'
        )}}>
        <label>Rounding retirement date<input aria-label="Rounding retirement date" required type="date"
          value={retireDate} onChange={event=>setRetireDate(event.target.value)}/></label>
        <label>Rounding retirement reason<input aria-label="Rounding retirement reason" required
          value={retireReason} onChange={event=>setRetireReason(event.target.value)}/></label>
        <button type="submit">Retire rounding policy</button>
      </form>}
    </div>}
  </div>;
}

function RoundingFields({
  value,onChange,prefix=''
}:{
  value:RoundingVersionWrite;
  onChange:(next:RoundingVersionWrite)=>void;
  prefix?:string;
}){
  return <>
    <label>{prefix}Rounding method<select aria-label={`${prefix}Rounding method`.trim()}
      value={value.method} onChange={event=>onChange({...value,method:event.target.value as RoundingMethod})}>
      {(['HALF_UP','HALF_EVEN','HALF_DOWN','UP','DOWN','CEILING','FLOOR'] as RoundingMethod[]).map(item=>
        <option key={item}>{item}</option>
      )}
    </select></label>
    <label>{prefix}Rounding scale<input aria-label={`${prefix}Rounding scale`.trim()}
      type="number" min="0" max="10" required value={value.scale}
      onChange={event=>onChange({...value,scale:Number(event.target.value)})}/></label>
    <label>{prefix}Rounding stage<select aria-label={`${prefix}Rounding stage`.trim()}
      value={value.stage} onChange={event=>onChange({...value,stage:event.target.value as RoundingStage})}>
      {(['COMPONENT','INTERMEDIATE','FINAL'] as RoundingStage[]).map(item=>
        <option key={item}>{item}</option>
      )}
    </select></label>
    <label>{prefix}Negative treatment<select aria-label={`${prefix}Negative treatment`.trim()}
      value={value.negativeTreatment}
      onChange={event=>onChange({...value,negativeTreatment:event.target.value as NegativeTreatment})}>
      {(['SYMMETRIC','TOWARD_ZERO','AWAY_FROM_ZERO','PROHIBIT'] as NegativeTreatment[]).map(item=>
        <option key={item}>{item}</option>
      )}
    </select></label>
    <label>{prefix}Rounding effective from<input aria-label={`${prefix}Rounding effective from`.trim()}
      required type="date" value={value.effectiveFrom}
      onChange={event=>onChange({...value,effectiveFrom:event.target.value})}/></label>
    <label>{prefix}Rounding effective to<input aria-label={`${prefix}Rounding effective to`.trim()}
      type="date" value={value.effectiveTo??''}
      onChange={event=>onChange({...value,effectiveTo:event.target.value||undefined})}/></label>
  </>;
}

function ProrationPanel({
  api,components,items,permissions,onChanged
}:{
  api:ComponentControlApi;
  components:PayComponentVersion[];
  items:ProrationPolicyView[];
  permissions:Set<string>;
  onChanged:()=>Promise<void>;
}){
  const [componentId,setComponentId]=useState('');
  const [eventType,setEventType]=useState<ProrationEvent>('JOINING');
  const [selected,setSelected]=useState<ProrationPolicyView|null>(null);
  const [version,setVersion]=useState<ProrationVersionWrite>({
    method:'CALENDAR_DAYS',basis:'PAY_PERIOD',effectiveFrom:today()
  });
  const [history,setHistory]=useState<ProrationPolicyView[]>([]);
  const [audit,setAudit]=useState<AuditEventView[]|null>(null);
  const [endDate,setEndDate]=useState('');
  const [retireDate,setRetireDate]=useState('');
  const [retireReason,setRetireReason]=useState('');
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');

  const canCreate=permissions.has('compensation.component.create');
  const canVersion=permissions.has('compensation.component.version.create');
  const canCorrect=permissions.has('compensation.component.version.correct');
  const canApprove=permissions.has('compensation.component.approve');
  const canEnd=permissions.has('compensation.component.version.end-date');
  const canRetire=permissions.has('compensation.component.retire');
  const canAudit=permissions.has('audit.read');

  function choose(item:ProrationPolicyView){
    setSelected(item);setVersion({
      method:item.method,basis:item.basis,effectiveFrom:item.effectiveFrom,
      effectiveTo:item.effectiveTo??undefined
    });setHistory([]);setAudit(null);setError('');setMessage('');
  }
  async function action(work:()=>Promise<ProrationPolicyView>,success:string){
    setError('');setMessage('');
    try{const result=await work();choose(result);setMessage(success);await onChanged()}
    catch(value){setError((value as Error).message)}
  }

  return <div className="card">
    <h3>Event-specific proration</h3>
    <p>Joining, exit, unpaid leave, transfer and salary-revision policies remain independently effective-dated.</p>
    {error&&<p className="error" role="alert">{error}</p>}
    {message&&<p role="status">{message}</p>}
    {items.length>0&&<div className="pay-group-list">{items.map(item=>
      <button key={item.versionId} className="tree-item" onClick={()=>choose(item)}>
        <strong>{item.componentCode}</strong><span>{item.eventType}</span>
        <small>{item.method} / {item.basis} · {item.approvalStatus}</small>
      </button>
    )}</div>}
    {canCreate&&<form className="form-grid" aria-label="Create proration policy"
      onSubmit={event=>{event.preventDefault();void action(
        ()=>api.createProrationPolicy(componentId,eventType,version),
        'Proration-policy draft created.'
      )}}>
      <label>Proration component<select aria-label="Proration component" required value={componentId}
        onChange={event=>setComponentId(event.target.value)}>
        <option value="">Select component</option>
        {components.map(component=><option key={component.identityId}
          value={component.identityId}>{component.code}</option>)}
      </select></label>
      <label>Proration event<select aria-label="Proration event" value={eventType}
        onChange={event=>setEventType(event.target.value as ProrationEvent)}>
        {(['JOINING','EXIT','UNPAID_LEAVE','TRANSFER','SALARY_REVISION'] as ProrationEvent[]).map(item=>
          <option key={item}>{item}</option>
        )}
      </select></label>
      <ProrationFields value={version} onChange={setVersion}/>
      <button type="submit">Create proration policy</button>
    </form>}
    {selected&&<div aria-label="Proration lifecycle">
      <h4>{selected.componentCode} · {selected.eventType}</h4>
      <button className="secondary-button" onClick={async()=>{
        try{setHistory(await api.prorationHistory(selected.identityId))}
        catch(value){setError((value as Error).message)}
      }}>Load proration history</button>
      {canAudit&&<button className="secondary-button" onClick={async()=>{
        try{setAudit(await api.prorationAudit(selected.identityId))}
        catch(value){setError((value as Error).message)}
      }}>Load proration audit</button>}
      {history.length>0&&<ul aria-label="Proration history">{history.map(item=>
        <li key={item.versionId}>v{item.versionSequence} · {item.approvalStatus} · {item.effectiveFrom}</li>
      )}</ul>}
      {audit&&<AuditEvidence events={audit} label="Proration audit evidence"/>}
      {(canVersion||canCorrect)&&<form className="form-grid" aria-label="Proration version lifecycle"
        onSubmit={event=>event.preventDefault()}>
        <ProrationFields prefix="Lifecycle " value={version} onChange={setVersion}/>
        {canVersion&&<button type="button" onClick={()=>void action(
          ()=>api.addProrationVersion(selected.identityId,version),'Proration version created.'
        )}>Add proration version</button>}
        {canCorrect&&selected.approvalStatus==='DRAFT'&&<button type="button"
          className="secondary-button" onClick={()=>void action(
            ()=>api.correctProrationVersion(selected.identityId,selected.versionId,version),
            'Proration draft corrected.'
          )}>Correct selected proration draft</button>}
      </form>}
      {canApprove&&selected.approvalStatus==='DRAFT'&&<button onClick={()=>void action(
        ()=>api.approveProration(selected.identityId,selected.versionId,selected.versionNo),
        'Proration version approved.'
      )}>Approve proration version</button>}
      {canEnd&&<form className="form-grid" aria-label="End-date proration version"
        onSubmit={event=>{event.preventDefault();void action(
          ()=>api.endDateProration(selected.identityId,selected.versionId,selected.versionNo,endDate),
          'Proration version end-dated.'
        )}}>
        <label>Proration end date<input aria-label="Proration end date" required type="date"
          value={endDate} onChange={event=>setEndDate(event.target.value)}/></label>
        <button type="submit">End-date proration version</button>
      </form>}
      {canRetire&&<form className="form-grid" aria-label="Retire proration policy"
        onSubmit={event=>{event.preventDefault();void action(
          ()=>api.retireProration(selected.identityId,selected.identityVersionNo,retireDate,retireReason),
          'Proration policy retired.'
        )}}>
        <label>Proration retirement date<input aria-label="Proration retirement date" required type="date"
          value={retireDate} onChange={event=>setRetireDate(event.target.value)}/></label>
        <label>Proration retirement reason<input aria-label="Proration retirement reason" required
          value={retireReason} onChange={event=>setRetireReason(event.target.value)}/></label>
        <button type="submit">Retire proration policy</button>
      </form>}
    </div>}
  </div>;
}

function ProrationFields({
  value,onChange,prefix=''
}:{
  value:ProrationVersionWrite;
  onChange:(next:ProrationVersionWrite)=>void;
  prefix?:string;
}){
  return <>
    <label>{prefix}Proration method<select aria-label={`${prefix}Proration method`.trim()}
      value={value.method}
      onChange={event=>onChange({...value,method:event.target.value as ProrationMethod})}>
      {(['CALENDAR_DAYS','WORKING_DAYS','ACTUAL_DAYS','NONE'] as ProrationMethod[]).map(item=>
        <option key={item}>{item}</option>
      )}
    </select></label>
    <label>{prefix}Proration basis<select aria-label={`${prefix}Proration basis`.trim()}
      value={value.basis}
      onChange={event=>onChange({...value,basis:event.target.value as ProrationBasis})}>
      {(['PAY_PERIOD','MONTH','ANNUAL','DAILY_RATE'] as ProrationBasis[]).map(item=>
        <option key={item}>{item}</option>
      )}
    </select></label>
    <label>{prefix}Proration effective from<input
      aria-label={`${prefix}Proration effective from`.trim()} required type="date"
      value={value.effectiveFrom}
      onChange={event=>onChange({...value,effectiveFrom:event.target.value})}/></label>
    <label>{prefix}Proration effective to<input
      aria-label={`${prefix}Proration effective to`.trim()} type="date"
      value={value.effectiveTo??''}
      onChange={event=>onChange({...value,effectiveTo:event.target.value||undefined})}/></label>
  </>;
}

function AuditEvidence({events,label}:{events:AuditEventView[];label:string}){
  return <div aria-label={label}>
    <h4>{label}</h4>
    {events.length===0?<p>No audit events returned.</p>:<ol>{events.map((event,index)=>
      <li key={index}><code>{JSON.stringify(event)}</code></li>
    )}</ol>}
  </div>;
}
