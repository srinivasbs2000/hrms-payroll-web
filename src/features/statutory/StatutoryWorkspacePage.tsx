import {
  FormEvent,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState
} from 'react';
import {currentPermissions} from '../organisation/organisation-api';
import type {
  PayrollCalculationRequestView,
  PayrollCycleView
} from '../payroll-execution/payroll-execution-api';
import {
  httpStatutoryApi,
  StatutoryApi,
  StatutoryBalanceSnapshotView,
  StatutoryEvaluationRequestView,
  StatutoryLedgerBatchView,
  StatutoryLedgerEntryView,
  StatutoryReconciliationView,
  StatutoryRemittanceSummaryView,
  StatutoryResultView
} from './statutory-api';

type Props={api?:StatutoryApi;permissions?:Set<string>};

const readPermissions=[
  'statutory-evaluation.read',
  'statutory-ledger.read',
  'statutory-balance.read',
  'statutory-reconciliation.read',
  'statutory-remittance.read'
] as const;

export function StatutoryWorkspacePage({
  api=httpStatutoryApi,
  permissions
}:Props){
  const effectivePermissions=useMemo(
    ()=>permissions??currentPermissions(),
    [permissions]
  );
  const [cycles,setCycles]=useState<PayrollCycleView[]>([]);
  const [cycle,setCycle]=useState<PayrollCycleView|null>(null);
  const [calculationRequests,setCalculationRequests]=
    useState<PayrollCalculationRequestView[]>([]);
  const [evaluations,setEvaluations]=
    useState<StatutoryEvaluationRequestView[]>([]);
  const [results,setResults]=useState<StatutoryResultView[]>([]);
  const [batches,setBatches]=useState<StatutoryLedgerBatchView[]>([]);
  const [entries,setEntries]=useState<StatutoryLedgerEntryView[]>([]);
  const [balances,setBalances]=useState<StatutoryBalanceSnapshotView[]>([]);
  const [reconciliations,setReconciliations]=
    useState<StatutoryReconciliationView[]>([]);
  const [remittances,setRemittances]=
    useState<StatutoryRemittanceSummaryView[]>([]);
  const [calculationRequestId,setCalculationRequestId]=useState('');
  const [evaluationRequestId,setEvaluationRequestId]=useState('');
  const [statutoryResultId,setStatutoryResultId]=useState('');
  const [employeeDelta,setEmployeeDelta]=useState('0');
  const [employerDelta,setEmployerDelta]=useState('0');
  const [reason,setReason]=useState('');
  const [loading,setLoading]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [success,setSuccess]=useState('');

  const canReadCycles=effectivePermissions.has('payroll-cycle.read');
  const hasStatutoryRead=readPermissions.some(permission=>
    effectivePermissions.has(permission)
  );

  const loadCycles=useCallback(async()=>{
    if(!canReadCycles)return;
    setLoading(true);
    setError('');
    try{
      const values=await api.listCycles();
      setCycles(values);
      setCycle(current=>{
        if(!current)return null;
        return values.find(value=>value.id===current.id)??current;
      });
    }catch(value){
      setError((value as Error).message);
    }finally{
      setLoading(false);
    }
  },[api,canReadCycles]);

  useEffect(()=>{void loadCycles()},[loadCycles]);

  async function loadCycle(cycleId:string){
    setLoading(true);
    setError('');
    try{
      const canReadCalculations=
        effectivePermissions.has('payroll-result.read');
      const [
        selected,
        calculationValues,
        evaluationValues,
        resultValues,
        batchValues,
        entryValues,
        balanceValues,
        reconciliationValues,
        remittanceValues
      ]=await Promise.all([
        api.getCycle(cycleId),
        canReadCalculations
          ?api.calculationRequests(cycleId)
          :Promise.resolve([]),
        effectivePermissions.has('statutory-evaluation.read')
          ?api.evaluations(cycleId)
          :Promise.resolve([]),
        effectivePermissions.has('statutory-evaluation.read')
          ?api.results(cycleId)
          :Promise.resolve([]),
        effectivePermissions.has('statutory-ledger.read')
          ?api.ledgerBatches(cycleId)
          :Promise.resolve([]),
        effectivePermissions.has('statutory-ledger.read')
          ?api.ledgerEntries(cycleId)
          :Promise.resolve([]),
        effectivePermissions.has('statutory-balance.read')
          ?api.balances(cycleId)
          :Promise.resolve([]),
        effectivePermissions.has('statutory-reconciliation.read')
          ?api.reconciliations(cycleId)
          :Promise.resolve([]),
        effectivePermissions.has('statutory-remittance.read')
          ?api.remittances(cycleId)
          :Promise.resolve([])
      ]);

      setCycle(selected);
      setCalculationRequests(calculationValues);
      setEvaluations(evaluationValues);
      setResults(resultValues);
      setBatches(batchValues);
      setEntries(entryValues);
      setBalances(balanceValues);
      setReconciliations(reconciliationValues);
      setRemittances(remittanceValues);
      setCalculationRequestId(
        calculationValues.find(item=>item.status==='COMPLETED')?.id??''
      );
      const postedEvaluationIds=new Set(
        batchValues
          .filter(item=>item.status==='COMPLETED')
          .map(item=>item.evaluationRequestId)
      );
      setEvaluationRequestId(
        evaluationValues.find(item=>
          item.status==='COMPLETED'&&!postedEvaluationIds.has(item.id)
        )?.id??''
      );
      setStatutoryResultId(resultValues[0]?.id??'');
      setCycles(current=>
        current.map(value=>value.id===selected.id?selected:value)
      );
    }catch(value){
      setError((value as Error).message);
    }finally{
      setLoading(false);
    }
  }

  async function perform(message:string,work:()=>Promise<void>){
    setBusy(true);
    setError('');
    setSuccess('');
    try{
      await work();
      setSuccess(message);
    }catch(value){
      setError((value as Error).message);
    }finally{
      setBusy(false);
    }
  }

  async function evaluate(event:FormEvent){
    event.preventDefault();
    if(!cycle)return;
    const requestId=calculationRequestId.trim();
    if(!requestId){
      setError('A completed payroll calculation request ID is required');
      return;
    }
    await perform('Statutory evaluation completed',async()=>{
      const execution=await api.evaluate(
        cycle.id,
        cycle.versionNo,
        requestId
      );
      setEvaluationRequestId(execution.evaluationRequestId);
      await loadCycle(cycle.id);
    });
  }

  async function post(event:FormEvent){
    event.preventDefault();
    if(!cycle)return;
    const requestId=evaluationRequestId.trim();
    if(!requestId){
      setError('A completed statutory evaluation request is required');
      return;
    }
    await perform('Statutory ledger posting completed',async()=>{
      await api.post(cycle.id,cycle.versionNo,requestId);
      await loadCycle(cycle.id);
    });
  }

  async function correct(event:FormEvent){
    event.preventDefault();
    if(!cycle)return;
    const resultId=statutoryResultId.trim();
    const trimmedReason=reason.trim();
    const employeeAmount=Number(employeeDelta);
    const employerAmount=Number(employerDelta);

    if(!resultId){
      setError('A statutory result is required for correction');
      return;
    }
    if(
      !Number.isFinite(employeeAmount)||
      !Number.isFinite(employerAmount)||
      (employeeAmount===0&&employerAmount===0)
    ){
      setError('At least one signed correction delta must be non-zero');
      return;
    }
    if(trimmedReason.length<8||trimmedReason.length>500){
      setError('Correction reason must contain between 8 and 500 characters');
      return;
    }

    await perform('Statutory correction posted',async()=>{
      await api.correct(cycle.id,cycle.versionNo,{
        statutoryResultId:resultId,
        employeeAmountDelta:employeeAmount,
        employerAmountDelta:employerAmount,
        reason:trimmedReason
      });
      setEmployeeDelta('0');
      setEmployerDelta('0');
      setReason('');
      await loadCycle(cycle.id);
    });
  }

  if(!canReadCycles){
    return <section className="card" aria-labelledby="statutory-title">
      <h2 id="statutory-title">Statutory execution</h2>
      <p role="alert">
        You do not have permission to read payroll cycles.
      </p>
    </section>;
  }

  if(!hasStatutoryRead){
    return <section className="card" aria-labelledby="statutory-title">
      <h2 id="statutory-title">Statutory execution</h2>
      <p role="alert">
        You do not have a supported statutory evidence read permission.
      </p>
    </section>;
  }

  const latestEvaluation=evaluations.find(
    item=>item.status==='COMPLETED'
  )??null;
  const latestBatch=batches.find(item=>item.status==='COMPLETED')??null;
  const latestReconciliation=reconciliations[0]??null;

  return <section aria-labelledby="statutory-title">
    <div className="page-heading">
      <div>
        <p className="eyebrow">Sprint 4 statutory deductions</p>
        <h2 id="statutory-title">Statutory execution</h2>
        <p>
          Evaluate active payroll evidence, post the statutory ledger,
          record controlled corrections and inspect reconciled balances.
        </p>
      </div>
      <button disabled={loading} onClick={()=>void loadCycles()}>
        Refresh cycles
      </button>
    </div>

    {loading&&<p role="status">Loading statutory execution data...</p>}
    {error&&<p className="error" role="alert">{error}</p>}
    {success&&<p className="success" role="status">{success}</p>}

    <div className="statutory-layout">
      <div>
        <section className="card">
          <div className="section-heading">
            <h3>Payroll cycles</h3>
            <span className="count-badge">{cycles.length}</span>
          </div>
          {cycles.length===0
            ?<p className="empty compact">No payroll cycles exist yet.</p>
            :<div className="cycle-list">
              {cycles.map(item=><button
                key={item.id}
                className={
                  `cycle-item ${cycle?.id===item.id?'selected':''}`
                }
                onClick={()=>void loadCycle(item.id)}
              >
                <span>
                  <strong>{item.periodCode}</strong>
                  <small>{item.payGroupCode} · {item.cycleType}</small>
                </span>
                <span>
                  <strong>{displayStatus(item.status)}</strong>
                  <small>Version {item.versionNo}</small>
                </span>
              </button>)}
            </div>}
        </section>
      </div>

      <div>
        {!cycle&&<section className="card empty">
          <h3>Select a calculated payroll cycle</h3>
          <p>
            Statutory commands and immutable evidence appear after selection.
          </p>
        </section>}

        {cycle&&<>
          <CycleSummary
            cycle={cycle}
            latestEvaluation={latestEvaluation}
            latestBatch={latestBatch}
            latestReconciliation={latestReconciliation}
            currency={
              results[0]?.currency??remittances[0]?.currency??'INR'
            }
          />
          <CommandPanel
            cycle={cycle}
            permissions={effectivePermissions}
            busy={busy}
            calculationRequests={calculationRequests}
            evaluations={evaluations}
            results={results}
            batches={batches}
            calculationRequestId={calculationRequestId}
            setCalculationRequestId={setCalculationRequestId}
            evaluationRequestId={evaluationRequestId}
            setEvaluationRequestId={setEvaluationRequestId}
            statutoryResultId={statutoryResultId}
            setStatutoryResultId={setStatutoryResultId}
            employeeDelta={employeeDelta}
            setEmployeeDelta={setEmployeeDelta}
            employerDelta={employerDelta}
            setEmployerDelta={setEmployerDelta}
            reason={reason}
            setReason={setReason}
            onEvaluate={evaluate}
            onPost={post}
            onCorrect={correct}
          />

          {effectivePermissions.has('statutory-evaluation.read')&&<>
            <EvaluationTable items={evaluations}/>
            <ResultTable items={results}/>
          </>}
          {effectivePermissions.has('statutory-ledger.read')&&<>
            <LedgerBatchTable items={batches}/>
            <LedgerEntryTable items={entries}/>
          </>}
          {effectivePermissions.has('statutory-balance.read')&&
            <BalanceTable items={balances}/>}
          {effectivePermissions.has('statutory-reconciliation.read')&&
            <ReconciliationTable items={reconciliations}/>}
          {effectivePermissions.has('statutory-remittance.read')&&
            <RemittanceTable items={remittances}/>}
        </>}
      </div>
    </div>
  </section>;
}

