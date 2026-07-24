import {fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {expect,test,vi} from 'vitest';
import {PayrollExecutionPage} from './PayrollExecutionPage';
import {
  PayrollCycleView,
  PayrollExecutionApi,
  PayrollResultSummaryView
} from './payroll-execution-api';

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
  status:'INPUTS_SEALED',
  activePopulationResolutionId:'42000000-0000-0000-0000-000000000001',
  inputSealedAt:'2026-07-24T06:00:00Z',
  inputSealedBy:'payroll-admin',
  inputSnapshotCount:1,
  inputSnapshotSetHash:'a'.repeat(64),
  controlTotal:90000,
  versionNo:3
};

const result:PayrollResultSummaryView={
  id:'45000000-0000-0000-0000-000000000001',
  calculationRequestId:'44000000-0000-0000-0000-000000000001',
  cycleId:cycle.id,
  payrollAssignmentVersionId:'32100000-0000-0000-0000-000000000001',
  assignmentNumber:'ASN-001',
  employeeNumber:'EMP-001',
  inputSnapshotId:'43000000-0000-0000-0000-000000000001',
  resultStatus:'CALCULATED',
  currency:'INR',
  grossAmount:90000,
  deductionAmount:5000,
  netAmount:85000,
  componentCount:4,
  resultHash:'b'.repeat(64),
  calculatedAt:'2026-07-24T06:05:00Z'
};

function fakeApi(overrides:Partial<PayrollExecutionApi>={}):PayrollExecutionApi{
  return {
    listCycles:vi.fn().mockResolvedValue([cycle]),
    getCycle:vi.fn().mockResolvedValue(cycle),
    createCycle:vi.fn().mockResolvedValue(cycle),
    resolvePopulation:vi.fn().mockResolvedValue({
      resolutionId:cycle.activePopulationResolutionId,
      cycleId:cycle.id,
      attemptNo:1,
      includedCount:1,
      excludedCount:0,
      cycleVersionNo:1
    }),
    population:vi.fn().mockResolvedValue([{
      id:'42100000-0000-0000-0000-000000000001',
      cycleId:cycle.id,
      populationResolutionId:cycle.activePopulationResolutionId,
      payrollAssignmentVersionId:result.payrollAssignmentVersionId,
      assignmentNumber:result.assignmentNumber,
      payrollRelationshipVersionId:'31100000-0000-0000-0000-000000000001',
      employeeNumber:result.employeeNumber,
      employeePayrollProfileId:'33000000-0000-0000-0000-000000000001',
      payGroupAssignmentId:'34000000-0000-0000-0000-000000000001',
      salaryAssignmentId:'35000000-0000-0000-0000-000000000001',
      inclusionReason:'Included with approved effective configuration',
      status:'INCLUDED'
    }]),
    sealInputs:vi.fn().mockResolvedValue({
      cycleId:cycle.id,
      snapshotCount:1,
      combinedHash:'a'.repeat(64),
      cycleVersionNo:3,
      sealedAt:'2026-07-24T06:00:00Z'
    }),
    snapshots:vi.fn().mockResolvedValue([{
      id:result.inputSnapshotId,
      cycleId:cycle.id,
      payrollAssignmentVersionId:result.payrollAssignmentVersionId,
      assignmentNumber:result.assignmentNumber,
      employeeNumber:result.employeeNumber,
      populationResolutionId:cycle.activePopulationResolutionId,
      salaryStructureVersionId:'27000000-0000-0000-0000-000000000001',
      payloadSchemaVersion:1,
      snapshotHash:'a'.repeat(64),
      sealedAt:'2026-07-24T06:00:00Z',
      sealedBy:'payroll-admin'
    }]),
    calculate:vi.fn().mockResolvedValue({
      cycleId:cycle.id,
      calculationRequestId:result.calculationRequestId,
      resultCount:1,
      grossTotal:90000,
      deductionTotal:5000,
      netTotal:85000,
      resultSetHash:'c'.repeat(64),
      cycleVersionNo:4,
      completedAt:result.calculatedAt,
      completedBy:'payroll-admin'
    }),
    recalculate:vi.fn().mockResolvedValue({
      cycleId:cycle.id,
      calculationRequestId:'44000000-0000-0000-0000-000000000002',
      supersededRequestId:result.calculationRequestId,
      attemptNo:2,
      resultCount:1,
      grossTotal:90000,
      deductionTotal:5000,
      netTotal:85000,
      resultSetHash:'d'.repeat(64),
      cycleVersionNo:5,
      completedAt:result.calculatedAt,
      completedBy:'payroll-admin'
    }),
    calculationRequests:vi.fn().mockResolvedValue([]),
    results:vi.fn().mockResolvedValue([result]),
    result:vi.fn(),
    trace:vi.fn(),
    ...overrides
  };
}

