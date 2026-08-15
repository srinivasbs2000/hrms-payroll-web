import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {expect,test,vi} from 'vitest';
import {PayComponentVersion} from '../pay-component/pay-component-api';
import {ComponentControlsPage} from './ComponentControlsPage';
import {
  ComponentControlApi,
  FormulaValidationView,
  RateTableView
} from './component-controls-api';

const component:PayComponentVersion={
  identityId:'20000000-0000-0000-0000-000000000001',
  code:'BASIC',name:'Basic Pay',componentType:'EARNING',
  lifecycleStatus:'ACTIVE',ownershipScope:'TENANT',countryCode:null,
  protectedFlag:false,confidentialityLevel:'STANDARD',identityVersionNo:1,
  retirementEffectiveDate:null,retirementReason:null,retiredAt:null,retiredBy:null,
  versionId:'21000000-0000-0000-0000-000000000001',
  versionSequence:1,versionNo:1,catalogueSchemaVersion:1,
  classificationStatus:'COMPLETE',formulaType:'FIXED',formulaExpression:null,
  fixedAmount:50000,roundingScale:2,componentCategory:'CASH_EARNING',
  componentSubcategory:'BASIC_PAY',cashImpact:'INCREASE',payeeType:'EMPLOYEE',
  paymentChannel:'PAYROLL_BANK',settlementTiming:'CURRENT_PERIOD',
  payslipVisibility:'SHOW',zeroValueVisibility:'SUPPRESS',
  negativeValuePolicy:'PROHIBIT',frequency:'MONTHLY',valueNature:'FIXED',
  amountRepresentation:'MONTHLY_AMOUNT',taxTreatment:'DELEGATED',
  payrollTiming:'REGULAR',effectiveFrom:'2026-01-01',effectiveTo:null,
  approvalStatus:'APPROVED',supersedesVersionId:null,superseded:false
};

const rate:RateTableView={
  identityId:'30000000-0000-0000-0000-000000000001',
  code:'GRADE_RATE',name:'Grade rate',lifecycleStatus:'PENDING_APPROVAL',
  identityVersionNo:0,retirementEffectiveDate:null,retirementReason:null,
  versionId:'31000000-0000-0000-0000-000000000001',
  versionSequence:1,versionNo:0,valueType:'AMOUNT',unitCode:'INR',
  effectiveFrom:'2026-01-01',effectiveTo:null,approvalStatus:'DRAFT',
  supersedesVersionId:null,superseded:false,
  dimensions:[{id:'32000000-0000-0000-0000-000000000001',sequence:1,
    code:'GRADE',name:'Grade',dataType:'TEXT'}],
  cells:[{id:'33000000-0000-0000-0000-000000000001',sequence:1,
    dimensionValues:{GRADE:'A'},rateValue:'1000'}]
};

const validation:FormulaValidationView={
  canonicalExpression:'BASIC*0.1',dependencies:['BASIC'],
  calculationPhase:'PRE_TAX',resultContract:'DECIMAL',
  formulaFingerprint:'abc123'
};

