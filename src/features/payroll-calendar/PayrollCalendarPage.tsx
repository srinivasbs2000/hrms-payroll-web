import {FormEvent,useCallback,useEffect,useMemo,useState} from 'react';
import {currentPermissions} from '../organisation/organisation-api';
import {
  CalendarOperational,GeneratePeriods,httpPayrollCalendarApi,PayPeriod,PayPeriodOperational,
  PayrollCalendar,PayrollCalendarApi,PayrollCalendarWrite,PayrollFrequency
} from './payroll-calendar-api';

type Props={api?:PayrollCalendarApi;permissions?:Set<string>};
const currentYear=()=>new Date().getFullYear();
const frequencies:PayrollFrequency[]=['MONTHLY','FORTNIGHTLY','WEEKLY','DAILY','CUSTOM'];

export function PayrollCalendarPage({api=httpPayrollCalendarApi,permissions}:Props){
  const effectivePermissions=useMemo(()=>permissions??currentPermissions(),[permissions]);
  const canRead=effectivePermissions.has('calendar.read');
  const canCreate=effectivePermissions.has('calendar.create');
  const canGenerate=effectivePermissions.has('calendar.period.generate');
  const [calendars,setCalendars]=useState<PayrollCalendar[]>([]);
  const [selected,setSelected]=useState<PayrollCalendar|null>(null);
  const [periods,setPeriods]=useState<PayPeriod[]>([]);
  const [operations,setOperations]=useState<CalendarOperational|null>(null);
  const [periodEvidence,setPeriodEvidence]=useState<PayPeriodOperational[]>([]);
  const [year,setYear]=useState(currentYear);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');

  const loadCalendars=useCallback(async()=>{
    if(!canRead)return;
    setLoading(true);setError('');
    try{setCalendars(await api.list())}catch(exception){setError((exception as Error).message)}
    finally{setLoading(false)}
  },[api,canRead]);
  useEffect(()=>{void loadCalendars()},[loadCalendars]);

  async function loadSelected(calendar:PayrollCalendar,targetYear=year){
    setSelected(calendar);setError('');setNotice('');setLoading(true);
    try{
      const [periodRows,operationState,evidence]=await Promise.all([
        api.periods(calendar.id,targetYear),api.operations(calendar.id),api.periodOperations(calendar.id,targetYear)
      ]);
      setPeriods(periodRows);setOperations(operationState);setPeriodEvidence(evidence);
    }catch(exception){setError((exception as Error).message)}
    finally{setLoading(false)}
  }
  async function create(input:PayrollCalendarWrite){
    setError('');setNotice('');
    try{
      const created=await api.create(input);await loadCalendars();await loadSelected(created);
      setNotice(`Calendar ${created.code} version ${created.calendarVersion} created.`);
    }catch(exception){setError((exception as Error).message)}
  }
  async function generate(input:GeneratePeriods){
    if(!selected)return;
    setError('');setNotice('');setLoading(true);
    try{
      const generated=await api.generate(selected.id,input);
      setPeriods(generated);setPeriodEvidence(await api.periodOperations(selected.id,year));
      setOperations(await api.operations(selected.id));
      setNotice(`${generated.length} periods generated for ${selected.code}.`);
    }catch(exception){setError((exception as Error).message)}
    finally{setLoading(false)}
  }
  async function lifecycle(action:'publish'|'amend'|'retire',reason=''){
    if(!selected)return;
    setError('');setNotice('');
    try{
      if(action==='amend'){
        const successor=await api.amend(selected.id);await loadCalendars();await loadSelected(successor);
        setNotice(`Draft successor version ${successor.calendarVersion} created.`);
      }else{
        const updated=action==='publish'?await api.publish(selected.id,reason):await api.retire(selected.id,reason);
        setOperations(updated);setNotice(`Calendar ${action} action completed.`);
        await loadCalendars();
      }
    }catch(exception){setError((exception as Error).message)}
  }

  if(!canRead)return <section className="card" aria-labelledby="payroll-calendar-title">
    <h2 id="payroll-calendar-title">Payroll calendars</h2>
    <p role="alert">You do not have permission to view payroll calendars.</p>
  </section>;

  const lineage=selected?calendars.filter(item=>item.calendarSeriesId===selected.calendarSeriesId)
    .sort((a,b)=>a.calendarVersion-b.calendarVersion):[];

  return <section aria-labelledby="payroll-calendar-title">
    <div className="page-heading"><div>
      <p className="eyebrow">Payroll calendar operations</p>
      <h2 id="payroll-calendar-title">Payroll calendars</h2>
      <p>Versioned multi-frequency calendars, contiguous periods, lifecycle readiness and adjusted milestone evidence.</p>
    </div></div>
    {loading&&<p role="status">Loading payroll calendar operations...</p>}
    {error&&<p className="error" role="alert">{error}</p>}
    {notice&&<p className="success" role="status">{notice}</p>}

    <div className="card"><div className="section-heading"><div><h3>Calendar versions</h3>
      <p>Select a version to inspect periods, readiness, lifecycle and date adjustments.</p></div>
      <span className="count-badge">{calendars.length} versions</span></div>
      {calendars.length===0?<p>No payroll calendars are configured.</p>:
        <div className="calendar-list">{calendars.map(calendar=><button key={calendar.id} type="button"
          className={selected?.id===calendar.id?'calendar-item selected':'calendar-item'}
          aria-pressed={selected?.id===calendar.id} onClick={()=>void loadSelected(calendar)}>
          <span><strong>{calendar.code}</strong><small>{calendar.name} · version {calendar.calendarVersion}</small></span>
          <span><strong>{calendar.frequency}</strong><small>{calendar.timezone}</small></span>
        </button>)}</div>}
    </div>

    {canCreate?<CreateCalendarForm onCreate={create}/>:<p className="permission-note">
      Create/lifecycle controls require <code>calendar.create</code>.</p>}

    {selected&&operations&&<OperationalWorkspace calendar={selected} operations={operations}
      lineage={lineage} periods={periods} evidence={periodEvidence} year={year}
      canCreate={canCreate} canGenerate={canGenerate} onYearChange={setYear}
      onReload={()=>loadSelected(selected,year)} onGenerate={generate} onLifecycle={lifecycle}/>}
  </section>;
}

