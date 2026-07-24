import {FormEvent,useCallback,useEffect,useMemo,useState} from 'react';
import {Link} from 'react-router-dom';
import {currentPermissions} from '../organisation/organisation-api';
import {
  httpPayrollExecutionApi,
  PayrollCalculationRequestView,
  PayrollCycleView,
  PayrollExecutionApi,
  PayrollInputSnapshotView,
  PayrollResultSummaryView,
  PopulationMemberView
} from './payroll-execution-api';

type Props={api?:PayrollExecutionApi;permissions?:Set<string>};

export function PayrollExecutionPage({
  api=httpPayrollExecutionApi,
  permissions
}:Props){
  const effectivePermissions=useMemo(()=>permissions??currentPermissions(),[permissions]);
  const [cycles,setCycles]=useState<PayrollCycleView[]>([]);
  const [cycle,setCycle]=useState<PayrollCycleView|null>(null);
  const [population,setPopulation]=useState<PopulationMemberView[]>([]);
  const [snapshots,setSnapshots]=useState<PayrollInputSnapshotView[]>([]);
  const [requests,setRequests]=useState<PayrollCalculationRequestView[]>([]);
  const [results,setResults]=useState<PayrollResultSummaryView[]>([]);
  const [loading,setLoading]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [success,setSuccess]=useState('');
  const [reason,setReason]=useState('');

  const canRead=effectivePermissions.has('payroll-cycle.read');
  const canReadInputs=effectivePermissions.has('payroll-cycle.inputs.read');
  const canReadResults=effectivePermissions.has('payroll-result.read');

  const loadCycles=useCallback(async()=>{
    if(!canRead)return;
    setLoading(true);setError('');
    try{
      const values=await api.listCycles();
      setCycles(values);
      setCycle(current=>{
        if(!current)return null;
        return values.find(value=>value.id===current.id)??current;
      });
    }catch(value){setError((value as Error).message)}
    finally{setLoading(false)}
  },[api,canRead]);

  useEffect(()=>{void loadCycles()},[loadCycles]);

  async function loadCycle(cycleId:string){
    setLoading(true);setError('');
    try{
      const [selected,members,inputSnapshots,calculationRequests,payrollResults]=await Promise.all([
        api.getCycle(cycleId),
        api.population(cycleId),
        canReadInputs?api.snapshots(cycleId):Promise.resolve([]),
        canReadResults?api.calculationRequests(cycleId):Promise.resolve([]),
        canReadResults?api.results(cycleId):Promise.resolve([])
      ]);
      setCycle(selected);
      setPopulation(members);
      setSnapshots(inputSnapshots);
      setRequests(calculationRequests);
      setResults(payrollResults);
      setCycles(current=>current.map(value=>value.id===selected.id?selected:value));
    }catch(value){setError((value as Error).message)}
    finally{setLoading(false)}
  }

  async function perform(message:string,work:()=>Promise<void>){
    setBusy(true);setError('');setSuccess('');
    try{
      await work();
      setSuccess(message);
    }catch(value){setError((value as Error).message)}
    finally{setBusy(false)}
  }

  async function createCycle(payGroupVersionId:string,payPeriodId:string){
    await perform('Payroll cycle created',async()=>{
      const created=await api.createCycle(payGroupVersionId,payPeriodId);
      await loadCycles();
      await loadCycle(created.id);
    });
  }

  async function resolvePopulation(){
    if(!cycle)return;
    await perform('Payroll population resolved',async()=>{
      await api.resolvePopulation(cycle.id,cycle.versionNo);
      await loadCycle(cycle.id);
    });
  }

  async function sealInputs(){
    if(!cycle)return;
    await perform('Payroll inputs sealed',async()=>{
      await api.sealInputs(cycle.id,cycle.versionNo);
      await loadCycle(cycle.id);
    });
  }

  async function calculate(){
    if(!cycle)return;
    await perform('Payroll calculation completed',async()=>{
      await api.calculate(cycle.id,cycle.versionNo);
      await loadCycle(cycle.id);
    });
  }

  async function recalculate(event:FormEvent){
    event.preventDefault();
    if(!cycle)return;
    const trimmed=reason.trim();
    if(trimmed.length<8||trimmed.length>500){
      setError('Recalculation reason must contain between 8 and 500 characters');
      return;
    }
    await perform('Payroll recalculation completed',async()=>{
      await api.recalculate(cycle.id,cycle.versionNo,trimmed);
      setReason('');
      await loadCycle(cycle.id);
    });
  }

  if(!canRead)return <section className="card" aria-labelledby="payroll-execution-title">
    <h2 id="payroll-execution-title">Payroll execution</h2>
    <p role="alert">You do not have permission to view payroll cycles.</p>
  </section>;

  return <section aria-labelledby="payroll-execution-title">
    <div className="page-heading">
      <div>
        <p className="eyebrow">Sprint 3 controlled execution</p>
        <h2 id="payroll-execution-title">Payroll execution</h2>
        <p>Resolve the population, seal immutable inputs, calculate payroll and inspect every persisted attempt.</p>
      </div>
      <button disabled={loading} onClick={()=>void loadCycles()}>Refresh cycles</button>
    </div>
    {loading&&<p role="status">Loading payroll execution data...</p>}
    {error&&<p className="error" role="alert">{error}</p>}
    {success&&<p className="success" role="status">{success}</p>}

    <div className="payroll-execution-layout">
      <div>
        <section className="card">
          <div className="section-heading">
            <h3>Payroll cycles</h3>
            <span className="count-badge">{cycles.length}</span>
          </div>
          {cycles.length===0
            ?<p className="empty compact">No payroll cycles exist yet.</p>
            :<div className="cycle-list">{cycles.map(item=><button
                key={item.id}
                className={`cycle-item ${cycle?.id===item.id?'selected':''}`}
                onClick={()=>void loadCycle(item.id)}>
                <span><strong>{item.periodCode}</strong><small>{item.payGroupCode} · {item.cycleType}</small></span>
                <span><strong>{item.status.replaceAll('_',' ')}</strong><small>Version {item.versionNo}</small></span>
              </button>)}</div>}
        </section>
        {effectivePermissions.has('payroll-cycle.create')
          ?<CreateCycleForm disabled={busy} onSubmit={createCycle}/>
          :<p className="permission-note">Cycle creation requires <code>payroll-cycle.create</code>.</p>}
      </div>

      <div>
        {!cycle&&<section className="card empty">
          <h3>Select a payroll cycle</h3>
          <p>The controlled execution workspace opens after a cycle is selected or created.</p>
        </section>}
        {cycle&&<>
          <CycleSummary cycle={cycle}/>
          <ExecutionActions
            cycle={cycle}
            permissions={effectivePermissions}
            busy={busy}
            reason={reason}
            setReason={setReason}
            onResolve={resolvePopulation}
            onSeal={sealInputs}
            onCalculate={calculate}
            onRecalculate={recalculate}/>
          <PopulationTable items={population}/>
          {canReadInputs
            ?<SnapshotTable items={snapshots}/>
            :<p className="permission-note">Input snapshots require <code>payroll-cycle.inputs.read</code>.</p>}
          {canReadResults?<>
            <CalculationHistory items={requests}/>
            <ResultTable cycleId={cycle.id} items={results}/>
          </>:<p className="permission-note">Calculation history and results require <code>payroll-result.read</code>.</p>}
        </>}
      </div>
    </div>
  </section>;
}