function CycleSummary({
  cycle,
  latestEvaluation,
  latestBatch,
  latestReconciliation,
  currency
}:{
  cycle:PayrollCycleView;
  latestEvaluation:StatutoryEvaluationRequestView|null;
  latestBatch:StatutoryLedgerBatchView|null;
  latestReconciliation:StatutoryReconciliationView|null;
  currency:string;
}){
  return <section className="card">
    <div className="section-heading">
      <h3>{cycle.payGroupName} · {cycle.periodCode}</h3>
      <StatusBadge value={cycle.status}/>
    </div>
    <dl className="summary-grid statutory-summary">
      <div>
        <dt>Cycle version</dt>
        <dd>{cycle.versionNo}</dd>
      </div>
      <div>
        <dt>Evaluation</dt>
        <dd>{latestEvaluation?.status??'Not evaluated'}</dd>
      </div>
      <div>
        <dt>Ledger posting</dt>
        <dd>{latestBatch?.status??'Not posted'}</dd>
      </div>
      <div>
        <dt>Employee statutory</dt>
        <dd>{amountOrDash(latestBatch?.cycleEmployeeTotal,currency)}</dd>
      </div>
      <div>
        <dt>Employer liability</dt>
        <dd>{amountOrDash(latestBatch?.cycleEmployerTotal,currency)}</dd>
      </div>
      <div>
        <dt>Reconciliation</dt>
        <dd>{latestReconciliation?.status??'Not available'}</dd>
      </div>
    </dl>
    {latestBatch?.ledgerSetHash&&<HashLine
      label="Ledger set hash"
      value={latestBatch.ledgerSetHash}
    />}
    {latestReconciliation?.reconciliationHash&&<HashLine
      label="Reconciliation hash"
      value={latestReconciliation.reconciliationHash}
    />}
  </section>;
}