function CreateCalendarForm({onCreate}:{onCreate:(input:PayrollCalendarWrite)=>Promise<void>}){
  const [code,setCode]=useState('');const [name,setName]=useState('');
  const [frequency,setFrequency]=useState<PayrollFrequency>('MONTHLY');
  const [timezone,setTimezone]=useState('Asia/Kolkata');const [customDays,setCustomDays]=useState(14);
  const [customAuthorised,setCustomAuthorised]=useState(false);
  async function submit(event:FormEvent){
    event.preventDefault();
    await onCreate({code,name,frequency,timezone,
      customPeriodDays:frequency==='CUSTOM'?customDays:null,
      customFrequencyAuthorised:frequency==='CUSTOM'&&customAuthorised,
      weekendIsoDays:[6,7]});
    setCode('');setName('');
  }
  return <form className="card form-grid" aria-label="Create payroll calendar" onSubmit={event=>void submit(event)}>
    <h3>Create calendar version</h3>
    <label>Calendar code<input required pattern="[A-Z][A-Z0-9_]{1,39}" value={code}
      onChange={event=>setCode(event.target.value.toUpperCase())}/></label>
    <label>Calendar name<input required maxLength={160} value={name} onChange={event=>setName(event.target.value)}/></label>
    <label>Frequency<select value={frequency} onChange={event=>setFrequency(event.target.value as PayrollFrequency)}>
      {frequencies.map(value=><option key={value} value={value}>{value.replaceAll('_',' ')}</option>)}</select></label>
    <label>Timezone<input required value={timezone} onChange={event=>setTimezone(event.target.value)}/></label>
    {frequency==='CUSTOM'&&<><label>Custom period days<input type="number" min={1} max={366} value={customDays}
      onChange={event=>setCustomDays(Number(event.target.value))}/></label>
      <label><input type="checkbox" required checked={customAuthorised} onChange={event=>setCustomAuthorised(event.target.checked)}/>
        Custom frequency explicitly authorised</label></>}
    <p className="permission-note">Weekend policy defaults to Saturday/Sunday. Milestone-rule and holiday-calendar write endpoints are not exposed by the current merged backend contract, so this UI does not invent edit controls for them.</p>
    <button type="submit">Create calendar</button>
  </form>;
}

