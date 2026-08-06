import {payrollRequest} from '../pay-component/pay-component-api';

export type ApprovalStatus='DRAFT'|'APPROVED'|'REJECTED';
export type ComponentType='EARNING'|'DEDUCTION'|'INFORMATION';
export type FormulaType='FIXED'|'PERCENTAGE_OF_COMPONENT'|'RESIDUAL';
export type CtcCostView='OFFERED'|'TARGET'|'ACCRUED'|'ACTUAL_EMPLOYER_COST';
export type CtcTreatmentType=
  'FIXED_VALUE'|'TARGET_VALUE'|'ACTUAL_VALUE'|'PROVISION'|
  'EMPLOYER_CONTRIBUTION'|'BENEFIT_PREMIUM'|'EXCLUDE'|'INFORMATIONAL';
export type EligibilityFactType='TEXT'|'NUMBER'|'DATE'|'UUID';
export type EligibilityOperator='EQ'|'NE'|'IN'|'NOT_IN'|'GTE'|'LTE';
export type EligibilityResult='ELIGIBLE'|'NOT_ELIGIBLE'|'REQUIRES_APPROVAL';
export type EligibilityScalar=string|number;
export type StructureType='STANDARD'|'EXECUTIVE'|'SALES'|'HOURLY'|'CONTRACT';
export type PayFrequency='MONTHLY'|'WEEKLY'|'BIWEEKLY'|'SEMIMONTHLY';
export type ConfidentialityLevel='STANDARD'|'RESTRICTED'|'EXECUTIVE';
export type SalaryTargetType='ANNUAL_CTC'|'ANNUAL_GROSS'|'MONTHLY_GROSS';
export type SalaryLineType='FIXED'|'PERCENTAGE'|'RESIDUAL';
export type OverridePolicy='PROHIBITED'|'CONTROLLED'|'ALLOWED';

export const eligibilityFactTypes:Record<string,EligibilityFactType>={
  COUNTRY_CODE:'TEXT',STATE_CODE:'TEXT',LOCATION_CODE:'TEXT',
  LEGAL_ENTITY_VERSION_ID:'UUID',PAYROLL_STATUTORY_UNIT_VERSION_ID:'UUID',
  ESTABLISHMENT_VERSION_ID:'UUID',PAY_GROUP_VERSION_ID:'UUID',
  EMPLOYMENT_TYPE:'TEXT',EMPLOYEE_CATEGORY:'TEXT',GRADE_CODE:'TEXT',JOB_CODE:'TEXT',
  SERVICE_MONTHS:'NUMBER',ANNUAL_COMPENSATION_AMOUNT:'NUMBER',EFFECTIVE_DATE:'DATE'
};

export interface SalaryStructureComponentOption{
  identityId:string;versionId:string;code:string;name:string;
  componentType:ComponentType;formulaType:FormulaType;approvalStatus?:ApprovalStatus;
}

export interface CtcPolicyTreatmentWrite{
  componentId:string;componentVersionId:string;treatmentSequence:number;
  costView:CtcCostView;treatmentType:CtcTreatmentType;fixedValue?:number;
  targetPercentage?:number;payrollBaseId?:string;payrollBaseVersionId?:string;
  effectiveFrom?:string;effectiveTo?:string;
}
export interface CtcPolicyVersionWrite{
  name:string;currency?:'INR';annualisationMethod:'MONTHLY_X_12'|'PAY_PERIOD_FACTOR'|'EXACT_ANNUAL';
  toleranceAmount?:number;residualComponentId:string;residualComponentVersionId:string;
  effectiveFrom:string;effectiveTo?:string;treatments:CtcPolicyTreatmentWrite[];
}
export interface CtcPolicyCreate{code:string;version:CtcPolicyVersionWrite}
export interface CtcPolicyTreatment extends Omit<CtcPolicyTreatmentWrite,'effectiveFrom'|'effectiveTo'>{
  id:string;componentCode:string;componentName:string;componentCategory:string;
  payrollBaseCode:string|null;payrollBaseName:string|null;effectiveFrom:string;
  effectiveTo:string|null;versionNo:number;
}
export interface CtcPolicyVersion{
  identityId:string;code:string;lifecycleStatus:'PENDING_APPROVAL'|'ACTIVE'|'RETIRED';
  identityVersionNo:number;retirementEffectiveDate:string|null;retirementReason:string|null;
  retiredAt:string|null;retiredBy:string|null;versionId:string;versionSequence:number;
  versionNo:number;name:string;currency:'INR';annualisationMethod:CtcPolicyVersionWrite['annualisationMethod'];
  toleranceAmount:number;residualComponentId:string;residualComponentVersionId:string;
  residualComponentCode:string;residualComponentName:string;effectiveFrom:string;
  effectiveTo:string|null;approvalStatus:ApprovalStatus;supersedesVersionId:string|null;
  superseded:boolean;treatments:CtcPolicyTreatment[];
}

