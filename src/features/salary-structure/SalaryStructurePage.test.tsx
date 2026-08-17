import {fireEvent,render,screen,waitFor} from '@testing-library/react';import {expect,test,vi} from 'vitest';import {SalaryStructurePage} from './SalaryStructurePage';
import type {CompensationConfigurationApi,CtcPolicyVersion,EligibilityRuleVersion,SalaryStructurePayrollBaseOption,SalaryStructureValidation,SalaryStructureVersion} from './salary-structure-api';
export const component={identityId:'c1',versionId:'cv1',code:'BASIC',name:'Basic',componentType:'EARNING' as const,formulaType:'FIXED' as const,approvalStatus:'APPROVED' as const};
export const payrollBase:SalaryStructurePayrollBaseOption={versionId:'bv1',code:'BASIC_BASE',name:'Basic target base',baseCategory:'CTC',approvalStatus:'APPROVED'};
export const ctc:CtcPolicyVersion={identityId:'p1',code:'STD_CTC',lifecycleStatus:'ACTIVE',identityVersionNo:1,retirementEffectiveDate:null,retirementReason:null,retiredAt:null,retiredBy:null,versionId:'pv1',versionSequence:1,versionNo:0,name:'Standard CTC',currency:'INR',annualisationMethod:'MONTHLY_X_12',toleranceAmount:.01,residualComponentId:'c1',residualComponentVersionId:'cv1',residualComponentCode:'BASIC',residualComponentName:'Basic',effectiveFrom:'2026-01-01',effectiveTo:null,approvalStatus:'DRAFT',supersedesVersionId:null,superseded:false,treatments:[]};
export const rule:EligibilityRuleVersion={identityId:'r1',code:'INDIA',lifecycleStatus:'ACTIVE',identityVersionNo:1,retirementEffectiveDate:null,retirementReason:null,retiredAt:null,retiredBy:null,versionId:'rv1',versionSequence:1,versionNo:0,name:'India rule',resultWhenMatched:'ELIGIBLE',resultWhenNotMatched:'NOT_ELIGIBLE',effectiveFrom:'2026-01-01',effectiveTo:null,approvalStatus:'APPROVED',supersedesVersionId:null,superseded:false,criteria:[{id:'q1',criterionSequence:1,factKey:'COUNTRY_CODE',factType:'TEXT',comparisonOperator:'EQ',value:'IN',versionNo:0}]};
export const structure:SalaryStructureVersion={identityId:'s1',code:'DEFAULT',identityStatus:'ACTIVE',versionId:'sv1',versionSequence:1,versionNo:0,name:'Default',currency:'INR',structureSchemaVersion:1,structureType:'STANDARD',payFrequency:'MONTHLY',confidentialityLevel:'STANDARD',ctcPolicyVersionId:'pv1',eligibilityRuleVersionId:'rv1',targetType:'ANNUAL_CTC',targetFrequency:'ANNUAL',targetSourceAmount:'1200000.0000',targetAnnualizationFactor:'1.0000',targetExecutionMode:'STRUCTURAL',inclusivePayrollBaseVersionId:null,exclusivePayrollBaseVersionId:null,targetAnnualAmount:'1200000.0000',toleranceAmount:'0.0100',residualComponentVersionId:'cv1',configurationHash:'config',validationFingerprint:null,effectiveFrom:'2026-01-01',effectiveTo:null,approvalStatus:'DRAFT',supersedesVersionId:null,superseded:false,lines:[{id:'sl1',componentId:'c1',componentVersionId:'cv1',componentCode:'BASIC',componentName:'Basic',componentType:'EARNING',componentFormulaType:'FIXED',lineSchemaVersion:1,sequenceNo:1,lineType:'RESIDUAL',targetAmount:null,targetPercentage:null,percentageBaseCode:null,minimumAmount:null,maximumAmount:null,mandatory:true,overridePolicy:'CONTROLLED',ctcDisplayOrder:1,payslipDisplayOrder:1,effectiveFrom:'2026-01-01',effectiveTo:null}]};
export const validation:SalaryStructureValidation={validationId:'v1',identityId:'s1',versionId:'sv1',ctcPolicyVersionId:'pv1',eligibilityRuleVersionId:'rv1',effectiveDate:'2026-01-01',targetAmount:1200000,validationStatus:'PASS',requestHash:'request',configurationHash:'config',resultHash:'result',blockingErrorCount:0,warningCount:1,summary:{statutoryCompatibilityStatus:'STRUCTURAL_ONLY'},createdAt:'2026-01-01T00:00:00Z',createdBy:'maker',disclaimer:'DESIGN-TIME SALARY-STRUCTURE SIMULATION — NOT AN EMPLOYEE PAYROLL RESULT',lines:[]};
export function fakeApi(overrides:Partial<CompensationConfigurationApi>={}):CompensationConfigurationApi{return {listStructures:vi.fn().mockResolvedValue([structure]),listComponents:vi.fn().mockResolvedValue([component]),listPayrollBases:vi.fn().mockResolvedValue([payrollBase]),structureHistory:vi.fn().mockResolvedValue([structure]),createStructure:vi.fn().mockResolvedValue(structure),addStructureVersion:vi.fn().mockResolvedValue(structure),correctStructure:vi.fn().mockResolvedValue(structure),endDateStructure:vi.fn().mockResolvedValue(structure),approveStructure:vi.fn().mockResolvedValue(structure),simulateStructure:vi.fn().mockResolvedValue(validation),structureValidations:vi.fn().mockResolvedValue([]),bindStructureValidation:vi.fn().mockResolvedValue({...structure,validationFingerprint:'result'}),ctcList:vi.fn().mockResolvedValue([ctc]),ctcHistory:vi.fn().mockResolvedValue([ctc]),ctcCreate:vi.fn().mockResolvedValue(ctc),ctcAddVersion:vi.fn().mockResolvedValue(ctc),ctcCorrect:vi.fn().mockResolvedValue(ctc),ctcEndDate:vi.fn().mockResolvedValue(ctc),ctcApprove:vi.fn().mockResolvedValue({...ctc,approvalStatus:'APPROVED'}),ctcRetire:vi.fn().mockResolvedValue(ctc),eligibilityList:vi.fn().mockResolvedValue([rule]),eligibilityHistory:vi.fn().mockResolvedValue([rule]),eligibilityCreate:vi.fn().mockResolvedValue(rule),eligibilityAddVersion:vi.fn().mockResolvedValue(rule),eligibilityCorrect:vi.fn().mockResolvedValue(rule),eligibilityEndDate:vi.fn().mockResolvedValue(rule),eligibilityApprove:vi.fn().mockResolvedValue(rule),eligibilityEvaluate:vi.fn().mockResolvedValue({identityId:'r1',versionId:'rv1',result:'ELIGIBLE',matched:true,configurationHash:'c',factsHash:'f',evaluationHash:'e',disclaimer:'DESIGN-TIME ONLY',criteria:[]}),eligibilityRetire:vi.fn().mockResolvedValue(rule),...overrides}}

