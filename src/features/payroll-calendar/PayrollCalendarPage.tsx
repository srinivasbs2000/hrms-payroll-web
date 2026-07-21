import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState
} from 'react';
import {currentPermissions} from '../organisation/organisation-api';
import {
  GeneratePeriods,
  httpPayrollCalendarApi,
  PayPeriod,
  PayrollCalendar,
  PayrollCalendarApi,
  PayrollCalendarWrite
} from './payroll-calendar-api';

type Props={
  api?:PayrollCalendarApi;
  permissions?:Set<string>;
};

const currentYear=()=>new Date().getFullYear();

export function PayrollCalendarPage({
  api=httpPayrollCalendarApi,
  permissions
}:Props){
  const effectivePermissions=useMemo(
    ()=>permissions??currentPermissions(),
    [permissions]);
  const [calendars,setCalendars]=useState<PayrollCalendar[]>([]);
  const [selected,setSelected]=useState<PayrollCalendar|null>(null);
  const [periods,setPeriods]=useState<PayPeriod[]>([]);
  const [year,setYear]=useState(currentYear);
  const [paymentDay,setPaymentDay]=useState(31);
  const [loading,setLoading]=useState(false);
  const [periodLoading,setPeriodLoading]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');

  const canRead=effectivePermissions.has('calendar.read');
  const canCreate=effectivePermissions.has('calendar.create');
  const canGenerate=effectivePermissions.has(
    'calendar.period.generate');

  const loadCalendars=useCallback(async()=>{
    if(!canRead)return;
    setLoading(true);
    setError('');
    try{
      setCalendars(await api.list());
    }catch(exception){
      setError((exception as Error).message);
    }finally{
      setLoading(false);
    }
  },[api,canRead]);

  useEffect(()=>{
    void loadCalendars();
  },[loadCalendars]);

  async function selectCalendar(calendar:PayrollCalendar){
    setSelected(calendar);
    setPeriods([]);
    setNotice('');
    setError('');
    setPeriodLoading(true);
    try{
      setPeriods(await api.periods(calendar.id,year));
    }catch(exception){
      setError((exception as Error).message);
    }finally{
      setPeriodLoading(false);
    }
  }

  async function loadPeriods(){
    if(!selected)return;
    setNotice('');
    setError('');
    setPeriodLoading(true);
    try{
      setPeriods(await api.periods(selected.id,year));
    }catch(exception){
      setError((exception as Error).message);
    }finally{
      setPeriodLoading(false);
    }
  }

  async function create(input:PayrollCalendarWrite){
    setNotice('');
    setError('');
    try{
      const created=await api.create(input);
      setCalendars(await api.list());
      setSelected(created);
      setPeriods([]);
      setNotice(`Calendar ${created.code} created.`);
    }catch(exception){
      setError((exception as Error).message);
    }
  }

  async function generate(input:GeneratePeriods){
    if(!selected)return;
    setNotice('');
    setError('');
    setPeriodLoading(true);
    try{
      const generated=await api.generate(selected.id,input);
      setPeriods(generated);
      setNotice(
        `${generated.length} monthly periods are ready for ${input.year}.`);
    }catch(exception){
      setError((exception as Error).message);
    }finally{
      setPeriodLoading(false);
    }
  }

  if(!canRead){
    return <section
      className="card"
      aria-labelledby="payroll-calendar-title">
      <h2 id="payroll-calendar-title">Payroll calendars</h2>
      <p role="alert">
        You do not have permission to view payroll calendars.
      </p>
    </section>;
  }

  return <section aria-labelledby="payroll-calendar-title">
    <div className="page-heading">
      <div>
        <p className="eyebrow">Sprint 2 configuration</p>
        <h2 id="payroll-calendar-title">Payroll calendars</h2>
        <p>
          Tenant-scoped monthly calendars with deterministic annual periods.
        </p>
      </div>
    </div>

    {loading&&<p role="status">Loading payroll calendars...</p>}
    {error&&<p className="error" role="alert">{error}</p>}
    {notice&&<p className="success" role="status">{notice}</p>}

    {!loading&&calendars.length===0&&
      <div className="card empty">
        <h3>No payroll calendars</h3>
        <p>Create the monthly calendar before configuring a pay group.</p>
      </div>}

    {calendars.length>0&&
      <div className="card">
        <div className="section-heading">
          <div>
            <h3>Available calendars</h3>
            <p>Select a calendar to inspect or generate its periods.</p>
          </div>
          <span className="count-badge">
            {calendars.length} configured
          </span>
        </div>
        <div className="calendar-list">
          {calendars.map(calendar=>
            <button
              key={calendar.id}
              type="button"
              className={
                selected?.id===calendar.id
                  ?'calendar-item selected'
                  :'calendar-item'}
              aria-pressed={selected?.id===calendar.id}
              onClick={()=>void selectCalendar(calendar)}>
              <span>
                <strong>{calendar.code}</strong>
                <small>{calendar.name}</small>
              </span>
              <span>
                <strong>{calendar.frequency}</strong>
                <small>{calendar.timezone}</small>
              </span>
            </button>)}
        </div>
      </div>}

    {canCreate
      ?<CreateCalendarForm onCreate={create}/>
      :<p className="permission-note">
        Create controls are hidden because <code>calendar.create</code> is
        not granted.
      </p>}

    {selected&&
      <CalendarPeriods
        calendar={selected}
        periods={periods}
        year={year}
        paymentDay={paymentDay}
        loading={periodLoading}
        canGenerate={canGenerate}
        onYearChange={setYear}
        onPaymentDayChange={setPaymentDay}
        onLoad={loadPeriods}
        onGenerate={generate}
      />}
  </section>;
}

