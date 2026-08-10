import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {expect,test,vi} from 'vitest';
import {FoundationBankingAuthorityPage} from './FoundationBankingAuthorityPage';
import type {
  AuthorisedSignatoryView,
  BankingReadinessView,
  EmployerBankAccountView,
  FbaOwnerOption,
  FoundationBankingAuthorityApi
} from './foundation-banking-authority-api';

const owner:FbaOwnerOption={
  kind:'LEGAL_ENTITY',
  identityId:'10000000-0000-0000-0000-000000000001',
  versionId:'10000000-0000-0000-0000-000000000002',
  code:'LE001',
  name:'Synthetic Employer'
};

const bank:EmployerBankAccountView={
  identityId:'20000000-0000-0000-0000-000000000001',
  code:'BANK_MAIN',
  ownerKind:'LEGAL_ENTITY',
  legalEntityId:owner.identityId,
  payrollStatutoryUnitId:null,
  identityStatus:'ACTIVE',
  identityVersionNo:1,
  versionId:'20000000-0000-0000-0000-000000000002',
  versionSequence:1,
  versionNo:4,
  bankName:'Synthetic Bank',
  branchName:'Main',
  routingCode:'SYNTH0001',
  accountHolderName:'Synthetic Employer',
  currencyCode:'INR',
  maskedAccountNumber:'****7890',
  defaultAccount:true,
  effectiveFrom:'2026-08-10',
  effectiveTo:null,
  lifecycleStatus:'ACTIVE',
  verificationEvidenceRef:'VERIFY-1',
  verifiedAt:'2026-08-10T00:00:00Z',
  verifiedBy:'payroll.fba.verifier',
  approvedAt:'2026-08-10T00:01:00Z',
  approvedBy:'payroll.fba.approver',
  approvalEvidenceRef:'APPROVE-1',
  rejectedAt:null,
  rejectedBy:null,
  rejectionReason:null,
  rejectionEvidenceRef:null,
  suspendedAt:null,
  suspendedBy:null,
  suspensionReason:null,
  supersedesVersionId:null,
  superseded:false,
  createdBy:'payroll.admin'
};

const signatory:AuthorisedSignatoryView={
  identityId:'30000000-0000-0000-0000-000000000001',
  code:'SIGNATORY_MAIN',
  ownerKind:'LEGAL_ENTITY',
  legalEntityId:owner.identityId,
  payrollStatutoryUnitId:null,
  identityStatus:'ACTIVE',
  identityVersionNo:1,
  versionId:'30000000-0000-0000-0000-000000000002',
  versionSequence:1,
  versionNo:4,
  fullName:'Synthetic Signatory',
  designation:'Director',
  authorityReference:'BOARD-2026-001',
  effectiveFrom:'2026-08-10',
  effectiveTo:null,
  lifecycleStatus:'ACTIVE',
  verificationEvidenceRef:'VERIFY-2',
  verifiedAt:'2026-08-10T00:00:00Z',
  verifiedBy:'payroll.fba.verifier',
  approvedAt:'2026-08-10T00:01:00Z',
  approvedBy:'payroll.fba.approver',
  approvalEvidenceRef:'APPROVE-2',
  rejectedAt:null,
  rejectedBy:null,
  rejectionReason:null,
  rejectionEvidenceRef:null,
  suspendedAt:null,
  suspendedBy:null,
  suspensionReason:null,
  supersedesVersionId:null,
  superseded:false,
  createdBy:'payroll.admin',
  scopes:[{
    scopeId:'30000000-0000-0000-0000-000000000003',
    purposeCode:'PAYROLL_FUNDING',
    currencyCode:'INR',
    maximumAmount:1000000
  }]
};

const ready:BankingReadinessView={
  readinessScope:'BANKING_AND_SIGNATORY_ONLY',
  ownerKind:'LEGAL_ENTITY',
  legalEntityId:owner.identityId,
  payrollStatutoryUnitId:null,
  currencyCode:'INR',
  purposeCode:'PAYROLL_FUNDING',
  amount:1000,
  asOf:'2026-08-10',
  bankReady:true,
  signatoryReady:true,
  ready:true,
  authorityEvaluation:null,
  findings:[]
};

