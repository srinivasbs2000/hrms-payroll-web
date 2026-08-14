import {FormEvent,useCallback,useEffect,useMemo,useState} from 'react';
import {currentPermissions,HierarchyNode,httpOrganisationApi,OrganisationApi,OrganisationHierarchy} from '../organisation/organisation-api';
import {
  ApprovalAuthority,ApprovalAuthorityWrite,ApprovalDelegation,ApprovalDelegationWrite,
  ApprovalOwnerKind,ApprovalRole,FoundationApprovalAuthorityApi,httpFoundationApprovalAuthorityApi
} from './foundation-approval-authority-api';

type Props={
  api?:FoundationApprovalAuthorityApi;
  organisationApi?:OrganisationApi;
  permissions?:Set<string>;
};

type OwnerOption={kind:ApprovalOwnerKind;id:string;label:string};
type SignedInActor={id:string;label:string};
const today=()=>new Date().toISOString().slice(0,10);

function signedInActor():SignedInActor|undefined{
  const token=window.payrollSession?.accessToken;
  if(!token)return undefined;
  try{
    const segment=token.split('.')[1];
    if(!segment)return undefined;
    const base64=segment.replaceAll('-','+').replaceAll('_','/');
    const payload=JSON.parse(atob(base64.padEnd(Math.ceil(base64.length/4)*4,'='))) as {
      iss?:unknown;sub?:unknown;preferred_username?:unknown;name?:unknown
    };
    if(typeof payload.iss!=='string'||typeof payload.sub!=='string')return undefined;
    const username=typeof payload.preferred_username==='string'&&payload.preferred_username.trim()
      ?payload.preferred_username
      :typeof payload.name==='string'&&payload.name.trim()?payload.name:'Current signed-in user';
    return {id:`${payload.iss}|${payload.sub}`,label:username};
  }catch{
    return undefined;
  }
}

function flattenOwners(hierarchy:OrganisationHierarchy):OwnerOption[]{
  const result:OwnerOption[]=[];
  function visit(node:HierarchyNode){
    if(node.value.kind==='LEGAL_ENTITY'||node.value.kind==='PAYROLL_STATUTORY_UNIT'){
      result.push({
        kind:node.value.kind,
        id:node.value.identityId,
        label:`${node.value.code} — ${node.value.name}`
      });
    }
    for(const child of node.children)visit(child);
  }
  for(const root of hierarchy.legalEntities)visit(root);
  return result;
}

