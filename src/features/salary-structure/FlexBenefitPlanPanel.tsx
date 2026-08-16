import {FormEvent,useCallback,useEffect,useMemo,useState} from 'react';
import {
  BenefitSupplementalPlan,FlexBenefitApi,FlexBenefitCreate,FlexBenefitOptionWrite,FlexComponentOption,
  FlexBenefitPlan,FlexBenefitVersionWrite,FlexChangeRule,FlexFinalRule,FlexJoiningRule,
  FlexRetroRule,FlexUnusedRule,httpFlexBenefitApi
} from './flex-benefit-api';

type Props={api?:FlexBenefitApi;permissions:Set<string>;asOf:string};
type OptionDraft={componentVersionId:string;componentCode:string;componentName:string;
  minimum:string;maximum:string;defaultValue:string;proofRequired:boolean};

export function FlexBenefitPlanPanel({api=httpFlexBenefitApi,permissions,asOf}:Props){
  const [items,setItems]=useState<FlexBenefitPlan[]>([]);
  const [benefitPlans,setBenefitPlans]=useState<BenefitSupplementalPlan[]>([]);
  const [eligibility,setEligibility]=useState<{versionId:string;code:string}[]>([]);
  const [components,setComponents]=useState<FlexComponentOption[]>([]);
  const [selected,setSelected]=useState<FlexBenefitPlan|null>(null);
  const [history,setHistory]=useState<FlexBenefitPlan[]>([]);
  const [error,setError]=useState('');
  const canRead=permissions.has('compensation.structure.read');

  const load=useCallback(async()=>{
    if(!canRead)return;
    setError('');
    try{
      const [plans,supplemental,rules,componentOptions]=await Promise.all([
        api.list(asOf),api.benefitPlans(asOf),
        permissions.has('compensation.eligibility-rule.read')?api.eligibilityRules(asOf):Promise.resolve([]),
        permissions.has('compensation.component.read')?api.components(asOf):Promise.resolve([])
      ]);
      setItems(plans);
      setBenefitPlans(supplemental.filter(item=>item.planType==='BENEFIT'&&item.approvalStatus==='APPROVED'));
      setEligibility(rules.filter(item=>item.approvalStatus==='APPROVED'));
      setComponents(componentOptions.filter(item=>item.approvalStatus===undefined||item.approvalStatus==='APPROVED'));
    }catch(value){setError((value as Error).message)}
  },[api,asOf,canRead,permissions]);
  useEffect(()=>{void load()},[load]);

  async function select(item:FlexBenefitPlan){
    setSelected(item);setError('');
    try{setHistory(await api.history(item.identityId))}catch(value){setError((value as Error).message)}
  }
  async function create(input:FlexBenefitCreate){
    setError('');try{const result=await api.create(input);await load();await select(result)}
    catch(value){setError((value as Error).message)}
  }
  async function approve(item:FlexBenefitPlan){
    setError('');try{const result=await api.approve(item.identityId,item.versionId);await load();await select(result)}
    catch(value){setError((value as Error).message)}
  }

  if(!canRead)return <section className="configuration-panel"><h3>Flexible benefits</h3>
    <p className="permission-note">Flexible-benefit configuration requires
      <code> compensation.structure.read</code>.</p></section>;

  return <section className="configuration-panel" aria-labelledby="flex-benefit-title">
    <div className="section-heading"><div><p className="eyebrow">E04-006 policy configuration</p>
      <h3 id="flex-benefit-title">Flexible-benefit plans</h3></div></div>
    <p>Reusable annual allowance baskets pinned to approved BENEFIT supplemental-plan
      component versions. Employee elections are not stored in this workbench.</p>
    {error&&<p className="error" role="alert">{error}</p>}
    <div className="configuration-list">{items.map(item=><button
      key={item.versionId} className="configuration-button" onClick={()=>void select(item)}>
      <strong>{item.code}</strong><span>{item.name}</span>
      <small>{item.annualBasketAmount} INR · {item.unusedBalanceRule.toLowerCase().replaceAll('_',' ')}</small>
    </button>)}</div>
    {permissions.has('compensation.structure.create')&&
      <FlexBenefitEditor benefitPlans={benefitPlans} eligibility={eligibility} components={components}
        canReadComponents={permissions.has('compensation.component.read')} onCreate={create}/>}
    {selected&&<section className="card">
      <div className="section-heading"><h4>{selected.code} policy timeline</h4>
        <span className={`badge ${selected.approvalStatus.toLowerCase()}`}>{selected.approvalStatus}</span></div>
      <ol className="compact-timeline">{history.map(item=><li key={item.versionId}>
        <span><strong>v{item.versionSequence} {item.name}</strong>
          <small>{item.supplementalPlanCode} v{item.supplementalPlanVersionSequence}
            {' · '}{item.electionWindowStart} to {item.electionWindowEnd} · {item.options.length} options</small></span>
        {item.approvalStatus==='DRAFT'&&!item.superseded&&permissions.has('compensation.structure.approve')&&
          <button onClick={()=>void approve(item)}>Approve flex-benefit policy</button>}
      </li>)}</ol>
      {permissions.has('compensation.structure.simulate')&&<ElectionPolicyValidator api={api} plan={selected}/>}
    </section>}
  </section>;
}

