import {ApprovalStatus,employeePayrollRequest} from './employee-payroll-api';

export type CompensationEventType='PROSPECTIVE'|'CURRENT_PERIOD'|'RETROSPECTIVE'|'CORRECTION'|'REVERSAL';
export type OverrideKind='AMOUNT'|'PERCENTAGE';
export type LifecycleEventType='TRANSFER'|'REHIRE'|'CONCURRENT_ASSIGNMENT';
export type RelationshipDecision='CONTINUE'|'SUCCESSOR';

export interface AffectedPeriodView{
  payPeriodId:string;
  periodCode:string;
  periodStart:string;
  periodEnd:string;
  reasonCode:string;
}

export interface CompensationChangeWrite{
  payrollAssignmentId:string;
  eventType:CompensationEventType;
  effectiveDate:string;
  sourceEventId?:string;
  reason:string;
}

export interface CompensationChangeView{
  id:string;
  payrollAssignmentId:string;
  eventType:CompensationEventType;
  effectiveDate:string;
  sourceEventId:string|null;
  reason:string;
  assessmentThrough:string|null;
  impactAssessedAt:string|null;
  impactAssessedBy:string|null;
  impactedPeriodCount:number;
  approvalStatus:ApprovalStatus;
  approvedAt:string|null;
  approvedBy:string|null;
  versionNo:number;
}

export interface EmployeeComponentOverrideWrite{
  payrollAssignmentVersionId:string;
  salaryAssignmentId:string;
  salaryStructureLineId:string;
  componentVersionId:string;
  overrideKind:OverrideKind;
  overrideValue:number;
  effectiveFrom:string;
  effectiveTo?:string;
}

export interface EmployeeComponentOverrideView{
  id:string;
  payrollAssignmentVersionId:string;
  salaryAssignmentId:string;
  salaryStructureLineId:string;
  componentVersionId:string;
  overrideKind:OverrideKind;
  overrideValue:number;
  effectiveFrom:string;
  effectiveTo:string|null;
  approvalStatus:ApprovalStatus;
  supersedesOverrideId:string|null;
  superseded:boolean;
  versionNo:number;
}

export interface PayrollLifecycleLineageWrite{
  eventType:LifecycleEventType;
  relationshipDecision:RelationshipDecision;
  predecessorRelationshipId:string;
  successorRelationshipId:string;
  predecessorAssignmentId?:string;
  successorAssignmentId?:string;
  effectiveDate:string;
  reason:string;
}

export interface PayrollLifecycleLineageView{
  id:string;
  eventType:LifecycleEventType;
  relationshipDecision:RelationshipDecision;
  predecessorRelationshipId:string;
  successorRelationshipId:string;
  predecessorAssignmentId:string|null;
  successorAssignmentId:string|null;
  effectiveDate:string;
  reason:string;
  approvalStatus:ApprovalStatus;
  versionNo:number;
}

export interface AuditEventView{
  id:string;
  occurredAt:string;
  actor:string;
  action:string;
  objectType:string;
  objectId:string;
  correlationId:string;
  beforeState:string|null;
  afterState:string|null;
  metadata:string|null;
}

export interface EmployeePayrollBindingApi{
  listCompensationChanges(payrollAssignmentId:string):Promise<CompensationChangeView[]>;
  createCompensationChange(input:CompensationChangeWrite):Promise<CompensationChangeView>;
  assessCompensationChange(id:string,assessmentThrough:string):Promise<CompensationChangeView>;
  compensationChangeImpact(id:string):Promise<AffectedPeriodView[]>;
  approveCompensationChange(id:string):Promise<CompensationChangeView>;
  compensationChangeAudit(id:string):Promise<AuditEventView[]>;

  listOverrides(payrollAssignmentVersionId:string):Promise<EmployeeComponentOverrideView[]>;
  createOverride(input:EmployeeComponentOverrideWrite):Promise<EmployeeComponentOverrideView>;
  correctOverride(id:string,input:EmployeeComponentOverrideWrite):Promise<EmployeeComponentOverrideView>;
  approveOverride(id:string):Promise<EmployeeComponentOverrideView>;
  overrideAudit(id:string):Promise<AuditEventView[]>;

  listLineage(payrollRelationshipId:string):Promise<PayrollLifecycleLineageView[]>;
  createLineage(input:PayrollLifecycleLineageWrite):Promise<PayrollLifecycleLineageView>;
  approveLineage(id:string):Promise<PayrollLifecycleLineageView>;
  lineageAudit(id:string):Promise<AuditEventView[]>;

  payGroupImpact(id:string):Promise<AffectedPeriodView[]>;
}

export const httpEmployeePayrollBindingApi:EmployeePayrollBindingApi={
  listCompensationChanges:id=>employeePayrollRequest(`/compensation-changes?payrollAssignmentId=${encodeURIComponent(id)}`),
  createCompensationChange:input=>employeePayrollRequest('/compensation-changes',{method:'POST',body:JSON.stringify(input)}),
  assessCompensationChange:(id,assessmentThrough)=>employeePayrollRequest(`/compensation-changes/${id}/impact-assessment`,{
    method:'POST',body:JSON.stringify({assessmentThrough})
  }),
  compensationChangeImpact:id=>employeePayrollRequest(`/compensation-changes/${id}/impact`),
  approveCompensationChange:id=>employeePayrollRequest(`/compensation-changes/${id}/approval`,{method:'POST'}),
  compensationChangeAudit:id=>employeePayrollRequest(`/compensation-changes/${id}/audit`),

  listOverrides:id=>employeePayrollRequest(`/employee-component-overrides?payrollAssignmentVersionId=${encodeURIComponent(id)}`),
  createOverride:input=>employeePayrollRequest('/employee-component-overrides',{method:'POST',body:JSON.stringify(input)}),
  correctOverride:(id,input)=>employeePayrollRequest(`/employee-component-overrides/${id}/corrections`,{method:'POST',body:JSON.stringify(input)}),
  approveOverride:id=>employeePayrollRequest(`/employee-component-overrides/${id}/approval`,{method:'POST'}),
  overrideAudit:id=>employeePayrollRequest(`/employee-component-overrides/${id}/audit`),

  listLineage:id=>employeePayrollRequest(`/payroll-lifecycle-lineage?payrollRelationshipId=${encodeURIComponent(id)}`),
  createLineage:input=>employeePayrollRequest('/payroll-lifecycle-lineage',{method:'POST',body:JSON.stringify(input)}),
  approveLineage:id=>employeePayrollRequest(`/payroll-lifecycle-lineage/${id}/approval`,{method:'POST'}),
  lineageAudit:id=>employeePayrollRequest(`/payroll-lifecycle-lineage/${id}/audit`),

  payGroupImpact:id=>employeePayrollRequest(`/pay-group-assignments/${id}/impact`)
};
