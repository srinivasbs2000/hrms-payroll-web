import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {expect,test,vi} from 'vitest';
import {SalaryStructureLifecyclePanel} from './SalaryStructureLifecyclePanel';
import type {SalaryStructureVersion} from './salary-structure-api';
import type {SalaryStructureLifecycle,SalaryStructureLifecycleApi} from './salary-structure-lifecycle-api';

const structure={
  identityId:'s1',code:'DEFAULT',identityStatus:'ACTIVE',versionId:'sv1',versionSequence:1,
  versionNo:1,name:'Default',currency:'INR',structureSchemaVersion:1,structureType:'STANDARD',
  payFrequency:'MONTHLY',confidentialityLevel:'STANDARD',ctcPolicyVersionId:'pv1',
  eligibilityRuleVersionId:null,targetType:'ANNUAL_CTC',targetAnnualAmount:1200000,
  toleranceAmount:.01,residualComponentVersionId:'cv1',configurationHash:'a'.repeat(64),
  validationFingerprint:'b'.repeat(64),effectiveFrom:'2027-01-01',effectiveTo:null,
  approvalStatus:'DRAFT',supersedesVersionId:null,superseded:false,lines:[]
} as SalaryStructureVersion;

const draft:SalaryStructureLifecycle={
  identityId:'s1',versionId:'sv1',versionNo:1,workflowStatus:'DRAFT',approvalStatus:'DRAFT',
  publishedActive:false,submittedAt:null,submittedBy:null,approvedAt:null,approvedBy:null,
  publishedAt:null,publishedBy:null,configurationHash:'a'.repeat(64),
  validationFingerprint:'b'.repeat(64),statutoryBindingRevision:0,actions:[]
};
const submitted:SalaryStructureLifecycle={...draft,versionNo:2,workflowStatus:'SUBMITTED',
  submittedAt:'2026-08-16T12:00:00Z',submittedBy:'maker',actions:[{
    actionId:'a1',actionSequence:1,actionType:'SUBMITTED',actor:'maker',
    occurredAt:'2026-08-16T12:00:00Z',comment:'review',configurationHash:'a'.repeat(64),
    validationFingerprint:'b'.repeat(64),statutoryBindingRevision:0,
    statutoryEvidenceHash:null,structureVersionNo:2,actionHash:'c'.repeat(64)}]};
const approved:SalaryStructureLifecycle={...submitted,versionNo:3,workflowStatus:'APPROVED',
  approvalStatus:'APPROVED',approvedAt:'2026-08-16T12:05:00Z',approvedBy:'checker'};
const published:SalaryStructureLifecycle={...approved,versionNo:4,workflowStatus:'PUBLISHED',
  publishedAt:'2026-08-16T12:10:00Z',publishedBy:'publisher'};

function fakeApi(overrides:Partial<SalaryStructureLifecycleApi>={}):SalaryStructureLifecycleApi{
  return {
    lifecycle:vi.fn().mockResolvedValue(draft),
    submit:vi.fn().mockResolvedValue(submitted),
    approve:vi.fn().mockResolvedValue(undefined),
    reject:vi.fn().mockResolvedValue(draft),
    publish:vi.fn().mockResolvedValue(published),
    ...overrides
  };
}

test('loads lifecycle only when opened',async()=>{
  const api=fakeApi();
  render(<SalaryStructureLifecyclePanel structure={structure}
    permissions={new Set(['compensation.structure.read'])} api={api}/>);
  expect(api.lifecycle).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Open approval lifecycle'}));
  await waitFor(()=>expect(api.lifecycle).toHaveBeenCalledWith('s1','sv1'));
  expect(await screen.findByText('DRAFT')).toBeInTheDocument();
});

test('maker submits exact validated version with optimistic version',async()=>{
  const api=fakeApi();
  render(<SalaryStructureLifecyclePanel structure={structure}
    permissions={new Set(['compensation.structure.read','compensation.structure.submit'])} api={api}/>);
  fireEvent.click(screen.getByRole('button',{name:'Open approval lifecycle'}));
  fireEvent.change(await screen.findByLabelText('Submission comment'),{target:{value:'review'}});
  fireEvent.click(screen.getByRole('button',{name:'Submit for approval'}));
  await waitFor(()=>expect(api.submit).toHaveBeenCalledWith('s1','sv1',1,'review'));
  expect(await screen.findAllByText('SUBMITTED')).toHaveLength(2);
});

test('checker approves or rejects a submitted structure',async()=>{
  const api=fakeApi({lifecycle:vi.fn().mockResolvedValueOnce(submitted).mockResolvedValueOnce(approved)});
  render(<SalaryStructureLifecyclePanel structure={structure}
    permissions={new Set(['compensation.structure.read','compensation.structure.approve'])} api={api}/>);
  fireEvent.click(screen.getByRole('button',{name:'Open approval lifecycle'}));
  fireEvent.click(await screen.findByRole('button',{name:'Approve submitted structure'}));
  await waitFor(()=>expect(api.approve).toHaveBeenCalledWith('s1','sv1'));
  expect(await screen.findByText('APPROVED')).toBeInTheDocument();
});

test('publisher is a distinct lifecycle action',async()=>{
  const api=fakeApi({lifecycle:vi.fn().mockResolvedValue(approved)});
  render(<SalaryStructureLifecyclePanel structure={structure}
    permissions={new Set(['compensation.structure.read','compensation.structure.publish'])} api={api}/>);
  fireEvent.click(screen.getByRole('button',{name:'Open approval lifecycle'}));
  fireEvent.click(await screen.findByRole('button',{name:'Publish approved structure'}));
  await waitFor(()=>expect(api.publish).toHaveBeenCalledWith('s1','sv1',3,undefined));
  expect(await screen.findByText('PUBLISHED')).toBeInTheDocument();
});
