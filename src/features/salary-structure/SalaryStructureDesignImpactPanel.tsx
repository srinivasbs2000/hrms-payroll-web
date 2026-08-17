import {useEffect,useMemo,useState} from 'react';
import type {SalaryStructureVersion} from './salary-structure-api';
import {
  httpSalaryStructureDesignImpactApi
} from './salary-structure-design-impact-api';
import type {
  SalaryStructureDesignImpact,
  SalaryStructureDesignImpactApi
} from './salary-structure-design-impact-api';

type Props={
  structure:SalaryStructureVersion;
  history:SalaryStructureVersion[];
  permissions:Set<string>;
  api?:SalaryStructureDesignImpactApi;
};

export function SalaryStructureDesignImpactPanel({
  structure,
  history,
  permissions,
  api=httpSalaryStructureDesignImpactApi
}:Props){
  const [open,setOpen]=useState(false);
  const [baselineVersionId,setBaselineVersionId]=useState('');
  const [impact,setImpact]=useState<SalaryStructureDesignImpact|null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');

  const candidates=useMemo(()=>history
    .filter(item=>item.versionId!==structure.versionId)
    .sort((left,right)=>right.versionSequence-left.versionSequence),[
      history,structure.versionId
    ]);

  useEffect(()=>{
    setImpact(null);
    setError('');
    setBaselineVersionId(candidates[0]?.versionId??'');
  },[structure.versionId,candidates]);

  if(!permissions.has('compensation.structure.read'))return null;

  async function compare(){
    if(!baselineVersionId)return;
    setLoading(true);setError('');
    try{
      setImpact(await api.compare(
        structure.identityId,
        baselineVersionId,
        structure.versionId));
    }catch(value){
      setError((value as Error).message);
    }finally{
      setLoading(false);
    }
  }

  if(!open)return <button type="button" onClick={()=>setOpen(true)}>
    Open design impact</button>;

  return <section className="configuration-panel" aria-labelledby="design-impact-title">
    <div className="section-heading"><div>
      <p className="eyebrow">E04-011 design evidence</p>
      <h3 id="design-impact-title">Version comparison & downstream impact</h3>
    </div></div>
    <p>Compare governed configuration before approval and publication.</p>
    {candidates.length===0?<p>No other version is available for comparison.</p>:<>
      <div className="form-grid">
        <label>Baseline version<select aria-label="Design impact baseline version"
          value={baselineVersionId}
          onChange={event=>setBaselineVersionId(event.target.value)}>
          {candidates.map(item=><option key={item.versionId} value={item.versionId}>
            v{item.versionSequence} · {item.name} · {item.approvalStatus}
          </option>)}
        </select></label>
        <button type="button" disabled={loading} onClick={()=>void compare()}>
          {loading?'Comparing…':'Compare selected versions'}
        </button>
      </div>
      {error&&<p className="error" role="alert">{error}</p>}
      {impact&&<>
        <div className="evidence-card">
          <strong>{impact.changes.length} configuration/dependency changes</strong>
          <span>{impact.downstreamImpacts.length} downstream review impacts</span>
          <p><small>Comparison evidence</small><br/><code>{impact.comparisonHash}</code></p>
        </div>
        <div className="evidence-list">
          <h4>What changed</h4>
          {impact.changes.length===0?<p>No design difference detected.</p>:
            impact.changes.map((change,index)=><article
              className="evidence-card" key={`${change.area}-${change.key}-${index}`}>
              <div className="section-heading">
                <strong>{change.area} · {change.key}</strong>
                <span>{change.changeType}</span>
              </div>
              <small>Before: {change.beforeValue??'—'}</small>
              <small>After: {change.afterValue??'—'}</small>
            </article>)}
        </div>
        <div className="evidence-list">
          <h4>Downstream review</h4>
          {impact.downstreamImpacts.map(item=><article
            className="evidence-card" key={item.impactCode}>
            <div className="section-heading">
              <strong>{item.impactCode}</strong><span>{item.severity}</span>
            </div>
            <p>{item.detail}</p>
          </article>)}
        </div>
        <div className="hash-grid">
          <dt>Baseline configuration</dt><dd><code>{impact.baseline.configurationHash}</code></dd>
          <dt>Proposed configuration</dt><dd><code>{impact.proposed.configurationHash}</code></dd>
          <dt>Baseline statutory revision</dt><dd>{impact.baseline.statutoryBindingRevision}</dd>
          <dt>Proposed statutory revision</dt><dd>{impact.proposed.statutoryBindingRevision}</dd>
          <dt>Baseline dependencies</dt><dd>{impact.baselineDependencies.length}</dd>
          <dt>Proposed dependencies</dt><dd>{impact.proposedDependencies.length}</dd>
        </div>
        <p><small>{impact.disclaimer}</small></p>
      </>}
    </>}
  </section>;
}