export function FoundationApprovalAuthorityPage({
  api=httpFoundationApprovalAuthorityApi,
  organisationApi=httpOrganisationApi,
  permissions
}:Props){
  const effectivePermissions=useMemo(()=>permissions??currentPermissions(),[permissions]);
  const currentActor=useMemo(()=>signedInActor(),[]);
  const canRead=effectivePermissions.has('foundation-approval-authority.read');
  const canWriteAuthority=effectivePermissions.has('foundation-approval-authority.write');
  const canWriteDelegation=effectivePermissions.has('foundation-approval-delegation.write');
  const [authorities,setAuthorities]=useState<ApprovalAuthority[]>([]);
  const [delegations,setDelegations]=useState<ApprovalDelegation[]>([]);
  const [owners,setOwners]=useState<OwnerOption[]>([]);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');

  const load=useCallback(async()=>{
    if(!canRead)return;
    setLoading(true);setError('');
    try{
      const [authorityRows,delegationRows]=await Promise.all([
        api.listAuthorities(),api.listDelegations()
      ]);
      setAuthorities(authorityRows);
      setDelegations(delegationRows);
      try{
        const hierarchy=await organisationApi.hierarchy(today());
        setOwners(flattenOwners(hierarchy));
      }catch{
        setOwners([]);
      }
    }catch(exception){setError((exception as Error).message)}
    finally{setLoading(false)}
  },[api,canRead,organisationApi]);

  useEffect(()=>{void load()},[load]);

  async function createAuthority(input:ApprovalAuthorityWrite){
    setError('');setNotice('');
    try{
      const created=await api.createAuthority(input);
      setNotice(`Approval authority for ${created.actorId} created.`);
      await load();
    }catch(exception){setError((exception as Error).message)}
  }
  async function changeAuthority(item:ApprovalAuthority,action:'suspend'|'retire',reason:string){
    setError('');setNotice('');
    try{
      if(action==='suspend')await api.suspendAuthority(item.id,item.versionNo,reason);
      else await api.retireAuthority(item.id,item.versionNo,reason);
      setNotice(`Approval authority ${action} action completed.`);
      await load();
    }catch(exception){setError((exception as Error).message)}
  }
  async function createDelegation(input:ApprovalDelegationWrite){
    setError('');setNotice('');
    try{
      const created=await api.createDelegation(input);
      setNotice(`Delegation to ${created.delegateActorId} created.`);
      await load();
    }catch(exception){setError((exception as Error).message)}
  }
  async function revokeDelegation(item:ApprovalDelegation,reason:string){
    setError('');setNotice('');
    try{
      await api.revokeDelegation(item.id,item.versionNo,reason);
      setNotice(`Delegation to ${item.delegateActorId} revoked.`);
      await load();
    }catch(exception){setError((exception as Error).message)}
  }

  if(!canRead)return <section className="card" aria-labelledby="approval-authority-title">
    <h2 id="approval-authority-title">Foundation approval authority</h2>
    <p role="alert">You do not have permission to view approval authority.</p>
  </section>;

  return <section aria-labelledby="approval-authority-title">
    <div className="page-heading"><div>
      <p className="eyebrow">Foundation security administration</p>
      <h2 id="approval-authority-title">Approval authority & delegation</h2>
      <p>Effective-dated legal-entity/PSU approval scope with bounded delegation and immutable lifecycle evidence.</p>
    </div></div>
    {loading&&<p role="status">Loading approval authority...</p>}
    {error&&<p className="error" role="alert">{error}</p>}
    {notice&&<p className="success" role="status">{notice}</p>}

    <div className="card">
      <div className="section-heading"><div><h3>Approval authorities</h3>
        <p>Verifier and final-approver authority is application scope; it does not grant system access.</p></div>
        <span className="count-badge">{authorities.length} configured</span></div>
      {authorities.length===0?<p>No approval authorities are configured.</p>:
        <div className="table-scroll"><table><thead><tr>
          <th>Owner</th><th>Role</th><th>Domain / action</th><th>Actor</th>
          <th>Effective</th><th>Status</th><th>Actions</th>
        </tr></thead><tbody>{authorities.map(item=><tr key={item.id}>
          <td>{ownerLabel(item,owners)}</td>
          <td>{item.approvalRole.replaceAll('_',' ')}</td>
          <td>{item.domainCode} / {item.actionCode}</td>
          <td>{item.actorId}</td>
          <td>{item.effectiveFrom} → {item.effectiveTo??'open'}</td>
          <td><span className={`badge ${item.status.toLowerCase()}`}>{item.status}</span></td>
          <td>{canWriteAuthority&&item.status==='ACTIVE'?<AuthorityActions item={item} onChange={changeAuthority}/>:null}</td>
        </tr>)}</tbody></table></div>}
    </div>

    {canWriteAuthority?<CreateAuthorityForm owners={owners} currentActor={currentActor} onCreate={createAuthority}/>:
      <p className="permission-note">Authority write controls require <code>foundation-approval-authority.write</code>.</p>}

    <div className="card">
      <div className="section-heading"><div><h3>Delegations</h3>
        <p>Delegations are bounded by explicit start and end dates and inherit the source authority scope.</p></div>
        <span className="count-badge">{delegations.length} configured</span></div>
      {delegations.length===0?<p>No approval delegations are configured.</p>:
        <div className="table-scroll"><table><thead><tr>
          <th>Source authority</th><th>Delegator</th><th>Delegate</th><th>Effective</th><th>Status</th><th>Actions</th>
        </tr></thead><tbody>{delegations.map(item=><tr key={item.id}>
          <td>{authorityLabel(item.sourceAuthorityId,authorities)}</td>
          <td>{item.delegatorActorId}</td><td>{item.delegateActorId}</td>
          <td>{item.effectiveFrom} → {item.effectiveTo}</td>
          <td><span className={`badge ${item.status.toLowerCase()}`}>{item.status}</span></td>
          <td>{canWriteDelegation&&item.status==='ACTIVE'&&currentActor?.id===item.delegatorActorId?<ReasonButton
            label="Revoke" onSubmit={reason=>revokeDelegation(item,reason)}/>:null}</td>
        </tr>)}</tbody></table></div>}
    </div>

    {canWriteDelegation?<CreateDelegationForm authorities={authorities} currentActor={currentActor} onCreate={createDelegation}/>:
      <p className="permission-note">Delegation controls require <code>foundation-approval-delegation.write</code>.</p>}
  </section>;
}