test('requires structure read permission',()=>{const api=fakeApi();render(<SalaryStructurePage api={api} permissions={new Set()}/>);expect(screen.getByRole('alert')).toBeInTheDocument();expect(api.listStructures).not.toHaveBeenCalled()});
test('keeps CTC and eligibility inside one workbench',async()=>{
  const api=fakeApi();
  render(<SalaryStructurePage api={api} permissions={new Set(['compensation.structure.read','compensation.component.read','compensation.ctc-policy.read','compensation.eligibility-rule.read'])}/>);
  expect(await screen.findByRole('tab',{name:'Salary structures'})).toBeInTheDocument();
  fireEvent.click(screen.getByRole('tab',{name:'CTC policies'}));
  expect(screen.getByRole('heading',{name:'CTC policies'})).toBeInTheDocument();
  await waitFor(()=>expect(api.ctcList).toHaveBeenCalled());
  fireEvent.click(screen.getByRole('tab',{name:'Eligibility rules'}));
  expect(screen.getByRole('heading',{name:'Eligibility rules'})).toBeInTheDocument();
  await waitFor(()=>expect(api.eligibilityList).toHaveBeenCalled());
});
test('shows exact version-pinned target metadata',async()=>{const api=fakeApi();render(<SalaryStructurePage api={api} permissions={new Set(['compensation.structure.read'])}/>);fireEvent.click(await screen.findByRole('button',{name:/DEFAULT/}));expect(await screen.findByText(/v1 Default/)).toBeInTheDocument();expect(screen.getByText(/validation not bound/)).toBeInTheDocument();await waitFor(()=>expect(api.structureHistory).toHaveBeenCalledWith('s1'))});
test('does not approve an unvalidated draft',async()=>{
  const api=fakeApi();
  render(<SalaryStructurePage api={api} permissions={new Set(['compensation.structure.read','compensation.structure.approve'])}/>);
  fireEvent.click(await screen.findByRole('button',{name:/DEFAULT/}));
  await waitFor(()=>expect(api.structureHistory).toHaveBeenCalledWith('s1'));
  await waitFor(()=>expect(api.structureValidations).toHaveBeenCalledWith('s1','sv1'));
  expect(screen.queryByRole('button',{name:'Approve validated structure'})).not.toBeInTheDocument();
});
test('routes approval through the governed lifecycle workbench',async()=>{const api=fakeApi({listStructures:vi.fn().mockResolvedValue([{...structure,validationFingerprint:'result'}]),structureHistory:vi.fn().mockResolvedValue([{...structure,validationFingerprint:'result'}])});render(<SalaryStructurePage api={api} permissions={new Set(['compensation.structure.read','compensation.structure.approve'])}/>);fireEvent.click(await screen.findByRole('button',{name:/DEFAULT/}));expect(await screen.findByRole('button',{name:'Open approval lifecycle'})).toBeInTheDocument();expect(screen.queryByRole('button',{name:'Approve validated structure'})).not.toBeInTheDocument();expect(api.approveStructure).not.toHaveBeenCalled()});
test('preserves append-only structure version creation',async()=>{const api=fakeApi();render(<SalaryStructurePage api={api} permissions={new Set(['compensation.structure.read','compensation.component.read','compensation.ctc-policy.read','compensation.eligibility-rule.read','compensation.structure.version.create'])}/>);fireEvent.click(await screen.findByRole('button',{name:/DEFAULT/}));fireEvent.click(await screen.findByRole('button',{name:'Add structure version'}));await waitFor(()=>expect(api.addStructureVersion).toHaveBeenCalledWith('s1',expect.objectContaining({code:undefined,ctcPolicyVersionId:'pv1',residualComponentVersionId:'cv1'})))});
test('preserves optimistic structure end dating',async()=>{const api=fakeApi();render(<SalaryStructurePage api={api} permissions={new Set(['compensation.structure.read','compensation.structure.version.end-date'])}/>);fireEvent.click(await screen.findByRole('button',{name:/DEFAULT/}));fireEvent.change(screen.getByLabelText('Structure end date'),{target:{value:'2027-01-01'}});fireEvent.click(screen.getByRole('button',{name:'End-date structure version'}));await waitFor(()=>expect(api.endDateStructure).toHaveBeenCalledWith('s1','sv1',0,'2027-01-01'))});

