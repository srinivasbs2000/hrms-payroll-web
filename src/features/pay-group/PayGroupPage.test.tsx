import {fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {expect,test,vi} from 'vitest';
import {PayGroupPage} from './PayGroupPage';
import {PayGroupApi,PayGroupRoutingReadiness,PayGroupRoutingRule,PayGroupVersion} from './pay-group-api';

const group:PayGroupVersion={
  identityId:'10000000-0000-0000-0000-000000000001',
  code:'MONTHLY_IN',
  identityStatus:'ACTIVE',
  versionId:'11000000-0000-0000-0000-000000000001',
  versionSequence:1,
  versionNo:1,
  name:'Monthly India',
  payrollStatutoryUnitVersionId:'12000000-0000-0000-0000-000000000001',
  calendarId:'13000000-0000-0000-0000-000000000001',
  currency:'INR',
  prorationMethod:'CALENDAR_DAYS',
  effectiveFrom:'2026-01-01',
  effectiveTo:null,
  approvalStatus:'APPROVED',
  supersedesVersionId:null,
  superseded:false
};
const routingRule:PayGroupRoutingRule={
  id:'14000000-0000-0000-0000-000000000001',payGroupVersionId:group.versionId,
  payrollStatutoryUnitVersionId:group.payrollStatutoryUnitVersionId,
  establishmentVersionId:null,priority:100,effectiveFrom:'2026-01-01',effectiveTo:null,
  status:'ACTIVE',versionNo:0
};
const readiness:PayGroupRoutingReadiness={
  payrollAssignmentVersionId:'15000000-0000-0000-0000-000000000001',
  requestedPayGroupVersionId:group.versionId,effectiveFrom:'2026-01-01',effectiveTo:'2027-01-01',
  payrollStatutoryUnitVersionId:group.payrollStatutoryUnitVersionId,calendarId:group.calendarId,
  calendarFrequency:'MONTHLY',calendarTimezone:'Asia/Kolkata',
  resolutionAtEffectiveFrom:{payGroupVersionId:group.versionId,resolutionSource:'PSU_RULE',
    routingRuleId:routingRule.id},compatible:true,routingCoverageComplete:true,
  routingMatchesRequestedPayGroup:true,ready:true,resolutionCheckpoints:[{asOf:'2026-01-01',
    payGroupVersionId:group.versionId,resolutionSource:'PSU_RULE',routingRuleId:routingRule.id,
    matchesRequestedPayGroup:true}],issues:[]
};

function fakeApi(overrides:Partial<PayGroupApi>={}):PayGroupApi{
  return {
    list:vi.fn().mockResolvedValue([]),
    history:vi.fn().mockResolvedValue([group]),
    create:vi.fn().mockResolvedValue(group),
    addVersion:vi.fn().mockResolvedValue({...group,versionSequence:2,approvalStatus:'DRAFT'}),
    correct:vi.fn().mockResolvedValue({...group,versionSequence:2,approvalStatus:'DRAFT'}),
    endDate:vi.fn().mockResolvedValue({...group,effectiveTo:'2027-01-01',versionNo:2}),
    approve:vi.fn().mockResolvedValue({...group,approvalStatus:'APPROVED'}),
    routingRules:vi.fn().mockResolvedValue([]),
    createRoutingRule:vi.fn().mockResolvedValue(routingRule),
    endDateRoutingRule:vi.fn().mockResolvedValue({...routingRule,effectiveTo:'2027-01-01',versionNo:1}),
    routingReadiness:vi.fn().mockResolvedValue(readiness),
    ...overrides
  };
}

test('rejects the screen when pay-group.read is absent',()=>{
  const api=fakeApi();
  render(<PayGroupPage api={api} permissions={new Set()}/>);
  expect(screen.getByRole('alert')).toHaveTextContent('do not have permission');
  expect(api.list).not.toHaveBeenCalled();
});

test('renders effective groups and immutable history',async()=>{
  const api=fakeApi({list:vi.fn().mockResolvedValue([group])});
  render(<PayGroupPage api={api} permissions={new Set(['pay-group.read'])}/>);
  fireEvent.click(await screen.findByRole('button',{name:/MONTHLY_IN/}));
  expect(await screen.findByText('Version 1: Monthly India')).toBeInTheDocument();
  expect(screen.getByText('2026-01-01 to open')).toBeInTheDocument();
});

test('keeps a newly-created draft selected so it can be approved',async()=>{
  const draft={...group,approvalStatus:'DRAFT' as const};
  const approved={...group,approvalStatus:'APPROVED' as const};
  const history=vi.fn()
    .mockResolvedValueOnce([draft])
    .mockResolvedValueOnce([approved]);
  const api=fakeApi({
    create:vi.fn().mockResolvedValue(draft),
    history,
    approve:vi.fn().mockResolvedValue(approved)
  });
  render(<PayGroupPage api={api} permissions={new Set([
    'pay-group.read','pay-group.create','pay-group.approve'
  ])}/>);
  await screen.findByText('No approved pay groups');

  fireEvent.change(screen.getByLabelText('Code'),{target:{value:'monthly_in'}});
  fireEvent.change(screen.getByLabelText('Name'),{target:{value:'Monthly India'}});
  fireEvent.change(
    screen.getByLabelText('Payroll statutory unit version ID'),
    {target:{value:group.payrollStatutoryUnitVersionId}});
  fireEvent.change(screen.getByLabelText('Calendar ID'),{target:{value:group.calendarId}});
  fireEvent.click(screen.getByRole('button',{name:'Create pay-group draft'}));

  await waitFor(()=>expect(api.create).toHaveBeenCalledWith(expect.objectContaining({
    code:'MONTHLY_IN',
    currency:'INR',
    prorationMethod:'CALENDAR_DAYS'
  })));
  expect(await screen.findByRole('heading',{name:'MONTHLY_IN version timeline'})).toBeInTheDocument();
  expect(screen.getByText('Version 1: Monthly India')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Approve'}));
  await waitFor(()=>expect(api.approve).toHaveBeenCalledWith(group.identityId,group.versionId));
});

test('exposes version and optimistic end-date workflows',async()=>{
  const api=fakeApi({list:vi.fn().mockResolvedValue([group])});
  render(<PayGroupPage api={api} permissions={new Set([
    'pay-group.read',
    'pay-group.version.create',
    'pay-group.version.end-date'
  ])}/>);

  fireEvent.click(await screen.findByRole('button',{name:/MONTHLY_IN/}));
  await screen.findByText('Version 1: Monthly India');

  fireEvent.change(screen.getByLabelText('Version name'),{target:{value:'Monthly India 2027'}});
  fireEvent.change(screen.getByLabelText('Version effective from'),{target:{value:'2027-01-01'}});
  fireEvent.click(screen.getByRole('button',{name:'Add version'}));

  await waitFor(()=>expect(api.addVersion).toHaveBeenCalledWith(
    group.identityId,
    expect.objectContaining({name:'Monthly India 2027',effectiveFrom:'2027-01-01'})
  ));

  fireEvent.change(screen.getByLabelText('End date'),{target:{value:'2027-01-01'}});
  fireEvent.click(screen.getByRole('button',{name:'End-date pay-group version'}));

  await waitFor(()=>expect(api.endDate).toHaveBeenCalledWith(
    group.identityId,group.versionId,group.versionNo,'2027-01-01'
  ));
});

test('surfaces API problem details accessibly',async()=>{
  const api=fakeApi({list:vi.fn().mockRejectedValue(new Error('Tenant context unavailable'))});
  render(<PayGroupPage api={api} permissions={new Set(['pay-group.read'])}/>);
  expect(await screen.findByRole('alert')).toHaveTextContent('Tenant context unavailable');
});

test('creates and end-dates ranked routing rules with business pay-group selection',async()=>{
  const api=fakeApi({list:vi.fn().mockResolvedValue([group]),
    routingRules:vi.fn().mockResolvedValue([routingRule])});
  render(<PayGroupPage api={api} permissions={new Set([
    'pay-group.read','pay-group.create','pay-group.version.end-date'
  ])}/>);
  expect(await screen.findByRole('table',{name:'Effective pay-group routing rules'})).toBeInTheDocument();
  expect(screen.getByText('ACTIVE / v0')).toBeInTheDocument();
  const form=screen.getByRole('form',{name:'Create pay-group routing rule'});
  const createFields=within(form);
  fireEvent.change(createFields.getByLabelText('Routing payroll statutory unit version ID'),
    {target:{value:group.payrollStatutoryUnitVersionId}});
  fireEvent.change(createFields.getByLabelText('Priority'),{target:{value:'25'}});
  fireEvent.click(createFields.getByRole('button',{name:'Create routing rule'}));
  await waitFor(()=>expect(api.createRoutingRule).toHaveBeenCalledWith(expect.objectContaining({
    payGroupVersionId:group.versionId,payrollStatutoryUnitVersionId:group.payrollStatutoryUnitVersionId,
    establishmentVersionId:null,priority:25
  })));
  const endDateForm=screen.getByRole('form',{name:`End-date routing rule ${routingRule.id}`});
  const endDateFields=within(endDateForm);
  fireEvent.change(endDateFields.getByLabelText('End date'),{target:{value:'2026-12-31'}});
  fireEvent.click(endDateFields.getByRole('button',{name:'End-date rule'}));
  await waitFor(()=>expect(api.endDateRoutingRule).toHaveBeenCalledWith(
    routingRule.id,routingRule.versionNo,'2026-12-31'));
});

test('shows deterministic bounded routing readiness and blocker evidence',async()=>{
  const blocked={...readiness,compatible:false,routingCoverageComplete:false,
    routingMatchesRequestedPayGroup:false,ready:false,issues:[{
      issueCode:'CALENDAR_FREQUENCY_MISMATCH',issueDetail:'Calendar frequency is incompatible.'
    }],resolutionCheckpoints:[readiness.resolutionCheckpoints[0],{
      asOf:'2026-07-01',payGroupVersionId:null,resolutionSource:null,routingRuleId:null,
      matchesRequestedPayGroup:false
    }]};
  const api=fakeApi({list:vi.fn().mockResolvedValue([group]),
    routingReadiness:vi.fn().mockResolvedValue(blocked)});
  render(<PayGroupPage api={api} permissions={new Set(['pay-group.read'])}/>);
  const form=await screen.findByRole('form',{name:'Inspect routing readiness'});
  const readinessFields=within(form);
  fireEvent.change(readinessFields.getByLabelText('Payroll assignment version ID'),
    {target:{value:blocked.payrollAssignmentVersionId}});
  fireEvent.change(readinessFields.getByLabelText('Readiness effective from'),{target:{value:'2026-01-01'}});
  fireEvent.change(readinessFields.getByLabelText('Readiness effective to'),{target:{value:'2027-01-01'}});
  fireEvent.click(readinessFields.getByRole('button',{name:'Inspect routing readiness'}));
  expect(await screen.findByText('BLOCKED')).toBeInTheDocument();
  expect(screen.getByText(/CALENDAR_FREQUENCY_MISMATCH/)).toBeInTheDocument();
  expect(screen.getByRole('table',{name:'Routing resolution checkpoints'})).toHaveTextContent('2026-07-01');
  await waitFor(()=>expect(api.routingReadiness).toHaveBeenCalledWith({
    payrollAssignmentVersionId:blocked.payrollAssignmentVersionId,
    payGroupVersionId:group.versionId,effectiveFrom:'2026-01-01',effectiveTo:'2027-01-01'
  }));
});
