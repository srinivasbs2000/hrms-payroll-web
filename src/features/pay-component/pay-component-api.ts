export interface PayComponentVersion {
  identityId:string;
  code:string;
  name:string;
  componentType:'EARNING'|'DEDUCTION'|'INFORMATION';
  versionId:string;
  versionSequence:number;
  versionNo:number;
  formulaType:'FIXED'|'PERCENTAGE_OF_COMPONENT'|'RESIDUAL';
  formulaExpression:string|null;
  fixedAmount:number|null;
  roundingScale:number;
  effectiveFrom:string;
  effectiveTo:string|null;
  approvalStatus:'DRAFT'|'APPROVED'|'REJECTED';
  supersedesVersionId:string|null;
  superseded:boolean;
}

export interface PayComponentWrite {
  code?:string;
  name?:string;
  componentType?:'EARNING'|'DEDUCTION'|'INFORMATION';
  formulaType:'FIXED'|'PERCENTAGE_OF_COMPONENT'|'RESIDUAL';
  formulaExpression?:string;
  fixedAmount?:number;
  roundingScale?:number;
  effectiveFrom:string;
  effectiveTo?:string;
}

export interface PayComponentApi {
  list(asOf:string):Promise<PayComponentVersion[]>;
  history(identityId:string):Promise<PayComponentVersion[]>;
  create(input:PayComponentWrite):Promise<PayComponentVersion>;
  addVersion(identityId:string,input:PayComponentWrite):Promise<PayComponentVersion>;
  correct(identityId:string,versionId:string,input:PayComponentWrite):Promise<PayComponentVersion>;
  endDate(identityId:string,versionId:string,versionNo:number,effectiveTo:string):Promise<PayComponentVersion>;
  approve(identityId:string,versionId:string):Promise<PayComponentVersion>;
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

export const httpPayComponentApi:PayComponentApi={
  list:asOf=>request(`/pay-components?asOf=${encodeURIComponent(asOf)}`),
  history:id=>request(`/pay-components/${id}/versions`),
  create:input=>request('/pay-components',{method:'POST',body:JSON.stringify(input)}),
  addVersion:(id,input)=>request(`/pay-components/${id}/versions`,{method:'POST',body:JSON.stringify(input)}),
  correct:(id,version,input)=>request(`/pay-components/${id}/versions/${version}/corrections`,{method:'POST',body:JSON.stringify(input)}),
  endDate:(id,version,versionNo,effectiveTo)=>request(`/pay-components/${id}/versions/${version}/end-date`,{
    method:'POST',headers:{'If-Match':String(versionNo)},body:JSON.stringify({effectiveTo})
  }),
  approve:(id,version)=>request(`/pay-components/${id}/versions/${version}/approval`,{method:'POST'})
};