import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState
} from 'react';
import {
  AuthorisedSignatoryVersionWrite,
  AuthorisedSignatoryView,
  BankingReadinessView,
  EmployerBankAccountRevealView,
  EmployerBankAccountVersionWrite,
  EmployerBankAccountView,
  FbaOwnerOption,
  FoundationBankingAuthorityApi,
  httpFoundationBankingAuthorityApi
} from './foundation-banking-authority-api';

type Props={
  api?:FoundationBankingAuthorityApi;
  permissions?:Set<string>;
};

function sessionPermissions():Set<string>{
  return new Set(window.payrollSession?.permissions??[]);
}

function ownerKey(owner:FbaOwnerOption):string{
  return `${owner.kind}|${owner.identityId}`;
}

function ownerLabel(owner:FbaOwnerOption):string{
  const kind=owner.kind==='LEGAL_ENTITY'
    ?'Legal entity'
    :'Payroll statutory unit';
  return `${kind} · ${owner.code} · ${owner.name}`;
}

function currentDate():string{
  return new Date().toISOString().slice(0,10);
}

function setWorkflowLink(kind:'bankAccountId'|'signatoryId',identityId:string){
  const url=new URL(window.location.href);
  url.searchParams.delete(kind==='bankAccountId'?'signatoryId':'bankAccountId');
  url.searchParams.set(kind,identityId);
  window.history.replaceState(null,'',`${url.pathname}${url.search}`);
}