function CreateCycleForm({disabled,onSubmit}:{
  disabled:boolean;
  onSubmit:(payGroupVersionId:string,payPeriodId:string)=>Promise<void>;
}){
  const [payGroupVersionId,setPayGroupVersionId]=useState('');
  const [payPeriodId,setPayPeriodId]=useState('');
  async function submit(event:FormEvent){
    event.preventDefault();
    await onSubmit(payGroupVersionId,payPeriodId);
  }
  return <form className="card form-grid" onSubmit={event=>void submit(event)}>
    <h3>Create regular payroll cycle</h3>
    <label>Pay-group version ID<input required value={payGroupVersionId} onChange={event=>setPayGroupVersionId(event.target.value)}/></label>
    <label>Pay-period ID<input required value={payPeriodId} onChange={event=>setPayPeriodId(event.target.value)}/></label>
    <button disabled={disabled} type="submit">Create payroll cycle</button>
  </form>;
}

function CycleSummary({cycle}:{cycle:PayrollCycleView}){
  return <section className="card">
    <div className="section-heading">
      <h3>{cycle.payGroupName} · {cycle.periodCode}</h3>
      <StatusBadge value={cycle.status}/>
    </div>
    <dl className="summary-grid execution-summary">
      <div><dt>Period</dt><dd>{cycle.periodStart} to {cycle.periodEnd}</dd></div>
      <div><dt>Payment date</dt><dd>{cycle.paymentDate}</dd></div>
      <div><dt>Version</dt><dd>{cycle.versionNo}</dd></div>
      <div><dt>Population resolution</dt><dd>{shortHash(cycle.activePopulationResolutionId)}</dd></div>
      <div><dt>Snapshots</dt><dd>{cycle.inputSnapshotCount??0}</dd></div>
      <div><dt>Control total</dt><dd>{cycle.controlTotal===null?'—':money(cycle.controlTotal,'INR')}</dd></div>
    </dl>
    {cycle.inputSnapshotSetHash&&<p className="hash-line"><strong>Input set hash</strong><code>{cycle.inputSnapshotSetHash}</code></p>}
  </section>;
}

