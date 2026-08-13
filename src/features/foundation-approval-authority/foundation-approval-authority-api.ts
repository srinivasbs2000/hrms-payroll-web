export type ApprovalOwnerKind='LEGAL_ENTITY'|'PAYROLL_STATUTORY_UNIT';
export type ApprovalRole='VERIFIER'|'FINAL_APPROVER';
export type ApprovalAuthorityStatus='ACTIVE'|'SUSPENDED'|'RETIRED';
export type ApprovalDelegationStatus='ACTIVE'|'REVOKED';

export interface ApprovalAuthorityWrite{
  ownerKind:ApprovalOwnerKind;
  ownerId:string;
  approvalRole:ApprovalRole;
  domainCode:string;
  actionCode:string;
  actorId:string;
  effectiveFrom:string;
  effectiveTo?:string|null;
}
export interface ApprovalAuthority extends ApprovalAuthorityWrite{
  id:string;
  effectiveTo:string|null;
  status:ApprovalAuthorityStatus;
  createdAt:string;
  createdBy:string;
  suspendedAt:string|null;
  suspendedBy:string|null;
  suspensionReason:string|null;
  retiredAt:string|null;
  retiredBy:string|null;
  retirementReason:string|null;
  versionNo:number;
}
export interface ApprovalDelegationWrite{
  sourceAuthorityId:string;
  delegateActorId:string;
  effectiveFrom:string;
  effectiveTo:string;
}
export interface ApprovalDelegation extends ApprovalDelegationWrite{
  id:string;
  delegatorActorId:string;
  status:ApprovalDelegationStatus;
  createdAt:string;
  createdBy:string;
  revokedAt:string|null;
  revokedBy:string|null;
  revocationReason:string|null;
  versionNo:number;
}
export interface FoundationApprovalAuthorityApi{
  listAuthorities():Promise<ApprovalAuthority[]>;
  createAuthority(input:ApprovalAuthorityWrite):Promise<ApprovalAuthority>;
  suspendAuthority(id:string,versionNo:number,reason:string):Promise<ApprovalAuthority>;
  retireAuthority(id:string,versionNo:number,reason:string):Promise<ApprovalAuthority>;
  listDelegations():Promise<ApprovalDelegation[]>;
  createDelegation(input:ApprovalDelegationWrite):Promise<ApprovalDelegation>;
  revokeDelegation(id:string,versionNo:number,reason:string):Promise<ApprovalDelegation>;
}

async function request<T>(path:string,init:RequestInit={}):Promise<T>{
  const headers=new Headers(init.headers);
  headers.set('X-Correlation-ID',crypto.randomUUID());
  if(init.method&&init.method!=='GET')headers.set('Idempotency-Key',crypto.randomUUID());
  if(init.body)headers.set('Content-Type','application/json');
  const token=window.payrollSession?.accessToken;
  if(token)headers.set('Authorization',`Bearer ${token}`);
  const response=await fetch(`/api/v1${path}`,{...init,headers});
  if(!response.ok){
    let detail=`Request failed (${response.status})`;
    try{detail=(await response.json() as {detail?:string}).detail??detail}catch{/* non-JSON */}
    throw new Error(detail);
  }
  return response.json() as Promise<T>;
}

export const httpFoundationApprovalAuthorityApi:FoundationApprovalAuthorityApi={
  listAuthorities:()=>request('/foundation-approval-authorities'),
  createAuthority:input=>request('/foundation-approval-authorities',{
    method:'POST',body:JSON.stringify(input)
  }),
  suspendAuthority:(id,versionNo,reason)=>request(`/foundation-approval-authorities/${id}/suspension`,{
    method:'POST',headers:{'If-Match':String(versionNo)},body:JSON.stringify({reason})
  }),
  retireAuthority:(id,versionNo,reason)=>request(`/foundation-approval-authorities/${id}/retirement`,{
    method:'POST',headers:{'If-Match':String(versionNo)},body:JSON.stringify({reason})
  }),
  listDelegations:()=>request('/foundation-approval-delegations'),
  createDelegation:input=>request('/foundation-approval-delegations',{
    method:'POST',body:JSON.stringify(input)
  }),
  revokeDelegation:(id,versionNo,reason)=>request(`/foundation-approval-delegations/${id}/revocation`,{
    method:'POST',headers:{'If-Match':String(versionNo)},body:JSON.stringify({reason})
  })
};
