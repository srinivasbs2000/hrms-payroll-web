import {
  fireEvent,
  render,
  screen,
  waitFor
} from '@testing-library/react';
import {expect,test,vi} from 'vitest';
import {PayrollCalendarPage} from './PayrollCalendarPage';
import {
  PayPeriod,
  PayrollCalendar,
  PayrollCalendarApi
} from './payroll-calendar-api';

const calendar:PayrollCalendar={
  id:'20000000-0000-0000-0000-000000000001',
  code:'MONTHLY_IN',
  name:'Monthly India',
  frequency:'MONTHLY',
  timezone:'Asia/Kolkata'
};

const periods:PayPeriod[]=Array.from({length:12},(_,index)=>{
  const month=String(index+1).padStart(2,'0');
  const february=index===1;
  return {
    id:`30000000-0000-0000-0000-${String(index+1).padStart(12,'0')}`,
    calendarId:calendar.id,
    periodCode:`2028-${month}`,
    periodStart:`2028-${month}-01`,
    periodEnd: february
      ?'2028-02-29'
      :`2028-${month}-${index===3||index===5||index===8||index===10?'30':'31'}`,
    paymentDate:february
      ?'2028-02-29'
      :`2028-${month}-${index===3||index===5||index===8||index===10?'30':'31'}`,
    status:'OPEN'
  };
});

function fakeApi(
  overrides:Partial<PayrollCalendarApi>={}
):PayrollCalendarApi{
  return {
    list:vi.fn().mockResolvedValue([]),
    create:vi.fn().mockResolvedValue(calendar),
    periods:vi.fn().mockResolvedValue([]),
    generate:vi.fn().mockResolvedValue(periods),
    ...overrides
  };
}

test('rejects the screen when calendar.read is absent',()=>{
  const api=fakeApi();
  render(
    <PayrollCalendarPage
      api={api}
      permissions={new Set()}
    />);
  expect(screen.getByRole('alert')).toHaveTextContent(
    'do not have permission');
  expect(api.list).not.toHaveBeenCalled();
});

test('lists calendars and loads their periods',async()=>{
  const api=fakeApi({
    list:vi.fn().mockResolvedValue([calendar]),
    periods:vi.fn().mockResolvedValue(periods)
  });

  render(
    <PayrollCalendarPage
      api={api}
      permissions={new Set(['calendar.read'])}
    />);

  fireEvent.click(
    await screen.findByRole(
      'button',
      {name:/MONTHLY_IN/}));

  expect(await screen.findByText('2028-02')).toBeInTheDocument();
  expect(screen.getAllByText('2028-02-29')).toHaveLength(2);
  expect(api.periods).toHaveBeenCalledWith(
    calendar.id,
    expect.any(Number));
});

test('creates the supported monthly calendar shape',async()=>{
  const api=fakeApi();

  render(
    <PayrollCalendarPage
      api={api}
      permissions={new Set([
        'calendar.read',
        'calendar.create'
      ])}
    />);

  await screen.findByText('No payroll calendars');

  fireEvent.change(
    screen.getByLabelText('Calendar code'),
    {target:{value:'monthly_in'}});
  fireEvent.change(
    screen.getByLabelText('Calendar name'),
    {target:{value:'Monthly India'}});
  fireEvent.click(
    screen.getByRole(
      'button',
      {name:'Create calendar'}));

  await waitFor(()=>expect(api.create).toHaveBeenCalledWith({
    code:'MONTHLY_IN',
    name:'Monthly India',
    frequency:'MONTHLY',
    timezone:'Asia/Kolkata'
  }));
});

test('generates and displays twelve leap-year periods',async()=>{
  const api=fakeApi({
    list:vi.fn().mockResolvedValue([calendar])
  });

  render(
    <PayrollCalendarPage
      api={api}
      permissions={new Set([
        'calendar.read',
        'calendar.period.generate'
      ])}
    />);

  fireEvent.click(
    await screen.findByRole(
      'button',
      {name:/MONTHLY_IN/}));

  fireEvent.change(
    screen.getByLabelText('Period year'),
    {target:{value:'2028'}});
  fireEvent.change(
    screen.getByLabelText('Payment day'),
    {target:{value:'31'}});
  fireEvent.click(
    screen.getByRole(
      'button',
      {name:'Generate 12 periods'}));

  await waitFor(()=>expect(api.generate).toHaveBeenCalledWith(
    calendar.id,
    {year:2028,paymentDay:31}
  ));
  expect(await screen.findByText('2028-02')).toBeInTheDocument();
  expect(screen.getAllByText('2028-02-29')).toHaveLength(2);
  expect(screen.getByRole('status')).toHaveTextContent(
    '12 monthly periods');
});

test('surfaces calendar API errors accessibly',async()=>{
  const api=fakeApi({
    list:vi.fn().mockRejectedValue(
      new Error('Tenant context unavailable'))
  });

  render(
    <PayrollCalendarPage
      api={api}
      permissions={new Set(['calendar.read'])}
    />);

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Tenant context unavailable');
});
