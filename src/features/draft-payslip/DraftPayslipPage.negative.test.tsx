import {render,screen} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {expect,test,vi} from 'vitest';
import {DraftPayslipPage} from './DraftPayslipPage';
import {PayrollExecutionApi,PayrollResultDetailView} from '../payroll-execution/payroll-execution-api';

const detail:PayrollResultDetailView={
  id:'45000000-0000-0000-0000-000000000001',
  calculationRequestId:'44000000-0000-0000-0000-000000000001',
  cycleId:'41000000-0000-0000-0000-000000000001',
  payrollAssignmentVersionId:'32100000-0000-0000-0000-000000000001',
  assignmentNumber:'ASN-001',
  employeeNumber:'EMP-001',
  inputSnapshotId:'43000000-0000-0000-0000-000000000001',
  resultStatus:'CALCULATED',
  currency:'INR',
  grossAmount:90000,
  deductionAmount:0,
  netAmount:90000,
  componentCount:1,
  resultHash:'a'.repeat(64),
  calculatedAt:'2026-07-24T06:05:00Z',
  resultSchemaVersion:1,
  inputSnapshotHash:'b'.repeat(64),
  salaryStructureVersionId:'27000000-0000-0000-0000-000000000001',
  resultPayload:{},
  components:[]
};

function fakeApi(overrides:Partial<PayrollExecutionApi>={}):PayrollExecutionApi{
  return {
    listCycles:vi.fn(),getCycle:vi.fn(),createCycle:vi.fn(),
    resolvePopulation:vi.fn(),population:vi.fn(),sealInputs:vi.fn(),
    snapshots:vi.fn(),calculate:vi.fn(),recalculate:vi.fn(),
    calculationRequests:vi.fn(),results:vi.fn(),
    result:vi.fn().mockResolvedValue(detail),
    trace:vi.fn().mockResolvedValue([]),
    ...overrides
  };
}

test('requires a persisted result selection',()=>{
  const api=fakeApi();
  render(<MemoryRouter><DraftPayslipPage
    api={api}
    permissions={new Set(['payroll-result.read'])}/></MemoryRouter>);

  expect(screen.getByText(/Select a persisted payroll result/))
    .toBeInTheDocument();
  expect(api.result).not.toHaveBeenCalled();
});

test('surfaces result-loading failures',async()=>{
  const api=fakeApi({
    result:vi.fn().mockRejectedValue(new Error('Payroll result not found'))
  });
  render(<MemoryRouter><DraftPayslipPage
    api={api}
    permissions={new Set(['payroll-result.read'])}
    cycleId={detail.cycleId}
    resultId={detail.id}/></MemoryRouter>);

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Payroll result not found');
});

test('does not request trace evidence without trace permission',async()=>{
  const api=fakeApi();
  render(<MemoryRouter><DraftPayslipPage
    api={api}
    permissions={new Set(['payroll-result.read'])}
    cycleId={detail.cycleId}
    resultId={detail.id}/></MemoryRouter>);

  expect(await screen.findByText('EMP-001')).toBeInTheDocument();
  expect(screen.getByText(/Calculation trace requires/)).toBeInTheDocument();
  expect(api.trace).not.toHaveBeenCalled();
});