function CommandPanel(props:{
  cycle:PayrollCycleView;
  permissions:Set<string>;
  busy:boolean;
  calculationRequests:PayrollCalculationRequestView[];
  evaluations:StatutoryEvaluationRequestView[];
  results:StatutoryResultView[];
  batches:StatutoryLedgerBatchView[];
  calculationRequestId:string;
  setCalculationRequestId:(value:string)=>void;
  evaluationRequestId:string;
  setEvaluationRequestId:(value:string)=>void;
  statutoryResultId:string;
  setStatutoryResultId:(value:string)=>void;
  employeeDelta:string;
  setEmployeeDelta:(value:string)=>void;
  employerDelta:string;
  setEmployerDelta:(value:string)=>void;
  reason:string;
  setReason:(value:string)=>void;
  onEvaluate:(event:FormEvent)=>Promise<void>;
  onPost:(event:FormEvent)=>Promise<void>;
  onCorrect:(event:FormEvent)=>Promise<void>;
}){
  const {
    cycle,
    permissions,
    busy,
    calculationRequests,
    evaluations,
    results,
    batches
  }=props;
  const postedEvaluationIds=new Set(
    batches
      .filter(item=>item.status==='COMPLETED')
      .map(item=>item.evaluationRequestId)
  );
  const completedEvaluations=evaluations.filter(
    item=>item.status==='COMPLETED'&&!postedEvaluationIds.has(item.id)
  );
  const hasCompletedBatch=batches.some(item=>item.status==='COMPLETED');

  return <section className="card">
    <div className="section-heading">
      <h3>Controlled statutory commands</h3>
      <span>Current cycle version {cycle.versionNo}</span>
    </div>
    <div className="statutory-command-grid">
      {permissions.has('statutory-evaluation.execute')
        ?<form onSubmit={event=>void props.onEvaluate(event)}>
          <h4>1. Evaluate</h4>
          <p>
            Evaluate the exact active completed payroll calculation request.
          </p>
          <label>Calculation request ID
            <input
              required
              list="calculation-request-options"
              value={props.calculationRequestId}
              onChange={event=>
                props.setCalculationRequestId(event.target.value)
              }
            />
          </label>
          <datalist id="calculation-request-options">
            {calculationRequests
              .filter(item=>item.status==='COMPLETED')
              .map(item=><option key={item.id} value={item.id}>
                Attempt {item.attemptNo} · {item.calculationKind}
              </option>)}
          </datalist>
          <button
            disabled={busy||cycle.status!=='CALCULATED'}
            type="submit"
          >
            Evaluate statutory deductions
          </button>
        </form>
        :<PermissionNote permission="statutory-evaluation.execute"/>}

      {permissions.has('statutory-ledger.post')
        ?<form onSubmit={event=>void props.onPost(event)}>
          <h4>2. Post ledger</h4>
          <p>
            Post one completed evaluation into immutable statutory evidence.
          </p>
          <label>Evaluation request
            <select
              required
              value={props.evaluationRequestId}
              onChange={event=>
                props.setEvaluationRequestId(event.target.value)
              }
            >
              <option value="">Select completed evaluation</option>
              {completedEvaluations.map(item=><option
                key={item.id}
                value={item.id}
              >
                {shortId(item.id)} · {dateTime(item.completedAt)}
              </option>)}
            </select>
          </label>
          <button
            disabled={
              busy||
              cycle.status!=='CALCULATED'||
              completedEvaluations.length===0
            }
            type="submit"
          >
            Post statutory ledger
          </button>
        </form>
        :<PermissionNote permission="statutory-ledger.post"/>}

      {permissions.has('statutory-ledger.correct')
        ?<form onSubmit={event=>void props.onCorrect(event)}>
          <h4>3. Correct</h4>
          <p>
            Append signed deltas; prior ledger evidence is never edited.
          </p>
          <label>Statutory result
            <select
              required
              value={props.statutoryResultId}
              onChange={event=>
                props.setStatutoryResultId(event.target.value)
              }
            >
              <option value="">Select statutory result</option>
              {results.map(item=><option key={item.id} value={item.id}>
                {shortId(item.statutoryRuleId)} ·
                employee {item.employeeAmount} ·
                employer {item.employerAmount}
              </option>)}
            </select>
          </label>
          <div className="signed-delta-grid">
            <label>Employee delta
              <input
                inputMode="decimal"
                type="number"
                step="0.0001"
                value={props.employeeDelta}
                onChange={event=>props.setEmployeeDelta(event.target.value)}
              />
            </label>
            <label>Employer delta
              <input
                inputMode="decimal"
                type="number"
                step="0.0001"
                value={props.employerDelta}
                onChange={event=>props.setEmployerDelta(event.target.value)}
              />
            </label>
          </div>
          <label>Correction reason
            <textarea
              required
              minLength={8}
              maxLength={500}
              value={props.reason}
              onChange={event=>props.setReason(event.target.value)}
              placeholder="Describe the approved statutory correction."
            />
          </label>
          <button
            disabled={
              busy||cycle.status!=='CALCULATED'||!hasCompletedBatch
            }
            type="submit"
          >
            Post signed correction
          </button>
        </form>
        :<PermissionNote permission="statutory-ledger.correct"/>}
    </div>
  </section>;
}

