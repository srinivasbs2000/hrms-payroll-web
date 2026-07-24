import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {expect,test,vi} from 'vitest';
import {PayrollExecutionPage} from './PayrollExecutionPage';
import {PayrollCycleView,PayrollExecutionApi} from './payroll-execution-api';

const draftCycle:PayrollCycleView={
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
  status:'DRAFT',
  activePopulationResolutionId:null,
  inputSealedAt:null,
  inputSealedBy:null,
  inputSnapshotCount:null,
  inputSnapshotSetHash:null,
  controlTotal:null,
  versionNo:0
};

function fakeApi(
  selected:PayrollCycleView=draftCycle,
  overrides:Partial<PayrollExecutionApi>={}
):PayrollExecutionApi{
  return {
    listCycles:vi.fn().mockResolvedValue([selected]),
    getCycle:vi.fn().mockResolvedValue(selected),
    createCycle:vi.fn().mockResolvedValue(selected),
    resolvePopulation:vi.fn(),
    population:vi.fn().mockResolvedValue([]),
    sealInputs:vi.fn(),
    snapshots:vi.fn().mockResolvedValue([]),
    calculate:vi.fn(),
    recalculate:vi.fn(),
    calculationRequests:vi.fn().mockResolvedValue([]),
    results:vi.fn().mockResolvedValue([]),
    result:vi.fn(),
    trace:vi.fn(),
    ...overrides
  };
}

const readPermissions=[
  'payroll-cycle.read',
  'payroll-cycle.inputs.read',
  'payroll-result.read'
];

test('surfaces cycle-list loading failures',async()=>{
  const api=fakeApi(draftCycle,{
    listCycles:vi.fn().mockRejectedValue(new Error('Cycle service unavailable'))
  });
  render(<MemoryRouter><PayrollExecutionPage
    api={api}
    permissions={new Set(readPermissions)}/></MemoryRouter>);

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Cycle service unavailable');
});

test('enforces lifecycle action gating in the UI',async()=>{
  const api=fakeApi();
  render(<MemoryRouter><PayrollExecutionPage
    api={api}
    permissions={new Set([
      ...readPermissions,
      'payroll-cycle.population.resolve',
      'payroll-cycle.inputs.seal',
      'payroll-calculation.execute',
      'payroll-calculation.recalculate'
    ])}/></MemoryRouter>);

  fireEvent.click(await screen.findByRole('button',{name:/2026-07/}));

  expect(await screen.findByRole('button',{name:'Resolve population'}))
    .toBeEnabled();
  expect(screen.getByRole('button',{name:'Seal immutable inputs'}))
    .toBeDisabled();
  expect(screen.getByRole('button',{name:'Calculate payroll'}))
    .toBeDisabled();
  expect(screen.queryByRole('button',{name:'Recalculate payroll'}))
    .not.toBeInTheDocument();
});

test('surfaces a stale calculation conflict without a success message',async()=>{
  const sealed={...draftCycle,status:'INPUTS_SEALED',versionNo:2};
  const api=fakeApi(sealed,{
    calculate:vi.fn().mockRejectedValue(
      new Error('Payroll cycle version is stale'))
  });
  render(<MemoryRouter><PayrollExecutionPage
    api={api}
    permissions={new Set([
      ...readPermissions,
      'payroll-calculation.execute'
    ])}/></MemoryRouter>);

  fireEvent.click(await screen.findByRole('button',{name:/2026-07/}));
  fireEvent.click(await screen.findByRole('button',{name:'Calculate payroll'}));

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Payroll cycle version is stale');
  expect(screen.queryByText('Payroll calculation completed'))
    .not.toBeInTheDocument();
});

test('trims the recalculation reason and sends the current cycle version',async()=>{
  const calculated={...draftCycle,status:'CALCULATED',versionNo:4};
  const recalculate=vi.fn().mockResolvedValue({
    cycleId:calculated.id,
    calculationRequestId:'44000000-0000-0000-0000-000000000002',
    supersededRequestId:'44000000-0000-0000-0000-000000000001',
    attemptNo:2,
    resultCount:1,
    grossTotal:90000,
    deductionTotal:0,
    netTotal:90000,
    resultSetHash:'a'.repeat(64),
    cycleVersionNo:5,
    completedAt:'2026-07-24T06:10:00Z',
    completedBy:'payroll-admin'
  });
  const api=fakeApi(calculated,{recalculate});
  render(<MemoryRouter><PayrollExecutionPage
    api={api}
    permissions={new Set([
      ...readPermissions,
      'payroll-calculation.recalculate'
    ])}/></MemoryRouter>);

  fireEvent.click(await screen.findByRole('button',{name:/2026-07/}));
  fireEvent.change(
    await screen.findByLabelText('Controlled recalculation reason'),
    {target:{value:'  Approved payroll review rerun  '}});
  fireEvent.click(screen.getByRole('button',{name:'Recalculate payroll'}));

  await waitFor(()=>expect(recalculate).toHaveBeenCalledWith(
    calculated.id,4,'Approved payroll review rerun'));
});