function ExecutionActions({cycle,permissions,busy,reason,setReason,onResolve,onSeal,onCalculate,onRecalculate}:{
  cycle:PayrollCycleView;
  permissions:Set<string>;
  busy:boolean;
  reason:string;
  setReason:(value:string)=>void;
  onResolve:()=>Promise<void>;
  onSeal:()=>Promise<void>;
  onCalculate:()=>Promise<void>;
  onRecalculate:(event:FormEvent)=>Promise<void>;
}){
  const resolveAllowed=['DRAFT','POPULATION_RESOLVED'].includes(cycle.status);
  return <section className="card">
    <div className="section-heading"><h3>Controlled actions</h3><span>Current version {cycle.versionNo}</span></div>
    <div className="execution-actions">
      {permissions.has('payroll-cycle.population.resolve')&&<button
        disabled={busy||!resolveAllowed}
        onClick={()=>void onResolve()}>Resolve population</button>}
      {permissions.has('payroll-cycle.inputs.seal')&&<button
        disabled={busy||cycle.status!=='POPULATION_RESOLVED'}
        onClick={()=>void onSeal()}>Seal immutable inputs</button>}
      {permissions.has('payroll-calculation.execute')&&<button
        disabled={busy||cycle.status!=='INPUTS_SEALED'}
        onClick={()=>void onCalculate()}>Calculate payroll</button>}
    </div>
    {cycle.status==='CALCULATED'&&permissions.has('payroll-calculation.recalculate')&&<form
      className="recalculation-form"
      onSubmit={event=>void onRecalculate(event)}>
      <label>Controlled recalculation reason
        <textarea
          required
          minLength={8}
          maxLength={500}
          value={reason}
          onChange={event=>setReason(event.target.value)}
          placeholder="Explain why a new immutable calculation attempt is required."/>
      </label>
      <button disabled={busy} type="submit">Recalculate payroll</button>
    </form>}
  </section>;
}

function PopulationTable({items}:{items:PopulationMemberView[]}){
  return <section className="card">
    <div className="section-heading"><h3>Active population</h3><span className="count-badge">{items.length}</span></div>
    {items.length===0?<p className="empty compact">No included employees are recorded for the active resolution.</p>
      :<div className="table-scroll"><table>
        <thead><tr><th>Employee</th><th>Assignment</th><th>Status</th><th>Evidence</th></tr></thead>
        <tbody>{items.map(item=><tr key={item.id}>
          <td>{item.employeeNumber}</td><td>{item.assignmentNumber}</td>
          <td><StatusBadge value={item.status}/></td><td>{item.inclusionReason}</td>
        </tr>)}</tbody>
      </table></div>}
  </section>;
}

