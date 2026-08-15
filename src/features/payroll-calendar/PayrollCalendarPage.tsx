import {FormEvent,useCallback,useEffect,useMemo,useState} from 'react';
import {currentPermissions} from '../organisation/organisation-api';
import {
  CalendarAdjustmentPolicy,CalendarHoliday,CalendarHolidayWrite,CalendarMilestoneAnchor,
  CalendarMilestoneRule,CalendarMilestoneRuleWrite,CalendarMilestoneType,CalendarOperational,
  CalendarReadiness,GeneratePeriods,httpPayrollCalendarApi,PayPeriod,PayPeriodOperational,
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
  const [milestoneRules,setMilestoneRules]=useState<CalendarMilestoneRule[]>([]);
  const [holidays,setHolidays]=useState<CalendarHoliday[]>([]);
  const [readiness,setReadiness]=useState<CalendarReadiness|null>(null);
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
      const [periodRows,operationState,evidence,rules,holidayRows,readinessEvidence]=await Promise.all([
        api.periods(calendar.id,targetYear),api.operations(calendar.id),
        api.periodOperations(calendar.id,targetYear),api.milestoneRules(calendar.id),
        api.holidays(calendar.id),api.readiness(calendar.id)
      ]);
      setPeriods(periodRows);setOperations(operationState);setPeriodEvidence(evidence);
      setMilestoneRules(rules);setHolidays(holidayRows);setReadiness(readinessEvidence);
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
      setReadiness(await api.readiness(selected.id));
      setNotice(`${generated.length} periods generated for ${selected.code}.`);
    }catch(exception){setError((exception as Error).message)}
    finally{setLoading(false)}
  }
  async function configureMilestoneRules(rules:CalendarMilestoneRuleWrite[]){
    if(!selected)return;
    setError('');setNotice('');
    try{
      setMilestoneRules(await api.configureMilestoneRules(selected.id,rules));
      setReadiness(await api.readiness(selected.id));setOperations(await api.operations(selected.id));
      setNotice('Complete five-rule milestone configuration saved with version evidence.');
    }catch(exception){setError((exception as Error).message)}
  }
  async function configureHoliday(input:CalendarHolidayWrite){
    if(!selected)return;
    setError('');setNotice('');
    try{
      const configured=await api.configureHoliday(selected.id,input);
      setHolidays(await api.holidays(selected.id));setReadiness(await api.readiness(selected.id));
      setOperations(await api.operations(selected.id));
      setNotice(`${configured.holidayName} saved for ${configured.holidayDate} at version ${configured.versionNo}.`);
    }catch(exception){setError((exception as Error).message)}
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
        setOperations(updated);setReadiness(await api.readiness(selected.id));
        setNotice(`Calendar ${action} action completed.`);
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

    {selected&&operations&&readiness&&<OperationalWorkspace calendar={selected} operations={operations}
      lineage={lineage} periods={periods} evidence={periodEvidence} year={year}
      milestoneRules={milestoneRules} holidays={holidays} readiness={readiness}
      canCreate={canCreate} canGenerate={canGenerate} onYearChange={setYear}
      onReload={()=>loadSelected(selected,year)} onGenerate={generate} onLifecycle={lifecycle}
      onConfigureMilestoneRules={configureMilestoneRules} onConfigureHoliday={configureHoliday}/>}
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
    <p className="permission-note">Weekend policy defaults to Saturday/Sunday. This UI does not invent edit controls: milestone and holiday configuration is submitted only through the merged governed backend contracts.</p>
    <button type="submit">Create calendar</button>
  </form>;
}

