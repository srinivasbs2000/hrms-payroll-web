import {
  PayComponentVersion,
  PayComponentVersionWrite,
  payrollRequest
} from '../pay-component/pay-component-api';

export type CalculationPhase='INPUT'|'PRE_TAX'|'TAX'|'POST_TAX'|'NET';
export type RateValueType='AMOUNT'|'PERCENTAGE'|'FACTOR'|'QUANTITY';
export type DimensionDataType='TEXT'|'NUMBER'|'BOOLEAN'|'DATE';
export type RoundingMethod='HALF_UP'|'HALF_EVEN'|'HALF_DOWN'|'UP'|'DOWN'|'CEILING'|'FLOOR';
export type RoundingStage='COMPONENT'|'INTERMEDIATE'|'FINAL';
export type NegativeTreatment='SYMMETRIC'|'TOWARD_ZERO'|'AWAY_FROM_ZERO'|'PROHIBIT';
export type ProrationEvent='JOINING'|'EXIT'|'UNPAID_LEAVE'|'TRANSFER'|'SALARY_REVISION';
export type ProrationMethod='CALENDAR_DAYS'|'WORKING_DAYS'|'ACTUAL_DAYS'|'NONE';
export type ProrationBasis='PAY_PERIOD'|'MONTH'|'ANNUAL'|'DAILY_RATE';

export interface StatutoryWageReferenceWrite {
  statutoryRuleId:string;
  statutoryRuleVersionId:string;
}

export type ControlledComponentVersionWrite=PayComponentVersionWrite&{
  statutoryWageReferences:StatutoryWageReferenceWrite[];
  calculationPhase:CalculationPhase;
  resultContract:'DECIMAL';
};

export interface FormulaValidationView {
  canonicalExpression:string;
  dependencies:string[];
  calculationPhase:CalculationPhase;
  resultContract:'DECIMAL';
  formulaFingerprint:string;
}

export interface FormulaDependencyView {
  componentId:string;
  componentVersionId:string;
  componentCode:string;
  calculationPhase:CalculationPhase;
  dependencyComponentId:string;
  dependencyComponentVersionId:string;
  dependencyCode:string;
  dependencyPhase:CalculationPhase;
  dependencyOrder:number;
  formulaFingerprint:string;
}

export interface FormulaDependantView {
  dependantComponentId:string;
  dependantComponentVersionId:string;
  dependantComponentCode:string;
  dependencyComponentVersionId:string;
  dependencyOrder:number;
  formulaFingerprint:string;
}

export interface ComponentImpactView {
  componentId:string;
  outgoingDependencies:FormulaDependencyView[];
  formulaDependants:FormulaDependantView[];
  payrollBaseIds:string[];
  salaryStructureIds:string[];
  roundingPolicyIds:string[];
  prorationPolicyIds:string[];
}

export interface StatutoryWageReferenceView {
  componentId:string;
  componentVersionId:string;
  statutoryRuleId:string;
  statutoryRuleVersionId:string;
  statutoryRuleCode:string;
  ruleCategory:string;
  ruleEffectiveFrom:string;
  ruleEffectiveTo:string|null;
}

export interface RateDimensionWrite {
  code:string;
  name:string;
  dataType:DimensionDataType;
}

export interface RateCellWrite {
  dimensionValues:Record<string,string>;
  rateValue:string;
}

export interface RateTableVersionWrite {
  valueType:RateValueType;
  unitCode:string;
  effectiveFrom:string;
  effectiveTo?:string;
  dimensions:RateDimensionWrite[];
  cells:RateCellWrite[];
}

export interface RateTableCreateWrite {
  code:string;
  name:string;
  version:RateTableVersionWrite;
}

export interface RateDimensionView extends RateDimensionWrite {
  id:string;
  sequence:number;
}

export interface RateCellView {
  id:string;
  sequence:number;
  dimensionValues:Record<string,string>;
  rateValue:string;
}