function EvaluationTable({
  items
}:{items:StatutoryEvaluationRequestView[]}){
  return <EvidenceTable
    heading="Statutory evaluations"
    count={items.length}
    empty="No statutory evaluations exist."
  >
    <table>
      <thead><tr>
        <th>Status</th>
        <th>Engine</th>
        <th>Payroll results</th>
        <th>Statutory results</th>
        <th className="money">Employee</th>
        <th className="money">Employer</th>
        <th className="money">Post-statutory net</th>
        <th>Completed</th>
      </tr></thead>
      <tbody>{items.map(item=><tr key={item.id}>
        <td><StatusBadge value={item.status}/></td>
        <td>{item.engineVersion}</td>
        <td>{item.payrollResultCount??'—'}</td>
        <td>{item.statutoryResultCount??'—'}</td>
        <td className="money">{amountOrDash(item.employeeTotal,'INR')}</td>
        <td className="money">{amountOrDash(item.employerTotal,'INR')}</td>
        <td className="money">
          {amountOrDash(item.postStatutoryNetTotal,'INR')}
        </td>
        <td>{dateTime(item.completedAt)}</td>
      </tr>)}</tbody>
    </table>
  </EvidenceTable>;
}

function ResultTable({items}:{items:StatutoryResultView[]}){
  return <EvidenceTable
    heading="Statutory results"
    count={items.length}
    empty="No statutory result evidence exists."
  >
    <table>
      <thead><tr>
        <th>Rule</th>
        <th>Payroll result</th>
        <th className="money">Employee</th>
        <th className="money">Employer</th>
        <th>Hash</th>
        <th>Created</th>
      </tr></thead>
      <tbody>{items.map(item=><tr key={item.id}>
        <td><code title={item.statutoryRuleId}>
          {shortId(item.statutoryRuleId)}
        </code></td>
        <td><code title={item.payrollResultId}>
          {shortId(item.payrollResultId)}
        </code></td>
        <td className="money">{money(item.employeeAmount,item.currency)}</td>
        <td className="money">{money(item.employerAmount,item.currency)}</td>
        <td><code title={item.resultHash}>{shortHash(item.resultHash)}</code></td>
        <td>{dateTime(item.createdAt)}</td>
      </tr>)}</tbody>
    </table>
  </EvidenceTable>;
}