function ownerLabel(item:ApprovalAuthority,owners:OwnerOption[]){
  return owners.find(option=>option.kind===item.ownerKind&&option.id===item.ownerId)?.label
    ??`${item.ownerKind.replaceAll('_',' ')} ${item.ownerId}`;
}
function authorityLabel(id:string,authorities:ApprovalAuthority[]){
  const item=authorities.find(authority=>authority.id===id);
  return item?`${item.actorId} · ${item.approvalRole.replaceAll('_',' ')} · ${item.domainCode}/${item.actionCode}`:id;
}

function CreateAuthorityForm({owners,currentActor,onCreate}:{owners:OwnerOption[];currentActor?:SignedInActor;onCreate:(input:ApprovalAuthorityWrite)=>Promise<void>}){
  const [ownerKind,setOwnerKind]=useState<ApprovalOwnerKind>('LEGAL_ENTITY');
  const [ownerId,setOwnerId]=useState('');
  const [approvalRole,setApprovalRole]=useState<ApprovalRole>('VERIFIER');
  const [domainCode,setDomainCode]=useState('FOUNDATION');
  const [actionCode,setActionCode]=useState('APPROVE');
  const [actorId,setActorId]=useState(currentActor?.id??'');
  const [effectiveFrom,setEffectiveFrom]=useState(today);
  const [effectiveTo,setEffectiveTo]=useState('');
  const options=owners.filter(option=>option.kind===ownerKind);
  useEffect(()=>{if(options.length>0&&!options.some(option=>option.id===ownerId))setOwnerId(options[0].id)},[options,ownerId]);

  async function submit(event:FormEvent){
    event.preventDefault();
    await onCreate({ownerKind,ownerId,approvalRole,domainCode,actionCode,actorId,effectiveFrom,effectiveTo:effectiveTo||undefined});
  }
  return <form className="card form-grid" aria-label="Create approval authority" onSubmit={event=>void submit(event)}>
    <h3>Create approval authority</h3>
    <label>Owner type<select value={ownerKind} onChange={event=>setOwnerKind(event.target.value as ApprovalOwnerKind)}>
      <option value="LEGAL_ENTITY">Legal entity</option><option value="PAYROLL_STATUTORY_UNIT">Payroll statutory unit</option>
    </select></label>
    {options.length>0?<label>Business owner<select aria-label="Approval authority business owner" value={ownerId} onChange={event=>setOwnerId(event.target.value)}>
      {options.map(option=><option key={option.id} value={option.id}>{option.label}</option>)}</select></label>:
      <label>Owner identity ID<input required value={ownerId} onChange={event=>setOwnerId(event.target.value)}/></label>}
    <label>Approval role<select value={approvalRole} onChange={event=>setApprovalRole(event.target.value as ApprovalRole)}>
      <option value="VERIFIER">Verifier</option><option value="FINAL_APPROVER">Final approver</option>
    </select></label>
    <label>Domain code<input required pattern="[A-Z][A-Z0-9_]{1,79}" value={domainCode}
      onChange={event=>setDomainCode(event.target.value.toUpperCase())}/></label>
    <label>Action code<input required pattern="[A-Z][A-Z0-9_]{1,79}" value={actionCode}
      onChange={event=>setActionCode(event.target.value.toUpperCase())}/></label>
    <label>Actor ID<input required maxLength={160} value={actorId} onChange={event=>setActorId(event.target.value)}/></label>
    {currentActor&&actorId===currentActor.id?<small>Current signed-in user: {currentActor.label}</small>:null}
    <label>Effective from<input required type="date" value={effectiveFrom} onChange={event=>setEffectiveFrom(event.target.value)}/></label>
    <label>Effective to<input type="date" value={effectiveTo} onChange={event=>setEffectiveTo(event.target.value)}/></label>
    <button type="submit">Create authority</button>
  </form>;
}