const readPermissions=new Set([
  'payroll-cycle.read',
  'payroll-cycle.inputs.read',
  'payroll-result.read'
]);

test('rejects the workspace without cycle read permission',()=>{
  const api=fakeApi();
  render(<MemoryRouter><PayrollExecutionPage api={api} permissions={new Set()}/></MemoryRouter>);
  expect(screen.getByRole('alert')).toHaveTextContent('do not have permission');
  expect(api.listCycles).not.toHaveBeenCalled();
});

test('loads a selected cycle with population, snapshots and results',async()=>{
  const api=fakeApi();
  render(<MemoryRouter><PayrollExecutionPage api={api} permissions={readPermissions}/></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button',{name:/2026-07/}));
  const populationHeading=await screen.findByRole('heading',{name:'Active population'});
  const populationSection=populationHeading.closest('section');
  expect(populationSection).not.toBeNull();
  expect(within(populationSection!).getByText('EMP-001')).toBeInTheDocument();
  expect(screen.getByRole('link',{name:'View'})).toHaveAttribute(
    'href',`/draft-payslip?cycleId=${cycle.id}&resultId=${result.id}`);
  expect(api.population).toHaveBeenCalledWith(cycle.id);
  expect(api.snapshots).toHaveBeenCalledWith(cycle.id);
  expect(api.results).toHaveBeenCalledWith(cycle.id);
});

test('executes calculation with the selected cycle version',async()=>{
  const calculated={...cycle,status:'CALCULATED',versionNo:4};
  const api=fakeApi({
    getCycle:vi.fn()
      .mockResolvedValueOnce(cycle)
      .mockResolvedValueOnce(calculated)
  });
  render(<MemoryRouter><PayrollExecutionPage api={api} permissions={new Set([
    ...readPermissions,
    'payroll-calculation.execute'
  ])}/></MemoryRouter>);

  fireEvent.click(await screen.findByRole('button',{name:/2026-07/}));
  fireEvent.click(await screen.findByRole('button',{name:'Calculate payroll'}));

  await waitFor(()=>expect(api.calculate).toHaveBeenCalledWith(cycle.id,3));
  expect(await screen.findByText('Payroll calculation completed')).toBeInTheDocument();
});

test('requires a bounded reason before controlled recalculation',async()=>{
  const calculated={...cycle,status:'CALCULATED',versionNo:4};
  const api=fakeApi({getCycle:vi.fn().mockResolvedValue(calculated)});
  render(<MemoryRouter><PayrollExecutionPage api={api} permissions={new Set([
    ...readPermissions,
    'payroll-calculation.recalculate'
  ])}/></MemoryRouter>);

  fireEvent.click(await screen.findByRole('button',{name:/2026-07/}));
  fireEvent.change(await screen.findByLabelText('Controlled recalculation reason'),{
    target:{value:'fix'}
  });
  fireEvent.submit(screen.getByRole('button',{name:'Recalculate payroll'}).closest('form')!);

  expect(await screen.findByRole('alert')).toHaveTextContent('between 8 and 500');
  expect(api.recalculate).not.toHaveBeenCalled();
});
