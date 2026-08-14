import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {expect,test,vi} from 'vitest';
import {PayrollCalendarPage} from './PayrollCalendarPage';
import {CalendarOperational,PayPeriodOperational,PayrollCalendar,PayrollCalendarApi} from './payroll-calendar-api';

const calendar:PayrollCalendar={
  id:'20000000-0000-0000-0000-000000000001',calendarSeriesId:'21000000-0000-0000-0000-000000000001',
  calendarVersion:1,supersedesCalendarId:null,code:'WEEKLY_IN',name:'Weekly India',frequency:'WEEKLY',timezone:'Asia/Kolkata'
};
const operation:CalendarOperational={...calendar,customPeriodDays:null,customFrequencyAuthorised:false,
  publicationRequired:true,lifecycleStatus:'DRAFT',latestLifecycleEventId:null,lifecycleChangedAt:null,
  lifecycleChangedBy:null,lifecycleReason:null,milestoneRuleCount:5,holidayCount:3,periodCount:52,
  firstPeriodStart:'2026-01-01',lastPeriodEnd:'2026-12-31'};
const evidence:PayPeriodOperational[]=[{
  id:'30000000-0000-0000-0000-000000000001',calendarId:calendar.id,periodCode:'2026-W01',
  periodStart:'2026-01-01',periodEnd:'2026-01-07',paymentDate:'2026-01-07',status:'OPEN',
  paymentOriginalDate:'2026-01-07',paymentAdjustedDate:'2026-01-06'
}];
function fakeApi(overrides:Partial<PayrollCalendarApi>={}):PayrollCalendarApi{
  return {
    list:vi.fn().mockResolvedValue([calendar]),create:vi.fn().mockResolvedValue(calendar),
    periods:vi.fn().mockResolvedValue(evidence),generate:vi.fn().mockResolvedValue(evidence),
    operations:vi.fn().mockResolvedValue(operation),periodOperations:vi.fn().mockResolvedValue(evidence),
    publish:vi.fn().mockResolvedValue({...operation,lifecycleStatus:'PUBLISHED'}),
    amend:vi.fn().mockResolvedValue({...calendar,id:'next',calendarVersion:2,supersedesCalendarId:calendar.id}),
    retire:vi.fn().mockResolvedValue({...operation,lifecycleStatus:'RETIRED'}),...overrides
  };
}
test('requires calendar.read',()=>{
  const api=fakeApi();render(<PayrollCalendarPage api={api} permissions={new Set()}/>);
  expect(screen.getByRole('alert')).toHaveTextContent('do not have permission');expect(api.list).not.toHaveBeenCalled();
});
test('shows multi-frequency lifecycle readiness and adjusted milestone evidence',async()=>{
  const api=fakeApi();render(<PayrollCalendarPage api={api} permissions={new Set(['calendar.read'])}/>);
  fireEvent.click(await screen.findByRole('button',{name:/WEEKLY_IN/}));
  expect(await screen.findByText('Milestone rules: 5/5')).toBeInTheDocument();
  expect(screen.getByText(/Calendar lifecycle is DRAFT/)).toBeInTheDocument();
  expect(screen.getByText('2026-01-07 → 2026-01-06')).toBeInTheDocument();
});
test('creates a custom calendar only with explicit custom configuration fields',async()=>{
  const api=fakeApi({list:vi.fn().mockResolvedValue([])});
  render(<PayrollCalendarPage api={api} permissions={new Set(['calendar.read','calendar.create'])}/>);
  await screen.findByText('No payroll calendars are configured.');
  fireEvent.change(screen.getByLabelText('Calendar code'),{target:{value:'custom_in'}});
  fireEvent.change(screen.getByLabelText('Calendar name'),{target:{value:'Custom India'}});
  fireEvent.change(screen.getByLabelText('Frequency'),{target:{value:'CUSTOM'}});
  fireEvent.change(screen.getByLabelText('Custom period days'),{target:{value:'14'}});
  const customAuthorisation=screen.getByLabelText('Custom frequency explicitly authorised');
  expect(customAuthorisation).toBeRequired();
  fireEvent.click(customAuthorisation);
  fireEvent.click(screen.getByRole('button',{name:'Create calendar'}));
  await waitFor(()=>expect(api.create).toHaveBeenCalledWith(expect.objectContaining({
    code:'CUSTOM_IN',frequency:'CUSTOM',customPeriodDays:14,customFrequencyAuthorised:true,weekendIsoDays:[6,7]
  })));
});