export interface EligibilityCriterionWrite{
  criterionSequence:number;factKey:string;factType:EligibilityFactType;
  comparisonOperator:EligibilityOperator;value:EligibilityScalar|EligibilityScalar[];
}
export interface EligibilityRuleVersionWrite{
  name:string;resultWhenMatched:EligibilityResult;resultWhenNotMatched:EligibilityResult;
  effectiveFrom:string;effectiveTo?:string;criteria:EligibilityCriterionWrite[];
}
export interface EligibilityRuleCreate{code:string;version:EligibilityRuleVersionWrite}
export interface EligibilityCriterion extends EligibilityCriterionWrite{id:string;versionNo:number}
export interface EligibilityRuleVersion{
  identityId:string;code:string;lifecycleStatus:'PENDING_APPROVAL'|'ACTIVE'|'RETIRED';
  identityVersionNo:number;retirementEffectiveDate:string|null;retirementReason:string|null;
  retiredAt:string|null;retiredBy:string|null;versionId:string;versionSequence:number;
  versionNo:number;name:string;resultWhenMatched:EligibilityResult;
  resultWhenNotMatched:EligibilityResult;effectiveFrom:string;effectiveTo:string|null;
  approvalStatus:ApprovalStatus;supersedesVersionId:string|null;superseded:boolean;
  criteria:EligibilityCriterion[];
}
export interface EligibilityEvaluation{
  identityId:string;versionId:string;result:EligibilityResult;matched:boolean;
  configurationHash:string;factsHash:string;evaluationHash:string;disclaimer:string;
  criteria:{criterionSequence:number;factKey:string;factType:EligibilityFactType;
    comparisonOperator:EligibilityOperator;expectedValue:unknown;actualValue:unknown;matched:boolean}[];
}

export interface SalaryStructureLineWrite{
  componentVersionId:string;sequenceNo:number;lineType:SalaryLineType;
  targetAmount?:number;targetPercentage?:number;percentageBaseCode?:string;
  minimumAmount?:number;maximumAmount?:number;mandatory:boolean;
  overridePolicy:OverridePolicy;ctcDisplayOrder:number;payslipDisplayOrder:number;
}
export interface SalaryStructureWrite{
  code?:string;name:string;currency?:'INR';structureType:StructureType;
  payFrequency:PayFrequency;confidentialityLevel:ConfidentialityLevel;
  ctcPolicyVersionId:string;eligibilityRuleVersionId?:string;targetType:SalaryTargetType;
  targetAnnualAmount:number;toleranceAmount:number;residualComponentVersionId:string;
  effectiveFrom:string;effectiveTo?:string;lines:SalaryStructureLineWrite[];
}
export interface SalaryStructureLineView extends Omit<SalaryStructureLineWrite,'targetAmount'|'targetPercentage'|'percentageBaseCode'|'minimumAmount'|'maximumAmount'>{
  id:string;componentId:string;componentCode:string;componentName:string;
  componentType:ComponentType;componentFormulaType:FormulaType;lineSchemaVersion:number;
  targetAmount:number|null;targetPercentage:number|null;percentageBaseCode:string|null;
  minimumAmount:number|null;maximumAmount:number|null;effectiveFrom:string;effectiveTo:string|null;
}
export interface SalaryStructureVersion{
  identityId:string;code:string;identityStatus:'ACTIVE'|'INACTIVE';versionId:string;
  versionSequence:number;versionNo:number;name:string;currency:'INR';structureSchemaVersion:number;
  structureType:StructureType;payFrequency:PayFrequency;confidentialityLevel:ConfidentialityLevel;
  ctcPolicyVersionId:string;eligibilityRuleVersionId:string|null;targetType:SalaryTargetType;
  targetAnnualAmount:number;toleranceAmount:number;residualComponentVersionId:string;
  configurationHash:string;validationFingerprint:string|null;effectiveFrom:string;
  effectiveTo:string|null;approvalStatus:ApprovalStatus;supersedesVersionId:string|null;
  superseded:boolean;lines:SalaryStructureLineView[];
}
export interface SalaryStructureValidationLine{
  id:string;lineSequence:number;componentId:string;componentVersionId:string;
  componentCode:string;componentName:string;annualAmount:number;monthlyAmount:number;
  classification:string;evidence:Record<string,unknown>;
}
export interface SalaryStructureValidation{
  validationId:string;identityId:string;versionId:string;ctcPolicyVersionId:string;
  eligibilityRuleVersionId:string|null;effectiveDate:string;targetAmount:number;
  validationStatus:'PASS'|'FAIL';requestHash:string;configurationHash:string;resultHash:string;
  blockingErrorCount:number;warningCount:number;summary:Record<string,unknown>;
  createdAt:string;createdBy:string;disclaimer:string;lines:SalaryStructureValidationLine[];
}

