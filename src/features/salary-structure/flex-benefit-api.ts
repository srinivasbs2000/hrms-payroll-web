import {payrollRequest} from '../pay-component/pay-component-api';

export type FlexApprovalStatus='DRAFT'|'APPROVED'|'REJECTED';
export type FlexJoiningRule='OPEN_SPECIAL_WINDOW'|'DEFAULT_ELECTION'|'NEXT_WINDOW'|'APPROVAL_REQUIRED';
export type FlexChangeRule='PROHIBITED'|'QUALIFYING_EVENT_ONLY'|'APPROVAL_REQUIRED';
export type FlexUnusedRule='CARRY_FORWARD'|'TAXABLE_FALLBACK'|'ENCASH'|'FORFEIT';
export type FlexFinalRule='ENCASH'|'TAXABLE_FALLBACK'|'FORFEIT'|'POLICY_ENGINE';
export type FlexRetroRule='PROHIBITED'|'OPEN_PERIOD_ONLY'|'APPROVAL_REQUIRED';

export interface BenefitPlanLine{
  componentVersionId:string;componentCode:string;componentName:string;
  defaultAmount:number|null;minimumAmount:number|null;maximumAmount:number|null;
}
export interface BenefitSupplementalPlan{
  identityId:string;versionId:string;versionSequence:number;code:string;name:string;
  planType:'ALLOWANCE'|'BENEFIT'|'INCENTIVE';approvalStatus:FlexApprovalStatus;
  effectiveFrom:string;effectiveTo:string|null;lines:BenefitPlanLine[];
}
export interface FlexEligibilityOption{versionId:string;code:string;approvalStatus:FlexApprovalStatus}
export interface FlexComponentOption{versionId:string;code:string;name:string;approvalStatus?:FlexApprovalStatus}
export interface FlexBenefitOptionWrite{
  optionSequence:number;componentVersionId:string;minimumAnnualAmount:string;
  maximumAnnualAmount?:string;defaultAnnualAmount:string;proofRequired:boolean;
}
export interface FlexBenefitVersionWrite{
  name:string;currency:'INR';supplementalPlanVersionId:string;eligibilityRuleVersionId?:string;
  annualBasketAmount:string;electionWindowStart:string;electionWindowEnd:string;
  midYearJoiningRule:FlexJoiningRule;joiningElectionWindowDays?:number;
  midYearChangeRule:FlexChangeRule;unusedBalanceRule:FlexUnusedRule;carryForwardLimit?:string;
  taxableFallbackComponentVersionId?:string;encashmentComponentVersionId?:string;
  finalSettlementRule:FlexFinalRule;retroCorrectionRule:FlexRetroRule;
  allowTotalCompensationChange:boolean;effectiveFrom:string;effectiveTo?:string;
  options:FlexBenefitOptionWrite[];
}
export interface FlexBenefitCreate{code:string;version:FlexBenefitVersionWrite}
export interface FlexBenefitOption extends FlexBenefitOptionWrite{
  optionId:string;componentId:string;componentCode:string;componentName:string;versionNo:number;
}
export interface FlexBenefitPlan{
  identityId:string;code:string;lifecycleStatus:'PENDING_APPROVAL'|'ACTIVE'|'RETIRED';
  identityVersionNo:number;versionId:string;versionSequence:number;versionNo:number;
  name:string;currency:'INR';supplementalPlanId:string;supplementalPlanVersionId:string;
  supplementalPlanCode:string;supplementalPlanName:string;supplementalPlanVersionSequence:number;
  eligibilityRuleId:string|null;eligibilityRuleVersionId:string|null;eligibilityRuleCode:string|null;annualBasketAmount:string;
  electionWindowStart:string;electionWindowEnd:string;midYearJoiningRule:FlexJoiningRule;
  joiningElectionWindowDays:number|null;midYearChangeRule:FlexChangeRule;
  unusedBalanceRule:FlexUnusedRule;carryForwardLimit:string|null;
  taxableFallbackComponentVersionId:string|null;encashmentComponentVersionId:string|null;
  finalSettlementRule:FlexFinalRule;retroCorrectionRule:FlexRetroRule;
  allowTotalCompensationChange:boolean;effectiveFrom:string;effectiveTo:string|null;
  approvalStatus:FlexApprovalStatus;approvedAt:string|null;approvedBy:string|null;
  supersedesVersionId:string|null;superseded:boolean;options:FlexBenefitOption[];
}
export interface FlexElectionValidation{
  validationStatus:'PASS'|'FAIL';annualBasketAmount:string;electedAnnualAmount:string;
  residualAnnualAmount:string;residualTreatment:FlexUnusedRule;
  blockers:string[];warnings:string[];disclaimer:string;
}
export interface FlexBenefitApi{
  list(asOf:string):Promise<FlexBenefitPlan[]>;
  history(identityId:string):Promise<FlexBenefitPlan[]>;
  benefitPlans(asOf:string):Promise<BenefitSupplementalPlan[]>;
  eligibilityRules(asOf:string):Promise<FlexEligibilityOption[]>;
  components(asOf:string):Promise<FlexComponentOption[]>;
  create(input:FlexBenefitCreate):Promise<FlexBenefitPlan>;
  addVersion(identityId:string,input:FlexBenefitVersionWrite):Promise<FlexBenefitPlan>;
  correct(identityId:string,versionId:string,input:FlexBenefitVersionWrite):Promise<FlexBenefitPlan>;
  approve(identityId:string,versionId:string):Promise<FlexBenefitPlan>;
  validateElection(identityId:string,versionId:string,input:{
    electionDate:string;joiningDate?:string;midYearChange:boolean;qualifyingEvent:boolean;
    approvedPolicyException:boolean;approvedCompensationAdjustment:boolean;eligibilityFacts:Record<string,unknown>;
    allocations:{componentVersionId:string;annualAmount:string}[];
  }):Promise<FlexElectionValidation>;
}
const post=(body?:unknown):RequestInit=>({method:'POST',body:body===undefined?undefined:JSON.stringify(body)});
export const httpFlexBenefitApi:FlexBenefitApi={
  list:asOf=>payrollRequest(`/flex-benefit-plans?asOf=${encodeURIComponent(asOf)}`),
  history:id=>payrollRequest(`/flex-benefit-plans/${id}/versions`),
  benefitPlans:asOf=>payrollRequest(`/salary-supplemental-plans?asOf=${encodeURIComponent(asOf)}`),
  eligibilityRules:asOf=>payrollRequest(`/eligibility-rules?asOf=${encodeURIComponent(asOf)}`),
  components:asOf=>payrollRequest(`/pay-components?asOf=${encodeURIComponent(asOf)}`),
  create:input=>payrollRequest('/flex-benefit-plans',post(input)),
  addVersion:(id,input)=>payrollRequest(`/flex-benefit-plans/${id}/versions`,post(input)),
  correct:(id,version,input)=>payrollRequest(`/flex-benefit-plans/${id}/versions/${version}/corrections`,post(input)),
  approve:(id,version)=>payrollRequest(`/flex-benefit-plans/${id}/versions/${version}/approval`,post()),
  validateElection:(id,version,input)=>payrollRequest(
    `/flex-benefit-plans/${id}/versions/${version}/election-validation`,post(input))
};