type WorkspaceProps={
  calendar:PayrollCalendar;operations:CalendarOperational;lineage:PayrollCalendar[];
  periods:PayPeriod[];evidence:PayPeriodOperational[];year:number;canCreate:boolean;canGenerate:boolean;
  milestoneRules:CalendarMilestoneRule[];holidays:CalendarHoliday[];readiness:CalendarReadiness;
  onYearChange:(year:number)=>void;onReload:()=>Promise<void>;onGenerate:(input:GeneratePeriods)=>Promise<void>;
  onLifecycle:(action:'publish'|'amend'|'retire',reason?:string)=>Promise<void>;
  onConfigureMilestoneRules:(rules:CalendarMilestoneRuleWrite[])=>Promise<void>;
  onConfigureHoliday:(input:CalendarHolidayWrite)=>Promise<void>;
};
function OperationalWorkspace(props:WorkspaceProps){
  const {calendar,operations,lineage,periods,evidence,year,canCreate,canGenerate,milestoneRules,
    holidays,readiness,onYearChange,onReload,onGenerate,onLifecycle,onConfigureMilestoneRules,
    onConfigureHoliday}=props;
  const [paymentDay,setPaymentDay]=useState(31);const [startDate,setStartDate]=useState(`${year}-01-01`);
  const [periodCount,setPeriodCount]=useState(calendar.frequency==='MONTHLY'?12:26);
  const legacyMonthly=calendar.frequency==='MONTHLY'&&!operations.publicationRequired;
  const generationBlocked=!readiness.generationReady;
  const publishBlocked=!readiness.publicationReady;
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
      <h4>Authoritative readiness</h4>
      <div className="action-summary"><span>Calendar lifecycle is {readiness.lifecycleStatus}</span>
        <span>Generation: {readiness.generationReady?'READY':'BLOCKED'}</span>
        <span>Publication: {readiness.publicationReady?'READY':'BLOCKED'}</span>
        <span>Incomplete periods: {readiness.incompletePeriodCount}</span></div>
      {readiness.blockers.length===0?<p className="success">No backend readiness blockers.</p>:
        <ul aria-label="Calendar readiness blockers">{readiness.blockers.map(blocker=><li key={blocker}>{readinessLabel(blocker)}</li>)}</ul>}
      {!operations.publicationRequired&&<p className="permission-note">Legacy compatibility calendar; publication lifecycle is not required.</p>}
      {canCreate&&operations.publicationRequired&&<LifecycleControls status={operations.lifecycleStatus} publishBlocked={publishBlocked} onLifecycle={onLifecycle}/>}
    </div>

    <div className="card"><h3>Version lineage</h3><ol className="timeline">{lineage.map(item=><li key={item.id}>
      <strong>Version {item.calendarVersion}: {item.name}</strong>
      <span>{item.frequency} · {item.timezone}</span>
      <span>{item.supersedesCalendarId?'Successor version':'Original version'}</span>
    </li>)}</ol></div>

    <CalendarConfigurationWorkspace calendar={calendar} rules={milestoneRules} holidays={holidays}
      canCreate={canCreate} mutable={readiness.lifecycleStatus==='DRAFT'}
      onConfigureRules={onConfigureMilestoneRules} onConfigureHoliday={onConfigureHoliday}/>

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
          title={generationBlocked?readiness.blockers.map(readinessLabel).join(' '):undefined}
          onClick={()=>void onGenerate(legacyMonthly?{year,paymentDay}:{startDate,periodCount})}>Generate periods</button>}
      </form>
      {!canGenerate&&<p className="permission-note">Generation requires <code>calendar.period.generate</code>.</p>}
      <PeriodTable periods={periods} calendar={calendar} year={year}/>
    </div>

    <div className="card"><h3>Milestone & working-day adjustment evidence</h3>
      <p>Original and adjusted dates are read from the backend operational evidence. Configuration changes remain separate from immutable period evidence.</p>
      <EvidenceTable rows={evidence}/>
    </div>
  </section>;
}
const readinessLabels:Record<CalendarReadiness['blockers'][number],string>={
  CALENDAR_NOT_DRAFT:'Calendar lifecycle is not DRAFT.',
  MILESTONE_RULE_SET_INCOMPLETE:'Exactly five milestone rules are required.',
  PAY_PERIODS_NOT_GENERATED:'No generated periods are available.',
  PERIOD_MILESTONE_EVIDENCE_INCOMPLETE:'One or more periods lack complete milestone evidence.'
};
const readinessLabel=(blocker:CalendarReadiness['blockers'][number])=>readinessLabels[blocker]??blocker;

