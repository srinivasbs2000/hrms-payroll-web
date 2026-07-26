import {
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from '@testing-library/react';
import {expect,test,vi} from 'vitest';
import {StatutoryWorkspacePage} from './StatutoryWorkspacePage';
import type {
  StatutoryApi,
  StatutoryEvaluationRequestView,
  StatutoryLedgerBatchView,
  StatutoryReconciliationView,
  StatutoryResultView
} from './statutory-api';
import type {
  PayrollCalculationRequestView,
  PayrollCycleView
} from '../payroll-execution/payroll-execution-api';

const cycle:PayrollCycleView={
  id:'41000000-0000-0000-0000-000000000001',
  payGroupVersionId:'25000000-0000-0000-0000-000000000001',
  payGroupCode:'MONTHLY',
  payGroupName:'Monthly payroll',
  payPeriodId:'26000000-0000-0000-0000-000000000001',
  periodCode:'2026-07',
  periodStart:'2026-07-01',
  periodEnd:'2026-07-31',
  paymentDate:'2026-07-31',
  cycleType:'REGULAR',
  status:'CALCULATED',
  activePopulationResolutionId:'42000000-0000-0000-0000-000000000001',
  inputSealedAt:'2026-07-24T06:00:00Z',
  inputSealedBy:'payroll-admin',
  inputSnapshotCount:1,
  inputSnapshotSetHash:'a'.repeat(64),
  controlTotal:90000,
  versionNo:5
};

const calculation:PayrollCalculationRequestView={
  id:'44000000-0000-0000-0000-000000000001',
  cycleId:cycle.id,
  status:'COMPLETED',
  calculationKind:'INITIAL',
  attemptNo:1,
  supersededRequestId:null,
  recalculationReason:null,
  engineVersion:'STARTER_FIXED_V1',
  requestSchemaVersion:1,
  expectedCycleVersion:3,
  inputSnapshotSetHash:'a'.repeat(64),
  requestedAt:'2026-07-24T06:04:00Z',
  startedAt:'2026-07-24T06:04:01Z',
  completedAt:'2026-07-24T06:05:00Z',
  completedBy:'payroll-admin',
  completedCycleVersion:4,
  resultCount:1,
  grossTotal:90000,
  deductionTotal:0,
  netTotal:90000,
  resultSetHash:'b'.repeat(64),
  versionNo:1
};

const evaluation:StatutoryEvaluationRequestView={
  id:'51000000-0000-0000-0000-000000000001',
  cycleId:cycle.id,
  calculationRequestId:calculation.id,
  status:'COMPLETED',
  engineVersion:'STATUTORY_NEUTRAL_V1',
  expectedCycleVersion:4,
  calculationResultSetHash:'b'.repeat(64),
  startedAt:'2026-07-24T06:06:00Z',
  completedAt:'2026-07-24T06:06:01Z',
  completedBy:'payroll-admin',
  payrollResultCount:1,
  statutoryResultCount:1,
  employeeTotal:'1800',
  employerTotal:'1800',
  postStatutoryNetTotal:'88200',
  evidenceSetHash:'c'.repeat(64),
  versionNo:1
};

const statutoryResult:StatutoryResultView={
  id:'52000000-0000-0000-0000-000000000001',
  evaluationRequestId:evaluation.id,
  payrollResultId:'45000000-0000-0000-0000-000000000001',
  statutoryInputSnapshotId:'51100000-0000-0000-0000-000000000001',
  employeeStatutoryProfileId:'51200000-0000-0000-0000-000000000001',
  employeeStatutoryRuleAssignmentId:
    '51300000-0000-0000-0000-000000000001',
  statutoryRuleId:'51400000-0000-0000-0000-000000000001',
  statutoryRuleVersionId:'51500000-0000-0000-0000-000000000001',
  currency:'INR',
  employeeAmount:'1800',
  employerAmount:'1800',
  resultHash:'d'.repeat(64),
  createdAt:'2026-07-24T06:06:01Z'
};

const batch:StatutoryLedgerBatchView={
  id:'53000000-0000-0000-0000-000000000001',
  cycleId:cycle.id,
  payPeriodId:cycle.payPeriodId,
  evaluationRequestId:evaluation.id,
  calculationRequestId:calculation.id,
  batchKind:'INITIAL',
  attemptNo:1,
  supersedesBatchId:null,
  status:'COMPLETED',
  postedAt:'2026-07-24T06:07:00Z',
  postedBy:'payroll-admin',
  completedAt:'2026-07-24T06:07:01Z',
  completedBy:'payroll-admin',
  entryCount:1,
  balanceSnapshotCount:1,
  remittanceSummaryCount:1,
  employeeDeltaTotal:'1800',
  employerDeltaTotal:'1800',
  cycleEmployeeTotal:'1800',
  cycleEmployerTotal:'1800',
  ledgerSetHash:'e'.repeat(64),
  reconciliationHash:'f'.repeat(64),
  versionNo:1
};

const reconciliation:StatutoryReconciliationView={
  id:'54000000-0000-0000-0000-000000000001',
  ledgerBatchId:batch.id,
  cycleId:cycle.id,
  evaluationRequestId:evaluation.id,
  currency:'INR',
  sourceEmployeeTotal:'1800',
  sourceEmployerTotal:'1800',
  correctionEmployeeTotal:'0',
  correctionEmployerTotal:'0',
  expectedEmployeeTotal:'1800',
  expectedEmployerTotal:'1800',
  ledgerEmployeeTotal:'1800',
  ledgerEmployerTotal:'1800',
  employeeVariance:'0',
  employerVariance:'0',
  status:'MATCHED',
  reconciliationHash:'f'.repeat(64),
  createdAt:'2026-07-24T06:07:01Z'
};

function fakeApi(overrides:Partial<StatutoryApi>={}):StatutoryApi{
  return {
    listCycles:vi.fn().mockResolvedValue([cycle]),
    getCycle:vi.fn().mockResolvedValue(cycle),
    calculationRequests:vi.fn().mockResolvedValue([calculation]),
    evaluate:vi.fn().mockResolvedValue({
      cycleId:cycle.id,
      calculationRequestId:calculation.id,
      evaluationRequestId:evaluation.id,
      payrollResultCount:1,
      statutoryResultCount:1,
      employeeTotal:'1800',
      employerTotal:'1800',
      postStatutoryNetTotal:'88200',
      evidenceSetHash:'c'.repeat(64),
      cycleVersionNo:5,
      completedAt:evaluation.completedAt,
      completedBy:'payroll-admin'
    }),
    post:vi.fn().mockResolvedValue({
      cycleId:cycle.id,
      evaluationRequestId:evaluation.id,
      ledgerBatchId:batch.id,
      attemptNo:1,
      batchKind:'INITIAL',
      postedEntryCount:1,
      employeeDeltaTotal:'1800',
      employerDeltaTotal:'1800',
      cycleEmployeeTotal:'1800',
      cycleEmployerTotal:'1800',
      ledgerSetHash:'e'.repeat(64),
      cycleVersionNo:6,
      completedAt:batch.completedAt,
      completedBy:'payroll-admin'
    }),
    correct:vi.fn().mockResolvedValue({
      cycleId:cycle.id,
      statutoryResultId:statutoryResult.id,
      ledgerBatchId:'53000000-0000-0000-0000-000000000002',
      attemptNo:2,
      postedEntryCount:1,
      employeeDeltaTotal:'-10',
      employerDeltaTotal:'0',
      cycleEmployeeTotal:'1790',
      cycleEmployerTotal:'1800',
      ledgerSetHash:'1'.repeat(64),
      cycleVersionNo:7,
      completedAt:'2026-07-24T06:08:00Z',
      completedBy:'payroll-admin'
    }),
    evaluations:vi.fn().mockResolvedValue([evaluation]),
    results:vi.fn().mockResolvedValue([statutoryResult]),
    ledgerBatches:vi.fn().mockResolvedValue([batch]),
    ledgerEntries:vi.fn().mockResolvedValue([]),
    balances:vi.fn().mockResolvedValue([]),
    reconciliations:vi.fn().mockResolvedValue([reconciliation]),
    remittances:vi.fn().mockResolvedValue([]),
    ...overrides
  };
}

const readPermissions=new Set([
  'payroll-cycle.read',
  'payroll-result.read',
  'statutory-evaluation.read',
  'statutory-ledger.read',
  'statutory-balance.read',
  'statutory-reconciliation.read',
  'statutory-remittance.read'
]);

test('rejects the workspace without payroll-cycle read permission',()=>{
  const api=fakeApi();
  render(<StatutoryWorkspacePage api={api} permissions={new Set([
    'statutory-evaluation.read'
  ])}/>);
  expect(screen.getByRole('alert')).toHaveTextContent(
    'permission to read payroll cycles'
  );
  expect(api.listCycles).not.toHaveBeenCalled();
});

test('loads evaluation, ledger and reconciliation evidence',async()=>{
  const api=fakeApi();
  render(<StatutoryWorkspacePage
    api={api}
    permissions={readPermissions}
  />);

  fireEvent.click(await screen.findByRole('button',{name:/2026-07/}));

  const evaluations=await screen.findByRole(
    'heading',
    {name:'Statutory evaluations'}
  );
  const evaluationSection=evaluations.closest('section');
  expect(evaluationSection).not.toBeNull();
  expect(
    within(evaluationSection!).getByText('STATUTORY_NEUTRAL_V1')
  ).toBeInTheDocument();
  expect(screen.getAllByText('MATCHED').length).toBeGreaterThan(0);
  expect(api.ledgerBatches).toHaveBeenCalledWith(cycle.id);
  expect(api.reconciliations).toHaveBeenCalledWith(cycle.id);
});

test('evaluates the selected calculation using the cycle version',async()=>{
  const api=fakeApi({
    evaluations:vi.fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([evaluation])
  });
  render(<StatutoryWorkspacePage
    api={api}
    permissions={new Set([
      ...readPermissions,
      'statutory-evaluation.execute'
    ])}
  />);

  fireEvent.click(await screen.findByRole('button',{name:/2026-07/}));
  fireEvent.click(await screen.findByRole(
    'button',
    {name:'Evaluate statutory deductions'}
  ));

  await waitFor(()=>expect(api.evaluate).toHaveBeenCalledWith(
    cycle.id,
    cycle.versionNo,
    calculation.id
  ));
  expect(
    await screen.findByText('Statutory evaluation completed')
  ).toBeInTheDocument();
});

test('requires a non-zero signed delta and bounded correction reason',async()=>{
  const api=fakeApi();
  render(<StatutoryWorkspacePage
    api={api}
    permissions={new Set([
      ...readPermissions,
      'statutory-ledger.correct'
    ])}
  />);

  fireEvent.click(await screen.findByRole('button',{name:/2026-07/}));
  fireEvent.change(await screen.findByLabelText('Correction reason'),{
    target:{value:'Approved statutory adjustment'}
  });
  fireEvent.click(screen.getByRole('button',{name:'Post signed correction'}));

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'signed correction delta must be non-zero'
  );
  expect(api.correct).not.toHaveBeenCalled();
});

test('sends exact decimal strings without binary conversion',async()=>{
  const api=fakeApi();
  render(<StatutoryWorkspacePage
    api={api}
    permissions={new Set([
      ...readPermissions,
      'statutory-ledger.correct'
    ])}
  />);

  fireEvent.click(await screen.findByRole('button',{name:/2026-07/}));
  fireEvent.change(await screen.findByLabelText('Employee delta'),{
    target:{value:'-10.1250'}
  });
  fireEvent.change(await screen.findByLabelText('Employer delta'),{
    target:{value:'0.1000'}
  });
  fireEvent.change(await screen.findByLabelText('Correction reason'),{
    target:{value:'Approved exact decimal adjustment'}
  });
  fireEvent.click(screen.getByRole('button',{name:'Post signed correction'}));

  await waitFor(()=>expect(api.correct).toHaveBeenCalledWith(
    cycle.id,
    cycle.versionNo,
    {
      statutoryResultId:statutoryResult.id,
      employeeAmountDelta:'-10.1250',
      employerAmountDelta:'0.1000',
      reason:'Approved exact decimal adjustment'
    }
  ));
});
