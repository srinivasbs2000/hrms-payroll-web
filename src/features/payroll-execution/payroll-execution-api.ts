export interface PayrollCycleView {
  id:string;
  payGroupVersionId:string;
  payGroupCode:string;
  payGroupName:string;
  payPeriodId:string;
  periodCode:string;
  periodStart:string;
  periodEnd:string;
  paymentDate:string;
  cycleType:string;
  status:string;
  activePopulationResolutionId:string|null;
  inputSealedAt:string|null;
  inputSealedBy:string|null;
  inputSnapshotCount:number|null;
  inputSnapshotSetHash:string|null;
  controlTotal:number|null;
  versionNo:number;
}

export interface PopulationResolutionResult {
  resolutionId:string;
  cycleId:string;
  attemptNo:number;
  includedCount:number;
  excludedCount:number;
  cycleVersionNo:number;
}

export interface PopulationMemberView {
  id:string;
  cycleId:string;
  populationResolutionId:string;
  payrollAssignmentVersionId:string;
  assignmentNumber:string;
  payrollRelationshipVersionId:string;
  employeeNumber:string;
  employeePayrollProfileId:string;
  payGroupAssignmentId:string;
  salaryAssignmentId:string;
  inclusionReason:string;
  status:string;
}

export interface PayrollInputSnapshotView {
  id:string;
  cycleId:string;
  payrollAssignmentVersionId:string;
  assignmentNumber:string;
  employeeNumber:string;
  populationResolutionId:string;
  salaryStructureVersionId:string;
  payloadSchemaVersion:number;
  snapshotHash:string;
  sealedAt:string;
  sealedBy:string;
}

export interface PayrollInputSealResult {
  cycleId:string;
  snapshotCount:number;
  combinedHash:string;
  cycleVersionNo:number;
  sealedAt:string;
}

export interface PayrollCalculationResult {
  cycleId:string;
  calculationRequestId:string;
  resultCount:number;
  grossTotal:number;
  deductionTotal:number;
  netTotal:number;
  resultSetHash:string;
  cycleVersionNo:number;
  completedAt:string;
  completedBy:string;
}

export interface PayrollRecalculationResult extends PayrollCalculationResult {
  supersededRequestId:string;
  attemptNo:number;
}

export interface PayrollCalculationRequestView {
  id:string;
  cycleId:string;
  status:string;
  calculationKind:string;
  attemptNo:number;
  supersededRequestId:string|null;
  recalculationReason:string|null;
  engineVersion:string;
  requestSchemaVersion:number;
  expectedCycleVersion:number;
  inputSnapshotSetHash:string;
  requestedAt:string;
  startedAt:string;
  completedAt:string|null;
  completedBy:string|null;
  completedCycleVersion:number|null;
  resultCount:number|null;
  grossTotal:number|null;
  deductionTotal:number|null;
  netTotal:number|null;
  resultSetHash:string|null;
  versionNo:number;
}

export interface PayrollResultSummaryView {
  id:string;
  calculationRequestId:string;
  cycleId:string;
  payrollAssignmentVersionId:string;
  assignmentNumber:string;
  employeeNumber:string;
  inputSnapshotId:string;
  resultStatus:string;
  currency:string;
  grossAmount:number;
  deductionAmount:number;
  netAmount:number;
  componentCount:number|null;
  resultHash:string;
  calculatedAt:string;
}

export interface PayrollComponentResultView {
  id:string;
  componentCode:string;
  sequenceNo:number;
  componentType:string;
  formulaType:string;
  roundingScale:number|null;
  unproratedAmount:number;
  prorationFactor:number;
  calculatedAmount:number;
  currency:string;
  componentVersionId:string;
  salaryStructureLineId:string;
  salaryStructureVersionId:string;
  componentPayload:unknown;
  componentHash:string;
}

export interface PayrollResultDetailView extends PayrollResultSummaryView {
  resultSchemaVersion:number;
  inputSnapshotHash:string;
  salaryStructureVersionId:string;
  resultPayload:unknown;
  components:PayrollComponentResultView[];
}

export interface PayrollCalculationTraceView {
  id:string;
  payrollResultId:string;
  componentResultId:string;
  componentCode:string;
  stepNo:number;
  stepType:string;
  inputs:unknown;
  outputValue:number;
  message:string;
  traceSchemaVersion:number;
  inputSnapshotId:string;
  componentVersionId:string;
  tracePayload:unknown;
  traceHash:string;
  createdAt:string;
}

export interface PayrollExecutionApi {
  listCycles():Promise<PayrollCycleView[]>;
  getCycle(cycleId:string):Promise<PayrollCycleView>;
  createCycle(payGroupVersionId:string,payPeriodId:string):Promise<PayrollCycleView>;
  resolvePopulation(cycleId:string,versionNo:number):Promise<PopulationResolutionResult>;
  population(cycleId:string):Promise<PopulationMemberView[]>;
  sealInputs(cycleId:string,versionNo:number):Promise<PayrollInputSealResult>;
  snapshots(cycleId:string):Promise<PayrollInputSnapshotView[]>;
  calculate(cycleId:string,versionNo:number):Promise<PayrollCalculationResult>;
  recalculate(cycleId:string,versionNo:number,reason:string):Promise<PayrollRecalculationResult>;
  calculationRequests(cycleId:string):Promise<PayrollCalculationRequestView[]>;
  results(cycleId:string):Promise<PayrollResultSummaryView[]>;
  result(cycleId:string,resultId:string):Promise<PayrollResultDetailView>;
  trace(cycleId:string,resultId:string):Promise<PayrollCalculationTraceView[]>;
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

export const httpPayrollExecutionApi:PayrollExecutionApi={
  listCycles:()=>request('/payroll-cycles'),
  getCycle:id=>request(`/payroll-cycles/${id}`),
  createCycle:(payGroupVersionId,payPeriodId)=>request('/payroll-cycles',{
    method:'POST',
    body:JSON.stringify({payGroupVersionId,payPeriodId})
  }),
  resolvePopulation:(id,versionNo)=>request(`/payroll-cycles/${id}/population-resolution`,{
    method:'POST',
    headers:{'If-Match':String(versionNo)}
  }),
  population:id=>request(`/payroll-cycles/${id}/population`),
  sealInputs:(id,versionNo)=>request(`/payroll-cycles/${id}/seal-inputs`,{
    method:'POST',
    headers:{'If-Match':String(versionNo)}
  }),
  snapshots:id=>request(`/payroll-cycles/${id}/input-snapshots`),
  calculate:(id,versionNo)=>request(`/payroll-cycles/${id}/calculation`,{
    method:'POST',
    headers:{'If-Match':String(versionNo)}
  }),
  recalculate:(id,versionNo,reason)=>request(`/payroll-cycles/${id}/recalculation`,{
    method:'POST',
    headers:{'If-Match':String(versionNo)},
    body:JSON.stringify({reason})
  }),
  calculationRequests:id=>request(`/payroll-cycles/${id}/calculation-requests`),
  results:id=>request(`/payroll-cycles/${id}/results`),
  result:(cycleId,resultId)=>request(`/payroll-cycles/${cycleId}/results/${resultId}`),
  trace:(cycleId,resultId)=>request(`/payroll-cycles/${cycleId}/results/${resultId}/trace`)
};