export interface CompensationConfigurationApi{
  listStructures(asOf:string):Promise<SalaryStructureVersion[]>;
  listComponents(asOf:string):Promise<SalaryStructureComponentOption[]>;
  structureHistory(identityId:string):Promise<SalaryStructureVersion[]>;
  createStructure(input:SalaryStructureWrite):Promise<SalaryStructureVersion>;
  addStructureVersion(identityId:string,input:SalaryStructureWrite):Promise<SalaryStructureVersion>;
  correctStructure(identityId:string,versionId:string,input:SalaryStructureWrite):Promise<SalaryStructureVersion>;
  endDateStructure(identityId:string,versionId:string,versionNo:number,effectiveTo:string):Promise<SalaryStructureVersion>;
  approveStructure(identityId:string,versionId:string):Promise<SalaryStructureVersion>;
  simulateStructure(identityId:string,versionId:string,effectiveDate:string,eligibilityFacts:Record<string,EligibilityScalar>):Promise<SalaryStructureValidation>;
  structureValidations(identityId:string,versionId:string):Promise<SalaryStructureValidation[]>;
  bindStructureValidation(identityId:string,versionId:string,validationId:string,versionNo:number):Promise<SalaryStructureVersion>;
  ctcList(asOf:string):Promise<CtcPolicyVersion[]>;ctcHistory(identityId:string):Promise<CtcPolicyVersion[]>;
  ctcCreate(input:CtcPolicyCreate):Promise<CtcPolicyVersion>;
  ctcAddVersion(identityId:string,input:CtcPolicyVersionWrite):Promise<CtcPolicyVersion>;
  ctcCorrect(identityId:string,versionId:string,input:CtcPolicyVersionWrite):Promise<CtcPolicyVersion>;
  ctcEndDate(identityId:string,versionId:string,versionNo:number,effectiveTo:string):Promise<CtcPolicyVersion>;
  ctcApprove(identityId:string,versionId:string):Promise<CtcPolicyVersion>;
  ctcRetire(identityId:string,identityVersionNo:number,effectiveDate:string,reason:string):Promise<CtcPolicyVersion>;
  eligibilityList(asOf:string):Promise<EligibilityRuleVersion[]>;
  eligibilityHistory(identityId:string):Promise<EligibilityRuleVersion[]>;
  eligibilityCreate(input:EligibilityRuleCreate):Promise<EligibilityRuleVersion>;
  eligibilityAddVersion(identityId:string,input:EligibilityRuleVersionWrite):Promise<EligibilityRuleVersion>;
  eligibilityCorrect(identityId:string,versionId:string,input:EligibilityRuleVersionWrite):Promise<EligibilityRuleVersion>;
  eligibilityEndDate(identityId:string,versionId:string,versionNo:number,effectiveTo:string):Promise<EligibilityRuleVersion>;
  eligibilityApprove(identityId:string,versionId:string):Promise<EligibilityRuleVersion>;
  eligibilityEvaluate(identityId:string,versionId:string,facts:Record<string,EligibilityScalar>):Promise<EligibilityEvaluation>;
  eligibilityRetire(identityId:string,identityVersionNo:number,effectiveDate:string,reason:string):Promise<EligibilityRuleVersion>;
}

