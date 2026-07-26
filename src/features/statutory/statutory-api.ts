import type {
  PayrollCalculationRequestView,
  PayrollCycleView
} from '../payroll-execution/payroll-execution-api';

export interface StatutoryEvaluationExecution {
  cycleId:string;
  calculationRequestId:string;
  evaluationRequestId:string;
  payrollResultCount:number;
  statutoryResultCount:number;
  employeeTotal:number;
  employerTotal:number;
  postStatutoryNetTotal:number;
  evidenceSetHash:string;
  cycleVersionNo:number;
  completedAt:string;
  completedBy:string;
}

export interface StatutoryEvaluationRequestView {
  id:string;
  cycleId:string;
  calculationRequestId:string;
  status:string;
  engineVersion:string;
  expectedCycleVersion:number;
  calculationResultSetHash:string;
  startedAt:string;
  completedAt:string|null;
  completedBy:string|null;
  payrollResultCount:number|null;
  statutoryResultCount:number|null;
  employeeTotal:number|null;
  employerTotal:number|null;
  postStatutoryNetTotal:number|null;
  evidenceSetHash:string|null;
  versionNo:number;
}

export interface StatutoryResultView {
  id:string;
  evaluationRequestId:string;
  payrollResultId:string;
  statutoryInputSnapshotId:string;
  employeeStatutoryProfileId:string;
  employeeStatutoryRuleAssignmentId:string;
  statutoryRuleId:string;
  statutoryRuleVersionId:string;
  currency:string;
  employeeAmount:number;
  employerAmount:number;
  resultHash:string;
  createdAt:string;
}

export interface StatutoryLedgerPostingExecution {
  cycleId:string;
  evaluationRequestId:string;
  ledgerBatchId:string;
  attemptNo:number;
  batchKind:string;
  postedEntryCount:number;
  employeeDeltaTotal:number;
  employerDeltaTotal:number;
  cycleEmployeeTotal:number;
  cycleEmployerTotal:number;
  ledgerSetHash:string;
  cycleVersionNo:number;
  completedAt:string;
  completedBy:string;
}

export interface StatutoryCorrectionExecution {
  cycleId:string;
  statutoryResultId:string;
  ledgerBatchId:string;
  attemptNo:number;
  postedEntryCount:number;
  employeeDeltaTotal:number;
  employerDeltaTotal:number;
  cycleEmployeeTotal:number;
  cycleEmployerTotal:number;
  ledgerSetHash:string;
  cycleVersionNo:number;
  completedAt:string;
  completedBy:string;
}

export interface StatutoryLedgerBatchView {
  id:string;
  cycleId:string;
  payPeriodId:string;
  evaluationRequestId:string;
  calculationRequestId:string;
  batchKind:string;
  attemptNo:number;
  supersedesBatchId:string|null;
  status:string;
  postedAt:string;
  postedBy:string;
  completedAt:string|null;
  completedBy:string|null;
  entryCount:number|null;
  balanceSnapshotCount:number|null;
  remittanceSummaryCount:number|null;
  employeeDeltaTotal:number|null;
  employerDeltaTotal:number|null;
  cycleEmployeeTotal:number|null;
  cycleEmployerTotal:number|null;
  ledgerSetHash:string|null;
  reconciliationHash:string|null;
  versionNo:number;
}

export interface StatutoryLedgerEntryView {
  id:string;
  ledgerBatchId:string;
  cycleId:string;
  payPeriodId:string;
  evaluationRequestId:string;
  sourceEvaluationRequestId:string;
  statutoryResultId:string;
  employeeStatutoryProfileId:string;
  statutoryRuleId:string;
  statutoryRuleVersionId:string;
  balanceYearId:string;
  jurisdictionCode:string;
  authorityCode:string;
  sequenceNo:number;
  entryKind:string;
  sourceEntryId:string|null;
  currency:string;
  employeeAmountDelta:number;
  employerAmountDelta:number;
  reasonCode:string;
  reasonDetail:string|null;
  entryHash:string;
  createdAt:string;
}

export interface StatutoryBalanceSnapshotView {
  id:string;
  ledgerBatchId:string;
  cycleId:string;
  payPeriodId:string;
  employeeStatutoryProfileId:string;
  statutoryRuleId:string;
  statutoryRuleVersionId:string;
  balanceYearId:string;
  jurisdictionCode:string;
  authorityCode:string;
  currency:string;
  periodEmployeeAmount:number;
  periodEmployerAmount:number;
  cycleEmployeeAmount:number;
  cycleEmployerAmount:number;
  yearEmployeeAmount:number;
  yearEmployerAmount:number;
  snapshotHash:string;
  createdAt:string;
}

export interface StatutoryReconciliationView {
  id:string;
  ledgerBatchId:string;
  cycleId:string;
  evaluationRequestId:string;
  currency:string;
  sourceEmployeeTotal:number;
  sourceEmployerTotal:number;
  correctionEmployeeTotal:number;
  correctionEmployerTotal:number;
  expectedEmployeeTotal:number;
  expectedEmployerTotal:number;
  ledgerEmployeeTotal:number;
  ledgerEmployerTotal:number;
  employeeVariance:number;
  employerVariance:number;
  status:string;
  reconciliationHash:string;
  createdAt:string;
}

