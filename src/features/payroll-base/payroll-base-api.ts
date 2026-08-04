import {payrollRequest,PayComponentVersion} from '../pay-component/pay-component-api';

export interface PayrollBaseVersion{
  identityId:string;code:string;name:string;
  lifecycleStatus:'PENDING_APPROVAL'|'ACTIVE'|'RETIRED';
  ownershipScope:'SYSTEM'|'COUNTRY_PACK'|'TENANT';countryCode:string|null;
  protectedFlag:boolean;confidentialityLevel:'STANDARD'|'RESTRICTED'|'EXECUTIVE';
  identityVersionNo:number;retirementEffectiveDate:string|null;retirementReason:string|null;
  retiredAt:string|null;retiredBy:string|null;versionId:string;versionSequence:number;
  versionNo:number;catalogueSchemaVersion:1;
  baseCategory:'CALCULATION'|'STATUTORY'|'TAX'|'CTC'|'REPORTING';
  aggregationMethod:'SUM'|'AVERAGE'|'MAXIMUM'|'MINIMUM'|'CUSTOM';
  description:string|null;effectiveFrom:string;effectiveTo:string|null;
  approvalStatus:'DRAFT'|'APPROVED'|'REJECTED';supersedesVersionId:string|null;superseded:boolean;
}
export interface PayrollBaseVersionWrite{
  baseCategory:PayrollBaseVersion['baseCategory'];
  aggregationMethod:PayrollBaseVersion['aggregationMethod'];
  description?:string;effectiveFrom:string;effectiveTo?:string;
}
export interface PayrollBaseCreate{
  code:string;name:string;ownershipScope?:'SYSTEM'|'COUNTRY_PACK'|'TENANT';
  countryCode?:string;protectedFlag?:boolean;
  confidentialityLevel?:'STANDARD'|'RESTRICTED'|'EXECUTIVE';
  version:PayrollBaseVersionWrite;
}
export interface ComponentBaseMembership{
  membershipId:string;payrollBaseId:string;payrollBaseVersionId:string;
  payrollBaseCode:string;payrollBaseVersionSequence:number;
  componentId:string;componentVersionId:string;componentCode:string;componentName:string;
  componentVersionSequence:number;membershipSequence:number;versionNo:number;
  membershipType:'INCLUDE'|'EXCLUDE'|'ADD_BACK'|'ELIGIBILITY_ONLY'|'CONTRIBUTION_ONLY'|'NOTIONAL';
  inclusionPercent:string;effectiveFrom:string;effectiveTo:string|null;
  approvalStatus:'DRAFT'|'APPROVED'|'REJECTED';supersedesMembershipId:string|null;superseded:boolean;
}
export interface MembershipWrite{
  payrollBaseVersionId:string;componentId:string;componentVersionId:string;
  membershipType:ComponentBaseMembership['membershipType'];inclusionPercent:string;
  effectiveFrom:string;effectiveTo?:string;
}
export interface PayrollBaseApi{
  list(asOf:string):Promise<PayrollBaseVersion[]>;
  history(identityId:string):Promise<PayrollBaseVersion[]>;
  create(input:PayrollBaseCreate):Promise<PayrollBaseVersion>;
  addVersion(identityId:string,input:PayrollBaseVersionWrite):Promise<PayrollBaseVersion>;
  correct(identityId:string,versionId:string,input:PayrollBaseVersionWrite):Promise<PayrollBaseVersion>;
  approve(identityId:string,versionId:string):Promise<PayrollBaseVersion>;
  endDate(identityId:string,versionId:string,versionNo:number,effectiveTo:string):Promise<PayrollBaseVersion>;
  retire(identityId:string,identityVersionNo:number,effectiveDate:string,reason:string):Promise<PayrollBaseVersion>;
  memberships(identityId:string,asOf:string,includeHistory:boolean):Promise<ComponentBaseMembership[]>;
  createMembership(identityId:string,input:MembershipWrite):Promise<ComponentBaseMembership>;
  correctMembership(identityId:string,membershipId:string,input:MembershipWrite):Promise<ComponentBaseMembership>;
  approveMembership(identityId:string,membershipId:string):Promise<ComponentBaseMembership>;
  endDateMembership(identityId:string,membershipId:string,versionNo:number,effectiveTo:string):Promise<ComponentBaseMembership>;
  components(asOf:string):Promise<PayComponentVersion[]>;
}
export const httpPayrollBaseApi:PayrollBaseApi={
  list:asOf=>payrollRequest(`/payroll-bases?asOf=${encodeURIComponent(asOf)}`),
  history:id=>payrollRequest(`/payroll-bases/${id}/versions`),
  create:input=>payrollRequest('/payroll-bases',{method:'POST',body:JSON.stringify(input)}),
  addVersion:(id,input)=>payrollRequest(`/payroll-bases/${id}/versions`,{method:'POST',body:JSON.stringify(input)}),
  correct:(id,version,input)=>payrollRequest(`/payroll-bases/${id}/versions/${version}/corrections`,{method:'POST',body:JSON.stringify(input)}),
  approve:(id,version)=>payrollRequest(`/payroll-bases/${id}/versions/${version}/approval`,{method:'POST'}),
  endDate:(id,version,versionNo,effectiveTo)=>payrollRequest(`/payroll-bases/${id}/versions/${version}/end-date`,{method:'POST',headers:{'If-Match':String(versionNo)},body:JSON.stringify({effectiveTo})}),
  retire:(id,identityVersionNo,effectiveDate,reason)=>payrollRequest(`/payroll-bases/${id}/retirement`,{method:'POST',headers:{'If-Match':String(identityVersionNo)},body:JSON.stringify({effectiveDate,reason})}),
  memberships:(id,asOf,includeHistory)=>payrollRequest(`/payroll-bases/${id}/memberships?asOf=${encodeURIComponent(asOf)}&includeHistory=${includeHistory}`),
  createMembership:(id,input)=>payrollRequest(`/payroll-bases/${id}/memberships`,{method:'POST',body:JSON.stringify(input)}),
  correctMembership:(id,membership,input)=>payrollRequest(`/payroll-bases/${id}/memberships/${membership}/corrections`,{method:'POST',body:JSON.stringify(input)}),
  approveMembership:(id,membership)=>payrollRequest(`/payroll-bases/${id}/memberships/${membership}/approval`,{method:'POST'}),
  endDateMembership:(id,membership,versionNo,effectiveTo)=>payrollRequest(`/payroll-bases/${id}/memberships/${membership}/end-date`,{method:'POST',headers:{'If-Match':String(versionNo)},body:JSON.stringify({effectiveTo})}),
  components:asOf=>payrollRequest(`/pay-components?asOf=${encodeURIComponent(asOf)}`)
};
