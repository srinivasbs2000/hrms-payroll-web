import {render,screen,within} from '@testing-library/react';
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
  deductionAmount:5000,
  netAmount:85000,
  componentCount:2,
  resultHash:'a'.repeat(64),
  calculatedAt:'2026-07-24T06:05:00Z',
  resultSchemaVersion:1,
  inputSnapshotHash:'b'.repeat(64),
  salaryStructureVersionId:'27000000-0000-0000-0000-000000000001',
  resultPayload:{},
  components:[{
    id:'45100000-0000-0000-0000-000000000001',
    componentCode:'BASIC',
    sequenceNo:1,
    componentType:'EARNING',
    formulaType:'FIXED',
    roundingScale:2,
    unproratedAmount:90000,
    prorationFactor:1,
    calculatedAmount:90000,
    currency:'INR',
    componentVersionId:'19100000-0000-0000-0000-000000000001',
    salaryStructureLineId:'27100000-0000-0000-0000-000000000001',
    salaryStructureVersionId:'27000000-0000-0000-0000-000000000001',
    componentPayload:{},
    componentHash:'c'.repeat(64)
  },{
    id:'45100000-0000-0000-0000-000000000002',
    componentCode:'RECOVERY',
    sequenceNo:2,
    componentType:'DEDUCTION',
    formulaType:'FIXED',
    roundingScale:2,
    unproratedAmount:5000,
    prorationFactor:1,
    calculatedAmount:5000,
    currency:'INR',
    componentVersionId:'19100000-0000-0000-0000-000000000002',
    salaryStructureLineId:'27100000-0000-0000-0000-000000000002',
    salaryStructureVersionId:'27000000-0000-0000-0000-000000000001',
    componentPayload:{},
    componentHash:'d'.repeat(64)
  }]
};

function fakeApi():PayrollExecutionApi{
  return {
    listCycles:vi.fn(),getCycle:vi.fn(),createCycle:vi.fn(),resolvePopulation:vi.fn(),
    population:vi.fn(),sealInputs:vi.fn(),snapshots:vi.fn(),calculate:vi.fn(),
    recalculate:vi.fn(),calculationRequests:vi.fn(),results:vi.fn(),
    result:vi.fn().mockResolvedValue(detail),
    trace:vi.fn().mockResolvedValue([{
      id:'46000000-0000-0000-0000-000000000001',
      payrollResultId:detail.id,
      componentResultId:detail.components[0].id,
      componentCode:'BASIC',
      stepNo:1,
      stepType:'FIXED',
      inputs:{amount:90000},
      outputValue:90000,
      message:'Applied fixed amount',
      traceSchemaVersion:1,
      inputSnapshotId:detail.inputSnapshotId,
      componentVersionId:detail.components[0].componentVersionId,
      tracePayload:{},
      traceHash:'e'.repeat(64),
      createdAt:detail.calculatedAt
    }])
  };
}

test('renders a real persisted draft payslip and trace',async()=>{
  const api=fakeApi();
  render(<MemoryRouter><DraftPayslipPage
    api={api}
    permissions={new Set(['payroll-result.read','payroll-result.trace.read'])}
    cycleId={detail.cycleId}
    resultId={detail.id}/></MemoryRouter>);

  expect(await screen.findByText('EMP-001')).toBeInTheDocument();
  const earnings=screen.getByRole('heading',{name:'Earnings'}).closest('section');
  expect(earnings).not.toBeNull();
  expect(within(earnings!).getByText('BASIC')).toBeInTheDocument();
  const deductions=screen.getByRole('heading',{name:'Deductions'}).closest('section');
  expect(deductions).not.toBeNull();
  expect(within(deductions!).getByText('RECOVERY')).toBeInTheDocument();
  expect(screen.getByText(/85,000\.00/)).toBeInTheDocument();
  expect(screen.getByText(/NOT A LEGAL PAYSLIP/)).toBeInTheDocument();
  expect(screen.getByText('Applied fixed amount')).toBeInTheDocument();
  expect(api.result).toHaveBeenCalledWith(detail.cycleId,detail.id);
  expect(api.trace).toHaveBeenCalledWith(detail.cycleId,detail.id);
});

test('requires result read permission',()=>{
  const api=fakeApi();
  render(<MemoryRouter><DraftPayslipPage
    api={api}
    permissions={new Set()}
    cycleId={detail.cycleId}
    resultId={detail.id}/></MemoryRouter>);
  expect(screen.getByRole('alert')).toHaveTextContent('do not have permission');
  expect(api.result).not.toHaveBeenCalled();
});
