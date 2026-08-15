import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {expect,test,vi} from 'vitest';
import {PayrollCalendarPage} from './PayrollCalendarPage';
import {
  CalendarHoliday,CalendarMilestoneRule,CalendarOperational,CalendarReadiness,
  PayPeriodOperational,PayrollCalendar,PayrollCalendarApi
} from './payroll-calendar-api';

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
const milestoneRules:CalendarMilestoneRule[]=[
  ['INPUT_CUTOFF',-5],['CALCULATION',-3],['APPROVAL',-2],['RELEASE',-1],['PAYMENT',0]
].map(([milestoneType,offsetDays],index)=>({
  id:`31000000-0000-0000-0000-00000000000${index+1}`,calendarId:calendar.id,
  milestoneType:milestoneType as CalendarMilestoneRule['milestoneType'],anchorType:'PERIOD_END',
  offsetDays:Number(offsetDays),adjustmentPolicy:'PREVIOUS_WORKING_DAY',versionNo:0
}));
const holiday:CalendarHoliday={id:'32000000-0000-0000-0000-000000000001',calendarId:calendar.id,
  holidayDate:'2026-01-26',holidayName:'Republic Day',versionNo:0};
const readiness:CalendarReadiness={calendarId:calendar.id,frequency:'WEEKLY',timezone:'Asia/Kolkata',
  lifecycleStatus:'DRAFT',milestoneRuleCount:5,holidayCount:1,periodCount:52,incompletePeriodCount:0,
  generationReady:true,publicationReady:true,blockers:[]};
