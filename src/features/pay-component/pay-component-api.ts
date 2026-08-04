export type ComponentType='EARNING'|'DEDUCTION'|'INFORMATION';
export type FormulaType='FIXED'|'PERCENTAGE_OF_COMPONENT'|'RESIDUAL';
export type ComponentCategory=
  'CASH_EARNING'|'EMPLOYEE_DEDUCTION'|'EMPLOYER_CONTRIBUTION'|
  'EMPLOYER_PROVISION'|'REIMBURSEMENT'|'BENEFIT'|'TAXABLE_PERQUISITE'|
  'NOTIONAL'|'ACCRUAL';

export interface PayComponentVersion {
  identityId:string;
  code:string;
  name:string;
  componentType:ComponentType;
  lifecycleStatus:'PENDING_APPROVAL'|'ACTIVE'|'RETIRED';
  ownershipScope:'SYSTEM'|'COUNTRY_PACK'|'TENANT';
  countryCode:string|null;
  protectedFlag:boolean;
  confidentialityLevel:'STANDARD'|'RESTRICTED'|'EXECUTIVE';
  identityVersionNo:number;
  retirementEffectiveDate:string|null;
  retirementReason:string|null;
  retiredAt:string|null;
  retiredBy:string|null;
  versionId:string;
  versionSequence:number;
  versionNo:number;
  catalogueSchemaVersion:0|1;
  classificationStatus:'LEGACY_INCOMPLETE'|'COMPLETE';
  formulaType:FormulaType;
  formulaExpression:string|null;
  fixedAmount:number|null;
  roundingScale:number;
  componentCategory:ComponentCategory|null;
  componentSubcategory:string|null;
  cashImpact:'INCREASE'|'DECREASE'|'NONE'|null;
  payeeType:'EMPLOYEE'|'AUTHORITY'|'LENDER'|'BENEFIT_PROVIDER'|'INTERNAL'|'NONE'|null;
  paymentChannel:'PAYROLL_BANK'|'SEPARATE_BANK'|'VENDOR'|'STATUTORY_REMITTANCE'|'NONE'|null;
  settlementTiming:'CURRENT_PERIOD'|'DEFERRED'|'ACCRUAL'|'EXIT'|'ANNUAL'|'NONE'|null;
  payslipVisibility:'SHOW'|'SUMMARISE'|'HIDE'|'CONDITIONAL'|null;
  zeroValueVisibility:'SHOW'|'SUPPRESS'|null;
  negativeValuePolicy:'ALLOW'|'PROHIBIT'|'REVERSAL_ONLY'|null;
  frequency:'PER_PAYROLL_PERIOD'|'MONTHLY'|'WEEKLY'|'DAILY'|'ANNUAL'|
    'ONE_TIME'|'EVENT_DRIVEN'|'AD_HOC'|'ON_EXIT'|'ON_JOINING'|
    'ON_CONFIRMATION'|'ON_ANNIVERSARY'|null;
  valueNature:'FIXED'|'VARIABLE'|'DERIVED'|'EXTERNAL_INPUT'|
    'EMPLOYEE_ELECTION'|'EMPLOYER_DISCRETION'|'STATUTORY'|
    'BALANCE_RECOVERY'|'PROVISION'|'NOTIONAL'|null;
  amountRepresentation:'ANNUAL_AMOUNT'|'MONTHLY_AMOUNT'|'DAILY_RATE'|
    'HOURLY_RATE'|'PER_UNIT_RATE'|'PERCENTAGE'|'SLAB'|'QUANTITY_RATE'|
    'FORMULA_RESULT'|'EXTERNAL_VALUE'|null;
  taxTreatment:'DELEGATED'|'TAXABLE'|'EXEMPT'|'PARTIALLY_EXEMPT'|
    'PROOF_DEPENDENT'|'REGIME_DEPENDENT'|'PERQUISITE'|'REIMBURSEMENT'|
    'TAX_ONLY_NOTIONAL'|null;
  payrollTiming:'REGULAR'|'OFF_CYCLE_ONLY'|'REGULAR_AND_OFF_CYCLE'|
    'FINAL_SETTLEMENT_ONLY'|'ANNUAL'|'CORRECTION'|
    'NON_PAYROLL_REPORTING'|null;
  effectiveFrom:string;
  effectiveTo:string|null;
  approvalStatus:'DRAFT'|'APPROVED'|'REJECTED';
  supersedesVersionId:string|null;
  superseded:boolean;
}