function SnapshotTable({items}:{items:PayrollInputSnapshotView[]}){
  return <section className="card">
    <div className="section-heading"><h3>Immutable input snapshots</h3><span className="count-badge">{items.length}</span></div>
    {items.length===0?<p className="empty compact">Inputs have not been sealed.</p>
      :<div className="table-scroll"><table>
        <thead><tr><th>Employee</th><th>Assignment</th><th>Schema</th><th>Hash</th><th>Sealed</th></tr></thead>
        <tbody>{items.map(item=><tr key={item.id}>
          <td>{item.employeeNumber}</td><td>{item.assignmentNumber}</td><td>{item.payloadSchemaVersion}</td>
          <td><code title={item.snapshotHash}>{shortHash(item.snapshotHash)}</code></td>
          <td>{dateTime(item.sealedAt)} by {item.sealedBy}</td>
        </tr>)}</tbody>
      </table></div>}
  </section>;
}

function CalculationHistory({items}:{items:PayrollCalculationRequestView[]}){
  return <section className="card">
    <div className="section-heading"><h3>Calculation attempts</h3><span className="count-badge">{items.length}</span></div>
    {items.length===0?<p className="empty compact">Payroll has not been calculated.</p>
      :<div className="table-scroll"><table>
        <thead><tr><th>Attempt</th><th>Kind</th><th>Status</th><th>Reason</th><th>Results</th><th>Net total</th></tr></thead>
        <tbody>{items.map(item=><tr key={item.id}>
          <td>{item.attemptNo}</td><td>{item.calculationKind}</td><td><StatusBadge value={item.status}/></td>
          <td>{item.recalculationReason??'Initial calculation'}</td><td>{item.resultCount??'—'}</td>
          <td className="money">{item.netTotal===null?'—':money(item.netTotal,'INR')}</td>
        </tr>)}</tbody>
      </table></div>}
  </section>;
}

function ResultTable({cycleId,items}:{cycleId:string;items:PayrollResultSummaryView[]}){
  return <section className="card">
    <div className="section-heading"><h3>Persisted payroll results</h3><span className="count-badge">{items.length}</span></div>
    {items.length===0?<p className="empty compact">No payroll results exist.</p>
      :<div className="table-scroll"><table>
        <thead><tr><th>Employee</th><th>Assignment</th><th>Calculated</th><th className="money">Gross</th><th className="money">Deductions</th><th className="money">Net</th><th>Draft payslip</th></tr></thead>
        <tbody>{items.map(item=><tr key={item.id}>
          <td>{item.employeeNumber}</td><td>{item.assignmentNumber}</td><td>{dateTime(item.calculatedAt)}</td>
          <td className="money">{money(item.grossAmount,item.currency)}</td>
          <td className="money">{money(item.deductionAmount,item.currency)}</td>
          <td className="money">{money(item.netAmount,item.currency)}</td>
          <td><Link className="text-link" to={`/draft-payslip?cycleId=${encodeURIComponent(cycleId)}&resultId=${encodeURIComponent(item.id)}`}>View</Link></td>
        </tr>)}</tbody>
      </table></div>}
  </section>;
}

function StatusBadge({value}:{value:string}){
  return <span className={`badge ${value.toLowerCase().replaceAll('_','-')}`}>{value.replaceAll('_',' ')}</span>;
}

function shortHash(value:string|null){
  if(!value)return '—';
  return value.length>16?`${value.slice(0,8)}…${value.slice(-8)}`:value;
}

function money(value:number,currency:string){
  return new Intl.NumberFormat('en-IN',{
    style:'currency',
    currency,
    minimumFractionDigits:2,
    maximumFractionDigits:2
  }).format(value);
}

function dateTime(value:string){
  return new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
}
