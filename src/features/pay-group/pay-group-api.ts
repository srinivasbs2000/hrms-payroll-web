export interface PayGroupVersion {
  identityId:string;
  code:string;
  identityStatus:'ACTIVE'|'INACTIVE';
  versionId:string;
  versionSequence:number;
  versionNo:number;
  name:string;
  payrollStatutoryUnitVersionId:string;
  calendarId:string;
  currency:'INR';
  prorationMethod:'CALENDAR_DAYS';
  effectiveFrom:string;
  effectiveTo:string|null;
  approvalStatus:'DRAFT'|'APPROVED'|'REJECTED';
  supersedesVersionId:string|null;
  superseded:boolean;
}

export interface PayGroupWrite {
  code?:string;
  name:string;
  payrollStatutoryUnitVersionId:string;
  calendarId:string;
  currency?:'INR';
  prorationMethod?:'CALENDAR_DAYS';
  effectiveFrom:string;
  effectiveTo?:string;
}

export interface PayGroupApi {
  list(asOf:string):Promise<PayGroupVersion[]>;
  history(identityId:string):Promise<PayGroupVersion[]>;
  create(input:PayGroupWrite):Promise<PayGroupVersion>;
  addVersion(identityId:string,input:PayGroupWrite):Promise<PayGroupVersion>;
  correct(identityId:string,versionId:string,input:PayGroupWrite):Promise<PayGroupVersion>;
  endDate(identityId:string,versionId:string,versionNo:number,effectiveTo:string):Promise<PayGroupVersion>;
  approve(identityId:string,versionId:string):Promise<PayGroupVersion>;
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
    try{
      const problem=await response.json() as {detail?:string};
      detail=problem.detail??detail;
    }catch{/* empty or non-JSON response */}
    const error=new Error(detail) as Error&{status?:number};
    error.status=response.status;
    throw error;
  }
  return response.json() as Promise<T>;
}

export const httpPayGroupApi:PayGroupApi={
  list:asOf=>request(`/pay-groups?asOf=${encodeURIComponent(asOf)}`),
  history:id=>request(`/pay-groups/${id}/versions`),
  create:input=>request('/pay-groups',{method:'POST',body:JSON.stringify(input)}),
  addVersion:(id,input)=>request(`/pay-groups/${id}/versions`,{method:'POST',body:JSON.stringify(input)}),
  correct:(id,version,input)=>request(`/pay-groups/${id}/versions/${version}/corrections`,{method:'POST',body:JSON.stringify(input)}),
  endDate:(id,version,versionNo,effectiveTo)=>request(`/pay-groups/${id}/versions/${version}/end-date`,{
    method:'POST',
    headers:{'If-Match':String(versionNo)},
    body:JSON.stringify({effectiveTo})
  }),
  approve:(id,version)=>request(`/pay-groups/${id}/versions/${version}/approval`,{method:'POST'})
};