export interface PayComponentVersionWrite {
  formulaType:FormulaType;
  formulaExpression?:string;
  fixedAmount?:number;
  roundingScale?:number;
  componentCategory:ComponentCategory;
  componentSubcategory?:string;
  cashImpact:'INCREASE'|'DECREASE'|'NONE';
  payeeType:'EMPLOYEE'|'AUTHORITY'|'LENDER'|'BENEFIT_PROVIDER'|'INTERNAL'|'NONE';
  paymentChannel:'PAYROLL_BANK'|'SEPARATE_BANK'|'VENDOR'|'STATUTORY_REMITTANCE'|'NONE';
  settlementTiming:'CURRENT_PERIOD'|'DEFERRED'|'ACCRUAL'|'EXIT'|'ANNUAL'|'NONE';
  payslipVisibility:'SHOW'|'SUMMARISE'|'HIDE'|'CONDITIONAL';
  zeroValueVisibility:'SHOW'|'SUPPRESS';
  negativeValuePolicy:'ALLOW'|'PROHIBIT'|'REVERSAL_ONLY';
  frequency:NonNullable<PayComponentVersion['frequency']>;
  valueNature:NonNullable<PayComponentVersion['valueNature']>;
  amountRepresentation:NonNullable<PayComponentVersion['amountRepresentation']>;
  taxTreatment:NonNullable<PayComponentVersion['taxTreatment']>;
  payrollTiming:NonNullable<PayComponentVersion['payrollTiming']>;
  effectiveFrom:string;
  effectiveTo?:string;
}

export interface PayComponentCreate {
  code:string;
  name:string;
  componentType:ComponentType;
  ownershipScope?:'SYSTEM'|'COUNTRY_PACK'|'TENANT';
  countryCode?:string;
  protectedFlag?:boolean;
  confidentialityLevel?:'STANDARD'|'RESTRICTED'|'EXECUTIVE';
  version:PayComponentVersionWrite;
}

export interface PayComponentApi {
  list(asOf:string):Promise<PayComponentVersion[]>;
  history(identityId:string):Promise<PayComponentVersion[]>;
  create(input:PayComponentCreate):Promise<PayComponentVersion>;
  addVersion(identityId:string,input:PayComponentVersionWrite):Promise<PayComponentVersion>;
  correct(identityId:string,versionId:string,input:PayComponentVersionWrite):Promise<PayComponentVersion>;
  endDate(identityId:string,versionId:string,versionNo:number,effectiveTo:string):Promise<PayComponentVersion>;
  approve(identityId:string,versionId:string):Promise<PayComponentVersion>;
  retire(identityId:string,identityVersionNo:number,effectiveDate:string,reason:string):Promise<PayComponentVersion>;
}

export async function payrollRequest<T>(path:string,init:RequestInit={}):Promise<T>{
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
  list:asOf=>payrollRequest(`/pay-components?asOf=${encodeURIComponent(asOf)}`),
  history:id=>payrollRequest(`/pay-components/${id}/versions`),
  create:input=>payrollRequest('/pay-components',{method:'POST',body:JSON.stringify(input)}),
  addVersion:(id,input)=>payrollRequest(`/pay-components/${id}/versions`,{method:'POST',body:JSON.stringify(input)}),
  correct:(id,version,input)=>payrollRequest(`/pay-components/${id}/versions/${version}/corrections`,{method:'POST',body:JSON.stringify(input)}),
  endDate:(id,version,versionNo,effectiveTo)=>payrollRequest(`/pay-components/${id}/versions/${version}/end-date`,{
    method:'POST',headers:{'If-Match':String(versionNo)},body:JSON.stringify({effectiveTo})
  }),
  approve:(id,version)=>payrollRequest(`/pay-components/${id}/versions/${version}/approval`,{method:'POST'}),
  retire:(id,identityVersionNo,effectiveDate,reason)=>payrollRequest(`/pay-components/${id}/retirement`,{
    method:'POST',headers:{'If-Match':String(identityVersionNo)},body:JSON.stringify({effectiveDate,reason})
  })
};