type WorkspaceProps={
  calendar:PayrollCalendar;operations:CalendarOperational;lineage:PayrollCalendar[];
  periods:PayPeriod[];evidence:PayPeriodOperational[];year:number;canCreate:boolean;canGenerate:boolean;
  onYearChange:(year:number)=>void;onReload:()=>Promise<void>;onGenerate:(input:GeneratePeriods)=>Promise<void>;
  onLifecycle:(action:'publish'|'amend'|'retire',reason?:string)=>Promise<void>;
};
function OperationalWorkspace(props:WorkspaceProps){
  const {calendar,operations,lineage,periods,evidence,year,canCreate,canGenerate,onYearChange,onReload,onGenerate,onLifecycle}=props;
  const [paymentDay,setPaymentDay]=useState(31);const [startDate,setStartDate]=useState(`${year}-01-01`);
  const [periodCount,setPeriodCount]=useState(calendar.frequency==='MONTHLY'?12:26);
  const legacyMonthly=calendar.frequency==='MONTHLY'&&!operations.publicationRequired;
  const blockers=readinessBlockers(operations);
  const generationBlockers=generationPrerequisiteBlockers(operations);
  const generationBlocked=generationBlockers.length>0;
  const publishBlocked=publicationPrerequisiteBlockers(operations).length>0;
  return <section>
    <div className="card"><div className="section-heading"><div>
      <h3>{calendar.code} operational status</h3>
      <p>Series {calendar.calendarSeriesId} · version {calendar.calendarVersion}</p></div>
      <span className={`badge ${operations.lifecycleStatus.toLowerCase()}`}>{operations.lifecycleStatus}</span></div>
      <div className="action-summary">
        <span>Frequency: {operations.frequency}</span><span>Milestone rules: {operations.milestoneRuleCount}/5</span>
        <span>Holidays: {operations.holidayCount}</span><span>Periods: {operations.periodCount}</span>
        <span>Schedule: {operations.firstPeriodStart??'not generated'} → {operations.lastPeriodEnd??'not generated'}</span>
      </div>
      <h4>Blocking conditions</h4>
      {blockers.length===0?<p className="success">No calendar readiness blockers detected from the authoritative operational state.</p>:
        <ul>{blockers.map(blocker=><li key={blocker}>{blocker}</li>)}</ul>}
      {!operations.publicationRequired&&<p className="permission-note">Legacy compatibility calendar; publication lifecycle is not required.</p>}
      {canCreate&&operations.publicationRequired&&<LifecycleControls status={operations.lifecycleStatus} publishBlocked={publishBlocked} onLifecycle={onLifecycle}/>}
    </div>

    <div className="card"><h3>Version lineage</h3><ol className="timeline">{lineage.map(item=><li key={item.id}>
      <strong>Version {item.calendarVersion}: {item.name}</strong>
      <span>{item.frequency} · {item.timezone}</span>
      <span>{item.supersedesCalendarId?'Successor version':'Original version'}</span>
    </li>)}</ol></div>

    <div className="card"><h3>Period generation & inspection</h3>
      <form className="period-controls" onSubmit={event=>{event.preventDefault();void onReload()}}>
        <label>Period year<input type="number" min={2020} max={2100} value={year}
          onChange={event=>onYearChange(Number(event.target.value))}/></label>
        {legacyMonthly?<label>Payment day<input type="number" min={1} max={31} value={paymentDay}
          onChange={event=>setPaymentDay(Number(event.target.value))}/></label>:<>
          <label>Schedule start<input type="date" value={startDate} onChange={event=>setStartDate(event.target.value)}/></label>
          <label>Period count<input type="number" min={1} max={1000} value={periodCount}
            onChange={event=>setPeriodCount(Number(event.target.value))}/></label></>}
        <button type="submit">Reload periods</button>
        {canGenerate&&<button type="button" disabled={generationBlocked}
          title={generationBlocked?generationBlockers[0]:undefined}
          onClick={()=>void onGenerate(legacyMonthly?{year,paymentDay}:{startDate,periodCount})}>Generate periods</button>}
      </form>
      {!canGenerate&&<p className="permission-note">Generation requires <code>calendar.period.generate</code>.</p>}
      <PeriodTable periods={periods} calendar={calendar} year={year}/>
    </div>

    <div className="card"><h3>Milestone & working-day adjustment evidence</h3>
      <p>Original and adjusted dates are read from the backend operational evidence. This surface is read-only until milestone/holiday configuration write contracts exist.</p>
      <EvidenceTable rows={evidence}/>
    </div>
  </section>;
}
function publicationPrerequisiteBlockers(operations:CalendarOperational){
  if(!operations.publicationRequired)return [];
  const blockers:string[]=[];
  if(operations.milestoneRuleCount!==5)blockers.push(`Exactly five milestone rules are required; backend reports ${operations.milestoneRuleCount}.`);
  if(operations.periodCount===0)blockers.push('No generated periods are available.');
  if(operations.frequency==='CUSTOM'&&!operations.customFrequencyAuthorised)blockers.push('Custom frequency has not been explicitly authorised.');
  return blockers;
}
function generationPrerequisiteBlockers(operations:CalendarOperational){
  if(!operations.publicationRequired)return [];
  const blockers:string[]=[];
  if(operations.milestoneRuleCount!==5)blockers.push(`Exactly five milestone rules are required; backend reports ${operations.milestoneRuleCount}.`);
  if(operations.frequency==='CUSTOM'&&!operations.customFrequencyAuthorised)blockers.push('Custom frequency has not been explicitly authorised.');
  if(operations.lifecycleStatus!=='DRAFT')blockers.push(`Calendar lifecycle is ${operations.lifecycleStatus}; period generation is allowed only while the governed schedule is DRAFT.`);
  return blockers;
}
function readinessBlockers(operations:CalendarOperational){
  if(!operations.publicationRequired)return operations.periodCount===0?['No generated periods are available.']:[];
  const blockers=publicationPrerequisiteBlockers(operations);
  if(operations.lifecycleStatus!=='PUBLISHED')blockers.push(`Calendar lifecycle is ${operations.lifecycleStatus}; publish before operational use.`);
  return blockers;
}
function LifecycleControls({status,publishBlocked,onLifecycle}:{status:CalendarOperational['lifecycleStatus'];publishBlocked:boolean;onLifecycle:WorkspaceProps['onLifecycle']}){
  const [reason,setReason]=useState('');
  return <div className="lifecycle-form"><label>Lifecycle reason<input maxLength={500} value={reason}
    onChange={event=>setReason(event.target.value)}/></label><div className="button-row">
    {status==='DRAFT'&&<button type="button" disabled={publishBlocked} title={publishBlocked?'Resolve calendar readiness blockers before publication':undefined} onClick={()=>void onLifecycle('publish',reason)}>Publish calendar</button>}
    {status==='PUBLISHED'&&<><button type="button" onClick={()=>void onLifecycle('amend')}>Start amendment</button>
      <button type="button" disabled={!reason.trim()} onClick={()=>void onLifecycle('retire',reason)}>Retire calendar</button></>}
  </div></div>;
}
function PeriodTable({periods,calendar,year}:{periods:PayPeriod[];calendar:PayrollCalendar;year:number}){
  if(periods.length===0)return <p>No periods are available for {year}.</p>;
  return <div className="table-scroll"><table><caption>{calendar.name} periods for {year}</caption>
    <thead><tr><th>Period</th><th>Start</th><th>End</th><th>Payment</th><th>Status</th></tr></thead>
    <tbody>{periods.map(period=><tr key={period.id}><td>{period.periodCode}</td><td>{period.periodStart}</td>
      <td>{period.periodEnd}</td><td>{period.paymentDate}</td><td>{period.status}</td></tr>)}</tbody></table></div>;
}
const milestoneColumns=[
  ['Input cutoff','inputCutoffOriginalDate','inputCutoffAdjustedDate'],
  ['Calculation','calculationOriginalDate','calculationAdjustedDate'],
  ['Approval','approvalOriginalDate','approvalAdjustedDate'],
  ['Release','releaseOriginalDate','releaseAdjustedDate'],
  ['Payment','paymentOriginalDate','paymentAdjustedDate']
] as const;
function EvidenceTable({rows}:{rows:PayPeriodOperational[]}){
  if(rows.length===0)return <p>No milestone evidence is available for the selected year.</p>;
  return <div className="table-scroll"><table><thead><tr><th>Period</th>
    {milestoneColumns.map(([label])=><th key={label}>{label} original → adjusted</th>)}</tr></thead>
    <tbody>{rows.map(row=><tr key={row.id}><td>{row.periodCode}</td>{milestoneColumns.map(([label,original,adjusted])=>
      <td key={label}>{row[original]??'—'} → {row[adjusted]??'—'}</td>)}</tr>)}</tbody></table></div>;
}