export interface RateTableView {
  identityId:string;
  code:string;
  name:string;
  lifecycleStatus:'PENDING_APPROVAL'|'ACTIVE'|'RETIRED';
  identityVersionNo:number;
  retirementEffectiveDate:string|null;
  retirementReason:string|null;
  versionId:string;
  versionSequence:number;
  versionNo:number;
  valueType:RateValueType;
  unitCode:string;
  effectiveFrom:string;
  effectiveTo:string|null;
  approvalStatus:'DRAFT'|'APPROVED'|'REJECTED';
  supersedesVersionId:string|null;
  superseded:boolean;
  dimensions:RateDimensionView[];
  cells:RateCellView[];
}

export interface RateLookupView {
  identityId:string;
  versionId:string;
  valueType:RateValueType;
  unitCode:string;
  dimensionValues:Record<string,string>;
  rateValue:string;
  effectiveFrom:string;
  effectiveTo:string|null;
}

export interface RoundingVersionWrite {
  method:RoundingMethod;
  scale:number;
  stage:RoundingStage;
  negativeTreatment:NegativeTreatment;
  effectiveFrom:string;
  effectiveTo?:string;
}

export interface RoundingPolicyView {
  identityId:string;
  componentId:string;
  componentCode:string;
  lifecycleStatus:'PENDING_APPROVAL'|'ACTIVE'|'RETIRED';
  identityVersionNo:number;
  retirementEffectiveDate:string|null;
  retirementReason:string|null;
  versionId:string;
  versionSequence:number;
  versionNo:number;
  method:RoundingMethod;
  scale:number;
  stage:RoundingStage;
  negativeTreatment:NegativeTreatment;
  effectiveFrom:string;
  effectiveTo:string|null;
  approvalStatus:'DRAFT'|'APPROVED'|'REJECTED';
  supersedesVersionId:string|null;
  superseded:boolean;
}

export interface ProrationVersionWrite {
  method:ProrationMethod;
  basis:ProrationBasis;
  effectiveFrom:string;
  effectiveTo?:string;
}

export interface ProrationPolicyView {
  identityId:string;
  componentId:string;
  componentCode:string;
  eventType:ProrationEvent;
  lifecycleStatus:'PENDING_APPROVAL'|'ACTIVE'|'RETIRED';
  identityVersionNo:number;
  retirementEffectiveDate:string|null;
  retirementReason:string|null;
  versionId:string;
  versionSequence:number;
  versionNo:number;
  method:ProrationMethod;
  basis:ProrationBasis;
  effectiveFrom:string;
  effectiveTo:string|null;
  approvalStatus:'DRAFT'|'APPROVED'|'REJECTED';
  supersedesVersionId:string|null;
  superseded:boolean;
}

export type AuditEventView=Record<string,unknown>;

export interface ComponentControlApi {
  listComponents(asOf:string):Promise<PayComponentVersion[]>;
  addComponentVersion(identityId:string,input:ControlledComponentVersionWrite):Promise<PayComponentVersion>;
  validateFormula(expression:string,calculationPhase:CalculationPhase):Promise<FormulaValidationView>;
  dependencies(identityId:string):Promise<FormulaDependencyView[]>;
  impact(identityId:string):Promise<ComponentImpactView>;
  statutoryWageReferences(identityId:string):Promise<StatutoryWageReferenceView[]>;
  componentAudit(identityId:string):Promise<AuditEventView[]>;

  listRateTables(asOf:string):Promise<RateTableView[]>;
  createRateTable(input:RateTableCreateWrite):Promise<RateTableView>;
  rateHistory(identityId:string):Promise<RateTableView[]>;
  addRateVersion(identityId:string,input:RateTableVersionWrite):Promise<RateTableView>;
  correctRateVersion(identityId:string,versionId:string,input:RateTableVersionWrite):Promise<RateTableView>;
  approveRate(identityId:string,versionId:string,versionNo:number):Promise<RateTableView>;
  endDateRate(identityId:string,versionId:string,versionNo:number,effectiveTo:string):Promise<RateTableView>;
  retireRate(identityId:string,identityVersionNo:number,effectiveDate:string,reason:string):Promise<RateTableView>;
  lookupRate(identityId:string,asOf:string,dimensions:Record<string,string>):Promise<RateLookupView>;
  rateAudit(identityId:string):Promise<AuditEventView[]>;