export function FoundationBankingAuthorityPage({
  api=httpFoundationBankingAuthorityApi,
  permissions
}:Props){
  const effectivePermissions=useMemo(
    ()=>permissions??sessionPermissions(),
    [permissions]
  );
  const [asOf,setAsOf]=useState(currentDate);
  const [owners,setOwners]=useState<FbaOwnerOption[]>([]);
  const [banks,setBanks]=useState<EmployerBankAccountView[]>([]);
  const [signatories,setSignatories]=useState<AuthorisedSignatoryView[]>([]);
  const [selectedBank,setSelectedBank]=useState<EmployerBankAccountView|null>(null);
  const [selectedSignatory,setSelectedSignatory]=
    useState<AuthorisedSignatoryView|null>(null);
  const [readiness,setReadiness]=useState<BankingReadinessView|null>(null);
  const [error,setError]=useState('');

  const canReadOrganisation=effectivePermissions.has('organisation.read');
  const canBankRead=effectivePermissions.has('organisation.bank-account.read');
  const canBankWrite=effectivePermissions.has('organisation.bank-account.write');
  const canBankVerify=effectivePermissions.has('organisation.bank-account.verify');
  const canBankApprove=effectivePermissions.has('organisation.bank-account.approve');
  const canBankReveal=effectivePermissions.has('organisation.bank-account.reveal');
  const canSignatoryRead=effectivePermissions.has('organisation.signatory.read');
  const canSignatoryWrite=effectivePermissions.has('organisation.signatory.write');
  const canSignatoryVerify=effectivePermissions.has('organisation.signatory.verify');
  const canSignatoryApprove=effectivePermissions.has('organisation.signatory.approve');
  const canReadiness=effectivePermissions.has('organisation.banking-readiness.read');

  const load=useCallback(async()=>{
    setError('');
    try{
      const nextOwners=canReadOrganisation
        ?await api.listOwners(asOf)
        :[];
      setOwners(nextOwners);

      if(canBankRead)setBanks(await api.listBanks(asOf));
      else setBanks([]);

      if(canSignatoryRead)setSignatories(await api.listSignatories(asOf));
      else setSignatories([]);

      const params=new URLSearchParams(window.location.search);
      const bankId=params.get('bankAccountId');
      if(bankId&&canBankRead){
        const history=await api.bankHistory(bankId);
        setSelectedBank(history[0]??null);
      }
      const signatoryId=params.get('signatoryId');
      if(signatoryId&&canSignatoryRead){
        const history=await api.signatoryHistory(signatoryId);
        setSelectedSignatory(history[0]??null);
      }
    }catch(caught){
      setError((caught as Error).message);
    }
  },[
    api,
    asOf,
    canBankRead,
    canReadOrganisation,
    canSignatoryRead
  ]);

  useEffect(()=>{void load()},[load]);

  function chooseBank(view:EmployerBankAccountView){
    setSelectedBank(view);
    setSelectedSignatory(null);
    setWorkflowLink('bankAccountId',view.identityId);
  }

  function chooseSignatory(view:AuthorisedSignatoryView){
    setSelectedSignatory(view);
    setSelectedBank(null);
    setWorkflowLink('signatoryId',view.identityId);
  }

  if(!canBankRead&&!canSignatoryRead&&!canReadiness){
    return <section className="card" aria-labelledby="fba-title">
      <h2 id="fba-title">Banking & authority</h2>
      <p role="alert">You do not have permission to view foundation banking or signatory authority.</p>
    </section>;
  }

  return <section aria-labelledby="fba-title">
    <div className="page-heading">
      <div>
        <p className="eyebrow">P5-FBA-01 foundation</p>
        <h2 id="fba-title">Banking & authority</h2>
        <p>Employer funding accounts, authorised signatories, delegated limits and bounded readiness.</p>
      </div>
      <label>
        Effective date
        <input
          aria-label="Banking effective date"
          type="date"
          value={asOf}
          onChange={event=>setAsOf(event.target.value)}
        />
      </label>
    </div>

    {error&&<p className="error" role="alert">{error}</p>}

    {!canReadOrganisation&&(canBankWrite||canSignatoryWrite||canReadiness)&&
      <p className="permission-note">
        Business owner selectors require <code>organisation.read</code>. Technical identifiers are not accepted by this workspace.
      </p>}

    <div className="two-column">
      {canBankRead&&<section className="card">
        <h3>Effective employer bank accounts</h3>
        {banks.length===0?<p>No approved employer bank account is effective.</p>:
          <ul className="timeline">
            {banks.map(item=><li key={item.versionId}>
              <button
                className="tree-item"
                onClick={()=>chooseBank(item)}
              >
                <strong>{item.code} · {item.bankName}</strong>
                <span>{item.currencyCode} · {item.maskedAccountNumber}</span>
                <small>{item.lifecycleStatus}{item.defaultAccount?' · Default funding':''}</small>
              </button>
            </li>)}
          </ul>}
      </section>}

      {canSignatoryRead&&<section className="card">
        <h3>Effective authorised signatories</h3>
        {signatories.length===0?<p>No approved authorised signatory is effective.</p>:
          <ul className="timeline">
            {signatories.map(item=><li key={item.versionId}>
              <button
                className="tree-item"
                onClick={()=>chooseSignatory(item)}
              >
                <strong>{item.code} · {item.fullName}</strong>
                <span>{item.designation??'No designation'}</span>
                <small>{item.lifecycleStatus} · {item.scopes.length} scope(s)</small>
              </button>
            </li>)}
          </ul>}
      </section>}
    </div>

    {canBankWrite&&canReadOrganisation&&
      <BankCreateForm
        asOf={asOf}
        owners={owners}
        onCreate={async(code,owner,version)=>{
          try{
            const created=await api.createBank(code,owner,version);
            chooseBank(created);
          }catch(caught){
            setError((caught as Error).message);
          }
        }}
      />}

    {selectedBank&&canBankRead&&
      <BankLifecycle
        value={selectedBank}
        canWrite={canBankWrite}
        canVerify={canBankVerify}
        canApprove={canBankApprove}
        canReveal={canBankReveal}
        api={api}
        onChange={chooseBank}
        onError={setError}
      />}

    {canSignatoryWrite&&canReadOrganisation&&
      <SignatoryCreateForm
        asOf={asOf}
        owners={owners}
        onCreate={async(code,owner,version)=>{
          try{
            const created=await api.createSignatory(code,owner,version);
            chooseSignatory(created);
          }catch(caught){
            setError((caught as Error).message);
          }
        }}
      />}

    {selectedSignatory&&canSignatoryRead&&
      <SignatoryLifecycle
        value={selectedSignatory}
        canWrite={canSignatoryWrite}
        canVerify={canSignatoryVerify}
        canApprove={canSignatoryApprove}
        api={api}
        onChange={chooseSignatory}
        onError={setError}
      />}

    {canReadiness&&canReadOrganisation&&
      <ReadinessForm
        asOf={asOf}
        owners={owners}
        api={api}
        value={readiness}
        onChange={setReadiness}
        onError={setError}
      />}
  </section>;
}

