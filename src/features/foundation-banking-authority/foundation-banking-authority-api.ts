export type FbaOwnerKind='LEGAL_ENTITY'|'PAYROLL_STATUTORY_UNIT';

export interface FbaOwnerOption{
  kind:FbaOwnerKind;
  identityId:string;
  versionId:string;
  code:string;
  name:string;
}

export interface EmployerBankAccountVersionWrite{
  bankName:string;
  branchName?:string;
  routingCode?:string;
  accountHolderName:string;
  currencyCode:string;
  accountNumber:string;
  defaultAccount:boolean;
  effectiveFrom:string;
  effectiveTo?:string;
}

export interface EmployerBankAccountView{
  identityId:string;
  code:string;
  ownerKind:FbaOwnerKind;
  legalEntityId:string|null;
  payrollStatutoryUnitId:string|null;
  identityStatus:string;
  identityVersionNo:number;
  versionId:string;
  versionSequence:number;
  versionNo:number;
  bankName:string;
  branchName:string|null;
  routingCode:string|null;
  accountHolderName:string;
  currencyCode:string;
  maskedAccountNumber:string;
  defaultAccount:boolean;
  effectiveFrom:string;
  effectiveTo:string|null;
  lifecycleStatus:
    |'DRAFT'
    |'PENDING_VERIFICATION'
    |'VERIFIED'
    |'APPROVAL_PENDING'
    |'ACTIVE'
    |'REJECTED'
    |'SUSPENDED'
    |'EXPIRED'
    |'SUPERSEDED';
  verificationEvidenceRef:string|null;
  verifiedAt:string|null;
  verifiedBy:string|null;
  approvedAt:string|null;
  approvedBy:string|null;
  approvalEvidenceRef:string|null;
  rejectedAt:string|null;
  rejectedBy:string|null;
  rejectionReason:string|null;
  rejectionEvidenceRef:string|null;
  suspendedAt:string|null;
  suspendedBy:string|null;
  suspensionReason:string|null;
  supersedesVersionId:string|null;
  superseded:boolean;
  createdBy:string;
}

export interface EmployerBankAccountRevealView{
  identityId:string;
  versionId:string;
  code:string;
  ownerKind:FbaOwnerKind;
  legalEntityId:string|null;
  payrollStatutoryUnitId:string|null;
  bankName:string;
  branchName:string|null;
  routingCode:string|null;
  accountHolderName:string;
  currencyCode:string;
  accountNumber:string;
  effectiveFrom:string;
  effectiveTo:string|null;
}

export interface AuthorisedSignatoryScopeWrite{
  purposeCode:string;
  currencyCode?:string;
  maximumAmount?:number;
}

export interface AuthorisedSignatoryVersionWrite{
  fullName:string;
  designation?:string;
  authorityReference:string;
  effectiveFrom:string;
  effectiveTo?:string;
  scopes:AuthorisedSignatoryScopeWrite[];
}

export interface AuthorisedSignatoryView{
  identityId:string;
  code:string;
  ownerKind:FbaOwnerKind;
  legalEntityId:string|null;
  payrollStatutoryUnitId:string|null;
  identityStatus:string;
  identityVersionNo:number;
  versionId:string;
  versionSequence:number;
  versionNo:number;
  fullName:string;
  designation:string|null;
  authorityReference:string;
  effectiveFrom:string;
  effectiveTo:string|null;
  lifecycleStatus:
    |'DRAFT'
    |'PENDING_VERIFICATION'
    |'VERIFIED'
    |'APPROVAL_PENDING'
    |'ACTIVE'
    |'REJECTED'
    |'SUSPENDED'
    |'EXPIRED'
    |'SUPERSEDED';
  verificationEvidenceRef:string|null;
  verifiedAt:string|null;
  verifiedBy:string|null;
  approvedAt:string|null;
  approvedBy:string|null;
  approvalEvidenceRef:string|null;
  rejectedAt:string|null;
  rejectedBy:string|null;
  rejectionReason:string|null;
  rejectionEvidenceRef:string|null;
  suspendedAt:string|null;
  suspendedBy:string|null;
  suspensionReason:string|null;
  supersedesVersionId:string|null;
  superseded:boolean;
  createdBy:string;
  scopes:Array<{
    scopeId:string;
    purposeCode:string;
    currencyCode:string|null;
    maximumAmount:number|null;
  }>;
}

export interface AuthorityEvaluationView{
  authorised:boolean;
  reasonCode:string;
  ownerKind:FbaOwnerKind;
  legalEntityId:string|null;
  payrollStatutoryUnitId:string|null;
  purposeCode:string;
  currencyCode:string|null;
  requestedAmount:number|null;
  asOf:string;
  signatoryIdentityId:string|null;
  signatoryVersionId:string|null;
  signatoryCode:string|null;
  signatoryName:string|null;
  scopeCurrencyCode:string|null;
  maximumAmount:number|null;
}