const milestoneTypes:CalendarMilestoneType[]=['INPUT_CUTOFF','CALCULATION','APPROVAL','RELEASE','PAYMENT'];
const milestoneDefaults:CalendarMilestoneRuleWrite[]=[
  {milestoneType:'INPUT_CUTOFF',anchorType:'PERIOD_END',offsetDays:-5,adjustmentPolicy:'PREVIOUS_WORKING_DAY'},
  {milestoneType:'CALCULATION',anchorType:'PERIOD_END',offsetDays:-3,adjustmentPolicy:'PREVIOUS_WORKING_DAY'},
  {milestoneType:'APPROVAL',anchorType:'PERIOD_END',offsetDays:-2,adjustmentPolicy:'PREVIOUS_WORKING_DAY'},
  {milestoneType:'RELEASE',anchorType:'PERIOD_END',offsetDays:-1,adjustmentPolicy:'PREVIOUS_WORKING_DAY'},
  {milestoneType:'PAYMENT',anchorType:'PERIOD_END',offsetDays:0,adjustmentPolicy:'PREVIOUS_WORKING_DAY'}
];

function CalendarConfigurationWorkspace({calendar,rules,holidays,canCreate,mutable,onConfigureRules,onConfigureHoliday}:{
  calendar:PayrollCalendar;rules:CalendarMilestoneRule[];holidays:CalendarHoliday[];
  canCreate:boolean;mutable:boolean;
  onConfigureRules:(rules:CalendarMilestoneRuleWrite[])=>Promise<void>;
  onConfigureHoliday:(input:CalendarHolidayWrite)=>Promise<void>;
}){
  return <div className="card" aria-labelledby="calendar-configuration-title">
    <div className="section-heading"><div><h3 id="calendar-configuration-title">Milestones & working days</h3>
      <p>Complete five-rule schedule and holiday corrections for {calendar.code}.</p></div>
      <span className="count-badge">{rules.length}/5 rules · {holidays.length} holidays</span></div>
    <MilestoneRuleTable rules={rules}/><HolidayTable holidays={holidays}/>
    {canCreate&&mutable?<><MilestoneRuleForm existing={rules} onSave={onConfigureRules}/>
      <HolidayForm onSave={onConfigureHoliday}/></>:<p className="permission-note">
      {!canCreate?'Configuration requires calendar.create.':'Configuration is locked because the calendar is not DRAFT.'}</p>}
  </div>;
}

function MilestoneRuleTable({rules}:{rules:CalendarMilestoneRule[]}){
  if(rules.length===0)return <p>No milestone rules are configured.</p>;
  return <div className="table-scroll"><table aria-label="Calendar milestone rules"><thead><tr>
    <th>Milestone</th><th>Anchor</th><th>Offset</th><th>Working-day policy</th><th>Version</th>
  </tr></thead><tbody>{rules.map(rule=><tr key={rule.id}><td>{rule.milestoneType}</td>
    <td>{rule.anchorType}</td><td>{rule.offsetDays}</td><td>{rule.adjustmentPolicy}</td>
    <td>v{rule.versionNo}</td></tr>)}</tbody></table></div>;
}