function LedgerBatchTable({items}:{items:StatutoryLedgerBatchView[]}){
  return <EvidenceTable
    heading="Ledger batches"
    count={items.length}
    empty="No statutory ledger batch has been posted."
  >
    <table>
      <thead><tr>
        <th>Attempt</th>
        <th>Kind</th>
        <th>Status</th>
        <th>Entries</th>
        <th className="money">Employee delta</th>
        <th className="money">Employer delta</th>
        <th className="money">Cycle employee</th>
        <th className="money">Cycle employer</th>
      </tr></thead>
      <tbody>{items.map(item=><tr key={item.id}>
        <td>{item.attemptNo}</td>
        <td>{displayStatus(item.batchKind)}</td>
        <td><StatusBadge value={item.status}/></td>
        <td>{item.entryCount??'—'}</td>
        <td className="money">
          {amountOrDash(item.employeeDeltaTotal,'INR')}
        </td>
        <td className="money">
          {amountOrDash(item.employerDeltaTotal,'INR')}
        </td>
        <td className="money">
          {amountOrDash(item.cycleEmployeeTotal,'INR')}
        </td>
        <td className="money">
          {amountOrDash(item.cycleEmployerTotal,'INR')}
        </td>
      </tr>)}</tbody>
    </table>
  </EvidenceTable>;
}