export interface StatutoryRemittanceSummaryView {
  id:string;
  ledgerBatchId:string;
  cycleId:string;
  payPeriodId:string;
  balanceYearId:string;
  jurisdictionCode:string;
  authorityCode:string;
  statutoryRuleId:string;
  statutoryRuleVersionId:string;
  currency:string;
  batchEmployeeDelta:number;
  batchEmployerDelta:number;
  periodEmployeeTotal:number;
  periodEmployerTotal:number;
  yearEmployeeTotal:number;
  yearEmployerTotal:number;
  remittanceAmount:number;
  remittancePosition:string;
  summaryHash:string;
  createdAt:string;
}

export interface StatutoryCorrectionInput {
  statutoryResultId:string;
  employeeAmountDelta:number;
  employerAmountDelta:number;
  reason:string;
}

export interface StatutoryApi {
  listCycles():Promise<PayrollCycleView[]>;
  getCycle(cycleId:string):Promise<PayrollCycleView>;
  calculationRequests(cycleId:string):Promise<PayrollCalculationRequestView[]>;
  evaluate(
    cycleId:string,
    versionNo:number,
    calculationRequestId:string
  ):Promise<StatutoryEvaluationExecution>;
  post(
    cycleId:string,
    versionNo:number,
    evaluationRequestId:string
  ):Promise<StatutoryLedgerPostingExecution>;
  correct(
    cycleId:string,
    versionNo:number,
    input:StatutoryCorrectionInput
  ):Promise<StatutoryCorrectionExecution>;
  evaluations(cycleId:string):Promise<StatutoryEvaluationRequestView[]>;
  results(cycleId:string):Promise<StatutoryResultView[]>;
  ledgerBatches(cycleId:string):Promise<StatutoryLedgerBatchView[]>;
  ledgerEntries(cycleId:string):Promise<StatutoryLedgerEntryView[]>;
  balances(cycleId:string):Promise<StatutoryBalanceSnapshotView[]>;
  reconciliations(cycleId:string):Promise<StatutoryReconciliationView[]>;
  remittances(cycleId:string):Promise<StatutoryRemittanceSummaryView[]>;
}

async function request<T>(path:string,init:RequestInit={}):Promise<T>{
  const headers=new Headers(init.headers);
  headers.set('X-Correlation-ID',crypto.randomUUID());
  if(init.method&&init.method!=='GET'){
    headers.set('Idempotency-Key',crypto.randomUUID());
  }
  if(init.body)headers.set('Content-Type','application/json');
  const token=window.payrollSession?.accessToken;
  if(token)headers.set('Authorization',`Bearer ${token}`);
  const response=await fetch(`/api/v1${path}`,{...init,headers});
  if(!response.ok){
    let detail=`Request failed (${response.status})`;
    try{
      detail=(await response.json() as {detail?:string}).detail??detail;
    }catch{/* non-JSON problem response */}
    throw new Error(detail);
  }
  return response.json() as Promise<T>;
}

export const httpStatutoryApi:StatutoryApi={
  listCycles:()=>request('/payroll-cycles'),
  getCycle:id=>request(`/payroll-cycles/${id}`),
  calculationRequests:id=>
    request(`/payroll-cycles/${id}/calculation-requests`),
  evaluate:(id,versionNo,calculationRequestId)=>
    request(`/payroll-cycles/${id}/statutory/evaluations`,{
      method:'POST',
      headers:{'If-Match':String(versionNo)},
      body:JSON.stringify({calculationRequestId})
    }),
  post:(id,versionNo,evaluationRequestId)=>
    request(`/payroll-cycles/${id}/statutory/postings`,{
      method:'POST',
      headers:{'If-Match':String(versionNo)},
      body:JSON.stringify({evaluationRequestId})
    }),
  correct:(id,versionNo,input)=>
    request(`/payroll-cycles/${id}/statutory/corrections`,{
      method:'POST',
      headers:{'If-Match':String(versionNo)},
      body:JSON.stringify(input)
    }),
  evaluations:id=>request(`/payroll-cycles/${id}/statutory/evaluations`),
  results:id=>request(`/payroll-cycles/${id}/statutory/results`),
  ledgerBatches:id=>
    request(`/payroll-cycles/${id}/statutory/ledger-batches`),
  ledgerEntries:id=>
    request(`/payroll-cycles/${id}/statutory/ledger-entries`),
  balances:id=>
    request(`/payroll-cycles/${id}/statutory/balance-snapshots`),
  reconciliations:id=>
    request(`/payroll-cycles/${id}/statutory/reconciliations`),
  remittances:id=>
    request(`/payroll-cycles/${id}/statutory/remittance-summaries`)
};
