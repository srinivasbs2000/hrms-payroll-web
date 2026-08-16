import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {expect,test,vi} from 'vitest';
import {SalaryStructureStatutoryCompatibilityPanel} from './SalaryStructureStatutoryCompatibilityPanel';
import type {SalaryStructureValidation,SalaryStructureVersion} from './salary-structure-api';
import type {
  SalaryStructureStatutoryApi,
  SalaryStructureStatutoryBinding,
  StatutoryCompatibilityEvaluation,
  StatutoryRuleVersionOption
} from './salary-structure-statutory-api';

const structure={
  identityId:'s1',versionId:'sv1',effectiveFrom:'2027-01-01',approvalStatus:'DRAFT',
  lines:[{componentVersionId:'cv1',componentCode:'BASIC',componentName:'Basic'}]
} as unknown as SalaryStructureVersion;

const validation={
  validationId:'v1',validationStatus:'PASS',effectiveDate:'2027-01-01',resultHash:'result-hash'
} as unknown as SalaryStructureValidation;

const rule:StatutoryRuleVersionOption={
  statutoryRuleId:'r1',statutoryRuleVersionId:'rv1',versionSequence:1,
  jurisdictionCode:'TEST_JURISDICTION',authorityCode:'LABOUR',ruleCode:'MIN_WAGE',
  ruleName:'Minimum wage',ruleCategory:'MINIMUM_WAGE',currency:'INR',
  effectiveFrom:'2027-01-01',effectiveTo:null,constraintKind:'MINIMUM_WAGE',
  periodBasis:'MONTHLY',minimumAmount:25000
};

const binding:SalaryStructureStatutoryBinding={
  bindingId:'b1',salaryStructureVersionId:'sv1',statutoryRuleId:'r1',
  statutoryRuleVersionId:'rv1',statutoryRuleVersionSequence:1,
  jurisdictionCode:'TEST_JURISDICTION',authorityCode:'LABOUR',ruleCode:'MIN_WAGE',
  ruleName:'Minimum wage',ruleCategory:'MINIMUM_WAGE',bindingPurpose:'MINIMUM_WAGE',
  enforcementLevel:'BLOCKING',componentVersionId:'cv1',periodBasis:'MONTHLY',
  minimumAmount:25000,currency:'INR',status:'ACTIVE',versionNo:0,
  createdAt:'2027-01-01T00:00:00Z',createdBy:'maker',retiredAt:null,retiredBy:null
};

const evaluation:StatutoryCompatibilityEvaluation={
  evaluationId:'e1',validationId:'v1',salaryStructureVersionId:'sv1',
  statutoryBindingRevision:1,validationStatus:'FAIL',blockingIssueCount:1,
  advisoryIssueCount:0,evidenceHash:'a'.repeat(64),createdAt:'2027-01-01T00:00:00Z',
  createdBy:'maker',disclaimer:'DESIGN-TIME STATUTORY COMPATIBILITY — NOT AN OFFICIAL PAYROLL OR LEGAL CALCULATION',
  issues:[{issueId:'i1',bindingId:'b1',issueCode:'MINIMUM_WAGE_BELOW_THRESHOLD',
    severity:'BLOCKING',statutoryRuleId:'r1',statutoryRuleVersionId:'rv1',
    componentVersionId:'cv1',periodBasis:'MONTHLY',requiredAmount:25000,
    actualAmount:20000,issueDetail:'below threshold'}]
};

function fakeApi(overrides:Partial<SalaryStructureStatutoryApi>={}):SalaryStructureStatutoryApi{
  return {
    ruleVersions:vi.fn().mockResolvedValue([rule]),
    bindings:vi.fn().mockResolvedValue([]),
    bind:vi.fn().mockResolvedValue(binding),
    retire:vi.fn().mockResolvedValue({...binding,status:'RETIRED'}),
    evaluate:vi.fn().mockResolvedValue(evaluation),
    evaluations:vi.fn().mockResolvedValue([]),
    ...overrides
  };
}

test('does not call statutory APIs until the user opens the workspace',()=>{
  const api=fakeApi();
  render(<SalaryStructureStatutoryCompatibilityPanel
    api={api} permissions={new Set(['compensation.structure.read'])}
    structure={structure} validations={[validation]}/>);
  expect(api.ruleVersions).not.toHaveBeenCalled();
  expect(screen.getByText(/Legal values remain in approved statutory-rule versions/)).toBeInTheDocument();
});

test('binds an approved minimum-wage rule to a structure component',async()=>{
  const api=fakeApi();
  render(<SalaryStructureStatutoryCompatibilityPanel
    api={api} permissions={new Set([
      'compensation.structure.read','compensation.structure.version.create'
    ])} structure={structure} validations={[validation]}/>);
  fireEvent.click(screen.getByRole('button',{name:'Load statutory compatibility'}));
  await screen.findByLabelText('Approved statutory rule version');
  fireEvent.click(screen.getByRole('button',{name:'Bind statutory authority'}));
  await waitFor(()=>expect(api.bind).toHaveBeenCalledWith(
    's1','sv1',expect.objectContaining({
      statutoryRuleVersionId:'rv1',
      bindingPurpose:'MINIMUM_WAGE',
      enforcementLevel:'BLOCKING',
      componentVersionId:'cv1'
    })));
});

test('shows blocking compatibility evidence without claiming payroll calculation',async()=>{
  const api=fakeApi();
  render(<SalaryStructureStatutoryCompatibilityPanel
    api={api} permissions={new Set([
      'compensation.structure.read','compensation.structure.simulate'
    ])} structure={structure} validations={[validation]}/>);
  fireEvent.click(screen.getByRole('button',{name:'Load statutory compatibility'}));
  fireEvent.click(await screen.findByRole('button',{name:'Evaluate statutory compatibility'}));
  expect(await screen.findByText(/MINIMUM_WAGE_BELOW_THRESHOLD/)).toBeInTheDocument();
  expect(screen.getAllByText(/NOT AN OFFICIAL PAYROLL OR LEGAL CALCULATION/).length).toBeGreaterThan(0);
});