function BankCreateForm({
  asOf,
  owners,
  onCreate
}:{
  asOf:string;
  owners:FbaOwnerOption[];
  onCreate:(
    code:string,
    owner:FbaOwnerOption,
    version:EmployerBankAccountVersionWrite
  )=>Promise<void>;
}){
  const [code,setCode]=useState('');
  const [selectedOwner,setSelectedOwner]=useState('');
  const [bankName,setBankName]=useState('');
  const [branchName,setBranchName]=useState('');
  const [routingCode,setRoutingCode]=useState('');
  const [holder,setHolder]=useState('');
  const [currency,setCurrency]=useState('INR');
  const [accountNumber,setAccountNumber]=useState('');
  const [isDefault,setIsDefault]=useState(true);

  useEffect(()=>{
    if(!selectedOwner&&owners[0])setSelectedOwner(ownerKey(owners[0]));
  },[owners,selectedOwner]);

  async function submit(event:FormEvent){
    event.preventDefault();
    const owner=owners.find(item=>ownerKey(item)===selectedOwner);
    if(!owner)return;
    await onCreate(code,owner,{
      bankName,
      branchName:branchName||undefined,
      routingCode:routingCode||undefined,
      accountHolderName:holder,
      currencyCode:currency,
      accountNumber,
      defaultAccount:isDefault,
      effectiveFrom:asOf
    });
    setAccountNumber('');
  }

  return <form className="card form-grid" onSubmit={event=>void submit(event)}>
    <h3>Add employer bank account</h3>
    <label>Bank code
      <input required value={code} onChange={event=>setCode(event.target.value.toUpperCase())}/>
    </label>
    <label>Bank owner
      <select required value={selectedOwner} onChange={event=>setSelectedOwner(event.target.value)}>
        <option value="">Select owner</option>
        {owners.map(owner=><option key={ownerKey(owner)} value={ownerKey(owner)}>{ownerLabel(owner)}</option>)}
      </select>
    </label>
    <label>Bank name
      <input required value={bankName} onChange={event=>setBankName(event.target.value)}/>
    </label>
    <label>Branch name
      <input value={branchName} onChange={event=>setBranchName(event.target.value)}/>
    </label>
    <label>Routing code
      <input value={routingCode} onChange={event=>setRoutingCode(event.target.value)}/>
    </label>
    <label>Account holder
      <input required value={holder} onChange={event=>setHolder(event.target.value)}/>
    </label>
    <label>Currency
      <input required pattern="[A-Z]{3}" value={currency} onChange={event=>setCurrency(event.target.value.toUpperCase())}/>
    </label>
    <label>Account number
      <input
        required
        autoComplete="off"
        value={accountNumber}
        onChange={event=>setAccountNumber(event.target.value)}
      />
    </label>
    <label>
      <input type="checkbox" checked={isDefault} onChange={event=>setIsDefault(event.target.checked)}/>
      Default payroll funding account
    </label>
    <p className="permission-note">Account numbers are encrypted by the backend and normal reads return only a masked value.</p>
    <button type="submit" disabled={!selectedOwner}>Create bank account</button>
  </form>;
}

