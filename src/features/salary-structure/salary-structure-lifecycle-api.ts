import {payrollRequest} from '../pay-component/pay-component-api';

export type SalaryStructureWorkflowStatus=
  'DRAFT'|'SUBMITTED'|'APPROVED'|'PUBLISHED'|'REJECTED';

export interface SalaryStructureWorkflowAction{
  actionId:string;
  actionSequence:number;
  actionType:'SUBMITTED'|'APPROVED'|'REJECTED'|'PUBLISHED';
  actor:string;
  occurredAt:string;
  comment:string|null;
  configurationHash:string;
  validationFingerprint:string|null;
  statutoryBindingRevision:number;
  statutoryEvidenceHash:string|null;
  structureVersionNo:number;
  actionHash:string;
}

export interface SalaryStructureLifecycle{
  identityId:string;
  versionId:string;
  versionNo:number;
  workflowStatus:SalaryStructureWorkflowStatus;
  approvalStatus:'DRAFT'|'APPROVED'|'REJECTED';
  publishedActive:boolean;
  submittedAt:string|null;
  submittedBy:string|null;
  approvedAt:string|null;
  approvedBy:string|null;
  publishedAt:string|null;
  publishedBy:string|null;
  configurationHash:string;
  validationFingerprint:string|null;
  statutoryBindingRevision:number;
  actions:SalaryStructureWorkflowAction[];
}

export interface SalaryStructureLifecycleApi{
  lifecycle(identityId:string,versionId:string):Promise<SalaryStructureLifecycle>;
  submit(identityId:string,versionId:string,versionNo:number,comment?:string):Promise<SalaryStructureLifecycle>;
  approve(identityId:string,versionId:string):Promise<void>;
  reject(identityId:string,versionId:string,versionNo:number,reason:string):Promise<SalaryStructureLifecycle>;
  publish(identityId:string,versionId:string,versionNo:number,comment?:string):Promise<SalaryStructureLifecycle>;
}

const post=(versionNo?:number,body?:unknown):RequestInit=>({
  method:'POST',
  headers:{
    'Idempotency-Key':crypto.randomUUID(),
    ...(versionNo===undefined?{}:{'If-Match':String(versionNo)})
  },
  body:body===undefined?undefined:JSON.stringify(body)
});

export const httpSalaryStructureLifecycleApi:SalaryStructureLifecycleApi={
  lifecycle:(identityId,versionId)=>payrollRequest(
    `/salary-structures/${identityId}/versions/${versionId}/lifecycle`),
  submit:(identityId,versionId,versionNo,comment)=>payrollRequest(
    `/salary-structures/${identityId}/versions/${versionId}/submission`,
    post(versionNo,{comment:comment||null})),
  approve:async(identityId,versionId)=>{
    await payrollRequest(
      `/salary-structures/${identityId}/versions/${versionId}/approval`,
      post());
  },
  reject:(identityId,versionId,versionNo,reason)=>payrollRequest(
    `/salary-structures/${identityId}/versions/${versionId}/rejection`,
    post(versionNo,{reason})),
  publish:(identityId,versionId,versionNo,comment)=>payrollRequest(
    `/salary-structures/${identityId}/versions/${versionId}/publication`,
    post(versionNo,{comment:comment||null}))
};