test('submits monthly source target without client-side annual amount calculation',async()=>{
  const api=fakeApi();
  render(<SalaryStructurePage api={api} permissions={new Set([
    'compensation.structure.read','compensation.structure.version.create','compensation.base.read'
  ])}/>);
  fireEvent.click(await screen.findByRole('button',{name:/DEFAULT/}));
  fireEvent.change(screen.getByLabelText('Target type'),{target:{value:'MONTHLY_GROSS'}});
  fireEvent.change(screen.getByLabelText('Target source amount'),{target:{value:'100000.0000'}});
  fireEvent.click(screen.getByRole('button',{name:'Add structure version'}));
  await waitFor(()=>expect(api.addStructureVersion).toHaveBeenCalledWith('s1',expect.objectContaining({
    targetType:'MONTHLY_GROSS',targetFrequency:'MONTHLY',targetAmount:'100000.0000',
    targetAnnualizationFactor:'12',targetAnnualAmount:undefined,toleranceAmount:'0.0100'
  })));
});

test('requires an approved inclusive payroll base for resolver-owned targets',async()=>{
  const api=fakeApi();
  render(<SalaryStructurePage api={api} permissions={new Set([
    'compensation.structure.read','compensation.structure.version.create','compensation.base.read'
  ])}/>);
  fireEvent.click(await screen.findByRole('button',{name:/DEFAULT/}));
  fireEvent.change(screen.getByLabelText('Target type'),{target:{value:'ANNUAL_BASIC'}});
  fireEvent.click(screen.getByRole('button',{name:'Add structure version'}));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Annual basic requires an approved inclusive payroll base.');
  expect(api.addStructureVersion).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Inclusive payroll base'),{target:{value:'bv1'}});
  fireEvent.click(screen.getByRole('button',{name:'Add structure version'}));
  await waitFor(()=>expect(api.addStructureVersion).toHaveBeenCalledWith('s1',expect.objectContaining({
    targetType:'ANNUAL_BASIC',targetFrequency:'ANNUAL',targetAnnualizationFactor:'1',
    inclusivePayrollBaseVersionId:'bv1'
  })));
});

test('keeps rate and net-pay target execution inside the calculation engine',async()=>{
  const api=fakeApi();
  render(<SalaryStructurePage api={api} permissions={new Set([
    'compensation.structure.read','compensation.structure.version.create','compensation.base.read'
  ])}/>);
  fireEvent.click(await screen.findByRole('button',{name:/DEFAULT/}));
  fireEvent.change(screen.getByLabelText('Target type'),{target:{value:'HOURLY_RATE'}});
  expect(screen.getByText(/does not perform gross-up, tax iteration/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Target source amount'),{target:{value:'1250.0000'}});
  fireEvent.click(screen.getByRole('button',{name:'Add structure version'}));
  await waitFor(()=>expect(api.addStructureVersion).toHaveBeenCalledWith('s1',expect.objectContaining({
    targetType:'HOURLY_RATE',targetFrequency:'HOURLY',targetAmount:'1250.0000',
    targetAnnualizationFactor:undefined,inclusivePayrollBaseVersionId:undefined,
    exclusivePayrollBaseVersionId:undefined,targetAnnualAmount:undefined
  })));
  expect(screen.queryByLabelText('Inclusive payroll base')).not.toBeInTheDocument();
});
