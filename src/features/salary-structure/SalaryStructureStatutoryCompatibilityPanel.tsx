import {useMemo,useState} from 'react';
import type {FormEvent} from 'react';
import type {SalaryStructureValidation,SalaryStructureVersion} from './salary-structure-api';
import {httpSalaryStructureStatutoryApi} from './salary-structure-statutory-api';
import type {
  SalaryStructureStatutoryApi,
  SalaryStructureStatutoryBinding,
  StatutoryBindingPurpose,
  StatutoryCompatibilityEvaluation,
  StatutoryEnforcementLevel,
  StatutoryRuleVersionOption
} from './salary-structure-statutory-api';

export function SalaryStructureStatutoryCompatibilityPanel({
  permissions,structure,validations,api=httpSalaryStructureStatutoryApi
}:{
  permissions:Set<string>;
  structure:SalaryStructureVersion;
  validations:SalaryStructureValidation[];
  api?:SalaryStructureStatutoryApi;
}){
  const [loaded,setLoaded]=useState(false);
  const [rules,setRules]=useState<StatutoryRuleVersionOption[]>([]);
  const [bindings,setBindings]=useState<SalaryStructureStatutoryBinding[]>([]);
  const [evaluations,setEvaluations]=useState<StatutoryCompatibilityEvaluation[]>([]);
  const [ruleVersionId,setRuleVersionId]=useState('');
  const [enforcement,setEnforcement]=useState<StatutoryEnforcementLevel>('BLOCKING');
  const [componentVersionId,setComponentVersionId]=useState('');
  const [validationId,setValidationId]=useState('');
  const [error,setError]=useState('');

  const selectedRule=useMemo(
    ()=>rules.find(item=>item.statutoryRuleVersionId===ruleVersionId),
    [rules,ruleVersionId]);
  const purpose:StatutoryBindingPurpose=
    selectedRule?.ruleCategory==='MINIMUM_WAGE'?'MINIMUM_WAGE':'STATUTORY_RULE';

  async function load(){
    setError('');
    try{
      const initialValidationId=validations[0]?.validationId||'';
      const [available,current,history]=await Promise.all([
        api.ruleVersions(structure.effectiveFrom),
        api.bindings(structure.identityId,structure.versionId),
        initialValidationId
          ?api.evaluations(structure.identityId,structure.versionId,initialValidationId)
          :Promise.resolve([])
      ]);
      setRules(available);
      setBindings(current);
      setEvaluations(history);
      setRuleVersionId(value=>value||available[0]?.statutoryRuleVersionId||'');
      setComponentVersionId(value=>value||structure.lines[0]?.componentVersionId||'');
      setValidationId(value=>value||initialValidationId);
      setLoaded(true);
    }catch(value){setError((value as Error).message)}
  }

  async function bind(event:FormEvent){
    event.preventDefault();
    setError('');
    if(!selectedRule)return;
    try{
      const created=await api.bind(
        structure.identityId,
        structure.versionId,
        {
          statutoryRuleVersionId:selectedRule.statutoryRuleVersionId,
          bindingPurpose:purpose,
          enforcementLevel:enforcement,
          componentVersionId:purpose==='MINIMUM_WAGE'?componentVersionId:undefined
        });
      setBindings(current=>[created,...current]);
    }catch(value){setError((value as Error).message)}
  }

  async function retire(item:SalaryStructureStatutoryBinding){
    setError('');
    try{
      const retired=await api.retire(
        structure.identityId,
        structure.versionId,
        item.bindingId,
        item.versionNo);
      setBindings(current=>current.map(value=>
        value.bindingId===retired.bindingId?retired:value));
    }catch(value){setError((value as Error).message)}
  }

  async function selectValidation(id:string){
    setValidationId(id);
    setError('');
    if(!id){setEvaluations([]);return}
    try{
      setEvaluations(await api.evaluations(structure.identityId,structure.versionId,id));
    }catch(value){setError((value as Error).message)}
  }

  async function evaluate(){
    setError('');
    if(!validationId)return;
    try{
      const result=await api.evaluate(
        structure.identityId,
        structure.versionId,
        validationId);
      setEvaluations(current=>[
        result,
        ...current.filter(value=>value.evaluationId!==result.evaluationId)
      ]);
    }catch(value){setError((value as Error).message)}
  }

  if(!permissions.has('compensation.structure.read')){
    return <section className="configuration-panel">
      <h3>Statutory compatibility</h3>
      <p className="permission-note">
        Statutory compatibility requires <code>compensation.structure.read</code>.
      </p>
    </section>;
  }

  return <section className="configuration-panel" aria-labelledby="statutory-compatibility-title">
    <div className="section-heading">
      <div>
        <p className="eyebrow">E04-009 governed evidence</p>
        <h3 id="statutory-compatibility-title">Statutory &amp; minimum-wage compatibility</h3>
      </div>
      {!loaded&&<button type="button" onClick={()=>void load()}>Load statutory compatibility</button>}
    </div>
    <p className="simulation-disclaimer">
      DESIGN-TIME STATUTORY COMPATIBILITY — NOT AN OFFICIAL PAYROLL OR LEGAL CALCULATION
    </p>
    <p>
      Legal values remain in approved statutory-rule versions. Salary structures store only
      exact-version bindings and compatibility evidence.
    </p>
    {error&&<p className="error" role="alert">{error}</p>}

    {loaded&&<>
      <div className="evidence-list">
        {bindings.length===0?<p>No statutory rule is bound to this exact structure version.</p>:
          bindings.map(item=><article className="evidence-card" key={item.bindingId}>
            <div className="section-heading">
              <strong>{item.ruleCode} · {item.bindingPurpose}</strong>
              <span>{item.enforcementLevel} · {item.status}</span>
            </div>
            <p>{item.jurisdictionCode} / {item.authorityCode} · rule v{item.statutoryRuleVersionSequence}</p>
            {item.minimumAmount!==null&&<p>
              Minimum: {item.minimumAmount} {item.currency} / {item.periodBasis}
            </p>}
            {item.status==='ACTIVE'&&structure.approvalStatus==='DRAFT'&&
              permissions.has('compensation.structure.version.create')&&
              <button type="button" onClick={()=>void retire(item)}>Retire binding</button>}
          </article>)}
      </div>

      {structure.approvalStatus==='DRAFT'&&permissions.has('compensation.structure.version.create')&&
        <form className="panel-form" onSubmit={event=>void bind(event)}>
          <label>Approved statutory rule version
            <select required value={ruleVersionId} onChange={event=>setRuleVersionId(event.target.value)}>
              <option value="">Select statutory rule</option>
              {rules.map(item=><option key={item.statutoryRuleVersionId} value={item.statutoryRuleVersionId}>
                {item.ruleCode} · {item.ruleCategory} · {item.jurisdictionCode}/{item.authorityCode}
              </option>)}
            </select>
          </label>
          <label>Binding purpose<input readOnly value={purpose}/></label>
          <label>Enforcement
            <select value={enforcement} onChange={event=>setEnforcement(event.target.value as StatutoryEnforcementLevel)}>
              <option value="BLOCKING">Blocking</option>
              <option value="ADVISORY">Advisory</option>
            </select>
          </label>
          {purpose==='MINIMUM_WAGE'&&<label>Wage comparison component
            <select required value={componentVersionId} onChange={event=>setComponentVersionId(event.target.value)}>
              <option value="">Select structure component</option>
              {structure.lines.map(line=><option key={line.componentVersionId} value={line.componentVersionId}>
                {line.componentCode} · {line.componentName}
              </option>)}
            </select>
          </label>}
          {selectedRule?.minimumAmount!==null&&selectedRule?.minimumAmount!==undefined&&<p>
            Authority threshold: {selectedRule.minimumAmount} {selectedRule.currency} / {selectedRule.periodBasis}
          </p>}
          <button type="submit">Bind statutory authority</button>
        </form>}

      <div className="panel-form">
        <label>Structural validation evidence
          <select value={validationId} onChange={event=>void selectValidation(event.target.value)}>
            <option value="">Select validation</option>
            {validations.map(item=><option key={item.validationId} value={item.validationId}>
              {item.validationStatus} · {item.effectiveDate} · {item.resultHash.slice(0,12)}
            </option>)}
          </select>
        </label>
        {permissions.has('compensation.structure.simulate')&&
          <button type="button" disabled={!validationId} onClick={()=>void evaluate()}>
            Evaluate statutory compatibility
          </button>}
      </div>

      <div className="evidence-list">
        {evaluations.map(item=><article className="evidence-card" key={item.evaluationId}>
          <div className="section-heading">
            <strong>{item.validationStatus}</strong>
            <span>{item.blockingIssueCount} blockers · {item.advisoryIssueCount} advisories</span>
          </div>
          <p>{item.disclaimer}</p>
          <p><code>{item.evidenceHash}</code></p>
          {item.issues.map(issue=><p key={issue.issueId}>
            <strong>{issue.severity}: {issue.issueCode}</strong> — {issue.issueDetail}
          </p>)}
        </article>)}
      </div>
    </>}
  </section>;
}
