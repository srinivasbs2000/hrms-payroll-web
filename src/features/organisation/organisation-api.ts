export type OrganisationKind='LEGAL_ENTITY'|'PAYROLL_STATUTORY_UNIT'|'ESTABLISHMENT';

export interface OrganisationVersion {
  kind:OrganisationKind; identityId:string; code:string; identityStatus:string;
  versionId:string; versionSequence:number; versionNo:number; name:string;
  countryCode:string|null; currency:string|null; stateCode:string|null;
  parentVersionId:string|null; effectiveFrom:string; effectiveTo:string|null;
  approvalStatus:'DRAFT'|'APPROVED'|'REJECTED'; supersedesVersionId:string|null; superseded:boolean;
}

export interface HierarchyNode {value:OrganisationVersion; children:HierarchyNode[]}
export interface OrganisationHierarchy {asOf:string; legalEntities:HierarchyNode[]}
export interface OrganisationWrite {
  code?:string; name:string; countryCode?:string; currency?:string; stateCode?:string;
  parentVersionId?:string; effectiveFrom:string; effectiveTo?:string;
}

export interface OrganisationApi {
  hierarchy(asOf:string):Promise<OrganisationHierarchy>;
  history(collection:string,identityId:string):Promise<OrganisationVersion[]>;
  create(collection:string,input:OrganisationWrite):Promise<OrganisationVersion>;
  addVersion(collection:string,identityId:string,input:OrganisationWrite):Promise<OrganisationVersion>;
  correct(collection:string,identityId:string,versionId:string,input:OrganisationWrite):Promise<OrganisationVersion>;
  endDate(collection:string,identityId:string,versionId:string,versionNo:number,effectiveTo:string):Promise<OrganisationVersion>;
  approve(collection:string,identityId:string,versionId:string):Promise<OrganisationVersion>;
}

declare global {
  interface Window {payrollSession?:{accessToken?:string;permissions?:string[]}}
}

export function currentPermissions():Set<string>{
  return new Set(window.payrollSession?.permissions??[]);
}

async function request<T>(path:string,init:RequestInit={}):Promise<T>{
  const headers=new Headers(init.headers);
  headers.set('X-Correlation-ID',crypto.randomUUID());
  if(init.method&&init.method!=='GET') headers.set('Idempotency-Key',crypto.randomUUID());
  if(init.body) headers.set('Content-Type','application/json');
  const token=window.payrollSession?.accessToken;
  if(token) headers.set('Authorization',`Bearer ${token}`);
  const response=await fetch(`/api/v1${path}`,{...init,headers});
  if(!response.ok){
    let detail=`Request failed (${response.status})`;
    try{const problem=await response.json() as {detail?:string}; detail=problem.detail??detail;}catch{/* empty response */}
    const error=new Error(detail) as Error&{status?:number}; error.status=response.status; throw error;
  }
  return response.json() as Promise<T>;
}

export const httpOrganisationApi:OrganisationApi={
  hierarchy:asOf=>request(`/organisation-hierarchy?asOf=${encodeURIComponent(asOf)}`),
  history:(collection,id)=>request(`/${collection}/${id}/versions`),
  create:(collection,input)=>request(`/${collection}`,{method:'POST',body:JSON.stringify(input)}),
  addVersion:(collection,id,input)=>request(`/${collection}/${id}/versions`,{method:'POST',body:JSON.stringify(input)}),
  correct:(collection,id,version,input)=>request(`/${collection}/${id}/versions/${version}/corrections`,{method:'POST',body:JSON.stringify(input)}),
  endDate:(collection,id,version,versionNo,effectiveTo)=>request(`/${collection}/${id}/versions/${version}/end-date`,{method:'POST',headers:{'If-Match':String(versionNo)},body:JSON.stringify({effectiveTo})}),
  approve:(collection,id,version)=>request(`/${collection}/${id}/versions/${version}/approval`,{method:'POST'})
};
