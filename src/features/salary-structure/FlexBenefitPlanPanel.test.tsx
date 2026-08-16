import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {expect,test,vi} from 'vitest';
import {FlexBenefitPlanPanel} from './FlexBenefitPlanPanel';
import type {BenefitSupplementalPlan,FlexBenefitApi,FlexBenefitPlan} from './flex-benefit-api';

const supplemental:BenefitSupplementalPlan={
  identityId:'sp1',versionId:'spv1',versionSequence:1,code:'BENEFITS',name:'Benefits',
  planType:'BENEFIT',approvalStatus:'APPROVED',effectiveFrom:'2027-01-01',effectiveTo:null,
  lines:[{componentVersionId:'cv1',componentCode:'MEAL',componentName:'Meal benefit',
    defaultAmount:10000,minimumAmount:0,maximumAmount:120000}]
};
const plan:FlexBenefitPlan={
  identityId:'f1',code:'FLEX',lifecycleStatus:'ACTIVE',identityVersionNo:1,versionId:'fv1',
  versionSequence:1,versionNo:0,name:'Flex',currency:'INR',supplementalPlanId:'sp1',
  supplementalPlanVersionId:'spv1',supplementalPlanCode:'BENEFITS',supplementalPlanName:'Benefits',
  supplementalPlanVersionSequence:1,eligibilityRuleId:null,eligibilityRuleVersionId:null,eligibilityRuleCode:null,
  annualBasketAmount:'120000.0000',electionWindowStart:'2027-01-01',electionWindowEnd:'2027-02-01',
  midYearJoiningRule:'DEFAULT_ELECTION',joiningElectionWindowDays:null,
  midYearChangeRule:'QUALIFYING_EVENT_ONLY',unusedBalanceRule:'FORFEIT',carryForwardLimit:null,
  taxableFallbackComponentVersionId:null,encashmentComponentVersionId:null,finalSettlementRule:'FORFEIT',
  retroCorrectionRule:'APPROVAL_REQUIRED',allowTotalCompensationChange:false,effectiveFrom:'2027-01-01',
  effectiveTo:null,approvalStatus:'DRAFT',approvedAt:null,approvedBy:null,supersedesVersionId:null,
  superseded:false,options:[{optionId:'o1',componentId:'c1',componentVersionId:'cv1',componentCode:'MEAL',
    componentName:'Meal benefit',optionSequence:1,minimumAnnualAmount:'0.0000',maximumAnnualAmount:'120000.0000',
    defaultAnnualAmount:'10000.0000',proofRequired:true,versionNo:0}]
};
function fakeApi(overrides:Partial<FlexBenefitApi>={}):FlexBenefitApi{return {
  list:vi.fn().mockResolvedValue([plan]),history:vi.fn().mockResolvedValue([plan]),
  benefitPlans:vi.fn().mockResolvedValue([supplemental]),eligibilityRules:vi.fn().mockResolvedValue([]),
  components:vi.fn().mockResolvedValue([{versionId:'cv1',code:'MEAL',name:'Meal benefit',approvalStatus:'APPROVED'}]),
  create:vi.fn().mockResolvedValue(plan),addVersion:vi.fn().mockResolvedValue(plan),correct:vi.fn().mockResolvedValue(plan),
  approve:vi.fn().mockResolvedValue({...plan,approvalStatus:'APPROVED'}),
  validateElection:vi.fn().mockResolvedValue({validationStatus:'PASS',annualBasketAmount:'120000.0000',
    electedAnnualAmount:'10000.0000',residualAnnualAmount:'110000.0000',residualTreatment:'FORFEIT',
    blockers:[],warnings:[],disclaimer:'DESIGN-TIME FLEX-BENEFIT POLICY VALIDATION — NOT AN EMPLOYEE ELECTION OR PAYROLL RESULT'}),
  ...overrides
}}

test('requires compensation structure read permission',()=>{
  const api=fakeApi();render(<FlexBenefitPlanPanel api={api} permissions={new Set()} asOf="2027-01-01"/>);
  expect(screen.getByText(/requires/)).toBeInTheDocument();expect(api.list).not.toHaveBeenCalled();
});

test('creates a flex policy from an approved BENEFIT supplemental plan',async()=>{
  const api=fakeApi({list:vi.fn().mockResolvedValue([])});
  render(<FlexBenefitPlanPanel api={api} permissions={new Set([
    'compensation.structure.read','compensation.structure.create'
  ])} asOf="2027-01-01"/>);
  fireEvent.change(await screen.findByLabelText('Approved BENEFIT supplemental plan'),{target:{value:'spv1'}});
  fireEvent.change(screen.getByLabelText('Annual basket amount'),{target:{value:'120000.0000'}});
  fireEvent.change(screen.getByLabelText('Flex plan code'),{target:{value:'flex_2027'}});
  fireEvent.change(screen.getByLabelText('Flex plan name'),{target:{value:'2027 Flex'}});
  fireEvent.click(screen.getByRole('button',{name:'Create flex-benefit policy draft'}));
  await waitFor(()=>expect(api.create).toHaveBeenCalledWith(expect.objectContaining({
    code:'FLEX_2027',version:expect.objectContaining({supplementalPlanVersionId:'spv1',
      annualBasketAmount:'120000.0000',options:[expect.objectContaining({componentVersionId:'cv1'})]})
  })));
});

test('validates policy without persisting an employee election',async()=>{
  const api=fakeApi();render(<FlexBenefitPlanPanel api={api} permissions={new Set([
    'compensation.structure.read','compensation.structure.simulate'
  ])} asOf="2027-01-01"/>);
  fireEvent.click(await screen.findByRole('button',{name:/FLEX/}));
  fireEvent.click(await screen.findByRole('button',{name:'Validate flex election policy'}));
  await waitFor(()=>expect(api.validateElection).toHaveBeenCalledWith('f1','fv1',expect.objectContaining({
    electionDate:'2027-01-01',eligibilityFacts:{},allocations:[{componentVersionId:'cv1',annualAmount:'10000.0000'}]
  })));
  expect(await screen.findByText(/^PASS$/)).toBeInTheDocument();
  expect(screen.getByText(/does not create an employee election/)).toBeInTheDocument();
});

test('exposes maker-checker approval only for draft policies',async()=>{
  const api=fakeApi();render(<FlexBenefitPlanPanel api={api} permissions={new Set([
    'compensation.structure.read','compensation.structure.approve'
  ])} asOf="2027-01-01"/>);
  fireEvent.click(await screen.findByRole('button',{name:/FLEX/}));
  fireEvent.click(await screen.findByRole('button',{name:'Approve flex-benefit policy'}));
  await waitFor(()=>expect(api.approve).toHaveBeenCalledWith('f1','fv1'));
});