test('blocks publication while authoritative readiness blockers remain',async()=>{
  const blocked={...operation,milestoneRuleCount:0,periodCount:0};
  const api=fakeApi({operations:vi.fn().mockResolvedValue(blocked),periods:vi.fn().mockResolvedValue([]),periodOperations:vi.fn().mockResolvedValue([])});
  render(<PayrollCalendarPage api={api} permissions={new Set(['calendar.read','calendar.create'])}/>);
  fireEvent.click(await screen.findByRole('button',{name:/WEEKLY_IN/}));
  expect(await screen.findByText('Milestone rules: 0/5')).toBeInTheDocument();
  expect(screen.getByRole('button',{name:'Publish calendar'})).toBeDisabled();
  expect(api.publish).not.toHaveBeenCalled();
});
test('generates non-monthly periods from explicit start and count and publishes draft',async()=>{
  const api=fakeApi();render(<PayrollCalendarPage api={api} permissions={new Set([
    'calendar.read','calendar.create','calendar.period.generate'
  ])}/>);
  fireEvent.click(await screen.findByRole('button',{name:/WEEKLY_IN/}));
  await screen.findByText('Milestone rules: 5/5');
  fireEvent.change(screen.getByLabelText('Schedule start'),{target:{value:'2026-01-01'}});
  fireEvent.change(screen.getByLabelText('Period count'),{target:{value:'52'}});
  fireEvent.click(screen.getByRole('button',{name:'Generate periods'}));
  await waitFor(()=>expect(api.generate).toHaveBeenCalledWith(calendar.id,{startDate:'2026-01-01',periodCount:52}));
  fireEvent.click(screen.getByRole('button',{name:'Publish calendar'}));
  await waitFor(()=>expect(api.publish).toHaveBeenCalledWith(calendar.id,''));
});

test('uses governed generalized generation for monthly calendars and blocks generation until rules exist',async()=>{
  const monthly={...calendar,id:'20000000-0000-0000-0000-000000000011',code:'MONTHLY_IN',name:'Monthly India',frequency:'MONTHLY' as const};
  const blocked={...operation,...monthly,milestoneRuleCount:0,periodCount:0,firstPeriodStart:null,lastPeriodEnd:null};
  const api=fakeApi({
    list:vi.fn().mockResolvedValue([monthly]),
    operations:vi.fn().mockResolvedValue(blocked),
    periods:vi.fn().mockResolvedValue([]),
    periodOperations:vi.fn().mockResolvedValue([])
  });
  render(<PayrollCalendarPage api={api} permissions={new Set([
    'calendar.read','calendar.create','calendar.period.generate'
  ])}/>);
  fireEvent.click(await screen.findByRole('button',{name:/MONTHLY_IN/}));
  await screen.findByText('Milestone rules: 0/5');
  expect(screen.getByLabelText('Schedule start')).toBeInTheDocument();
  expect(screen.queryByLabelText('Payment day')).not.toBeInTheDocument();
  expect(screen.getByRole('button',{name:'Generate periods'})).toBeDisabled();
  expect(api.generate).not.toHaveBeenCalled();
});

test('generates a governed monthly schedule through startDate and periodCount',async()=>{
  const monthly={...calendar,id:'20000000-0000-0000-0000-000000000012',code:'MONTHLY_GOV',name:'Governed Monthly',frequency:'MONTHLY' as const};
  const ready={...operation,...monthly,milestoneRuleCount:5,periodCount:0,firstPeriodStart:null,lastPeriodEnd:null};
  const api=fakeApi({
    list:vi.fn().mockResolvedValue([monthly]),
    operations:vi.fn().mockResolvedValue(ready),
    periods:vi.fn().mockResolvedValue([]),
    periodOperations:vi.fn().mockResolvedValue([])
  });
  render(<PayrollCalendarPage api={api} permissions={new Set([
    'calendar.read','calendar.create','calendar.period.generate'
  ])}/>);
  fireEvent.click(await screen.findByRole('button',{name:/MONTHLY_GOV/}));
  await screen.findByText('Milestone rules: 5/5');
  fireEvent.change(screen.getByLabelText('Schedule start'),{target:{value:'2026-01-01'}});
  fireEvent.change(screen.getByLabelText('Period count'),{target:{value:'12'}});
  fireEvent.click(screen.getByRole('button',{name:'Generate periods'}));
  await waitFor(()=>expect(api.generate).toHaveBeenCalledWith(
    monthly.id,{startDate:'2026-01-01',periodCount:12}
  ));
});

test('preserves the legacy monthly generation mode without imposing publication lifecycle',async()=>{
  const legacy={...calendar,id:'20000000-0000-0000-0000-000000000013',code:'LEGACY_MONTHLY',name:'Legacy Monthly',frequency:'MONTHLY' as const};
  const legacyOperation={...operation,...legacy,publicationRequired:false,lifecycleStatus:'DRAFT' as const,
    milestoneRuleCount:0,periodCount:12,firstPeriodStart:'2026-01-01',lastPeriodEnd:'2026-12-31'};
  const api=fakeApi({
    list:vi.fn().mockResolvedValue([legacy]),
    operations:vi.fn().mockResolvedValue(legacyOperation)
  });
  render(<PayrollCalendarPage api={api} permissions={new Set([
    'calendar.read','calendar.create','calendar.period.generate'
  ])}/>);
  fireEvent.click(await screen.findByRole('button',{name:/LEGACY_MONTHLY/}));
  await screen.findByText('Legacy compatibility calendar; publication lifecycle is not required.');
  expect(screen.queryByRole('button',{name:'Publish calendar'})).not.toBeInTheDocument();
  expect(screen.getByLabelText('Payment day')).toBeInTheDocument();
  expect(screen.queryByLabelText('Schedule start')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Generate periods'}));
  await waitFor(()=>expect(api.generate).toHaveBeenCalledWith(
    legacy.id,{year:new Date().getFullYear(),paymentDay:31}
  ));
});