export interface BankingReadinessView{
  readinessScope:'BANKING_AND_SIGNATORY_ONLY';
  ownerKind:FbaOwnerKind;
  legalEntityId:string|null;
  payrollStatutoryUnitId:string|null;
  currencyCode:string;
  purposeCode:string;
  amount:number|null;
  asOf:string;
  bankReady:boolean;
  signatoryReady:boolean;
  ready:boolean;
  authorityEvaluation:AuthorityEvaluationView|null;
  findings:Array<{
    code:string;
    source:string;
    severity:string;
    detail:string;
  }>;
}

export interface FoundationBankingAuthorityApi{
  listOwners(asOf:string):Promise<FbaOwnerOption[]>;
  listBanks(asOf:string):Promise<EmployerBankAccountView[]>;
  bankHistory(identityId:string):Promise<EmployerBankAccountView[]>;
  createBank(
    code:string,
    owner:FbaOwnerOption,
    version:EmployerBankAccountVersionWrite
  ):Promise<EmployerBankAccountView>;
  submitBank(view:EmployerBankAccountView):Promise<EmployerBankAccountView>;
  verifyBank(
    view:EmployerBankAccountView,
    evidenceRef:string
  ):Promise<EmployerBankAccountView>;
  requestBankApproval(
    view:EmployerBankAccountView
  ):Promise<EmployerBankAccountView>;
  approveBank(
    view:EmployerBankAccountView,
    evidenceRef:string
  ):Promise<EmployerBankAccountView>;
  rejectBank(
    view:EmployerBankAccountView,
    reason:string,
    evidenceRef:string
  ):Promise<EmployerBankAccountView>;
  suspendBank(
    view:EmployerBankAccountView,
    reason:string
  ):Promise<EmployerBankAccountView>;
  revealBank(
    view:EmployerBankAccountView,
    reason:string
  ):Promise<EmployerBankAccountRevealView>;

  listSignatories(asOf:string):Promise<AuthorisedSignatoryView[]>;
  signatoryHistory(identityId:string):Promise<AuthorisedSignatoryView[]>;
  createSignatory(
    code:string,
    owner:FbaOwnerOption,
    version:AuthorisedSignatoryVersionWrite
  ):Promise<AuthorisedSignatoryView>;
  submitSignatory(
    view:AuthorisedSignatoryView
  ):Promise<AuthorisedSignatoryView>;
  verifySignatory(
    view:AuthorisedSignatoryView,
    evidenceRef:string
  ):Promise<AuthorisedSignatoryView>;
  requestSignatoryApproval(
    view:AuthorisedSignatoryView
  ):Promise<AuthorisedSignatoryView>;
  approveSignatory(
    view:AuthorisedSignatoryView,
    evidenceRef:string
  ):Promise<AuthorisedSignatoryView>;
  rejectSignatory(
    view:AuthorisedSignatoryView,
    reason:string,
    evidenceRef:string
  ):Promise<AuthorisedSignatoryView>;
  suspendSignatory(
    view:AuthorisedSignatoryView,
    reason:string
  ):Promise<AuthorisedSignatoryView>;
  readiness(input:{
    owner:FbaOwnerOption;
    currencyCode:string;
    purposeCode:string;
    amount?:number;
    asOf:string;
  }):Promise<BankingReadinessView>;
}

type OrganisationHierarchyNode={
  value:{
    kind:string;
    identityId:string;
    versionId:string;
    code:string;
    name:string;
  };
  children:OrganisationHierarchyNode[];
};

type OrganisationHierarchy={
  legalEntities:OrganisationHierarchyNode[];
};

function isSupportedOwner(
  value:OrganisationHierarchyNode['value']
):value is OrganisationHierarchyNode['value']&{kind:FbaOwnerKind}{
  return value.kind==='LEGAL_ENTITY'||value.kind==='PAYROLL_STATUTORY_UNIT';
}

function flattenOwners(nodes:OrganisationHierarchyNode[]):FbaOwnerOption[]{
  return nodes.flatMap(node=>[
    ...(isSupportedOwner(node.value)?[{
      kind:node.value.kind,
      identityId:node.value.identityId,
      versionId:node.value.versionId,
      code:node.value.code,
      name:node.value.name
    }]:[]),
    ...flattenOwners(node.children)
  ]);
}