function MilestoneRuleForm({existing,onSave}:{existing:CalendarMilestoneRule[];
  onSave:(rules:CalendarMilestoneRuleWrite[])=>Promise<void>}){
  const [rules,setRules]=useState<CalendarMilestoneRuleWrite[]>(()=>ruleDrafts(existing));
  useEffect(()=>setRules(ruleDrafts(existing)),[existing]);
  function update(index:number,change:Partial<CalendarMilestoneRuleWrite>){
    setRules(current=>current.map((rule,position)=>position===index?{...rule,...change}:rule));
  }
  return <form className="lifecycle-form" aria-label="Configure calendar milestone rules"
    onSubmit={event=>{event.preventDefault();void onSave(rules)}}>
    <h4>Complete milestone rule set</h4>
    <div className="table-scroll"><table><thead><tr><th>Milestone</th><th>Anchor</th><th>Offset days</th>
      <th>Adjustment</th></tr></thead><tbody>{milestoneTypes.map((type,index)=><tr key={type}>
      <td><label>{type.replaceAll('_',' ')}<input type="hidden" value={type}/></label></td>
      <td><label><span className="visually-hidden">{type} anchor</span><select aria-label={`${type} anchor`}
        value={rules[index].anchorType} onChange={event=>update(index,{anchorType:event.target.value as CalendarMilestoneAnchor})}>
        <option value="PERIOD_START">PERIOD START</option><option value="PERIOD_END">PERIOD END</option></select></label></td>
      <td><label><span className="visually-hidden">{type} offset days</span><input aria-label={`${type} offset days`}
        required type="number" min={-366} max={366} value={rules[index].offsetDays}
        onChange={event=>update(index,{offsetDays:Number(event.target.value)})}/></label></td>
      <td><label><span className="visually-hidden">{type} adjustment policy</span><select
        aria-label={`${type} adjustment policy`} value={rules[index].adjustmentPolicy}
        onChange={event=>update(index,{adjustmentPolicy:event.target.value as CalendarAdjustmentPolicy})}>
        <option value="NONE">NONE</option><option value="PREVIOUS_WORKING_DAY">PREVIOUS WORKING DAY</option>
        <option value="NEXT_WORKING_DAY">NEXT WORKING DAY</option></select></label></td>
    </tr>)}</tbody></table></div><button type="submit">Save five milestone rules</button>
  </form>;
}

function ruleDrafts(existing:CalendarMilestoneRule[]){
  return milestoneDefaults.map(fallback=>{
    const stored=existing.find(rule=>rule.milestoneType===fallback.milestoneType);
    return stored?{milestoneType:stored.milestoneType,anchorType:stored.anchorType,
      offsetDays:stored.offsetDays,adjustmentPolicy:stored.adjustmentPolicy}:fallback;
  });
}

function HolidayTable({holidays}:{holidays:CalendarHoliday[]}){
  if(holidays.length===0)return <p>No holiday or working-day exceptions are configured.</p>;
  return <div className="table-scroll"><table aria-label="Calendar holidays"><thead><tr>
    <th>Date</th><th>Name</th><th>Version</th></tr></thead><tbody>{holidays.map(holiday=><tr
      key={holiday.id}><td>{holiday.holidayDate}</td><td>{holiday.holidayName}</td>
      <td>v{holiday.versionNo}</td></tr>)}</tbody></table></div>;
}

function HolidayForm({onSave}:{onSave:(input:CalendarHolidayWrite)=>Promise<void>}){
  const [holidayDate,setHolidayDate]=useState('');const [holidayName,setHolidayName]=useState('');
  return <form className="form-grid lifecycle-form" aria-label="Add or correct calendar holiday"
    onSubmit={event=>{event.preventDefault();void onSave({holidayDate,holidayName})}}>
    <h4>Add or correct holiday</h4><label>Holiday date<input required type="date" value={holidayDate}
      onChange={event=>setHolidayDate(event.target.value)}/></label>
    <label>Holiday name<input required maxLength={160} value={holidayName}
      onChange={event=>setHolidayName(event.target.value)}/></label>
    <button type="submit">Save holiday</button>
    <p className="permission-note">Saving the same date performs a governed correction and advances its version.</p>
  </form>;
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