function LedgerEntryTable({items}:{items:StatutoryLedgerEntryView[]}){
  return <EvidenceTable
    heading="Ledger entries"
    count={items.length}
    empty="No append-only statutory ledger entries exist."
  >
    <table>
      <thead><tr>
        <th>Sequence</th>
        <th>Kind</th>
        <th>Jurisdiction / authority</th>
        <th>Rule</th>
        <th className="money">Employee delta</th>
        <th className="money">Employer delta</th>
        <th>Reason</th>
      </tr></thead>
      <tbody>{items.map(item=><tr key={item.id}>
        <td>{item.sequenceNo}</td>
        <td><StatusBadge value={item.entryKind}/></td>
        <td>{item.jurisdictionCode} / {item.authorityCode}</td>
        <td><code title={item.statutoryRuleId}>
          {shortId(item.statutoryRuleId)}
        </code></td>
        <td className="money">
          {money(item.employeeAmountDelta,item.currency)}
        </td>
        <td className="money">
          {money(item.employerAmountDelta,item.currency)}
        </td>
        <td>{item.reasonDetail??displayStatus(item.reasonCode)}</td>
      </tr>)}</tbody>
    </table>
  </EvidenceTable>;
}

function BalanceTable({items}:{items:StatutoryBalanceSnapshotView[]}){
  return <EvidenceTable
    heading="PTD and YTD balances"
    count={items.length}
    empty="No statutory balance snapshots exist."
  >
    <table>
      <thead><tr>
        <th>Authority</th>
        <th>Rule</th>
        <th className="money">PTD employee</th>
        <th className="money">PTD employer</th>
        <th className="money">YTD employee</th>
        <th className="money">YTD employer</th>
      </tr></thead>
      <tbody>{items.map(item=><tr key={item.id}>
        <td>{item.jurisdictionCode} / {item.authorityCode}</td>
        <td><code title={item.statutoryRuleId}>
          {shortId(item.statutoryRuleId)}
        </code></td>
        <td className="money">
          {money(item.periodEmployeeAmount,item.currency)}
        </td>
        <td className="money">
          {money(item.periodEmployerAmount,item.currency)}
        </td>
        <td className="money">
          {money(item.yearEmployeeAmount,item.currency)}
        </td>
        <td className="money">
          {money(item.yearEmployerAmount,item.currency)}
        </td>
      </tr>)}</tbody>
    </table>
  </EvidenceTable>;
}