async function request<T>(
  path:string,
  init:RequestInit={}
):Promise<T>{
  const headers=new Headers(init.headers);
  headers.set('X-Correlation-ID',crypto.randomUUID());
  if(init.method&&init.method!=='GET'){
    headers.set('Idempotency-Key',crypto.randomUUID());
  }
  if(init.body)headers.set('Content-Type','application/json');
  const token=window.payrollSession?.accessToken;
  if(token)headers.set('Authorization',`Bearer ${token}`);
  const response=await fetch(`/api/v1${path}`,{...init,headers});
  if(!response.ok){
    let detail=`Request failed (${response.status})`;
    try{
      const problem=await response.json() as {detail?:string};
      detail=problem.detail??detail;
    }catch{
      // Empty or non-JSON RFC 9457 response.
    }
    throw new Error(detail);
  }
  return response.json() as Promise<T>;
}

function transitionBank(
  view:EmployerBankAccountView,
  action:string,
  body?:object
):Promise<EmployerBankAccountView>{
  return request(
    `/employer-bank-accounts/${view.identityId}/versions/${view.versionId}/${action}`,
    {
      method:'POST',
      headers:{'If-Match':String(view.versionNo)},
      body:body?JSON.stringify(body):undefined
    }
  );
}

function transitionSignatory(
  view:AuthorisedSignatoryView,
  action:string,
  body?:object
):Promise<AuthorisedSignatoryView>{
  return request(
    `/authorised-signatories/${view.identityId}/versions/${view.versionId}/${action}`,
    {
      method:'POST',
      headers:{'If-Match':String(view.versionNo)},
      body:body?JSON.stringify(body):undefined
    }
  );
}

function ownerPayload(owner:FbaOwnerOption){
  return owner.kind==='LEGAL_ENTITY'
    ?{ownerKind:owner.kind,legalEntityId:owner.identityId}
    :{ownerKind:owner.kind,payrollStatutoryUnitId:owner.identityId};
}

export const httpFoundationBankingAuthorityApi:FoundationBankingAuthorityApi={
  listOwners:async asOf=>{
    const hierarchy=await request<OrganisationHierarchy>(
      `/organisation-hierarchy?asOf=${encodeURIComponent(asOf)}`
    );
    return flattenOwners(hierarchy.legalEntities);
  },
  listBanks:asOf=>request(
    `/employer-bank-accounts?asOf=${encodeURIComponent(asOf)}`
  ),
  bankHistory:identityId=>request(
    `/employer-bank-accounts/${identityId}/versions`
  ),
  createBank:(code,owner,version)=>request('/employer-bank-accounts',{
    method:'POST',
    body:JSON.stringify({code,...ownerPayload(owner),version})
  }),
  submitBank:view=>transitionBank(view,'submit'),
  verifyBank:(view,evidenceRef)=>transitionBank(view,'verify',{evidenceRef}),
  requestBankApproval:view=>transitionBank(view,'request-approval'),
  approveBank:(view,evidenceRef)=>transitionBank(view,'approve',{evidenceRef}),
  rejectBank:(view,reason,evidenceRef)=>transitionBank(
    view,'reject',{reason,evidenceRef}
  ),
  suspendBank:(view,reason)=>transitionBank(view,'suspend',{reason}),
  revealBank:(view,reason)=>request(
    `/employer-bank-accounts/${view.identityId}/versions/${view.versionId}/reveal`,
    {method:'POST',body:JSON.stringify({reason})}
  ),

  listSignatories:asOf=>request(
    `/authorised-signatories?asOf=${encodeURIComponent(asOf)}`
  ),
  signatoryHistory:identityId=>request(
    `/authorised-signatories/${identityId}/versions`
  ),
  createSignatory:(code,owner,version)=>request('/authorised-signatories',{
    method:'POST',
    body:JSON.stringify({code,...ownerPayload(owner),version})
  }),
  submitSignatory:view=>transitionSignatory(view,'submit'),
  verifySignatory:(view,evidenceRef)=>transitionSignatory(
    view,'verify',{evidenceRef}
  ),
  requestSignatoryApproval:view=>transitionSignatory(
    view,'request-approval'
  ),
  approveSignatory:(view,evidenceRef)=>transitionSignatory(
    view,'approve',{evidenceRef}
  ),
  rejectSignatory:(view,reason,evidenceRef)=>transitionSignatory(
    view,'reject',{reason,evidenceRef}
  ),
  suspendSignatory:(view,reason)=>transitionSignatory(
    view,'suspend',{reason}
  ),
  readiness:input=>{
    const query=new URLSearchParams({
      ownerKind:input.owner.kind,
      ownerId:input.owner.identityId,
      currencyCode:input.currencyCode,
      purposeCode:input.purposeCode,
      asOf:input.asOf
    });
    if(input.amount!==undefined)query.set('amount',String(input.amount));
    return request(`/banking-readiness?${query.toString()}`);
  }
};
