import {FormEvent,useEffect,useMemo,useState} from 'react';
import {
  FoundationCycleOption,
  FoundationOwnerKind,
  FoundationReadinessApi,
  FoundationReadinessRequest,
  FoundationReadinessView,
  JurisdictionOption,
  RegistrationTypeOption,
  httpFoundationReadinessApi
} from './foundation-readiness-api';

type Props={
  api?:FoundationReadinessApi;
  permissions?:Set<string>;
};

type RegistrationRequirement=FoundationReadinessRequest['registrations'][number];

const requiredPermissions=[
  'payroll-cycle.read',
  'organisation.banking-readiness.read',
  'statutory-registration.read'
] as const;

function sessionPermissions():Set<string>{
  return new Set(window.payrollSession?.permissions??[]);
}

function cycleLabel(cycle:FoundationCycleOption):string{
  return `${cycle.payGroupName} · ${cycle.periodCode} · ${cycle.status}`;
}

export function FoundationReadinessPage({
  api=httpFoundationReadinessApi,
  permissions
}:Props){
  const effectivePermissions=useMemo(
    ()=>permissions??sessionPermissions(),
    [permissions]
  );
  const missing=requiredPermissions.filter(
    permission=>!effectivePermissions.has(permission)
  );

  const [cycles,setCycles]=useState<FoundationCycleOption[]>([]);
  const [cycleId,setCycleId]=useState('');
  const [types,setTypes]=useState<RegistrationTypeOption[]>([]);
  const [jurisdictions,setJurisdictions]=useState<JurisdictionOption[]>([]);
  const [bankOwnerKind,setBankOwnerKind]=useState<FoundationOwnerKind>('LEGAL_ENTITY');
  const [currency,setCurrency]=useState('INR');
  const [purpose,setPurpose]=useState('PAYROLL_FUNDING');
  const [amount,setAmount]=useState('1000');
  const [registrationTypeId,setRegistrationTypeId]=useState('');
  const [registrationOwnerKind,setRegistrationOwnerKind]=
    useState<FoundationOwnerKind>('PAYROLL_STATUTORY_UNIT');
  const [jurisdictionId,setJurisdictionId]=useState('');
  const [warningDays,setWarningDays]=useState('30');
  const [requirements,setRequirements]=useState<RegistrationRequirement[]>([]);
  const [readiness,setReadiness]=useState<FoundationReadinessView|null>(null);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);

  const selectedCycle=cycles.find(cycle=>cycle.id===cycleId)??null;
  const selectedPeriodEnd=selectedCycle?.periodEnd;

  useEffect(()=>{
    if(missing.length>0)return;
    let active=true;
    void api.listCycles().then(next=>{
      if(!active)return;
      setCycles(next);
      setCycleId(current=>current||next[0]?.id||'');
    }).catch(caught=>{
      if(active)setError((caught as Error).message);
    });
    return ()=>{active=false};
  },[api,missing.length]);

  useEffect(()=>{
    if(!selectedPeriodEnd||missing.length>0)return;
    let active=true;
    Promise.all([
      api.listRegistrationTypes(selectedPeriodEnd),
      api.listJurisdictions(selectedPeriodEnd)
    ]).then(([nextTypes,nextJurisdictions])=>{
      if(!active)return;
      const supportedTypes=nextTypes.filter(
        type=>type.approvalStatus==='APPROVED'
      );
      setTypes(supportedTypes);
      setJurisdictions(nextJurisdictions);
      setRegistrationTypeId(current=>
        supportedTypes.some(type=>type.identityId===current)
          ?current
          :supportedTypes[0]?.identityId??''
      );
      setJurisdictionId(current=>
        nextJurisdictions.some(item=>item.identityId===current)
          ?current
          :nextJurisdictions[0]?.identityId??''
      );
    }).catch(caught=>{
      if(active)setError((caught as Error).message);
    });
    return ()=>{active=false};
  },[api,missing.length,selectedPeriodEnd]);

  if(missing.length>0){
    return <section className="card" aria-labelledby="fsr-title">
      <h2 id="fsr-title">Foundation readiness</h2>
      <p role="alert">This bounded readiness view requires all of: {missing.join(', ')}.</p>
    </section>;
  }

  function addRequirement(){
    if(!registrationTypeId||!jurisdictionId)return;
    const requirement:RegistrationRequirement={
      registrationTypeId,
      ownerKind:registrationOwnerKind,
      payrollJurisdictionId:jurisdictionId,
      warningHorizonDays:Number(warningDays)
    };
    setRequirements(current=>[
      ...current.filter(item=>!(
        item.registrationTypeId===requirement.registrationTypeId&&
        item.ownerKind===requirement.ownerKind&&
        item.payrollJurisdictionId===requirement.payrollJurisdictionId
      )),
      requirement
    ]);
  }

  async function evaluate(event:FormEvent){
    event.preventDefault();
    if(!cycleId)return;
    setBusy(true);
    setError('');
    setReadiness(null);
    try{
      setReadiness(await api.evaluate(cycleId,{
        banking:{
          ownerKind:bankOwnerKind,
          currencyCode:currency,
          purposeCode:purpose,
          ...(amount?{amount:Number(amount)}:{})
        },
        registrations:requirements
      }));
    }catch(caught){
      setError((caught as Error).message);
    }finally{
      setBusy(false);
    }
  }

  return <section aria-labelledby="fsr-title">
    <div className="page-heading">
      <div>
        <p className="eyebrow">P5-FSR-01 foundation</p>
        <h2 id="fsr-title">Foundation readiness</h2>
        <p>Cycle-bound configuration, employer banking/signatory and explicitly declared registration readiness.</p>
      </div>
    </div>

    {error&&<p className="error" role="alert">{error}</p>}

    <form className="card form-grid" onSubmit={event=>void evaluate(event)}>
      <h3>Evaluate payroll foundation</h3>
      <label>Payroll cycle
        <select
          aria-label="Foundation payroll cycle"
          required
          value={cycleId}
          onChange={event=>{
            setCycleId(event.target.value);
            setRequirements([]);
            setReadiness(null);
          }}
        >
          <option value="">Select payroll cycle</option>
          {cycles.map(cycle=><option key={cycle.id} value={cycle.id}>
            {cycleLabel(cycle)}
          </option>)}
        </select>
      </label>
      {selectedCycle&&<p className="permission-note">
        Period {selectedCycle.periodStart} to {selectedCycle.periodEnd} · payment {selectedCycle.paymentDate}.
      </p>}
      <label>Banking owner
        <select
          aria-label="Foundation banking owner kind"
          value={bankOwnerKind}
          onChange={event=>setBankOwnerKind(event.target.value as FoundationOwnerKind)}
        >
          <option value="LEGAL_ENTITY">Legal entity</option>
          <option value="PAYROLL_STATUTORY_UNIT">Payroll statutory unit</option>
        </select>
      </label>
      <label>Currency
        <input
          aria-label="Foundation readiness currency"
          required
          pattern="[A-Z]{3}"
          value={currency}
          onChange={event=>setCurrency(event.target.value.toUpperCase())}
        />
      </label>
      <label>Authority purpose
        <input
          aria-label="Foundation readiness purpose"
          required
          value={purpose}
          onChange={event=>setPurpose(event.target.value.toUpperCase())}
        />
      </label>
      <label>Amount
        <input
          aria-label="Foundation readiness amount"
          type="number"
          min="0.01"
          step="0.01"
          value={amount}
          onChange={event=>setAmount(event.target.value)}
        />
      </label>

      <h3>Declared registration requirements</h3>
      <p className="permission-note">
        The generic foundation does not infer country-specific legal obligations. Add only requirements that are known for this evaluation. An empty list is explicitly not a legal conclusion.
      </p>
      <label>Registration type
        <select
          aria-label="Foundation registration type"
          value={registrationTypeId}
          onChange={event=>setRegistrationTypeId(event.target.value)}
        >
          <option value="">No registration requirement selected</option>
          {types.map(type=><option key={type.identityId} value={type.identityId}>
            {type.code} · {type.name}
          </option>)}
        </select>
      </label>
      <label>Registration owner
        <select
          aria-label="Foundation registration owner kind"
          value={registrationOwnerKind}
          onChange={event=>setRegistrationOwnerKind(event.target.value as FoundationOwnerKind)}
        >
          <option value="LEGAL_ENTITY">Legal entity</option>
          <option value="PAYROLL_STATUTORY_UNIT">Payroll statutory unit</option>
        </select>
      </label>
      <label>Payroll jurisdiction
        <select
          aria-label="Foundation payroll jurisdiction"
          value={jurisdictionId}
          onChange={event=>setJurisdictionId(event.target.value)}
        >
          <option value="">No jurisdiction selected</option>
          {jurisdictions.map(item=><option key={item.identityId} value={item.identityId}>
            {item.code} · {item.name}
          </option>)}
        </select>
      </label>
      <label>Expiry warning horizon
        <input
          aria-label="Foundation registration warning days"
          type="number"
          min="0"
          max="365"
          value={warningDays}
          onChange={event=>setWarningDays(event.target.value)}
        />
      </label>
      <button
        type="button"
        className="secondary-button"
        disabled={!registrationTypeId||!jurisdictionId}
        onClick={addRequirement}
      >Add registration requirement</button>

      {requirements.length>0&&<ul className="timeline">
        {requirements.map((item,index)=><li key={`${item.registrationTypeId}-${item.ownerKind}-${item.payrollJurisdictionId}`}>
          <span>
            <strong>{types.find(type=>type.identityId===item.registrationTypeId)?.code??item.registrationTypeId}</strong>
            {' · '}{item.ownerKind}
            {' · '}{jurisdictions.find(j=>j.identityId===item.payrollJurisdictionId)?.code??item.payrollJurisdictionId}
          </span>
          <button
            type="button"
            className="secondary-button"
            onClick={()=>setRequirements(current=>current.filter((_,at)=>at!==index))}
          >Remove</button>
        </li>)}
      </ul>}

      <button type="submit" disabled={!cycleId||busy}>
        {busy?'Evaluating…':'Evaluate foundation readiness'}
      </button>
    </form>

    {readiness&&<ReadinessResult value={readiness}/>}
  </section>;
}

