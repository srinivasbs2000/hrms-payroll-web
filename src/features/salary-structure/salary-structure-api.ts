export type ComponentType='EARNING'|'DEDUCTION'|'INFORMATION';
export type FormulaType='FIXED'|'PERCENTAGE_OF_COMPONENT'|'RESIDUAL';
export type ApprovalStatus='DRAFT'|'APPROVED'|'REJECTED';

export interface SalaryStructureComponentOption {
  versionId:string;
  code:string;
  name:string;
  componentType:ComponentType;
  formulaType:FormulaType;
}

export interface SalaryStructureLineWrite {
  componentVersionId:string;
  sequenceNo:number;
  targetAmount?:number;
  targetPercentage?:number;
  percentageBaseCode?:string;
}

export interface SalaryStructureWrite {
  code?:string;
  name:string;
  currency?:'INR';
  effectiveFrom:string;
  effectiveTo?:string;
  lines:SalaryStructureLineWrite[];
}

export interface SalaryStructureLineView {
  id:string;
  componentVersionId:string;
  componentCode:string;
  componentName:string;
  componentType:ComponentType;
  componentFormulaType:FormulaType;
  sequenceNo:number;
  targetAmount:number|null;
  targetPercentage:number|null;
  percentageBaseCode:string|null;
  effectiveFrom:string;
  effectiveTo:string|null;
}

export interface SalaryStructureVersion {
  identityId:string;
  code:string;
  identityStatus:'ACTIVE'|'INACTIVE';
  versionId:string;
  versionSequence:number;
  versionNo:number;
  name:string;
  currency:'INR';
  effectiveFrom:string;
  effectiveTo:string|null;
  approvalStatus:ApprovalStatus;
  supersedesVersionId:string|null;
  superseded:boolean;
  lines:SalaryStructureLineView[];
}

export interface SalaryStructureApi {
  list(asOf:string):Promise<SalaryStructureVersion[]>;
  listComponents(asOf:string):Promise<SalaryStructureComponentOption[]>;
  history(identityId:string):Promise<SalaryStructureVersion[]>;
  create(input:SalaryStructureWrite):Promise<SalaryStructureVersion>;
  addVersion(identityId:string,input:SalaryStructureWrite):Promise<SalaryStructureVersion>;
  correct(identityId:string,versionId:string,input:SalaryStructureWrite):Promise<SalaryStructureVersion>;
  endDate(identityId:string,versionId:string,versionNo:number,effectiveTo:string):Promise<SalaryStructureVersion>;
  approve(identityId:string,versionId:string):Promise<SalaryStructureVersion>;
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

export const httpSalaryStructureApi:SalaryStructureApi={
  list:asOf=>request(`/salary-structures?asOf=${encodeURIComponent(asOf)}`),
  listComponents:asOf=>request(`/pay-components?asOf=${encodeURIComponent(asOf)}`),
  history:id=>request(`/salary-structures/${id}/versions`),
  create:input=>request('/salary-structures',{method:'POST',body:JSON.stringify(input)}),
  addVersion:(id,input)=>request(`/salary-structures/${id}/versions`,{method:'POST',body:JSON.stringify(input)}),
  correct:(id,version,input)=>request(`/salary-structures/${id}/versions/${version}/corrections`,{method:'POST',body:JSON.stringify(input)}),
  endDate:(id,version,versionNo,effectiveTo)=>request(`/salary-structures/${id}/versions/${version}/end-date`,{
    method:'POST',headers:{'If-Match':String(versionNo)},body:JSON.stringify({effectiveTo})
  }),
  approve:(id,version)=>request(`/salary-structures/${id}/versions/${version}/approval`,{method:'POST'})
};