function api():FoundationBankingAuthorityApi{
  return {
    listOwners:vi.fn().mockResolvedValue([owner]),
    listBanks:vi.fn().mockResolvedValue([bank]),
    bankHistory:vi.fn().mockResolvedValue([bank]),
    createBank:vi.fn().mockResolvedValue(bank),
    submitBank:vi.fn().mockResolvedValue(bank),
    verifyBank:vi.fn().mockResolvedValue(bank),
    requestBankApproval:vi.fn().mockResolvedValue(bank),
    approveBank:vi.fn().mockResolvedValue(bank),
    rejectBank:vi.fn().mockResolvedValue(bank),
    suspendBank:vi.fn().mockResolvedValue(bank),
    revealBank:vi.fn().mockResolvedValue({
      identityId:bank.identityId,
      versionId:bank.versionId,
      code:bank.code,
      ownerKind:bank.ownerKind,
      legalEntityId:bank.legalEntityId,
      payrollStatutoryUnitId:null,
      bankName:bank.bankName,
      branchName:bank.branchName,
      routingCode:bank.routingCode,
      accountHolderName:bank.accountHolderName,
      currencyCode:'INR',
      accountNumber:'E2E001234567890',
      effectiveFrom:'2026-08-10',
      effectiveTo:null
    }),
    listSignatories:vi.fn().mockResolvedValue([signatory]),
    signatoryHistory:vi.fn().mockResolvedValue([signatory]),
    createSignatory:vi.fn().mockResolvedValue(signatory),
    submitSignatory:vi.fn().mockResolvedValue(signatory),
    verifySignatory:vi.fn().mockResolvedValue(signatory),
    requestSignatoryApproval:vi.fn().mockResolvedValue(signatory),
    approveSignatory:vi.fn().mockResolvedValue(signatory),
    rejectSignatory:vi.fn().mockResolvedValue(signatory),
    suspendSignatory:vi.fn().mockResolvedValue(signatory),
    readiness:vi.fn().mockResolvedValue(ready)
  };
}

test('read-only banking workspace never exposes the full account number',async()=>{
  render(<FoundationBankingAuthorityPage
    api={api()}
    permissions={new Set([
      'organisation.read',
      'organisation.bank-account.read',
      'organisation.signatory.read',
      'organisation.banking-readiness.read'
    ])}
  />);
  const bankRow=await screen.findByRole(
    'button',
    {name:/BANK_MAIN · Synthetic Bank/}
  );
  expect(bankRow).toHaveTextContent('****7890');
  expect(screen.queryByText('E2E001234567890')).not.toBeInTheDocument();
  expect(screen.queryByRole('button',{name:'Create bank account'})).not.toBeInTheDocument();
  expect(screen.queryByRole('button',{name:'Reveal account number'})).not.toBeInTheDocument();
  expect(await screen.findByText('SIGNATORY_MAIN · Synthetic Signatory')).toBeInTheDocument();
});

test('privileged reveal is explicit and transient',async()=>{
  const client=api();
  render(<FoundationBankingAuthorityPage
    api={client}
    permissions={new Set([
      'organisation.read',
      'organisation.bank-account.read',
      'organisation.bank-account.reveal'
    ])}
  />);
  fireEvent.click(await screen.findByRole('button',{name:/BANK_MAIN · Synthetic Bank/}));
  fireEvent.change(screen.getByLabelText('Reveal reason'),{
    target:{value:'Independent audit verification'}
  });
  fireEvent.click(screen.getByRole('button',{name:'Reveal account number'}));
  expect(await screen.findByText('E2E001234567890')).toBeInTheDocument();
  expect(client.revealBank).toHaveBeenCalledWith(
    expect.objectContaining({identityId:bank.identityId}),
    'Independent audit verification'
  );
  fireEvent.click(screen.getByRole('button',{name:'Clear revealed account number'}));
  await waitFor(()=>expect(screen.queryByText('E2E001234567890')).not.toBeInTheDocument());
});

test('bounded readiness remains explicitly scoped',async()=>{
  const client=api();
  render(<FoundationBankingAuthorityPage
    api={client}
    permissions={new Set([
      'organisation.read',
      'organisation.banking-readiness.read'
    ])}
  />);
  const ownerSelect=await screen.findByLabelText('Readiness owner');
  await waitFor(()=>expect(ownerSelect).not.toHaveValue(''));
  fireEvent.click(screen.getByRole('button',{name:'Check banking readiness'}));
  expect(await screen.findByText('Ready for banking and signatory authority')).toBeInTheDocument();
  expect(screen.getByText('BANKING_AND_SIGNATORY_ONLY')).toBeInTheDocument();
});