function AuthorityActions({item,onChange}:{item:ApprovalAuthority;onChange:(item:ApprovalAuthority,action:'suspend'|'retire',reason:string)=>Promise<void>}){
  return <div className="button-row"><ReasonButton label="Suspend" onSubmit={reason=>onChange(item,'suspend',reason)}/>
    <ReasonButton label="Retire" onSubmit={reason=>onChange(item,'retire',reason)}/></div>;
}

function ReasonButton({label,onSubmit}:{label:string;onSubmit:(reason:string)=>Promise<void>}){
  const [open,setOpen]=useState(false);const [reason,setReason]=useState('');
  if(!open)return <button type="button" className="secondary-button" onClick={()=>setOpen(true)}>{label}</button>;
  return <form onSubmit={event=>{event.preventDefault();void onSubmit(reason).then(()=>{setOpen(false);setReason('')})}}>
    <label>{label} reason<input required maxLength={500} value={reason} onChange={event=>setReason(event.target.value)}/></label>
    <div className="button-row"><button type="submit">{label}</button>
      <button type="button" className="secondary-button" onClick={()=>setOpen(false)}>Cancel</button></div>
  </form>;
}

function CreateDelegationForm({authorities,currentActor,onCreate}:{authorities:ApprovalAuthority[];currentActor?:SignedInActor;onCreate:(input:ApprovalDelegationWrite)=>Promise<void>}){
  const active=authorities.filter(item=>
    item.status==='ACTIVE'&&currentActor?.id===item.actorId
  );
  const [sourceAuthorityId,setSourceAuthorityId]=useState('');
  const [delegateActorId,setDelegateActorId]=useState('');
  const [effectiveFrom,setEffectiveFrom]=useState(today);
  const [effectiveTo,setEffectiveTo]=useState(today);
  useEffect(()=>{if(active.length>0&&!active.some(item=>item.id===sourceAuthorityId))setSourceAuthorityId(active[0].id)},[active,sourceAuthorityId]);
  async function submit(event:FormEvent){
    event.preventDefault();
    await onCreate({sourceAuthorityId,delegateActorId,effectiveFrom,effectiveTo});
  }
  return <form className="card form-grid" aria-label="Create approval delegation" onSubmit={event=>void submit(event)}>
    <h3>Create bounded delegation</h3>
    <label>Source authority<select required value={sourceAuthorityId} onChange={event=>setSourceAuthorityId(event.target.value)}>
      <option value="" disabled>Select authority</option>
      {active.map(item=><option key={item.id} value={item.id}>{item.actorId} · {item.approvalRole} · {item.domainCode}/{item.actionCode}</option>)}
    </select></label>
    <label>Delegate actor ID<input required maxLength={160} value={delegateActorId} onChange={event=>setDelegateActorId(event.target.value)}/></label>
    <label>Effective from<input required type="date" value={effectiveFrom} onChange={event=>setEffectiveFrom(event.target.value)}/></label>
    <label>Effective to<input required type="date" min={effectiveFrom} value={effectiveTo} onChange={event=>setEffectiveTo(event.target.value)}/></label>
    {currentActor&&active.length===0?<p className="permission-note">Only approval authorities held by the current signed-in user can be delegated.</p>:null}
    <button type="submit" disabled={active.length===0}>Create delegation</button>
  </form>;
}