function FlexBenefitEditor({benefitPlans,eligibility,components,canReadComponents,onCreate}:{
  benefitPlans:BenefitSupplementalPlan[];eligibility:{versionId:string;code:string}[];
  components:FlexComponentOption[];canReadComponents:boolean;
  onCreate:(input:FlexBenefitCreate)=>Promise<void>
}){
  const today=()=>new Date().toISOString().slice(0,10);
  const [code,setCode]=useState('');const [name,setName]=useState('');
  const [supplemental,setSupplemental]=useState('');const [eligibilityRule,setEligibilityRule]=useState('');
  const [basket,setBasket]=useState('120000.0000');const [effectiveFrom,setEffectiveFrom]=useState(today());
  const [effectiveTo,setEffectiveTo]=useState('');const [windowStart,setWindowStart]=useState(today());
  const [windowEnd,setWindowEnd]=useState(()=>{const date=new Date();date.setDate(date.getDate()+30);return date.toISOString().slice(0,10)});
  const [joiningRule,setJoiningRule]=useState<FlexJoiningRule>('DEFAULT_ELECTION');
  const [joiningDays,setJoiningDays]=useState('30');
  const [changeRule,setChangeRule]=useState<FlexChangeRule>('QUALIFYING_EVENT_ONLY');
  const [unusedRule,setUnusedRule]=useState<FlexUnusedRule>('FORFEIT');const [carryLimit,setCarryLimit]=useState('');
  const [fallback,setFallback]=useState('');const [encashment,setEncashment]=useState('');
  const [finalRule,setFinalRule]=useState<FlexFinalRule>('FORFEIT');
  const [retroRule,setRetroRule]=useState<FlexRetroRule>('APPROVAL_REQUIRED');
  const [allowCompChange,setAllowCompChange]=useState(false);const [options,setOptions]=useState<OptionDraft[]>([]);
  const [formError,setFormError]=useState('');
  const selectedPlan=useMemo(()=>benefitPlans.find(item=>item.versionId===supplemental),[benefitPlans,supplemental]);

  function choosePlan(versionId:string){
    setSupplemental(versionId);const plan=benefitPlans.find(item=>item.versionId===versionId);
    setOptions(plan?.lines.map(line=>({componentVersionId:line.componentVersionId,componentCode:line.componentCode,
      componentName:line.componentName,minimum:String(line.minimumAmount??0),maximum:String(line.maximumAmount??''),
      defaultValue:String(line.defaultAmount??0),proofRequired:false}))??[]);
  }
  function updateOption(id:string,change:Partial<OptionDraft>){
    setOptions(current=>current.map(item=>item.componentVersionId===id?{...item,...change}:item));
  }
  function build():FlexBenefitCreate|null{
    if(!selectedPlan){setFormError('Select an approved BENEFIT supplemental plan.');return null}
    if(options.length===0){setFormError('The selected benefit plan has no component options.');return null}
    const decimal=/^(?:0|[1-9]\d*)(?:\.\d{1,4})?$/;
    if(!decimal.test(basket)||Number(basket)<=0){setFormError('Annual basket must be a positive decimal with up to four fraction digits.');return null}
    const optionWrites:FlexBenefitOptionWrite[]=[];
    for(const [index,item] of options.entries()){
      if(!decimal.test(item.minimum)||!decimal.test(item.defaultValue)||(item.maximum&&!decimal.test(item.maximum))){
        setFormError(`Option ${index+1} amounts must use up to four fraction digits.`);return null}
      optionWrites.push({optionSequence:index+1,componentVersionId:item.componentVersionId,
        minimumAnnualAmount:item.minimum,maximumAnnualAmount:item.maximum||undefined,
        defaultAnnualAmount:item.defaultValue,proofRequired:item.proofRequired});
    }
    if(unusedRule==='CARRY_FORWARD'&&(!decimal.test(carryLimit)||Number(carryLimit)<Number(basket))){
      setFormError('Carry-forward limit must cover the full annual basket.');return null}
    if((unusedRule==='TAXABLE_FALLBACK'||finalRule==='TAXABLE_FALLBACK')&&!fallback){
      setFormError('Taxable fallback requires a fallback component version.');return null}
    if((unusedRule==='ENCASH'||finalRule==='ENCASH')&&!encashment){
      setFormError('Encashment requires an encashment component version.');return null}
    setFormError('');
    const version:FlexBenefitVersionWrite={name,currency:'INR',supplementalPlanVersionId:supplemental,
      eligibilityRuleVersionId:eligibilityRule||undefined,annualBasketAmount:basket,
      electionWindowStart:windowStart,electionWindowEnd:windowEnd,midYearJoiningRule:joiningRule,
      joiningElectionWindowDays:joiningRule==='OPEN_SPECIAL_WINDOW'?Number(joiningDays):undefined,
      midYearChangeRule:changeRule,unusedBalanceRule:unusedRule,
      carryForwardLimit:unusedRule==='CARRY_FORWARD'?carryLimit:undefined,
      taxableFallbackComponentVersionId:fallback||undefined,encashmentComponentVersionId:encashment||undefined,
      finalSettlementRule:finalRule,retroCorrectionRule:retroRule,allowTotalCompensationChange:allowCompChange,
      effectiveFrom,effectiveTo:effectiveTo||undefined,options:optionWrites};
    return {code,version};
  }
  async function submit(event:FormEvent){event.preventDefault();const input=build();if(input)await onCreate(input)}

  return <form className="card form-grid" onSubmit={event=>void submit(event)}><h4>Create flex-benefit policy draft</h4>
    {formError&&<p className="error" role="alert">{formError}</p>}
    <label>Flex plan code<input required pattern="[A-Z][A-Z0-9_]{1,39}" value={code}
      onChange={event=>setCode(event.target.value.toUpperCase())}/></label>
    <label>Flex plan name<input required value={name} onChange={event=>setName(event.target.value)}/></label>
    <label>Approved BENEFIT supplemental plan<select aria-label="Approved BENEFIT supplemental plan" required
      value={supplemental} onChange={event=>choosePlan(event.target.value)}><option value="">Select benefit component basket</option>
      {benefitPlans.map(item=><option key={item.versionId} value={item.versionId}>{item.code} v{item.versionSequence} - {item.name}</option>)}
    </select></label>
    <label>Eligibility rule<select value={eligibilityRule} onChange={event=>setEligibilityRule(event.target.value)}>
      <option value="">No plan-level rule</option>{eligibility.map(item=><option key={item.versionId} value={item.versionId}>{item.code}</option>)}
    </select></label>
    <label>Annual basket amount<input aria-label="Annual basket amount" required inputMode="decimal" value={basket}
      onChange={event=>setBasket(event.target.value)}/></label>
    <label>Election window starts<input required type="date" value={windowStart} onChange={event=>setWindowStart(event.target.value)}/></label>
    <label>Election window ends (exclusive)<input required type="date" value={windowEnd} onChange={event=>setWindowEnd(event.target.value)}/></label>
    <label>Mid-year joining rule<select value={joiningRule} onChange={event=>setJoiningRule(event.target.value as FlexJoiningRule)}>
      <option>DEFAULT_ELECTION</option><option>OPEN_SPECIAL_WINDOW</option><option>NEXT_WINDOW</option><option>APPROVAL_REQUIRED</option>
    </select></label>
    {joiningRule==='OPEN_SPECIAL_WINDOW'&&<label>Joiner election days<input type="number" min="1" max="365" value={joiningDays}
      onChange={event=>setJoiningDays(event.target.value)}/></label>}
    <label>Mid-year change rule<select value={changeRule} onChange={event=>setChangeRule(event.target.value as FlexChangeRule)}>
      <option>PROHIBITED</option><option>QUALIFYING_EVENT_ONLY</option><option>APPROVAL_REQUIRED</option>
    </select></label>
    <label>Unused balance rule<select value={unusedRule} onChange={event=>setUnusedRule(event.target.value as FlexUnusedRule)}>
      <option>FORFEIT</option><option>CARRY_FORWARD</option><option>TAXABLE_FALLBACK</option><option>ENCASH</option>
    </select></label>
    {unusedRule==='CARRY_FORWARD'&&<label>Carry-forward limit<input inputMode="decimal" value={carryLimit}
      onChange={event=>setCarryLimit(event.target.value)}/></label>}
    {(unusedRule==='TAXABLE_FALLBACK'||finalRule==='TAXABLE_FALLBACK')&&<label>Taxable fallback component<select
      aria-label="Taxable fallback component" disabled={!canReadComponents} value={fallback}
      onChange={event=>setFallback(event.target.value)}><option value="">Select approved component</option>
      {components.map(item=><option key={item.versionId} value={item.versionId}>{item.code} - {item.name}</option>)}
    </select></label>}
    {(unusedRule==='ENCASH'||finalRule==='ENCASH')&&<label>Encashment component<select
      aria-label="Encashment component" disabled={!canReadComponents} value={encashment}
      onChange={event=>setEncashment(event.target.value)}><option value="">Select approved component</option>
      {components.map(item=><option key={item.versionId} value={item.versionId}>{item.code} - {item.name}</option>)}
    </select></label>}
    <label>Final settlement rule<select value={finalRule} onChange={event=>setFinalRule(event.target.value as FlexFinalRule)}>
      <option>FORFEIT</option><option>ENCASH</option><option>TAXABLE_FALLBACK</option><option>POLICY_ENGINE</option>
    </select></label>
    <label>Retro correction rule<select value={retroRule} onChange={event=>setRetroRule(event.target.value as FlexRetroRule)}>
      <option>PROHIBITED</option><option>OPEN_PERIOD_ONLY</option><option>APPROVAL_REQUIRED</option>
    </select></label>
    {!canReadComponents&&(unusedRule==='TAXABLE_FALLBACK'||unusedRule==='ENCASH'||finalRule==='TAXABLE_FALLBACK'||finalRule==='ENCASH')&&
      <p className="permission-note">Component read permission is required to select fallback or encashment treatment.</p>}
    <label>Policy effective from<input required type="date" value={effectiveFrom} onChange={event=>setEffectiveFrom(event.target.value)}/></label>
    <label>Policy effective to<input type="date" value={effectiveTo} onChange={event=>setEffectiveTo(event.target.value)}/></label>
    <label><input type="checkbox" checked={allowCompChange} onChange={event=>setAllowCompChange(event.target.checked)}/>
      Permit explicitly approved total-compensation adjustment</label>
    <fieldset><legend>Benefit options and annual limits</legend>{options.map((item,index)=><div className="line-editor" key={item.componentVersionId}>
      <strong>{index+1}. {item.componentCode} - {item.componentName}</strong>
      <label>Minimum annual<input aria-label={`${item.componentCode} minimum annual`} value={item.minimum}
        onChange={event=>updateOption(item.componentVersionId,{minimum:event.target.value})}/></label>
      <label>Maximum annual<input aria-label={`${item.componentCode} maximum annual`} value={item.maximum}
        onChange={event=>updateOption(item.componentVersionId,{maximum:event.target.value})}/></label>
      <label>Default annual<input aria-label={`${item.componentCode} default annual`} value={item.defaultValue}
        onChange={event=>updateOption(item.componentVersionId,{defaultValue:event.target.value})}/></label>
      <label><input type="checkbox" checked={item.proofRequired}
        onChange={event=>updateOption(item.componentVersionId,{proofRequired:event.target.checked})}/>Proof required</label>
    </div>)}</fieldset>
    <button type="submit">Create flex-benefit policy draft</button>
  </form>;
}