function BankLifecycle({
  value,
  canWrite,
  canVerify,
  canApprove,
  canReveal,
  api,
  onChange,
  onError
}:{
  value:EmployerBankAccountView;
  canWrite:boolean;
  canVerify:boolean;
  canApprove:boolean;
  canReveal:boolean;
  api:FoundationBankingAuthorityApi;
  onChange:(value:EmployerBankAccountView)=>void;
  onError:(message:string)=>void;
}){
  const [verificationEvidence,setVerificationEvidence]=useState('');
  const [approvalEvidence,setApprovalEvidence]=useState('');
  const [rejectReason,setRejectReason]=useState('');
  const [suspendReason,setSuspendReason]=useState('');
  const [revealReason,setRevealReason]=useState('');
  const [revealed,setRevealed]=useState<EmployerBankAccountRevealView|null>(null);

  useEffect(()=>setRevealed(null),[value.versionId]);

  async function act(work:()=>Promise<EmployerBankAccountView>){
    onError('');
    try{
      onChange(await work());
    }catch(caught){
      onError((caught as Error).message);
    }
  }

  async function reveal(){
    onError('');
    try{
      setRevealed(await api.revealBank(value,revealReason));
      setRevealReason('');
    }catch(caught){
      onError((caught as Error).message);
    }
  }

  return <section className="card" aria-labelledby="bank-lifecycle-title">
    <h3 id="bank-lifecycle-title">Bank account {value.code}</h3>
    <div className="action-summary">
      <span>Status <strong>{value.lifecycleStatus}</strong></span>
      <span>{value.bankName} · {value.currencyCode} · <strong>{value.maskedAccountNumber}</strong></span>
      <span>Holder {value.accountHolderName}{value.defaultAccount?' · Default funding account':''}</span>
      <span>Created by {value.createdBy}</span>
      {value.verifiedBy&&<span>Verified by {value.verifiedBy}</span>}
      {value.approvedBy&&<span>Approved by {value.approvedBy}</span>}
    </div>

    {value.lifecycleStatus==='DRAFT'&&canWrite&&
      <button type="button" onClick={()=>void act(()=>api.submitBank(value))}>Submit bank for verification</button>}

    {value.lifecycleStatus==='PENDING_VERIFICATION'&&canVerify&&
      <div className="form-grid">
        <label>Bank verification evidence
          <input value={verificationEvidence} onChange={event=>setVerificationEvidence(event.target.value)}/>
        </label>
        <button
          type="button"
          disabled={!verificationEvidence}
          onClick={()=>void act(()=>api.verifyBank(value,verificationEvidence))}
        >Verify bank</button>
      </div>}

    {value.lifecycleStatus==='VERIFIED'&&canVerify&&
      <button type="button" onClick={()=>void act(()=>api.requestBankApproval(value))}>Request bank approval</button>}

    {value.lifecycleStatus==='APPROVAL_PENDING'&&canApprove&&
      <div className="form-grid">
        <label>Bank approval evidence
          <input value={approvalEvidence} onChange={event=>setApprovalEvidence(event.target.value)}/>
        </label>
        <button
          type="button"
          disabled={!approvalEvidence}
          onClick={()=>void act(()=>api.approveBank(value,approvalEvidence))}
        >Approve bank</button>
        <label>Bank rejection reason
          <input value={rejectReason} onChange={event=>setRejectReason(event.target.value)}/>
        </label>
        <button
          type="button"
          disabled={!rejectReason||!approvalEvidence}
          onClick={()=>void act(()=>api.rejectBank(value,rejectReason,approvalEvidence))}
        >Reject bank</button>
      </div>}

    {value.lifecycleStatus==='ACTIVE'&&canReveal&&
      <div className="form-grid">
        <label>Reveal reason
          <input value={revealReason} onChange={event=>setRevealReason(event.target.value)}/>
        </label>
        <button type="button" disabled={!revealReason} onClick={()=>void reveal()}>Reveal account number</button>
      </div>}

    {revealed&&<div className="action-summary" role="status">
      <strong>Revealed account number</strong>
      <code>{revealed.accountNumber}</code>
      <small>Privileged transient display. Do not copy into tickets, chat or logs.</small>
      <button type="button" onClick={()=>setRevealed(null)}>Clear revealed account number</button>
    </div>}

    {value.lifecycleStatus==='ACTIVE'&&canApprove&&
      <div className="form-grid">
        <label>Bank suspension reason
          <input value={suspendReason} onChange={event=>setSuspendReason(event.target.value)}/>
        </label>
        <button
          type="button"
          disabled={!suspendReason}
          onClick={()=>void act(()=>api.suspendBank(value,suspendReason))}
        >Suspend bank</button>
      </div>}
  </section>;
}