function ReadinessResult({value}:{value:FoundationReadinessView}){
  return <section className="card" aria-labelledby="foundation-readiness-result">
    <h3 id="foundation-readiness-result">
      {value.foundationReady?'Foundation ready':'Foundation blocked'}
    </h3>
    <div className="action-summary">
      <span>Scope <strong>{value.readinessScope}</strong></span>
      <span>Status <strong>{value.readinessStatus}</strong></span>
      <span>Cycle <strong>{value.cycleStatus}</strong></span>
      <span>Configuration count <strong>{value.foundationConfigurationCount??'not sealed'}</strong></span>
    </div>

    <h4>Immutable configuration snapshot</h4>
    <p>
      Snapshot <code>{value.foundationConfigurationSnapshotId??'not sealed'}</code>
    </p>
    <p>
      Hash <code>{value.foundationConfigurationSnapshotHash??'not sealed'}</code>
    </p>

    <h4>Readiness dimensions</h4>
    <ul className="timeline">
      {value.dimensions.map(dimension=><li key={dimension.code}>
        <strong>{dimension.code}</strong>
        <span>{dimension.status} · {dimension.coverage}</span>
        <small>{dimension.blockerCount} blocker(s) · {dimension.warningCount} warning(s)</small>
      </li>)}
    </ul>

    <h4>Findings</h4>
    {value.findings.length===0
      ?<p>No blockers or warnings were returned for the declared bounded requirements.</p>
      :<ul className="timeline">
        {value.findings.map((finding,index)=><li key={`${finding.code}-${index}`}>
          <strong>{finding.severity} · {finding.code}</strong>
          <span>{finding.source}</span>
          <small>{finding.detail}</small>
        </li>)}
      </ul>}

    <h4>Explicitly excluded capabilities</h4>
    <ul className="timeline">
      {value.excludedCapabilities.map(capability=><li key={capability}>{capability}</li>)}
    </ul>
  </section>;
}
