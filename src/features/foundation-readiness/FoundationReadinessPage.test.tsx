import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {expect,test,vi} from 'vitest';
import {
  FoundationReadinessApi,
  FoundationReadinessView
} from './foundation-readiness-api';
import {FoundationReadinessPage} from './FoundationReadinessPage';

const permissions=new Set([
  'payroll-cycle.read',
  'organisation.banking-readiness.read',
  'statutory-registration.read'
]);

function readyView():FoundationReadinessView{
  return {
    readinessScope:'FOUNDATION_ONLY',
    payrollCycleId:'cycle-1',
    cycleStatus:'INPUTS_SEALED',
    payGroupVersionId:'pgv-1',
    payrollStatutoryUnitVersionId:'psuv-1',
    payrollStatutoryUnitId:'psu-1',
    legalEntityVersionId:'lev-1',
    legalEntityId:'le-1',
    periodStart:'2026-08-01',
    periodEnd:'2026-08-31',
    paymentDate:'2026-08-31',
    foundationConfigurationSnapshotId:'snapshot-1',
    foundationConfigurationSnapshotHash:'a'.repeat(64),
    foundationConfigurationCount:11,
    foundationConfigurationSealedAt:'2026-08-11T00:00:00Z',
    foundationReady:true,
    readinessStatus:'READY',
    dimensions:[
      {code:'CONFIGURATION_SNAPSHOT',ready:true,status:'READY',blockerCount:0,warningCount:0,coverage:'EXACT_CYCLE_SNAPSHOT_ONLY'},
      {code:'BANK_ACCOUNT',ready:true,status:'READY',blockerCount:0,warningCount:0,coverage:'BANKING_AND_SIGNATORY_ONLY'},
      {code:'SIGNATORY_AUTHORITY',ready:true,status:'READY',blockerCount:0,warningCount:0,coverage:'BANKING_AND_SIGNATORY_ONLY'},
      {code:'JURISDICTION_REGISTRATION',ready:true,status:'READY',blockerCount:0,warningCount:0,coverage:'CALLER_DECLARED_REQUIREMENTS_ONLY'}
    ],
    registrationChecks:[],
    findings:[],
    excludedCapabilities:['COUNTRY_SPECIFIC_STATUTORY_RULES_RATES','PAYMENT_EXECUTION_BANK_INTEGRATION']
  };
}

function api():FoundationReadinessApi{
  return {
    listCycles:vi.fn().mockResolvedValue([{
      id:'cycle-1',
      payGroupCode:'E2E_MONTHLY_IN',
      payGroupName:'Synthetic Monthly India',
      periodCode:'E2E-2026-08',
      periodStart:'2026-08-01',
      periodEnd:'2026-08-31',
      paymentDate:'2026-08-31',
      status:'INPUTS_SEALED'
    }]),
    listRegistrationTypes:vi.fn().mockResolvedValue([]),
    listJurisdictions:vi.fn().mockResolvedValue([]),
    evaluate:vi.fn().mockResolvedValue(readyView())
  };
}

test('evaluates a cycle-bound bounded readiness request without inventing registrations',async()=>{
  const service=api();
  render(<FoundationReadinessPage api={service} permissions={permissions}/>);
  await screen.findByRole('option',{name:/E2E-2026-08/});
  fireEvent.click(screen.getByRole('button',{name:'Evaluate foundation readiness'}));
  await waitFor(()=>expect(service.evaluate).toHaveBeenCalledWith(
    'cycle-1',
    {
      banking:{
        ownerKind:'LEGAL_ENTITY',
        currencyCode:'INR',
        purposeCode:'PAYROLL_FUNDING',
        amount:1000
      },
      registrations:[]
    }
  ));
  expect(await screen.findByRole('heading',{name:'Foundation ready'})).toBeVisible();
  expect(screen.getByText(/EXACT_CYCLE_SNAPSHOT_ONLY/)).toBeVisible();
  expect(screen.getByText(/CALLER_DECLARED_REQUIREMENTS_ONLY/)).toBeVisible();
  expect(screen.getByText('COUNTRY_SPECIFIC_STATUTORY_RULES_RATES')).toBeVisible();
});

test('fails closed in the UI when any composed-readiness authority is absent',()=>{
  render(<FoundationReadinessPage api={api()} permissions={new Set(['payroll-cycle.read'])}/>);
  expect(screen.getByRole('alert')).toHaveTextContent('organisation.banking-readiness.read');
  expect(screen.getByRole('alert')).toHaveTextContent('statutory-registration.read');
  expect(screen.queryByRole('button',{name:'Evaluate foundation readiness'})).not.toBeInTheDocument();
});
