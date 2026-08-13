import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,test,vi} from 'vitest';
import {OrganisationApi,OrganisationHierarchy} from '../organisation/organisation-api';
import {FoundationApprovalAuthorityPage} from './FoundationApprovalAuthorityPage';
import {ApprovalAuthority,ApprovalDelegation,FoundationApprovalAuthorityApi} from './foundation-approval-authority-api';


function tokenFor(claims:Record<string,string>){
  const encoded=btoa(JSON.stringify(claims))
    .replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
  return `header.${encoded}.signature`;
}
function useSignedInActor(subject='admin-subject'){
  const issuer='http://localhost:8081/realms/payroll';
  window.payrollSession={
    accessToken:tokenFor({iss:issuer,sub:subject,preferred_username:'payroll.admin'}),
    permissions:[]
  };
  return `${issuer}|${subject}`;
}
afterEach(()=>{delete window.payrollSession});

const authority:ApprovalAuthority={
  id:'10000000-0000-0000-0000-000000000001',ownerKind:'LEGAL_ENTITY',
  ownerId:'20000000-0000-0000-0000-000000000001',approvalRole:'FINAL_APPROVER',
  domainCode:'FOUNDATION',actionCode:'APPROVE',actorId:'approver.one',
  effectiveFrom:'2026-01-01',effectiveTo:null,status:'ACTIVE',
  createdAt:'2026-01-01T00:00:00Z',createdBy:'admin',suspendedAt:null,suspendedBy:null,
  suspensionReason:null,retiredAt:null,retiredBy:null,retirementReason:null,versionNo:0
};
const delegation:ApprovalDelegation={
  id:'30000000-0000-0000-0000-000000000001',sourceAuthorityId:authority.id,
  delegateActorId:'delegate.one',effectiveFrom:'2026-08-01',effectiveTo:'2026-08-31',
  delegatorActorId:'approver.one',status:'ACTIVE',createdAt:'2026-07-01T00:00:00Z',
  createdBy:'admin',revokedAt:null,revokedBy:null,revocationReason:null,versionNo:0
};
function fakeApi(overrides:Partial<FoundationApprovalAuthorityApi>={}):FoundationApprovalAuthorityApi{
  return {
    listAuthorities:vi.fn().mockResolvedValue([authority]),
    createAuthority:vi.fn().mockResolvedValue(authority),
    suspendAuthority:vi.fn().mockResolvedValue({...authority,status:'SUSPENDED'}),
    retireAuthority:vi.fn().mockResolvedValue({...authority,status:'RETIRED'}),
    listDelegations:vi.fn().mockResolvedValue([delegation]),
    createDelegation:vi.fn().mockResolvedValue(delegation),
    revokeDelegation:vi.fn().mockResolvedValue({...delegation,status:'REVOKED'}),
    ...overrides
  };
}
const hierarchy:OrganisationHierarchy={asOf:'2026-08-13',legalEntities:[{value:{
  kind:'LEGAL_ENTITY',identityId:authority.ownerId,code:'LE_IN',identityStatus:'ACTIVE',identityVersionNo:0,
  retirementEffectiveDate:null,retirementReason:null,retiredAt:null,retiredBy:null,
  versionId:'20000000-0000-0000-0000-000000000099',versionSequence:1,versionNo:0,name:'India Legal Entity',
  countryCode:'IN',currency:'INR',stateCode:null,parentVersionId:null,responsibilityScope:null,
  establishmentType:null,effectiveFrom:'2026-01-01',effectiveTo:null,approvalStatus:'APPROVED',
  supersedesVersionId:null,superseded:false,createdBy:'admin',approvedBy:'checker'
},children:[]}]};
function fakeOrganisationApi():OrganisationApi{
  return {
    hierarchy:vi.fn().mockResolvedValue(hierarchy),
    listJurisdictions:vi.fn(),createJurisdiction:vi.fn(),approveJurisdiction:vi.fn(),
    listWorkLocations:vi.fn(),createWorkLocation:vi.fn(),approveWorkLocation:vi.fn(),
    history:vi.fn(),create:vi.fn(),addVersion:vi.fn(),correct:vi.fn(),endDate:vi.fn(),
    approve:vi.fn(),retire:vi.fn()
  } as unknown as OrganisationApi;
}
test('requires approval authority read permission',()=>{
  const api=fakeApi();
  render(<FoundationApprovalAuthorityPage api={api} organisationApi={fakeOrganisationApi()} permissions={new Set()}/>);
  expect(screen.getByRole('alert')).toHaveTextContent('do not have permission');
  expect(api.listAuthorities).not.toHaveBeenCalled();
});
test('shows business owner labels and bounded delegation',async()=>{
  render(<FoundationApprovalAuthorityPage api={fakeApi()} organisationApi={fakeOrganisationApi()}
    permissions={new Set(['foundation-approval-authority.read'])}/>);
  expect(await screen.findByText('LE_IN — India Legal Entity')).toBeInTheDocument();
  expect(screen.getByText('delegate.one')).toBeInTheDocument();
  expect(screen.getByText('2026-08-01 → 2026-08-31')).toBeInTheDocument();
});
test('uses canonical signed-in actor for delegable authority',async()=>{
  const actorId=useSignedInActor();
  const heldAuthority={...authority,actorId};
  const createdDelegation={...delegation,sourceAuthorityId:heldAuthority.id,delegatorActorId:actorId};
  const api=fakeApi({
    listAuthorities:vi.fn().mockResolvedValue([heldAuthority]),
    createAuthority:vi.fn().mockResolvedValue(heldAuthority),
    listDelegations:vi.fn().mockResolvedValue([]),
    createDelegation:vi.fn().mockResolvedValue(createdDelegation)
  });
  render(<FoundationApprovalAuthorityPage api={api} organisationApi={fakeOrganisationApi()}
    permissions={new Set(['foundation-approval-authority.read','foundation-approval-authority.write','foundation-approval-delegation.write'])}/>);
  await screen.findByRole('option',{name:'LE_IN — India Legal Entity'});
  expect(screen.getByLabelText('Actor ID')).toHaveValue(actorId);
  expect(screen.getByText('Current signed-in user: payroll.admin')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Create authority'}));
  await waitFor(()=>expect(api.createAuthority).toHaveBeenCalledWith(expect.objectContaining({
    ownerKind:'LEGAL_ENTITY',ownerId:authority.ownerId,actorId
  })));
  fireEvent.change(screen.getByLabelText('Delegate actor ID'),{
    target:{value:'http://localhost:8081/realms/payroll|delegate-subject'}
  });
  fireEvent.click(screen.getByRole('button',{name:'Create delegation'}));
  await waitFor(()=>expect(api.createDelegation).toHaveBeenCalledWith(expect.objectContaining({
    sourceAuthorityId:heldAuthority.id,
    delegateActorId:'http://localhost:8081/realms/payroll|delegate-subject'
  })));
});

test('does not expose delegation mutations owned by another actor',async()=>{
  useSignedInActor('admin-subject');
  const api=fakeApi();
  render(<FoundationApprovalAuthorityPage api={api} organisationApi={fakeOrganisationApi()}
    permissions={new Set(['foundation-approval-authority.read','foundation-approval-delegation.write'])}/>);
  await screen.findByText('delegate.one');
  expect(screen.queryByRole('button',{name:'Revoke'})).not.toBeInTheDocument();
  expect(screen.getByRole('button',{name:'Create delegation'})).toBeDisabled();
  expect(screen.getByText('Only approval authorities held by the current signed-in user can be delegated.')).toBeInTheDocument();
  expect(api.revokeDelegation).not.toHaveBeenCalled();
});
