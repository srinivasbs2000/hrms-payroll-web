import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {expect,test,vi} from 'vitest';
import {SetupPage} from './SetupPage';
import {OrganisationApi,OrganisationVersion} from './organisation-api';

const legal:OrganisationVersion={kind:'LEGAL_ENTITY',identityId:'10000000-0000-0000-0000-000000000001',code:'ACME_IN',identityStatus:'ACTIVE',versionId:'11000000-0000-0000-0000-000000000001',versionSequence:1,versionNo:0,name:'Acme India',countryCode:'IN',currency:'INR',stateCode:null,parentVersionId:null,effectiveFrom:'2026-01-01',effectiveTo:null,approvalStatus:'APPROVED',supersedesVersionId:null,superseded:false};

function fakeApi(overrides:Partial<OrganisationApi>={}):OrganisationApi{return {
  hierarchy:vi.fn().mockResolvedValue({asOf:'2026-07-19',legalEntities:[]}),
  history:vi.fn().mockResolvedValue([legal]),create:vi.fn().mockResolvedValue(legal),
  addVersion:vi.fn().mockResolvedValue({...legal,versionSequence:2,approvalStatus:'DRAFT'}),
  correct:vi.fn().mockResolvedValue({...legal,versionSequence:2,approvalStatus:'DRAFT'}),
  endDate:vi.fn().mockResolvedValue({...legal,effectiveTo:'2027-01-01',versionNo:1}),
  approve:vi.fn().mockResolvedValue({...legal,approvalStatus:'APPROVED'}),...overrides
}}

test('rejects the screen when organisation.read is absent',()=>{
  const api=fakeApi();render(<SetupPage api={api} permissions={new Set()}/>);
  expect(screen.getByRole('alert')).toHaveTextContent('do not have permission');
  expect(api.hierarchy).not.toHaveBeenCalled();
});

test('shows loading then the empty hierarchy state',async()=>{
  let resolve:(value:{asOf:string;legalEntities:[]})=>void=()=>{};
  const api=fakeApi({hierarchy:vi.fn(()=>new Promise<{asOf:string;legalEntities:[]}>(result=>{resolve=result}))});
  render(<SetupPage api={api} permissions={new Set(['organisation.read'])}/>);
  expect(screen.getByRole('status')).toHaveTextContent('Loading');
  resolve({asOf:'2026-07-19',legalEntities:[]});
  expect(await screen.findByText('No organisation configured')).toBeInTheDocument();
});

test('renders hierarchy and loads immutable version history',async()=>{
  const api=fakeApi({hierarchy:vi.fn().mockResolvedValue({asOf:'2026-07-19',legalEntities:[{value:legal,children:[]}]})});
  render(<SetupPage api={api} permissions={new Set(['organisation.read','organisation.approve'])}/>);
  fireEvent.click(await screen.findByRole('button',{name:/ACME_IN/}));
  expect(await screen.findByText('Version 1: Acme India')).toBeInTheDocument();
  expect(screen.getByText('2026-01-01 to open')).toBeInTheDocument();
});

test('exposes permitted add-version and end-date workflows with concurrency metadata',async()=>{
  const api=fakeApi({hierarchy:vi.fn().mockResolvedValue({asOf:'2026-07-19',legalEntities:[{value:legal,children:[]}]})});
  render(<SetupPage api={api} permissions={new Set(['organisation.read','organisation.version.create','organisation.version.end-date'])}/>);
  fireEvent.click(await screen.findByRole('button',{name:/ACME_IN/}));
  await screen.findByText('Version 1: Acme India');
  fireEvent.change(screen.getByLabelText('Version name'),{target:{value:'Acme India 2027'}});
  fireEvent.change(screen.getByLabelText('Version effective from'),{target:{value:'2027-01-01'}});
  fireEvent.click(screen.getByRole('button',{name:'Add version'}));
  await waitFor(()=>expect(api.addVersion).toHaveBeenCalledWith('legal-entities',legal.identityId,expect.objectContaining({name:'Acme India 2027',effectiveFrom:'2027-01-01'})));
  fireEvent.change(screen.getByLabelText('End date'),{target:{value:'2027-01-01'}});
  fireEvent.click(screen.getByRole('button',{name:'End-date active version'}));
  await waitFor(()=>expect(api.endDate).toHaveBeenCalledWith('legal-entities',legal.identityId,legal.versionId,legal.versionNo,'2027-01-01'));
});

test('submits a legal entity draft only when create is granted',async()=>{
  const api=fakeApi();
  render(<SetupPage api={api} permissions={new Set(['organisation.read','organisation.create'])}/>);
  await screen.findByText('No organisation configured');
  fireEvent.change(screen.getByLabelText('Code'),{target:{value:'new_le'}});
  fireEvent.change(screen.getByLabelText('Name'),{target:{value:'New Legal Entity'}});
  fireEvent.click(screen.getByRole('button',{name:'Create draft'}));
  await waitFor(()=>expect(api.create).toHaveBeenCalledWith('legal-entities',expect.objectContaining({code:'NEW_LE',name:'New Legal Entity'})));
});

test('surfaces API problem details as an accessible error',async()=>{
  const api=fakeApi({hierarchy:vi.fn().mockRejectedValue(new Error('Tenant context unavailable'))});
  render(<SetupPage api={api} permissions={new Set(['organisation.read'])}/>);
  expect(await screen.findByRole('alert')).toHaveTextContent('Tenant context unavailable');
});
