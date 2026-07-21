import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {expect,test,vi} from 'vitest';
import {PayGroupPage} from './PayGroupPage';
import {PayGroupApi,PayGroupVersion} from './pay-group-api';

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

function fakeApi(overrides:Partial<PayGroupApi>={}):PayGroupApi{
  return {
    list:vi.fn().mockResolvedValue([]),
    history:vi.fn().mockResolvedValue([group]),
    create:vi.fn().mockResolvedValue(group),
    addVersion:vi.fn().mockResolvedValue({...group,versionSequence:2,approvalStatus:'DRAFT'}),
    correct:vi.fn().mockResolvedValue({...group,versionSequence:2,approvalStatus:'DRAFT'}),
    endDate:vi.fn().mockResolvedValue({...group,effectiveTo:'2027-01-01',versionNo:2}),
    approve:vi.fn().mockResolvedValue({...group,approvalStatus:'APPROVED'}),
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

test('creates the approved monthly INR configuration shape',async()=>{
  const api=fakeApi();
  render(<PayGroupPage api={api} permissions={new Set(['pay-group.read','pay-group.create'])}/>);
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