  listRoundingPolicies(asOf:string):Promise<RoundingPolicyView[]>;
  createRoundingPolicy(componentId:string,version:RoundingVersionWrite):Promise<RoundingPolicyView>;
  roundingHistory(identityId:string):Promise<RoundingPolicyView[]>;
  addRoundingVersion(identityId:string,input:RoundingVersionWrite):Promise<RoundingPolicyView>;
  correctRoundingVersion(identityId:string,versionId:string,input:RoundingVersionWrite):Promise<RoundingPolicyView>;
  approveRounding(identityId:string,versionId:string,versionNo:number):Promise<RoundingPolicyView>;
  endDateRounding(identityId:string,versionId:string,versionNo:number,effectiveTo:string):Promise<RoundingPolicyView>;
  retireRounding(identityId:string,identityVersionNo:number,effectiveDate:string,reason:string):Promise<RoundingPolicyView>;
  roundingAudit(identityId:string):Promise<AuditEventView[]>;

  listProrationPolicies(asOf:string):Promise<ProrationPolicyView[]>;
  createProrationPolicy(componentId:string,eventType:ProrationEvent,version:ProrationVersionWrite):Promise<ProrationPolicyView>;
  prorationHistory(identityId:string):Promise<ProrationPolicyView[]>;
  addProrationVersion(identityId:string,input:ProrationVersionWrite):Promise<ProrationPolicyView>;
  correctProrationVersion(identityId:string,versionId:string,input:ProrationVersionWrite):Promise<ProrationPolicyView>;
  approveProration(identityId:string,versionId:string,versionNo:number):Promise<ProrationPolicyView>;
  endDateProration(identityId:string,versionId:string,versionNo:number,effectiveTo:string):Promise<ProrationPolicyView>;
  retireProration(identityId:string,identityVersionNo:number,effectiveDate:string,reason:string):Promise<ProrationPolicyView>;
  prorationAudit(identityId:string):Promise<AuditEventView[]>;
}

function asOfQuery(asOf:string){return `?asOf=${encodeURIComponent(asOf)}`}

