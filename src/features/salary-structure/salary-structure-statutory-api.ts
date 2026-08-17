import {payrollRequest} from '../pay-component/pay-component-api';

export type StatutoryBindingPurpose='MINIMUM_WAGE'|'STATUTORY_RULE';
export type StatutoryEnforcementLevel='BLOCKING'|'ADVISORY';

export interface StatutoryRuleVersionOption{
  statutoryRuleId:string;
  statutoryRuleVersionId:string;
  versionSequence:number;
  jurisdictionCode:string;
  authorityCode:string;
  ruleCode:string;
  ruleName:string;
  ruleCategory:string;
  currency:string;
  effectiveFrom:string;
  effectiveTo:string|null;
  constraintKind:string|null;
  periodBasis:'ANNUAL'|'MONTHLY'|'DAILY'|'HOURLY'|null;
  minimumAmount:number|null;
}

export interface SalaryStructureStatutoryBinding{
  bindingId:string;
  salaryStructureVersionId:string;
  statutoryRuleId:string;
  statutoryRuleVersionId:string;
  statutoryRuleVersionSequence:number;
  jurisdictionCode:string;
  authorityCode:string;
  ruleCode:string;
  ruleName:string;
  ruleCategory:string;
  bindingPurpose:StatutoryBindingPurpose;
  enforcementLevel:StatutoryEnforcementLevel;
  componentVersionId:string|null;
  periodBasis:'ANNUAL'|'MONTHLY'|'DAILY'|'HOURLY'|null;
  minimumAmount:number|null;
  currency:string;
  status:'ACTIVE'|'RETIRED';
  versionNo:number;
  createdAt:string;
  createdBy:string;
  retiredAt:string|null;
  retiredBy:string|null;
}

export interface StatutoryCompatibilityIssue{
  issueId:string;
  bindingId:string|null;
  issueCode:string;
  severity:StatutoryEnforcementLevel;
  statutoryRuleId:string|null;
  statutoryRuleVersionId:string|null;
  componentVersionId:string|null;
  periodBasis:string|null;
  requiredAmount:number|null;
  actualAmount:number|null;
  issueDetail:string;
}

export interface StatutoryCompatibilityEvaluation{
  evaluationId:string;
  validationId:string;
  salaryStructureVersionId:string;
  statutoryBindingRevision:number;
  validationStatus:'PASS'|'FAIL';
  blockingIssueCount:number;
  advisoryIssueCount:number;
  evidenceHash:string;
  createdAt:string;
  createdBy:string;
  issues:StatutoryCompatibilityIssue[];
  disclaimer:string;
}

export interface SalaryStructureStatutoryApi{
  ruleVersions(asOf:string):Promise<StatutoryRuleVersionOption[]>;
  bindings(identityId:string,versionId:string):Promise<SalaryStructureStatutoryBinding[]>;
  bind(identityId:string,versionId:string,input:{
    statutoryRuleVersionId:string;
    bindingPurpose:StatutoryBindingPurpose;
    enforcementLevel:StatutoryEnforcementLevel;
    componentVersionId?:string;
  }):Promise<SalaryStructureStatutoryBinding>;
  retire(identityId:string,versionId:string,bindingId:string,expectedVersion:number):
    Promise<SalaryStructureStatutoryBinding>;
  evaluate(identityId:string,versionId:string,validationId:string):
    Promise<StatutoryCompatibilityEvaluation>;
  evaluations(identityId:string,versionId:string,validationId:string):
    Promise<StatutoryCompatibilityEvaluation[]>;
}

const base='/salary-structure-statutory-compatibility';
const idempotencyKey=()=>globalThis.crypto?.randomUUID?.()??`${Date.now()}-${Math.random()}`;
const post=(body?:unknown):RequestInit=>({
  method:'POST',
  headers:{'Idempotency-Key':idempotencyKey()},
  body:body===undefined?undefined:JSON.stringify(body)
});

export const httpSalaryStructureStatutoryApi:SalaryStructureStatutoryApi={
  ruleVersions:asOf=>payrollRequest(`${base}/rule-versions?asOf=${encodeURIComponent(asOf)}`),
  bindings:(id,version)=>payrollRequest(`${base}/${id}/versions/${version}/bindings`),
  bind:(id,version,input)=>payrollRequest(`${base}/${id}/versions/${version}/bindings`,post(input)),
  retire:(id,version,binding,expectedVersion)=>payrollRequest(
    `${base}/${id}/versions/${version}/bindings/${binding}/retirement`,
    post({expectedVersion})),
  evaluate:(id,version,validation)=>payrollRequest(
    `${base}/${id}/versions/${version}/validations/${validation}/evaluations`,
    post()),
  evaluations:(id,version,validation)=>payrollRequest(
    `${base}/${id}/versions/${version}/validations/${validation}/evaluations`)
};
