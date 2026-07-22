import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {expect,test,vi} from 'vitest';
import {SalaryStructurePage} from './SalaryStructurePage';
import {
  SalaryStructureApi,
  SalaryStructureComponentOption,
  SalaryStructureVersion
} from './salary-structure-api';

const component:SalaryStructureComponentOption={
  versionId:'21100000-0000-0000-0000-000000000001',
  code:'BASIC',
  name:'Basic Pay',
  componentType:'EARNING',
  formulaType:'FIXED'
};

const structure:SalaryStructureVersion={
  identityId:'22000000-0000-0000-0000-000000000001',
  code:'DEFAULT',
  identityStatus:'ACTIVE',
  versionId:'22200000-0000-0000-0000-000000000001',
  versionSequence:1,
  versionNo:1,
  name:'Default Structure',
  currency:'INR',
  effectiveFrom:'2026-01-01',
  effectiveTo:null,
  approvalStatus:'APPROVED',
  supersedesVersionId:null,
  superseded:false,
  lines:[{
    id:'22300000-0000-0000-0000-000000000001',
    componentVersionId:component.versionId,
    componentCode:'BASIC',
    componentName:'Basic Pay',
    componentType:'EARNING',
    componentFormulaType:'FIXED',
    sequenceNo:1,
    targetAmount:50000,
    targetPercentage:null,
    percentageBaseCode:null,
    effectiveFrom:'2026-01-01',
    effectiveTo:null
  }]
};

function fakeApi(overrides:Partial<SalaryStructureApi>={}):SalaryStructureApi{
  return {
    list:vi.fn().mockResolvedValue([]),
    listComponents:vi.fn().mockResolvedValue([component]),
    history:vi.fn().mockResolvedValue([structure]),
    create:vi.fn().mockResolvedValue({...structure,approvalStatus:'DRAFT'}),
    addVersion:vi.fn().mockResolvedValue({...structure,versionSequence:2,approvalStatus:'DRAFT'}),
    correct:vi.fn().mockResolvedValue({...structure,versionSequence:2,approvalStatus:'DRAFT'}),
    endDate:vi.fn().mockResolvedValue({...structure,effectiveTo:'2027-01-01',versionNo:2}),
    approve:vi.fn().mockResolvedValue(structure),
    ...overrides
  };
}

test('rejects the screen when structure read is absent',()=>{
  const api=fakeApi();
  render(<SalaryStructurePage api={api} permissions={new Set()}/>);
  expect(screen.getByRole('alert')).toHaveTextContent('do not have permission');
  expect(api.list).not.toHaveBeenCalled();
});

test('renders effective structures and exact component-version history',async()=>{
  const api=fakeApi({list:vi.fn().mockResolvedValue([structure])});
  render(<SalaryStructurePage api={api} permissions={new Set(['compensation.structure.read'])}/>);
  fireEvent.click(await screen.findByRole('button',{name:/DEFAULT/}));
  expect(await screen.findByText('Version 1: Default Structure')).toBeInTheDocument();
  expect(screen.getByText('BASIC: fixed 50000')).toBeInTheDocument();
  expect(api.listComponents).not.toHaveBeenCalled();
});

test('creates a complete structure draft with exact component lineage',async()=>{
  const api=fakeApi();
  render(<SalaryStructurePage
    api={api}
    permissions={new Set([
      'compensation.structure.read',
      'compensation.structure.create'
    ])}/>);
  await screen.findByText('No approved salary structures');
  fireEvent.change(screen.getByLabelText('Code'),{target:{value:'default'}});
  fireEvent.change(screen.getByLabelText('Name'),{target:{value:'Default Structure'}});
  fireEvent.change(screen.getByLabelText('Line 1 component'),{target:{value:component.versionId}});
  fireEvent.change(screen.getByLabelText('Line 1 amount'),{target:{value:'50000'}});
  fireEvent.click(screen.getByRole('button',{name:'Create salary-structure draft'}));
  await waitFor(()=>expect(api.create).toHaveBeenCalledWith(expect.objectContaining({
    code:'DEFAULT',
    currency:'INR',
    lines:[{
      componentVersionId:component.versionId,
      sequenceNo:1,
      targetAmount:50000
    }]
  })));
});

test('exposes version and optimistic end-date workflows',async()=>{
  const api=fakeApi({list:vi.fn().mockResolvedValue([structure])});
  render(<SalaryStructurePage
    api={api}
    permissions={new Set([
      'compensation.structure.read',
      'compensation.structure.version.create',
      'compensation.structure.version.end-date'
    ])}/>);
  fireEvent.click(await screen.findByRole('button',{name:/DEFAULT/}));
  await screen.findByText('Version 1: Default Structure');
  fireEvent.change(screen.getByLabelText('Effective from'),{target:{value:'2027-01-01'}});
  fireEvent.click(screen.getByRole('button',{name:'Add version'}));
  await waitFor(()=>expect(api.addVersion).toHaveBeenCalledWith(
    structure.identityId,
    expect.objectContaining({
      effectiveFrom:'2027-01-01',
      lines:[expect.objectContaining({
        componentVersionId:component.versionId,
        targetAmount:50000
      })]
    })
  ));
  fireEvent.change(screen.getByLabelText('End date'),{target:{value:'2027-01-01'}});
  fireEvent.click(screen.getByRole('button',{name:'End-date salary-structure version'}));
  await waitFor(()=>expect(api.endDate).toHaveBeenCalledWith(
    structure.identityId,
    structure.versionId,
    structure.versionNo,
    '2027-01-01'
  ));
});

test('surfaces API problem details accessibly',async()=>{
  const api=fakeApi({
    list:vi.fn().mockRejectedValue(new Error('Tenant context unavailable'))
  });
  render(<SalaryStructurePage
    api={api}
    permissions={new Set(['compensation.structure.read'])}/>);
  expect(await screen.findByRole('alert')).toHaveTextContent('Tenant context unavailable');
});