function CreateCalendarForm({
  onCreate
}:{
  onCreate:(input:PayrollCalendarWrite)=>Promise<void>;
}){
  const [code,setCode]=useState('');
  const [name,setName]=useState('');
  const [timezone,setTimezone]=useState('Asia/Kolkata');

  async function submit(event:FormEvent){
    event.preventDefault();
    await onCreate({
      code,
      name,
      frequency:'MONTHLY',
      timezone
    });
    setCode('');
    setName('');
  }

  return <form
    className="card form-grid"
    aria-label="Create payroll calendar"
    onSubmit={event=>void submit(event)}>
    <h3>Create monthly payroll calendar</h3>
    <label>
      Calendar code
      <input
        required
        pattern="[A-Z][A-Z0-9_]{1,39}"
        value={code}
        onChange={event=>setCode(event.target.value.toUpperCase())}
      />
    </label>
    <label>
      Calendar name
      <input
        required
        maxLength={160}
        value={name}
        onChange={event=>setName(event.target.value)}
      />
    </label>
    <label>
      Frequency
      <input value="MONTHLY" readOnly/>
    </label>
    <label>
      Timezone
      <input
        required
        value={timezone}
        onChange={event=>setTimezone(event.target.value)}
      />
    </label>
    <button type="submit">Create calendar</button>
  </form>;
}

type CalendarPeriodsProps={
  calendar:PayrollCalendar;
  periods:PayPeriod[];
  year:number;
  paymentDay:number;
  loading:boolean;
  canGenerate:boolean;
  onYearChange:(year:number)=>void;
  onPaymentDayChange:(day:number)=>void;
  onLoad:()=>Promise<void>;
  onGenerate:(input:GeneratePeriods)=>Promise<void>;
};

function CalendarPeriods({
  calendar,
  periods,
  year,
  paymentDay,
  loading,
  canGenerate,
  onYearChange,
  onPaymentDayChange,
  onLoad,
  onGenerate
}:CalendarPeriodsProps){
  return <section
    className="card"
    aria-labelledby="calendar-periods-title">
    <div className="section-heading">
      <div>
        <h3 id="calendar-periods-title">
          {calendar.code} periods
        </h3>
        <p>
          Calendar ID: <code>{calendar.id}</code>
        </p>
      </div>
      <span className="badge approved">{calendar.frequency}</span>
    </div>

    <form
      className="period-controls"
      aria-label="Payroll period controls"
      onSubmit={event=>{
        event.preventDefault();
        void onLoad();
      }}>
      <label>
        Period year
        <input
          type="number"
          min={2020}
          max={2100}
          value={year}
          onChange={event=>onYearChange(Number(event.target.value))}
        />
      </label>
      <label>
        Payment day
        <input
          type="number"
          min={1}
          max={31}
          value={paymentDay}
          onChange={event=>onPaymentDayChange(
            Number(event.target.value))}
        />
      </label>
      <button type="submit">Load periods</button>
      {canGenerate&&
        <button
          type="button"
          onClick={()=>void onGenerate({year,paymentDay})}>
          Generate 12 periods
        </button>}
    </form>

    {!canGenerate&&
      <p className="permission-note">
        Generation is unavailable because
        <code> calendar.period.generate</code> is not granted.
      </p>}

    {loading&&<p role="status">Loading payroll periods...</p>}

    {!loading&&periods.length===0&&
      <div className="empty compact">
        <h4>No periods for {year}</h4>
        <p>
          Generate the deterministic monthly schedule when it is approved
          for use.
        </p>
      </div>}

    {periods.length>0&&
      <div className="table-scroll">
        <table>
          <caption>
            {calendar.name} monthly payroll periods for {year}
          </caption>
          <thead>
            <tr>
              <th scope="col">Period</th>
              <th scope="col">Start</th>
              <th scope="col">End</th>
              <th scope="col">Payment date</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {periods.map(period=>
              <tr key={period.id}>
                <td><strong>{period.periodCode}</strong></td>
                <td>{period.periodStart}</td>
                <td>{period.periodEnd}</td>
                <td>{period.paymentDate}</td>
                <td>
                  <span className={`badge ${period.status.toLowerCase()}`}>
                    {period.status}
                  </span>
                </td>
              </tr>)}
          </tbody>
        </table>
      </div>}
  </section>;
}