function SignatoryCreateForm({
  asOf,
  owners,
  onCreate
}:{
  asOf:string;
  owners:FbaOwnerOption[];
  onCreate:(
    code:string,
    owner:FbaOwnerOption,
    version:AuthorisedSignatoryVersionWrite
  )=>Promise<void>;
}){
  const [code,setCode]=useState('');
  const [selectedOwner,setSelectedOwner]=useState('');
  const [fullName,setFullName]=useState('');
  const [designation,setDesignation]=useState('');
  const [authorityReference,setAuthorityReference]=useState('');
  const [purposeCode,setPurposeCode]=useState('PAYROLL_FUNDING');
  const [currency,setCurrency]=useState('INR');
  const [maximumAmount,setMaximumAmount]=useState('1000000');

  useEffect(()=>{
    if(!selectedOwner&&owners[0])setSelectedOwner(ownerKey(owners[0]));
  },[owners,selectedOwner]);

  async function submit(event:FormEvent){
    event.preventDefault();
    const owner=owners.find(item=>ownerKey(item)===selectedOwner);
    if(!owner)return;
    const amount=maximumAmount?Number(maximumAmount):undefined;
    await onCreate(code,owner,{
      fullName,
      designation:designation||undefined,
      authorityReference,
      effectiveFrom:asOf,
      scopes:[{
        purposeCode,
        currencyCode:currency||undefined,
        maximumAmount:amount
      }]
    });
  }

  return <form className="card form-grid" onSubmit={event=>void submit(event)}>
    <h3>Add authorised signatory</h3>
    <label>Signatory code
      <input required value={code} onChange={event=>setCode(event.target.value.toUpperCase())}/>
    </label>
    <label>Signatory owner
      <select required value={selectedOwner} onChange={event=>setSelectedOwner(event.target.value)}>
        <option value="">Select owner</option>
        {owners.map(owner=><option key={ownerKey(owner)} value={ownerKey(owner)}>{ownerLabel(owner)}</option>)}
      </select>
    </label>
    <label>Full name
      <input required value={fullName} onChange={event=>setFullName(event.target.value)}/>
    </label>
    <label>Designation
      <input value={designation} onChange={event=>setDesignation(event.target.value)}/>
    </label>
    <label>Authority reference
      <input required value={authorityReference} onChange={event=>setAuthorityReference(event.target.value)}/>
    </label>
    <label>Purpose code
      <input required value={purposeCode} onChange={event=>setPurposeCode(event.target.value.toUpperCase())}/>
    </label>
    <label>Scope currency
      <input pattern="[A-Z]{3}" value={currency} onChange={event=>setCurrency(event.target.value.toUpperCase())}/>
    </label>
    <label>Maximum amount
      <input type="number" min="0.01" step="0.01" value={maximumAmount} onChange={event=>setMaximumAmount(event.target.value)}/>
    </label>
    <p className="permission-note">Legal signatory authority does not grant Payroll application access.</p>
    <button type="submit" disabled={!selectedOwner}>Create signatory</button>
  </form>;
}

function SignatoryLifecycle({
  value,
  canWrite,
  canVerify,
  canApprove,
  api,
  onChange,
  onError
}:{
  value:AuthorisedSignatoryView;
  canWrite:boolean;
  canVerify:boolean;
  canApprove:boolean;
  api:FoundationBankingAuthorityApi;
  onChange:(value:AuthorisedSignatoryView)=>void;
  onError:(message:string)=>void;
}){
  const [verificationEvidence,setVerificationEvidence]=useState('');
  const [approvalEvidence,setApprovalEvidence]=useState('');
  const [rejectReason,setRejectReason]=useState('');
  const [suspendReason,setSuspendReason]=useState('');

  async function act(work:()=>Promise<AuthorisedSignatoryView>){
    onError('');
    try{
      onChange(await work());
    }catch(caught){
      onError((caught as Error).message);
    }
  }

  return <section className="card" aria-labelledby="signatory-lifecycle-title">
    <h3 id="signatory-lifecycle-title">Authorised signatory {value.code}</h3>
    <div className="action-summary">
      <span>Status <strong>{value.lifecycleStatus}</strong></span>
      <span>{value.fullName} · {value.designation??'No designation'}</span>
      <span>Authority {value.authorityReference}</span>
      {value.scopes.map(scope=><span key={scope.scopeId}>
        {scope.purposeCode} · {scope.currencyCode??'Any currency'} · Limit {scope.maximumAmount??'Unbounded'}
      </span>)}
      <span>Created by {value.createdBy}</span>
      {value.verifiedBy&&<span>Verified by {value.verifiedBy}</span>}
      {value.approvedBy&&<span>Approved by {value.approvedBy}</span>}
    </div>

    {value.lifecycleStatus==='DRAFT'&&canWrite&&
      <button type="button" onClick={()=>void act(()=>api.submitSignatory(value))}>Submit signatory for verification</button>}

    {value.lifecycleStatus==='PENDING_VERIFICATION'&&canVerify&&
      <div className="form-grid">
        <label>Signatory verification evidence
          <input value={verificationEvidence} onChange={event=>setVerificationEvidence(event.target.value)}/>
        </label>
        <button
          type="button"
          disabled={!verificationEvidence}
          onClick={()=>void act(()=>api.verifySignatory(value,verificationEvidence))}
        >Verify signatory</button>
      </div>}

    {value.lifecycleStatus==='VERIFIED'&&canVerify&&
      <button type="button" onClick={()=>void act(()=>api.requestSignatoryApproval(value))}>Request signatory approval</button>}

    {value.lifecycleStatus==='APPROVAL_PENDING'&&canApprove&&
      <div className="form-grid">
        <label>Signatory approval evidence
          <input value={approvalEvidence} onChange={event=>setApprovalEvidence(event.target.value)}/>
        </label>
        <button
          type="button"
          disabled={!approvalEvidence}
          onClick={()=>void act(()=>api.approveSignatory(value,approvalEvidence))}
        >Approve signatory</button>
        <label>Signatory rejection reason
          <input value={rejectReason} onChange={event=>setRejectReason(event.target.value)}/>
        </label>
        <button
          type="button"
          disabled={!rejectReason||!approvalEvidence}
          onClick={()=>void act(()=>api.rejectSignatory(value,rejectReason,approvalEvidence))}
        >Reject signatory</button>
      </div>}

    {value.lifecycleStatus==='ACTIVE'&&canApprove&&
      <div className="form-grid">
        <label>Signatory suspension reason
          <input value={suspendReason} onChange={event=>setSuspendReason(event.target.value)}/>
        </label>
        <button
          type="button"
          disabled={!suspendReason}
          onClick={()=>void act(()=>api.suspendSignatory(value,suspendReason))}
        >Suspend signatory</button>
      </div>}
  </section>;
}

