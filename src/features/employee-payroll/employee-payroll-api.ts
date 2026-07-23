export type ApprovalStatus='DRAFT'|'APPROVED'|'REJECTED';
export type PayrollProfileStatus='INCOMPLETE'|'READY'|'ON_HOLD'|'INACTIVE';

export interface PayrollRelationshipWrite {
  externalEmployeeId?:string;
  employeeNumber?:string;
  legalEntityVersionId:string;
  relationshipStart:string;
  relationshipEnd?:string;
}

export interface PayrollRelationshipView {
  identityId:string;
  externalEmployeeId:string;
  employeeNumber:string;
  identityStatus:'ACTIVE'|'INACTIVE';
  versionId:string;
  versionSequence:number;
  versionNo:number;
  legalEntityVersionId:string;
  relationshipStart:string;
  relationshipEnd:string|null;
  approvalStatus:ApprovalStatus;
  supersedesVersionId:string|null;
  superseded:boolean;
}

export interface PayrollAssignmentWrite {
  payrollRelationshipId?:string;
  assignmentNumber?:string;
  payrollRelationshipVersionId:string;
  establishmentVersionId:string;
  assignmentStart:string;
  assignmentEnd?:string;
}

export interface PayrollAssignmentView {
  identityId:string;
  payrollRelationshipId:string;
  assignmentNumber:string;
  identityStatus:'ACTIVE'|'INACTIVE';
  versionId:string;
  versionSequence:number;
  versionNo:number;
  payrollRelationshipVersionId:string;
  establishmentVersionId:string;
  assignmentStart:string;
  assignmentEnd:string|null;
  approvalStatus:ApprovalStatus;
  supersedesVersionId:string|null;
  superseded:boolean;
}

export interface EmployeePayrollProfileView {
  id:string;
  payrollRelationshipId:string;
  employeeNumber:string;
  currency:'INR';
  payrollStatus:PayrollProfileStatus;
  versionNo:number;
}

export interface PayGroupAssignmentWrite {
  payrollAssignmentVersionId:string;
  payGroupVersionId:string;
  effectiveFrom:string;
  effectiveTo?:string;
}

export interface PayGroupAssignmentView {
  id:string;
  payrollAssignmentVersionId:string;
  payGroupVersionId:string;
  effectiveFrom:string;
  effectiveTo:string|null;
  approvalStatus:ApprovalStatus;
  supersedesAssignmentId:string|null;
  superseded:boolean;
  versionNo:number;
}

export interface SalaryAssignmentWrite {
  payrollAssignmentVersionId:string;
  salaryStructureVersionId:string;
  monthlyAmount:number;
  currency?:'INR';
  effectiveFrom:string;
  effectiveTo?:string;
}

export interface SalaryAssignmentView {
  id:string;
  payrollAssignmentVersionId:string;
  salaryStructureVersionId:string;
  monthlyAmount:number;
  currency:'INR';
  effectiveFrom:string;
  effectiveTo:string|null;
  approvalStatus:ApprovalStatus;
  supersedesAssignmentId:string|null;
  superseded:boolean;
  versionNo:number;
}

export interface EmployeePayrollApi {
  listRelationships(asOf:string):Promise<PayrollRelationshipView[]>;
  relationshipHistory(identityId:string):Promise<PayrollRelationshipView[]>;
  createRelationship(input:PayrollRelationshipWrite):Promise<PayrollRelationshipView>;
  addRelationshipVersion(identityId:string,input:PayrollRelationshipWrite):Promise<PayrollRelationshipView>;
  correctRelationship(identityId:string,versionId:string,input:PayrollRelationshipWrite):Promise<PayrollRelationshipView>;
  approveRelationship(identityId:string,versionId:string):Promise<PayrollRelationshipView>;
  endDateRelationship(identityId:string,versionId:string,versionNo:number,relationshipEnd:string):Promise<PayrollRelationshipView>;