const post=(body?:unknown,headers?:HeadersInit):RequestInit=>({method:'POST',headers,body:body===undefined?undefined:JSON.stringify(body)});
export const httpCompensationConfigurationApi:CompensationConfigurationApi={
  listStructures:asOf=>payrollRequest(`/salary-structures?asOf=${encodeURIComponent(asOf)}`),
  listComponents:asOf=>payrollRequest(`/pay-components?asOf=${encodeURIComponent(asOf)}`),
  structureHistory:id=>payrollRequest(`/salary-structures/${id}/versions`),
  createStructure:input=>payrollRequest('/salary-structures',post(input)),
  addStructureVersion:(id,input)=>payrollRequest(`/salary-structures/${id}/versions`,post(input)),
  correctStructure:(id,version,input)=>payrollRequest(`/salary-structures/${id}/versions/${version}/corrections`,post(input)),
  endDateStructure:(id,version,versionNo,effectiveTo)=>payrollRequest(`/salary-structures/${id}/versions/${version}/end-date`,post({effectiveTo},{'If-Match':String(versionNo)})),
  approveStructure:(id,version)=>payrollRequest(`/salary-structures/${id}/versions/${version}/approval`,post()),
  simulateStructure:(id,version,effectiveDate,eligibilityFacts)=>payrollRequest(`/salary-structures/${id}/versions/${version}/simulations`,post({effectiveDate,eligibilityFacts})),
  structureValidations:(id,version)=>payrollRequest(`/salary-structures/${id}/versions/${version}/validations`),
  bindStructureValidation:(id,version,validation,versionNo)=>payrollRequest(`/salary-structures/${id}/versions/${version}/validations/${validation}/binding`,post(undefined,{'If-Match':String(versionNo)})),
  ctcList:asOf=>payrollRequest(`/ctc-policies?asOf=${encodeURIComponent(asOf)}`),
  ctcHistory:id=>payrollRequest(`/ctc-policies/${id}/versions`),ctcCreate:input=>payrollRequest('/ctc-policies',post(input)),
  ctcAddVersion:(id,input)=>payrollRequest(`/ctc-policies/${id}/versions`,post(input)),
  ctcCorrect:(id,version,input)=>payrollRequest(`/ctc-policies/${id}/versions/${version}/corrections`,post(input)),
  ctcEndDate:(id,version,versionNo,effectiveTo)=>payrollRequest(`/ctc-policies/${id}/versions/${version}/end-date`,post({effectiveTo},{'If-Match':String(versionNo)})),
  ctcApprove:(id,version)=>payrollRequest(`/ctc-policies/${id}/versions/${version}/approval`,post()),
  ctcRetire:(id,versionNo,effectiveDate,reason)=>payrollRequest(`/ctc-policies/${id}/retirement`,post({effectiveDate,reason},{'If-Match':String(versionNo)})),
  eligibilityList:asOf=>payrollRequest(`/eligibility-rules?asOf=${encodeURIComponent(asOf)}`),
  eligibilityHistory:id=>payrollRequest(`/eligibility-rules/${id}/versions`),eligibilityCreate:input=>payrollRequest('/eligibility-rules',post(input)),
  eligibilityAddVersion:(id,input)=>payrollRequest(`/eligibility-rules/${id}/versions`,post(input)),
  eligibilityCorrect:(id,version,input)=>payrollRequest(`/eligibility-rules/${id}/versions/${version}/corrections`,post(input)),
  eligibilityEndDate:(id,version,versionNo,effectiveTo)=>payrollRequest(`/eligibility-rules/${id}/versions/${version}/end-date`,post({effectiveTo},{'If-Match':String(versionNo)})),
  eligibilityApprove:(id,version)=>payrollRequest(`/eligibility-rules/${id}/versions/${version}/approval`,post()),
  eligibilityEvaluate:(id,version,facts)=>payrollRequest(`/eligibility-rules/${id}/versions/${version}/evaluation`,post({facts})),
  eligibilityRetire:(id,versionNo,effectiveDate,reason)=>payrollRequest(`/eligibility-rules/${id}/retirement`,post({effectiveDate,reason},{'If-Match':String(versionNo)}))
};