function fakeApi(overrides:Partial<ComponentControlApi>={}):ComponentControlApi{
  return {
    listComponents:vi.fn().mockResolvedValue([component]),
    addComponentVersion:vi.fn().mockResolvedValue(component),
    validateFormula:vi.fn().mockResolvedValue(validation),
    dependencies:vi.fn().mockResolvedValue([]),
    impact:vi.fn().mockResolvedValue({
      componentId:component.identityId,outgoingDependencies:[],formulaDependants:[],
      payrollBaseIds:['base-1'],salaryStructureIds:[],roundingPolicyIds:[],prorationPolicyIds:[]
    }),
    statutoryWageReferences:vi.fn().mockResolvedValue([]),
    componentAudit:vi.fn().mockResolvedValue([{action:'VERSION_APPROVED'}]),
    listRateTables:vi.fn().mockResolvedValue([]),
    createRateTable:vi.fn().mockResolvedValue(rate),
    rateHistory:vi.fn().mockResolvedValue([rate]),
    addRateVersion:vi.fn().mockResolvedValue(rate),
    correctRateVersion:vi.fn().mockResolvedValue(rate),
    approveRate:vi.fn().mockResolvedValue({...rate,approvalStatus:'APPROVED',lifecycleStatus:'ACTIVE'}),
    endDateRate:vi.fn().mockResolvedValue({...rate,effectiveTo:'2027-01-01'}),
    retireRate:vi.fn().mockResolvedValue({...rate,lifecycleStatus:'RETIRED'}),
    lookupRate:vi.fn().mockResolvedValue({
      identityId:rate.identityId,versionId:rate.versionId,valueType:'AMOUNT',
      unitCode:'INR',dimensionValues:{GRADE:'A'},rateValue:'1000',
      effectiveFrom:'2026-01-01',effectiveTo:null
    }),
    rateAudit:vi.fn().mockResolvedValue([]),
    listRoundingPolicies:vi.fn().mockResolvedValue([]),
    createRoundingPolicy:vi.fn().mockRejectedValue(new Error('not used')),
    roundingHistory:vi.fn().mockResolvedValue([]),
    addRoundingVersion:vi.fn().mockRejectedValue(new Error('not used')),
    correctRoundingVersion:vi.fn().mockRejectedValue(new Error('not used')),
    approveRounding:vi.fn().mockRejectedValue(new Error('not used')),
    endDateRounding:vi.fn().mockRejectedValue(new Error('not used')),
    retireRounding:vi.fn().mockRejectedValue(new Error('not used')),
    roundingAudit:vi.fn().mockResolvedValue([]),
    listProrationPolicies:vi.fn().mockResolvedValue([]),
    createProrationPolicy:vi.fn().mockRejectedValue(new Error('not used')),
    prorationHistory:vi.fn().mockResolvedValue([]),
    addProrationVersion:vi.fn().mockRejectedValue(new Error('not used')),
    correctProrationVersion:vi.fn().mockRejectedValue(new Error('not used')),
    approveProration:vi.fn().mockRejectedValue(new Error('not used')),
    endDateProration:vi.fn().mockRejectedValue(new Error('not used')),
    retireProration:vi.fn().mockRejectedValue(new Error('not used')),
    prorationAudit:vi.fn().mockResolvedValue([]),
    ...overrides
  };
}

test('rejects component controls without read authority',()=>{
  const api=fakeApi();
  render(<ComponentControlsPage api={api} permissions={new Set()}/>);
  expect(screen.getByRole('alert')).toHaveTextContent('do not have permission');
  expect(api.listComponents).not.toHaveBeenCalled();
});

test('validates formulas and inspects component impact',async()=>{
  const api=fakeApi();
  render(<ComponentControlsPage api={api} permissions={
    new Set(['compensation.component.read'])
  }/>);
  fireEvent.click(await screen.findByRole('button',{name:/BASIC/}));
  fireEvent.change(screen.getByLabelText('Formula expression'),{
    target:{value:'BASIC*0.1'}
  });
  fireEvent.click(screen.getByRole('button',{name:'Validate formula'}));
  expect(await screen.findByText('BASIC*0.1')).toBeInTheDocument();
  expect(api.validateFormula).toHaveBeenCalledWith('BASIC*0.1','INPUT');
  fireEvent.click(screen.getByRole('button',{
    name:'Inspect dependency impact & statutory references'
  }));
  expect(await screen.findByText('Payroll bases: 1 · Salary structures: 0'))
    .toBeInTheDocument();
  expect(api.impact).toHaveBeenCalledWith(component.identityId);
});

test('creates advanced component version with phase and exact wage-rule pairs',async()=>{
  const api=fakeApi();
  render(<ComponentControlsPage api={api} permissions={
    new Set(['compensation.component.read','compensation.component.version.create'])
  }/>);
  fireEvent.click(await screen.findByRole('button',{name:/BASIC/}));
  fireEvent.change(screen.getByLabelText('Version formula type'),{
    target:{value:'PERCENTAGE_OF_COMPONENT'}
  });
  fireEvent.change(screen.getByLabelText('Version formula expression'),{
    target:{value:'BASIC*0.1'}
  });
  fireEvent.change(screen.getByLabelText('Version calculation phase'),{
    target:{value:'PRE_TAX'}
  });
  fireEvent.change(screen.getByLabelText('Statutory wage references'),{
    target:{value:'40000000-0000-0000-0000-000000000001,41000000-0000-0000-0000-000000000001'}
  });
  fireEvent.click(screen.getByRole('button',{name:'Create controlled version'}));
  await waitFor(()=>expect(api.addComponentVersion).toHaveBeenCalledWith(
    component.identityId,
    expect.objectContaining({
      formulaType:'PERCENTAGE_OF_COMPONENT',
      formulaExpression:'BASIC*0.1',
      calculationPhase:'PRE_TAX',
      resultContract:'DECIMAL',
      statutoryWageReferences:[{
        statutoryRuleId:'40000000-0000-0000-0000-000000000001',
        statutoryRuleVersionId:'41000000-0000-0000-0000-000000000001'
      }]
    })
  ));
});