  listAssignments(relationshipId:string,asOf:string):Promise<PayrollAssignmentView[]>;
  assignmentHistory(identityId:string):Promise<PayrollAssignmentView[]>;
  createAssignment(input:PayrollAssignmentWrite):Promise<PayrollAssignmentView>;
  addAssignmentVersion(identityId:string,input:PayrollAssignmentWrite):Promise<PayrollAssignmentView>;
  correctAssignment(identityId:string,versionId:string,input:PayrollAssignmentWrite):Promise<PayrollAssignmentView>;
  approveAssignment(identityId:string,versionId:string):Promise<PayrollAssignmentView>;
  endDateAssignment(identityId:string,versionId:string,versionNo:number,assignmentEnd:string):Promise<PayrollAssignmentView>;

  profileForRelationship(relationshipId:string):Promise<EmployeePayrollProfileView|null>;
  createProfile(relationshipId:string):Promise<EmployeePayrollProfileView>;
  updateProfileStatus(profileId:string,versionNo:number,status:PayrollProfileStatus):Promise<EmployeePayrollProfileView>;

  listPayGroupAssignments(assignmentVersionId:string):Promise<PayGroupAssignmentView[]>;
  createPayGroupAssignment(input:PayGroupAssignmentWrite):Promise<PayGroupAssignmentView>;
  correctPayGroupAssignment(assignmentId:string,input:PayGroupAssignmentWrite):Promise<PayGroupAssignmentView>;
  approvePayGroupAssignment(assignmentId:string):Promise<PayGroupAssignmentView>;
  endDatePayGroupAssignment(assignmentId:string,versionNo:number,effectiveTo:string):Promise<PayGroupAssignmentView>;

  listSalaryAssignments(assignmentVersionId:string):Promise<SalaryAssignmentView[]>;
  createSalaryAssignment(input:SalaryAssignmentWrite):Promise<SalaryAssignmentView>;
  correctSalaryAssignment(assignmentId:string,input:SalaryAssignmentWrite):Promise<SalaryAssignmentView>;
  approveSalaryAssignment(assignmentId:string):Promise<SalaryAssignmentView>;
  endDateSalaryAssignment(assignmentId:string,versionNo:number,effectiveTo:string):Promise<SalaryAssignmentView>;
}

type RequestOptions=RequestInit&{allowNotFound?:boolean};

async function request<T>(path:string,options:RequestOptions={}):Promise<T|null>{
  const {allowNotFound=false,...init}=options;
  const headers=new Headers(init.headers);
  headers.set('X-Correlation-ID',crypto.randomUUID());
  if(init.method&&init.method!=='GET')headers.set('Idempotency-Key',crypto.randomUUID());
  if(init.body)headers.set('Content-Type','application/json');
  const token=window.payrollSession?.accessToken;
  if(token)headers.set('Authorization',`Bearer ${token}`);
  const response=await fetch(`/api/v1${path}`,{...init,headers});
  if(allowNotFound&&response.status===404)return null;
  if(!response.ok){
    let detail=`Request failed (${response.status})`;
    try{detail=(await response.json() as {detail?:string}).detail??detail}catch{/* non-JSON */}
    throw new Error(detail);
  }
  return response.json() as Promise<T>;
}

function required<T>(value:Promise<T|null>):Promise<T>{
  return value.then(result=>{
    if(result===null)throw new Error('Expected API response body');
    return result;
  });
}