function ElectionPolicyValidator({api,plan}:{api:FlexBenefitApi;plan:FlexBenefitPlan}){
  const [date,setDate]=useState(plan.electionWindowStart);
  const [amounts,setAmounts]=useState<Record<string,string>>(
    Object.fromEntries(plan.options.map(item=>[item.componentVersionId,item.defaultAnnualAmount])));
  const [eligibilityFacts,setEligibilityFacts]=useState('{}');
  const [result,setResult]=useState<Awaited<ReturnType<FlexBenefitApi['validateElection']>>|null>(null);
  const [error,setError]=useState('');
  async function submit(event:FormEvent){
    event.preventDefault();setError('');
    try{
      const facts=JSON.parse(eligibilityFacts) as Record<string,unknown>;
      setResult(await api.validateElection(plan.identityId,plan.versionId,{
        electionDate:date,midYearChange:false,qualifyingEvent:false,approvedPolicyException:false,
        approvedCompensationAdjustment:false,eligibilityFacts:facts,allocations:plan.options.map(item=>({
          componentVersionId:item.componentVersionId,annualAmount:amounts[item.componentVersionId]??'0'}))
      }));
    }catch(value){setError((value as Error).message)}
  }
  return <form className="panel-form" onSubmit={event=>void submit(event)}><h4>Design-time election-policy validation</h4>
    <p>Validates eligibility, basket, configured option limits and election window; it does not create an employee election.</p>
    {error&&<p className="error" role="alert">{error}</p>}
    <label>Election date<input type="date" required value={date} onChange={event=>setDate(event.target.value)}/></label>
    {plan.eligibilityRuleVersionId&&<label>Eligibility facts<textarea aria-label="Flex eligibility facts"
      value={eligibilityFacts} onChange={event=>setEligibilityFacts(event.target.value)}/></label>}
    {plan.options.map(item=><label key={item.componentVersionId}>{item.componentCode} annual allocation<input inputMode="decimal"
      value={amounts[item.componentVersionId]??''} onChange={event=>setAmounts(current=>({...current,[item.componentVersionId]:event.target.value}))}/></label>)}
    <button type="submit">Validate flex election policy</button>
    {result&&<div className="evidence-card"><strong>{result.validationStatus}</strong>
      <p>{result.electedAnnualAmount} elected · {result.residualAnnualAmount} residual · {result.residualTreatment}</p>
      {result.blockers.length>0&&<p>Blockers: {result.blockers.join(', ')}</p>}
      {result.warnings.length>0&&<p>Warnings: {result.warnings.join(', ')}</p>}<small>{result.disclaimer}</small></div>}
  </form>;
}