test('creates a typed multidimensional rate table',async()=>{
  const api=fakeApi();
  render(<ComponentControlsPage api={api} permissions={
    new Set(['compensation.component.read','compensation.component.create'])
  }/>);
  await screen.findByRole('heading',{name:'Multidimensional rate tables'});
  fireEvent.change(screen.getByLabelText('Rate table code'),{target:{value:'grade_rate'}});
  fireEvent.change(screen.getByLabelText('Rate table name'),{target:{value:'Grade Rate'}});
  fireEvent.click(screen.getByRole('button',{name:'Add dimension'}));
  fireEvent.change(screen.getByLabelText('Dimension 2 code'),{target:{value:'STATE'}});
  fireEvent.change(screen.getByLabelText('Cell 1 GRADE'),{target:{value:'A'}});
  fireEvent.change(screen.getByLabelText('Cell 1 STATE'),{target:{value:'KA'}});
  fireEvent.change(screen.getByLabelText('Cell 1 rate value'),{target:{value:'1000'}});
  fireEvent.click(screen.getByRole('button',{name:'Create rate table'}));
  await waitFor(()=>expect(api.createRateTable).toHaveBeenCalledWith(
    expect.objectContaining({
      code:'GRADE_RATE',
      version:expect.objectContaining({
        valueType:'AMOUNT',
        unitCode:'INR',
        dimensions:expect.arrayContaining([
          expect.objectContaining({code:'GRADE'}),
          expect.objectContaining({code:'STATE'})
        ]),
        cells:[expect.objectContaining({
          dimensionValues:{GRADE:'A',STATE:'KA'},
          rateValue:'1000'
        })]
      })
    })
  ));
});

test('hides checker actions until approval authority is present',async()=>{
  const withoutApprove=fakeApi({listRateTables:vi.fn().mockResolvedValue([rate])});
  const first=render(<ComponentControlsPage api={withoutApprove} permissions={
    new Set(['compensation.component.read'])
  }/>);
  fireEvent.click(await screen.findByRole('button',{name:/GRADE_RATE/}));
  expect(screen.queryByRole('button',{name:'Approve rate version'})).not.toBeInTheDocument();
  first.unmount();

  const approve=vi.fn().mockResolvedValue({...rate,approvalStatus:'APPROVED',lifecycleStatus:'ACTIVE'});
  const withApprove=fakeApi({
    listRateTables:vi.fn().mockResolvedValue([rate]),
    approveRate:approve
  });
  render(<ComponentControlsPage api={withApprove} permissions={
    new Set(['compensation.component.read','compensation.component.approve'])
  }/>);
  fireEvent.click(await screen.findByRole('button',{name:/GRADE_RATE/}));
  fireEvent.click(screen.getByRole('button',{name:'Approve rate version'}));
  await waitFor(()=>expect(approve).toHaveBeenCalledWith(
    rate.identityId,rate.versionId,rate.versionNo
  ));
});


test('selecting a component does not retrigger the catalogue reload loop',async()=>{
  const api=fakeApi();
  render(<ComponentControlsPage api={api} permissions={
    new Set(['compensation.component.read'])
  }/>);
  fireEvent.click(await screen.findByRole('button',{name:/BASIC/}));
  await screen.findByRole('heading',{name:/BASIC · formula/});
  await waitFor(()=>expect(api.listComponents).toHaveBeenCalledTimes(1));
});


test('exposes component audit only with audit authority',async()=>{
  const api=fakeApi();
  const first=render(<ComponentControlsPage api={api} permissions={
    new Set(['compensation.component.read'])
  }/>);
  fireEvent.click(await screen.findByRole('button',{name:/BASIC/}));
  expect(screen.queryByRole('button',{name:'Load component audit'})).not.toBeInTheDocument();
  first.unmount();

  render(<ComponentControlsPage api={api} permissions={
    new Set(['compensation.component.read','audit.read'])
  }/>);
  fireEvent.click(await screen.findByRole('button',{name:/BASIC/}));
  fireEvent.click(screen.getByRole('button',{name:'Load component audit'}));
  expect(await screen.findByText(/VERSION_APPROVED/)).toBeInTheDocument();
  expect(api.componentAudit).toHaveBeenCalledWith(component.identityId);
});