function ReadinessForm({
  asOf,
  owners,
  api,
  value,
  onChange,
  onError
}:{
  asOf:string;
  owners:FbaOwnerOption[];
  api:FoundationBankingAuthorityApi;
  value:BankingReadinessView|null;
  onChange:(value:BankingReadinessView)=>void;
  onError:(message:string)=>void;
}){
  const [selectedOwner,setSelectedOwner]=useState('');
  const [currency,setCurrency]=useState('INR');
  const [purpose,setPurpose]=useState('PAYROLL_FUNDING');
  const [amount,setAmount]=useState('1000');

  useEffect(()=>{
    if(!selectedOwner&&owners[0])setSelectedOwner(ownerKey(owners[0]));
  },[owners,selectedOwner]);

  async function submit(event:FormEvent){
    event.preventDefault();
    const owner=owners.find(item=>ownerKey(item)===selectedOwner);
    if(!owner)return;
    onError('');
    try{
      onChange(await api.readiness({
        owner,
        currencyCode:currency,
        purposeCode:purpose,
        amount:amount?Number(amount):undefined,
        asOf
      }));
    }catch(caught){
      onError((caught as Error).message);
    }
  }

  return <form className="card form-grid" onSubmit={event=>void submit(event)}>
    <h3>Banking/signatory readiness</h3>
    <p className="permission-note">Scope is <code>BANKING_AND_SIGNATORY_ONLY</code>; this is not complete payroll-foundation readiness.</p>
    <label>Readiness owner
      <select required value={selectedOwner} onChange={event=>setSelectedOwner(event.target.value)}>
        <option value="">Select owner</option>
        {owners.map(owner=><option key={ownerKey(owner)} value={ownerKey(owner)}>{ownerLabel(owner)}</option>)}
      </select>
    </label>
    <label>Readiness currency
      <input required pattern="[A-Z]{3}" value={currency} onChange={event=>setCurrency(event.target.value.toUpperCase())}/>
    </label>
    <label>Readiness purpose
      <input required value={purpose} onChange={event=>setPurpose(event.target.value.toUpperCase())}/>
    </label>
    <label>Readiness amount
      <input type="number" min="0.01" step="0.01" value={amount} onChange={event=>setAmount(event.target.value)}/>
    </label>
    <button type="submit" disabled={!selectedOwner}>Check banking readiness</button>
    {value&&<div className="action-summary" role="status">
      <strong>{value.ready?'Ready for banking and signatory authority':'Banking/signatory readiness blocked'}</strong>
      <span>Bank {value.bankReady?'ready':'not ready'} · Signatory {value.signatoryReady?'ready':'not ready'}</span>
      {value.findings.map(finding=><span key={`${finding.source}:${finding.code}`}>
        {finding.severity} · {finding.code} · {finding.detail}
      </span>)}
    </div>}
  </form>;
}