function fakeApi(overrides:Partial<PayrollCalendarApi>={}):PayrollCalendarApi{
  return {
    list:vi.fn().mockResolvedValue([calendar]),create:vi.fn().mockResolvedValue(calendar),
    periods:vi.fn().mockResolvedValue(evidence),generate:vi.fn().mockResolvedValue(evidence),
    operations:vi.fn().mockResolvedValue(operation),periodOperations:vi.fn().mockResolvedValue(evidence),
    publish:vi.fn().mockResolvedValue({...operation,lifecycleStatus:'PUBLISHED'}),
    amend:vi.fn().mockResolvedValue({...calendar,id:'next',calendarVersion:2,supersedesCalendarId:calendar.id}),
    retire:vi.fn().mockResolvedValue({...operation,lifecycleStatus:'RETIRED'}),
    milestoneRules:vi.fn().mockResolvedValue(milestoneRules),
    configureMilestoneRules:vi.fn().mockResolvedValue(milestoneRules),
    holidays:vi.fn().mockResolvedValue([holiday]),configureHoliday:vi.fn().mockResolvedValue(holiday),
    readiness:vi.fn().mockResolvedValue(readiness),...overrides
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
  const blockedReadiness={...readiness,milestoneRuleCount:0,periodCount:0,generationReady:false,
    publicationReady:false,blockers:['MILESTONE_RULE_SET_INCOMPLETE','PAY_PERIODS_NOT_GENERATED'] as CalendarReadiness['blockers']};
  const api=fakeApi({operations:vi.fn().mockResolvedValue(blocked),readiness:vi.fn().mockResolvedValue(blockedReadiness),
    milestoneRules:vi.fn().mockResolvedValue([]),periods:vi.fn().mockResolvedValue([]),periodOperations:vi.fn().mockResolvedValue([])});
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
    periodOperations:vi.fn().mockResolvedValue([]),readiness:vi.fn().mockResolvedValue({
      ...readiness,calendarId:monthly.id,frequency:'MONTHLY',milestoneRuleCount:0,periodCount:0,
      generationReady:false,publicationReady:false,blockers:['MILESTONE_RULE_SET_INCOMPLETE','PAY_PERIODS_NOT_GENERATED']
    }),milestoneRules:vi.fn().mockResolvedValue([])
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
    periodOperations:vi.fn().mockResolvedValue([]),readiness:vi.fn().mockResolvedValue({
      ...readiness,calendarId:monthly.id,frequency:'MONTHLY',periodCount:0,publicationReady:false,
      blockers:['PAY_PERIODS_NOT_GENERATED']
    })
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
    operations:vi.fn().mockResolvedValue(legacyOperation),readiness:vi.fn().mockResolvedValue({
      ...readiness,calendarId:legacy.id,frequency:'MONTHLY',milestoneRuleCount:0,periodCount:12,
      generationReady:true,publicationReady:true,blockers:[]
    }),milestoneRules:vi.fn().mockResolvedValue([])
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

test('configures the complete milestone set and displays backend version evidence',async()=>{
  const api=fakeApi();render(<PayrollCalendarPage api={api} permissions={new Set([
    'calendar.read','calendar.create'
  ])}/>);
  fireEvent.click(await screen.findByRole('button',{name:/WEEKLY_IN/}));
  expect(await screen.findByRole('table',{name:'Calendar milestone rules'})).toHaveTextContent('PAYMENT');
  expect(screen.getAllByText('v0').length).toBeGreaterThanOrEqual(5);
  fireEvent.change(screen.getByLabelText('PAYMENT offset days'),{target:{value:'1'}});
  fireEvent.change(screen.getByLabelText('PAYMENT adjustment policy'),
    {target:{value:'NEXT_WORKING_DAY'}});
  fireEvent.click(screen.getByRole('button',{name:'Save five milestone rules'}));
  await waitFor(()=>expect(api.configureMilestoneRules).toHaveBeenCalledWith(calendar.id,
    expect.arrayContaining([expect.objectContaining({milestoneType:'PAYMENT',offsetDays:1,
      adjustmentPolicy:'NEXT_WORKING_DAY'})])));
});

test('supports repeat holiday correction by date and refreshes version evidence',async()=>{
  const corrected={...holiday,holidayName:'Republic Day observed',versionNo:1};
  const holidays=vi.fn().mockResolvedValueOnce([holiday]).mockResolvedValueOnce([corrected]);
  const api=fakeApi({holidays,configureHoliday:vi.fn().mockResolvedValue(corrected)});
  render(<PayrollCalendarPage api={api} permissions={new Set(['calendar.read','calendar.create'])}/>);
  fireEvent.click(await screen.findByRole('button',{name:/WEEKLY_IN/}));
  await screen.findByRole('table',{name:'Calendar holidays'});
  fireEvent.change(screen.getByLabelText('Holiday date'),{target:{value:'2026-01-26'}});
  fireEvent.change(screen.getByLabelText('Holiday name'),{target:{value:'Republic Day observed'}});
  fireEvent.click(screen.getByRole('button',{name:'Save holiday'}));
  await waitFor(()=>expect(api.configureHoliday).toHaveBeenCalledWith(calendar.id,{
    holidayDate:'2026-01-26',holidayName:'Republic Day observed'
  }));
  expect(await screen.findByText('Republic Day observed')).toBeInTheDocument();
  expect(screen.getByText('v1')).toBeInTheDocument();
});

test('locks configuration outside draft lifecycle and exposes backend blocker codes as business text',async()=>{
  const published={...operation,lifecycleStatus:'PUBLISHED' as const};
  const blocked={...readiness,lifecycleStatus:'PUBLISHED' as const,generationReady:false,
    publicationReady:false,blockers:['CALENDAR_NOT_DRAFT','PERIOD_MILESTONE_EVIDENCE_INCOMPLETE'] as CalendarReadiness['blockers']};
  const api=fakeApi({operations:vi.fn().mockResolvedValue(published),readiness:vi.fn().mockResolvedValue(blocked)});
  render(<PayrollCalendarPage api={api} permissions={new Set(['calendar.read','calendar.create'])}/>);
  fireEvent.click(await screen.findByRole('button',{name:/WEEKLY_IN/}));
  expect(await screen.findByText('Configuration is locked because the calendar is not DRAFT.')).toBeInTheDocument();
  expect(screen.getByText('Calendar lifecycle is not DRAFT.')).toBeInTheDocument();
  expect(screen.getByText('One or more periods lack complete milestone evidence.')).toBeInTheDocument();
  expect(screen.queryByRole('button',{name:'Save five milestone rules'})).not.toBeInTheDocument();
});
