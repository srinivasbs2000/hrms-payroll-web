import {useEffect,useMemo,useState} from 'react';
import {Link,useSearchParams} from 'react-router-dom';
import {currentPermissions} from '../organisation/organisation-api';
import {
  httpPayrollExecutionApi,
  PayrollCalculationTraceView,
  PayrollExecutionApi,
  PayrollResultDetailView
} from '../payroll-execution/payroll-execution-api';

type Props={
  api?:PayrollExecutionApi;
  permissions?:Set<string>;
  cycleId?:string;
  resultId?:string;
};

export function DraftPayslipPage({
  api=httpPayrollExecutionApi,
  permissions,
  cycleId,
  resultId
}:Props){
  const [searchParams]=useSearchParams();
  const effectivePermissions=useMemo(()=>permissions??currentPermissions(),[permissions]);
  const effectiveCycleId=cycleId??searchParams.get('cycleId')??'';
  const effectiveResultId=resultId??searchParams.get('resultId')??'';
  const [result,setResult]=useState<PayrollResultDetailView|null>(null);
  const [trace,setTrace]=useState<PayrollCalculationTraceView[]>([]);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');

  const canRead=effectivePermissions.has('payroll-result.read');
  const canReadTrace=effectivePermissions.has('payroll-result.trace.read');

  useEffect(()=>{
    if(!canRead||!effectiveCycleId||!effectiveResultId)return;
    let active=true;
    setLoading(true);setError('');
    void Promise.all([
      api.result(effectiveCycleId,effectiveResultId),
      canReadTrace?api.trace(effectiveCycleId,effectiveResultId):Promise.resolve([])
    ]).then(([detail,evidence])=>{
      if(active){setResult(detail);setTrace(evidence)}
    }).catch(value=>{
      if(active)setError((value as Error).message);
    }).finally(()=>{
      if(active)setLoading(false);
    });
    return()=>{active=false};
  },[api,canRead,canReadTrace,effectiveCycleId,effectiveResultId]);

  if(!canRead)return <section className="card" aria-labelledby="draft-payslip-title">
    <h2 id="draft-payslip-title">Draft payslip</h2>
    <p role="alert">You do not have permission to view payroll results.</p>
  </section>;

  if(!effectiveCycleId||!effectiveResultId)return <section className="card empty" aria-labelledby="draft-payslip-title">
    <h2 id="draft-payslip-title">Draft payslip</h2>
    <p>Select a persisted payroll result from the payroll execution workspace.</p>
    <Link className="text-link" to="/payroll-execution">Open payroll execution</Link>
  </section>;

  return <section aria-labelledby="draft-payslip-title">
    <div className="page-heading">
      <div>
        <p className="eyebrow">Persisted calculation evidence</p>
        <h2 id="draft-payslip-title">Draft payslip</h2>
        <p>This preview is generated from the immutable payroll result and component rows.</p>
      </div>
      <Link className="text-link" to="/payroll-execution">Back to payroll execution</Link>
    </div>
    {loading&&<p role="status">Loading persisted draft payslip...</p>}
    {error&&<p className="error" role="alert">{error}</p>}
    {result&&<PayslipDocument result={result}/>}
    {result&&canReadTrace&&<TraceEvidence items={trace}/>}
    {result&&!canReadTrace&&<p className="permission-note">Calculation trace requires <code>payroll-result.trace.read</code>.</p>}
  </section>;
}

function PayslipDocument({result}:{result:PayrollResultDetailView}){
  const earnings=result.components.filter(item=>item.componentType==='EARNING');
  const deductions=result.components.filter(item=>item.componentType==='DEDUCTION');
  return <article className="payslip-document">
    <div className="draft-banner">DRAFT · NOT FOR PAYMENT · NOT A LEGAL PAYSLIP</div>
    <div className="payslip-heading">
      <div><p className="eyebrow">Employee</p><h3>{result.employeeNumber}</h3><p>Assignment {result.assignmentNumber}</p></div>
      <div><p className="eyebrow">Calculated</p><strong>{dateTime(result.calculatedAt)}</strong><p>{result.currency}</p></div>
    </div>
    <dl className="payslip-identifiers">
      <div><dt>Payroll cycle</dt><dd><code>{result.cycleId}</code></dd></div>
      <div><dt>Calculation request</dt><dd><code>{result.calculationRequestId}</code></dd></div>
      <div><dt>Input snapshot</dt><dd><code>{result.inputSnapshotId}</code></dd></div>
      <div><dt>Result status</dt><dd>{result.resultStatus}</dd></div>
    </dl>
    <div className="payslip-columns">
      <ComponentTable title="Earnings" items={earnings}/>
      <ComponentTable title="Deductions" items={deductions}/>
    </div>
    <dl className="payslip-totals">
      <div><dt>Gross earnings</dt><dd>{money(result.grossAmount,result.currency)}</dd></div>
      <div><dt>Total deductions</dt><dd>{money(result.deductionAmount,result.currency)}</dd></div>
      <div className="net-pay"><dt>Net pay</dt><dd>{money(result.netAmount,result.currency)}</dd></div>
    </dl>
    <div className="evidence-block">
      <p><strong>Result hash</strong><code>{result.resultHash}</code></p>
      <p><strong>Input snapshot hash</strong><code>{result.inputSnapshotHash}</code></p>
      <p><strong>Salary structure version</strong><code>{result.salaryStructureVersionId}</code></p>
      <p><strong>Result schema</strong><span>{result.resultSchemaVersion}</span></p>
    </div>
  </article>;
}

function ComponentTable({title,items}:{title:string;items:PayrollResultDetailView['components']}){
  return <section>
    <h4>{title}</h4>
    {items.length===0?<p>None</p>:<table>
      <thead><tr><th>Component</th><th>Formula</th><th className="money">Amount</th></tr></thead>
      <tbody>{items.map(item=><tr key={item.id}>
        <td>{item.componentCode}</td>
        <td>{item.formulaType} · {decimal(item.prorationFactor)}</td>
        <td className="money">{money(item.calculatedAmount,item.currency)}</td>
      </tr>)}</tbody>
    </table>}
  </section>;
}

function TraceEvidence({items}:{items:PayrollCalculationTraceView[]}){
  return <section className="card">
    <div className="section-heading"><h3>Calculation trace</h3><span className="count-badge">{items.length}</span></div>
    {items.length===0?<p className="empty compact">No trace evidence is available.</p>
      :<div className="table-scroll"><table>
        <thead><tr><th>Step</th><th>Component</th><th>Type</th><th>Message</th><th className="money">Output</th><th>Hash</th></tr></thead>
        <tbody>{items.map(item=><tr key={item.id}>
          <td>{item.stepNo}</td><td>{item.componentCode}</td><td>{item.stepType}</td><td>{item.message}</td>
          <td className="money">{decimal(item.outputValue)}</td>
          <td><code title={item.traceHash}>{shortHash(item.traceHash)}</code></td>
        </tr>)}</tbody>
      </table></div>}
  </section>;
}

function money(value:number,currency:string){
  return new Intl.NumberFormat('en-IN',{
    style:'currency',
    currency,
    minimumFractionDigits:2,
    maximumFractionDigits:2
  }).format(value);
}

function decimal(value:number){
  return new Intl.NumberFormat('en-IN',{maximumFractionDigits:10}).format(value);
}

function dateTime(value:string){
  return new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
}

function shortHash(value:string){
  return value.length>16?`${value.slice(0,8)}…${value.slice(-8)}`:value;
}