export const httpComponentControlApi:ComponentControlApi={
  listComponents:asOf=>payrollRequest(`/pay-components${asOfQuery(asOf)}`),
  addComponentVersion:(id,input)=>payrollRequest(`/pay-components/${id}/versions`,{
    method:'POST',body:JSON.stringify(input)
  }),
  validateFormula:(expression,calculationPhase)=>payrollRequest('/pay-components/formula-validation',{
    method:'POST',body:JSON.stringify({expression,calculationPhase,resultContract:'DECIMAL'})
  }),
  dependencies:id=>payrollRequest(`/pay-components/${id}/dependencies`),
  impact:id=>payrollRequest(`/pay-components/${id}/impact`),
  statutoryWageReferences:id=>payrollRequest(`/pay-components/${id}/statutory-wage-references`),
  componentAudit:id=>payrollRequest(`/pay-components/${id}/audit`),

  listRateTables:asOf=>payrollRequest(`/component-rate-tables${asOfQuery(asOf)}`),
  createRateTable:input=>payrollRequest('/component-rate-tables',{method:'POST',body:JSON.stringify(input)}),
  rateHistory:id=>payrollRequest(`/component-rate-tables/${id}/versions`),
  addRateVersion:(id,input)=>payrollRequest(`/component-rate-tables/${id}/versions`,{
    method:'POST',body:JSON.stringify(input)
  }),
  correctRateVersion:(id,version,input)=>payrollRequest(
    `/component-rate-tables/${id}/versions/${version}/corrections`,
    {method:'POST',body:JSON.stringify(input)}
  ),
  approveRate:(id,version,versionNo)=>payrollRequest(
    `/component-rate-tables/${id}/versions/${version}/approval`,
    {method:'POST',headers:{'If-Match':String(versionNo)}}
  ),
  endDateRate:(id,version,versionNo,effectiveTo)=>payrollRequest(
    `/component-rate-tables/${id}/versions/${version}/end-date`,
    {method:'POST',headers:{'If-Match':String(versionNo)},body:JSON.stringify({effectiveTo})}
  ),
  retireRate:(id,identityVersionNo,effectiveDate,reason)=>payrollRequest(
    `/component-rate-tables/${id}/retirement`,
    {method:'POST',headers:{'If-Match':String(identityVersionNo)},body:JSON.stringify({effectiveDate,reason})}
  ),
  lookupRate:(id,asOf,dimensions)=>payrollRequest(
    `/component-rate-tables/${id}/lookup${asOfQuery(asOf)}`,
    {method:'POST',body:JSON.stringify(dimensions)}
  ),
  rateAudit:id=>payrollRequest(`/component-rate-tables/${id}/audit`),

  listRoundingPolicies:asOf=>payrollRequest(`/component-rounding-policies${asOfQuery(asOf)}`),
  createRoundingPolicy:(componentId,version)=>payrollRequest('/component-rounding-policies',{
    method:'POST',body:JSON.stringify({componentId,version})
  }),
  roundingHistory:id=>payrollRequest(`/component-rounding-policies/${id}/versions`),
  addRoundingVersion:(id,input)=>payrollRequest(`/component-rounding-policies/${id}/versions`,{
    method:'POST',body:JSON.stringify(input)
  }),
  correctRoundingVersion:(id,version,input)=>payrollRequest(
    `/component-rounding-policies/${id}/versions/${version}/corrections`,
    {method:'POST',body:JSON.stringify(input)}
  ),
  approveRounding:(id,version,versionNo)=>payrollRequest(
    `/component-rounding-policies/${id}/versions/${version}/approval`,
    {method:'POST',headers:{'If-Match':String(versionNo)}}
  ),
  endDateRounding:(id,version,versionNo,effectiveTo)=>payrollRequest(
    `/component-rounding-policies/${id}/versions/${version}/end-date`,
    {method:'POST',headers:{'If-Match':String(versionNo)},body:JSON.stringify({effectiveTo})}
  ),
  retireRounding:(id,identityVersionNo,effectiveDate,reason)=>payrollRequest(
    `/component-rounding-policies/${id}/retirement`,
    {method:'POST',headers:{'If-Match':String(identityVersionNo)},body:JSON.stringify({effectiveDate,reason})}
  ),
  roundingAudit:id=>payrollRequest(`/component-rounding-policies/${id}/audit`),

  listProrationPolicies:asOf=>payrollRequest(`/component-proration-policies${asOfQuery(asOf)}`),
  createProrationPolicy:(componentId,eventType,version)=>payrollRequest('/component-proration-policies',{
    method:'POST',body:JSON.stringify({componentId,eventType,version})
  }),
  prorationHistory:id=>payrollRequest(`/component-proration-policies/${id}/versions`),
  addProrationVersion:(id,input)=>payrollRequest(`/component-proration-policies/${id}/versions`,{
    method:'POST',body:JSON.stringify(input)
  }),
  correctProrationVersion:(id,version,input)=>payrollRequest(
    `/component-proration-policies/${id}/versions/${version}/corrections`,
    {method:'POST',body:JSON.stringify(input)}
  ),
  approveProration:(id,version,versionNo)=>payrollRequest(
    `/component-proration-policies/${id}/versions/${version}/approval`,
    {method:'POST',headers:{'If-Match':String(versionNo)}}
  ),
  endDateProration:(id,version,versionNo,effectiveTo)=>payrollRequest(
    `/component-proration-policies/${id}/versions/${version}/end-date`,
    {method:'POST',headers:{'If-Match':String(versionNo)},body:JSON.stringify({effectiveTo})}
  ),
  retireProration:(id,identityVersionNo,effectiveDate,reason)=>payrollRequest(
    `/component-proration-policies/${id}/retirement`,
    {method:'POST',headers:{'If-Match':String(identityVersionNo)},body:JSON.stringify({effectiveDate,reason})}
  ),
  prorationAudit:id=>payrollRequest(`/component-proration-policies/${id}/audit`)
};