export const httpEmployeePayrollApi:EmployeePayrollApi={
  listRelationships:asOf=>required(request(`/payroll-relationships?asOf=${encodeURIComponent(asOf)}`)),
  relationshipHistory:id=>required(request(`/payroll-relationships/${id}/versions`)),
  createRelationship:input=>required(request('/payroll-relationships',{method:'POST',body:JSON.stringify(input)})),
  addRelationshipVersion:(id,input)=>required(request(`/payroll-relationships/${id}/versions`,{method:'POST',body:JSON.stringify(input)})),
  correctRelationship:(id,version,input)=>required(request(`/payroll-relationships/${id}/versions/${version}/corrections`,{method:'POST',body:JSON.stringify(input)})),
  approveRelationship:(id,version)=>required(request(`/payroll-relationships/${id}/versions/${version}/approval`,{method:'POST'})),
  endDateRelationship:(id,version,versionNo,relationshipEnd)=>required(request(`/payroll-relationships/${id}/versions/${version}/end-date`,{
    method:'POST',headers:{'If-Match':String(versionNo)},body:JSON.stringify({relationshipEnd})
  })),

  listAssignments:(relationshipId,asOf)=>required(request(`/payroll-assignments?payrollRelationshipId=${encodeURIComponent(relationshipId)}&asOf=${encodeURIComponent(asOf)}`)),
  assignmentHistory:id=>required(request(`/payroll-assignments/${id}/versions`)),
  createAssignment:input=>required(request('/payroll-assignments',{method:'POST',body:JSON.stringify(input)})),
  addAssignmentVersion:(id,input)=>required(request(`/payroll-assignments/${id}/versions`,{method:'POST',body:JSON.stringify(input)})),
  correctAssignment:(id,version,input)=>required(request(`/payroll-assignments/${id}/versions/${version}/corrections`,{method:'POST',body:JSON.stringify(input)})),
  approveAssignment:(id,version)=>required(request(`/payroll-assignments/${id}/versions/${version}/approval`,{method:'POST'})),
  endDateAssignment:(id,version,versionNo,assignmentEnd)=>required(request(`/payroll-assignments/${id}/versions/${version}/end-date`,{
    method:'POST',headers:{'If-Match':String(versionNo)},body:JSON.stringify({assignmentEnd})
  })),

  profileForRelationship:id=>request(`/payroll-relationships/${id}/profile`,{allowNotFound:true}),
  createProfile:id=>required(request('/employee-payroll-profiles',{method:'POST',body:JSON.stringify({payrollRelationshipId:id,currency:'INR'})})),
  updateProfileStatus:(id,versionNo,status)=>required(request(`/employee-payroll-profiles/${id}/status`,{
    method:'POST',headers:{'If-Match':String(versionNo)},body:JSON.stringify({payrollStatus:status})
  })),

  listPayGroupAssignments:id=>required(request(`/pay-group-assignments?payrollAssignmentVersionId=${encodeURIComponent(id)}`)),
  createPayGroupAssignment:input=>required(request('/pay-group-assignments',{method:'POST',body:JSON.stringify(input)})),
  correctPayGroupAssignment:(id,input)=>required(request(`/pay-group-assignments/${id}/corrections`,{method:'POST',body:JSON.stringify(input)})),
  approvePayGroupAssignment:id=>required(request(`/pay-group-assignments/${id}/approval`,{method:'POST'})),
  endDatePayGroupAssignment:(id,versionNo,effectiveTo)=>required(request(`/pay-group-assignments/${id}/end-date`,{
    method:'POST',headers:{'If-Match':String(versionNo)},body:JSON.stringify({effectiveTo})
  })),

  listSalaryAssignments:id=>required(request(`/salary-assignments?payrollAssignmentVersionId=${encodeURIComponent(id)}`)),
  createSalaryAssignment:input=>required(request('/salary-assignments',{method:'POST',body:JSON.stringify(input)})),
  correctSalaryAssignment:(id,input)=>required(request(`/salary-assignments/${id}/corrections`,{method:'POST',body:JSON.stringify(input)})),
  approveSalaryAssignment:id=>required(request(`/salary-assignments/${id}/approval`,{method:'POST'})),
  endDateSalaryAssignment:(id,versionNo,effectiveTo)=>required(request(`/salary-assignments/${id}/end-date`,{
    method:'POST',headers:{'If-Match':String(versionNo)},body:JSON.stringify({effectiveTo})
  }))
};
