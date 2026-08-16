import {useState} from 'react';
import type {SalaryStructureVersion} from './salary-structure-api';
import {
  httpSalaryStructureLifecycleApi
} from './salary-structure-lifecycle-api';
import type {
  SalaryStructureLifecycle,
  SalaryStructureLifecycleApi
} from './salary-structure-lifecycle-api';

export function SalaryStructureLifecyclePanel({
  structure,permissions,api=httpSalaryStructureLifecycleApi
}:{
  structure:SalaryStructureVersion;
  permissions:Set<string>;
  api?:SalaryStructureLifecycleApi;
}){
  const [opened,setOpened]=useState(false);
  const [state,setState]=useState<SalaryStructureLifecycle|null>(null);
  const [comment,setComment]=useState('');
  const [reason,setReason]=useState('');
  const [error,setError]=useState('');

  async function load(){
    setError('');
    try{
      setState(await api.lifecycle(structure.identityId,structure.versionId));
      setOpened(true);
    }catch(value){setError((value as Error).message)}
  }

  async function submit(){
    if(!state)return;setError('');
    try{setState(await api.submit(
      structure.identityId,structure.versionId,state.versionNo,comment||undefined));setComment('')}
    catch(value){setError((value as Error).message)}
  }

  async function approve(){
    if(!state)return;setError('');
    try{
      await api.approve(structure.identityId,structure.versionId);
      setState(await api.lifecycle(structure.identityId,structure.versionId));
    }catch(value){setError((value as Error).message)}
  }

  async function reject(){
    if(!state||!reason.trim())return;setError('');
    try{setState(await api.reject(
      structure.identityId,structure.versionId,state.versionNo,reason.trim()));setReason('')}
    catch(value){setError((value as Error).message)}
  }

  async function publish(){
    if(!state)return;setError('');
    try{setState(await api.publish(
      structure.identityId,structure.versionId,state.versionNo,comment||undefined));setComment('')}
    catch(value){setError((value as Error).message)}
  }

  if(!permissions.has('compensation.structure.read'))return null;

  return <section className="configuration-panel" aria-labelledby="structure-lifecycle-title">
    <div className="section-heading">
      <div><p className="eyebrow">E04-010 maker-checker</p>
        <h3 id="structure-lifecycle-title">Submission, approval &amp; publication</h3></div>
      {!opened&&<button type="button" onClick={()=>void load()}>Open approval lifecycle</button>}
    </div>
    <p>Approval and publication are separate governed actions. Only published structures become effective configuration.</p>
    {error&&<p className="error" role="alert">{error}</p>}
    {state&&<>
      <div className="section-heading">
        <strong>{state.workflowStatus}</strong>
        <span>{state.publishedActive?'Published & active':'Version '+state.versionNo}</span>
      </div>
      <dl className="hash-grid">
        <dt>Validation evidence</dt><dd><code>{state.validationFingerprint??'Not bound'}</code></dd>
        <dt>Statutory revision</dt><dd>{state.statutoryBindingRevision}</dd>
        <dt>Submitted by</dt><dd>{state.submittedBy??'—'}</dd>
        <dt>Approved by</dt><dd>{state.approvedBy??'—'}</dd>
        <dt>Published by</dt><dd>{state.publishedBy??'—'}</dd>
      </dl>

      {state.workflowStatus==='DRAFT'&&permissions.has('compensation.structure.submit')&&<div className="panel-form">
        <label>Submission comment<textarea aria-label="Submission comment" value={comment}
          onChange={event=>setComment(event.target.value)}/></label>
        <button type="button" disabled={!state.validationFingerprint} onClick={()=>void submit()}>
          Submit for approval
        </button>
      </div>}

      {state.workflowStatus==='SUBMITTED'&&permissions.has('compensation.structure.approve')&&<div className="panel-form">
        <button type="button" onClick={()=>void approve()}>Approve submitted structure</button>
        <label>Rejection reason<textarea aria-label="Rejection reason" value={reason}
          onChange={event=>setReason(event.target.value)}/></label>
        <button type="button" disabled={!reason.trim()} onClick={()=>void reject()}>
          Reject submission
        </button>
      </div>}

      {state.workflowStatus==='APPROVED'&&permissions.has('compensation.structure.publish')&&<div className="panel-form">
        <label>Publication comment<textarea aria-label="Publication comment" value={comment}
          onChange={event=>setComment(event.target.value)}/></label>
        <button type="button" onClick={()=>void publish()}>Publish approved structure</button>
      </div>}

      <div className="evidence-list">
        <h4>Immutable workflow history</h4>
        {state.actions.length===0?<p>No workflow actions yet.</p>:state.actions.map(action=><article
          className="evidence-card" key={action.actionId}>
          <div className="section-heading"><strong>{action.actionType}</strong>
            <span>#{action.actionSequence} · {action.actor}</span></div>
          {action.comment&&<p>{action.comment}</p>}
          <p><code>{action.actionHash}</code></p>
          <small>Validation {action.validationFingerprint??'none'} · statutory revision {action.statutoryBindingRevision}</small>
        </article>)}
      </div>
    </>}
  </section>;
}