function ReconciliationTable({
  items
}:{items:StatutoryReconciliationView[]}){
  return <EvidenceTable
    heading="Reconciliation"
    count={items.length}
    empty="No statutory reconciliation evidence exists."
  >
    <table>
      <thead><tr>
        <th>Status</th>
        <th className="money">Expected employee</th>
        <th className="money">Ledger employee</th>
        <th className="money">Employee variance</th>
        <th className="money">Expected employer</th>
        <th className="money">Ledger employer</th>
        <th className="money">Employer variance</th>
      </tr></thead>
      <tbody>{items.map(item=><tr key={item.id}>
        <td><StatusBadge value={item.status}/></td>
        <td className="money">
          {money(item.expectedEmployeeTotal,item.currency)}
        </td>
        <td className="money">
          {money(item.ledgerEmployeeTotal,item.currency)}
        </td>
        <td className="money">
          {money(item.employeeVariance,item.currency)}
        </td>
        <td className="money">
          {money(item.expectedEmployerTotal,item.currency)}
        </td>
        <td className="money">
          {money(item.ledgerEmployerTotal,item.currency)}
        </td>
        <td className="money">
          {money(item.employerVariance,item.currency)}
        </td>
      </tr>)}</tbody>
    </table>
  </EvidenceTable>;
}

function RemittanceTable({
  items
}:{items:StatutoryRemittanceSummaryView[]}){
  return <EvidenceTable
    heading="Remittance preparation"
    count={items.length}
    empty="No remittance-ready summaries exist."
  >
    <table>
      <thead><tr>
        <th>Authority</th>
        <th>Rule</th>
        <th className="money">Period employee</th>
        <th className="money">Period employer</th>
        <th className="money">YTD employee</th>
        <th className="money">YTD employer</th>
        <th className="money">Remittance</th>
        <th>Position</th>
      </tr></thead>
      <tbody>{items.map(item=><tr key={item.id}>
        <td>{item.jurisdictionCode} / {item.authorityCode}</td>
        <td><code title={item.statutoryRuleId}>
          {shortId(item.statutoryRuleId)}
        </code></td>
        <td className="money">
          {money(item.periodEmployeeTotal,item.currency)}
        </td>
        <td className="money">
          {money(item.periodEmployerTotal,item.currency)}
        </td>
        <td className="money">
          {money(item.yearEmployeeTotal,item.currency)}
        </td>
        <td className="money">
          {money(item.yearEmployerTotal,item.currency)}
        </td>
        <td className="money">
          {money(item.remittanceAmount,item.currency)}
        </td>
        <td><StatusBadge value={item.remittancePosition}/></td>
      </tr>)}</tbody>
    </table>
  </EvidenceTable>;
}

function EvidenceTable({
  heading,
  count,
  empty,
  children
}:{
  heading:string;
  count:number;
  empty:string;
  children:ReactNode;
}){
  return <section className="card">
    <div className="section-heading">
      <h3>{heading}</h3>
      <span className="count-badge">{count}</span>
    </div>
    {count===0
      ?<p className="empty compact">{empty}</p>
      :<div className="table-scroll">{children}</div>}
  </section>;
}

function PermissionNote({permission}:{permission:string}){
  return <div className="permission-note statutory-permission">
    Command requires <code>{permission}</code>.
  </div>;
}

function HashLine({label,value}:{label:string;value:string}){
  return <p className="hash-line">
    <strong>{label}</strong>
    <code>{value}</code>
  </p>;
}

function StatusBadge({value}:{value:string}){
  const className=value.toLowerCase().replaceAll('_','-');
  return <span className={`badge ${className}`}>
    {displayStatus(value)}
  </span>;
}

function displayStatus(value:string){
  return value.replaceAll('_',' ');
}

function shortId(value:string){
  return value.length>13?`${value.slice(0,8)}…${value.slice(-4)}`:value;
}

function shortHash(value:string){
  return value.length>16?`${value.slice(0,8)}…${value.slice(-8)}`:value;
}

function amountOrDash(
  value:number|null|undefined,
  currency:string
){
  return value===null||value===undefined?'—':money(value,currency);
}

function money(value:number,currency:string){
  return new Intl.NumberFormat('en-IN',{
    style:'currency',
    currency,
    minimumFractionDigits:2,
    maximumFractionDigits:2
  }).format(value);
}

function dateTime(value:string|null){
  if(!value)return '—';
  return new Intl.DateTimeFormat('en-IN',{
    dateStyle:'medium',
    timeStyle:'short'
  }).format(new Date(value));
}
