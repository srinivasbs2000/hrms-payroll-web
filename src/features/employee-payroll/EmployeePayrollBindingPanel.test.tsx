import {fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {expect,test,vi} from 'vitest';
import {EmployeePayrollBindingPanel} from './EmployeePayrollBindingPanel';
import {
  CompensationChangeView,EmployeePayrollBindingApi
} from './employee-payroll-binding-api';
import {PayGroupAssignmentView,PayrollAssignmentView,PayrollRelationshipView,SalaryAssignmentView} from './employee-payroll-api';

const relationship={identityId:'r1',externalEmployeeId:'ext',employeeNumber:'EMP',identityStatus:'ACTIVE',versionId:'rv1',versionSequence:1,versionNo:1,legalEntityVersionId:'le1',payrollStatutoryUnitVersionId:'psu1',aggregationBoundaryKey:'INDIVIDUAL_RELATIONSHIP',countryCode:'IN',employerCurrency:'INR',relationshipStart:'2026-01-01',relationshipEnd:null,approvalStatus:'APPROVED',supersedesVersionId:null,superseded:false} as PayrollRelationshipView;
const assignment={identityId:'a1',payrollRelationshipId:'r1',assignmentNumber:'ASN',identityStatus:'ACTIVE',sourceWorkAssignmentRef:'WORK-1',versionId:'av1',versionSequence:1,versionNo:1,payrollRelationshipVersionId:'rv1',establishmentVersionId:'est1',payrollRole:'PRIMARY',payrollEligibilityFrom:'2026-01-01',payrollEligibilityTo:null,assignmentStart:'2026-01-01',assignmentEnd:null,approvalStatus:'APPROVED',supersedesVersionId:null,superseded:false} as PayrollAssignmentView;
const group={id:'pg1',payrollAssignmentVersionId:'av1',payGroupVersionId:'pgv1',effectiveFrom:'2026-01-01',effectiveTo:null,impactAssessmentThrough:'2026-03-31',impactedPeriodCount:3,approvalStatus:'APPROVED',supersedesAssignmentId:null,superseded:false,versionNo:1} as PayGroupAssignmentView;
const salary={id:'s1',payrollAssignmentVersionId:'av1',salaryStructureVersionId:'sv1',monthlyAmount:null,targetType:'ANNUAL_CTC',targetValue:1200000,targetFrequency:'ANNUAL',currency:'INR',sourceCompensationEventId:'cc1',effectiveFrom:'2026-01-01',effectiveTo:null,approvalStatus:'APPROVED',supersedesAssignmentId:null,superseded:false,versionNo:1} as SalaryAssignmentView;
const draftChange:CompensationChangeView={id:'cc1',payrollAssignmentId:'a1',eventType:'CURRENT_PERIOD',effectiveDate:'2026-01-01',sourceEventId:null,reason:'Needs assessment',assessmentThrough:null,impactAssessedAt:null,impactAssessedBy:null,impactedPeriodCount:0,approvalStatus:'DRAFT',approvedAt:null,approvedBy:null,versionNo:0};
const assessedChange:CompensationChangeView={...draftChange,assessmentThrough:'2026-03-31',impactAssessedAt:'2026-01-02T00:00:00Z',impactAssessedBy:'payroll.admin',impactedPeriodCount:3};

function fakeApi(overrides:Partial<EmployeePayrollBindingApi>={}):EmployeePayrollBindingApi{return {
  listCompensationChanges:vi.fn().mockResolvedValue([]),createCompensationChange:vi.fn().mockResolvedValue(draftChange),assessCompensationChange:vi.fn().mockResolvedValue(assessedChange),compensationChangeImpact:vi.fn().mockResolvedValue([{payPeriodId:'p1',periodCode:'2026-01',periodStart:'2026-01-01',periodEnd:'2026-01-31',reasonCode:'EFFECTIVE_DATE'}]),approveCompensationChange:vi.fn().mockResolvedValue({...assessedChange,approvalStatus:'APPROVED',versionNo:1}),compensationChangeAudit:vi.fn().mockResolvedValue([]),
  listOverrides:vi.fn().mockResolvedValue([]),createOverride:vi.fn().mockResolvedValue({id:'ov1',payrollAssignmentVersionId:'av1',salaryAssignmentId:'s1',salaryStructureLineId:'line1',componentVersionId:'component1',overrideKind:'AMOUNT',overrideValue:1250,effectiveFrom:'2026-01-01',effectiveTo:null,approvalStatus:'DRAFT',supersedesOverrideId:null,superseded:false,versionNo:0}),correctOverride:vi.fn(),approveOverride:vi.fn(),overrideAudit:vi.fn().mockResolvedValue([]),
  listLineage:vi.fn().mockResolvedValue([]),createLineage:vi.fn().mockResolvedValue({id:'ln1',eventType:'CONCURRENT_ASSIGNMENT',relationshipDecision:'CONTINUE',predecessorRelationshipId:'r1',successorRelationshipId:'r1',predecessorAssignmentId:'a1',successorAssignmentId:'a2',effectiveDate:'2026-01-01',reason:'Concurrent role',approvalStatus:'DRAFT',versionNo:0}),approveLineage:vi.fn(),lineageAudit:vi.fn().mockResolvedValue([]),payGroupImpact:vi.fn().mockResolvedValue([{payPeriodId:'p1',periodCode:'2026-01',periodStart:'2026-01-01',periodEnd:'2026-01-31',reasonCode:'PAY_GROUP_CHANGE'}]),
  ...overrides
}}

test('creates compensation change and shows affected-period evidence',async()=>{
  const api=fakeApi();const permissions=new Set(['employee-payroll.compensation-change.read','employee-payroll.compensation-change.create','employee-payroll.pay-group-assignment.read']);
  render(<EmployeePayrollBindingPanel relationship={relationship} assignment={assignment} payGroups={[group]} salaries={[salary]} permissions={permissions} api={api}/>);
  fireEvent.click(await screen.findByRole('button',{name:'Inspect affected periods'}));
  expect(await screen.findByText('2026-01')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Compensation change reason'),{target:{value:'Review'}});fireEvent.click(screen.getByRole('button',{name:'Create compensation change draft'}));
  await waitFor(()=>expect(api.createCompensationChange).toHaveBeenCalledWith(expect.objectContaining({payrollAssignmentId:'a1',eventType:'CURRENT_PERIOD',reason:'Review'})));
});

test('hides governed mutation controls and read calls when permissions are absent',async()=>{
  const api=fakeApi();render(<EmployeePayrollBindingPanel relationship={relationship} assignment={assignment} payGroups={[]} salaries={[]} permissions={new Set()} api={api}/>);
  expect(screen.getByText(/compensation-change.create/)).toBeInTheDocument();expect(screen.queryByRole('button',{name:'Create compensation change draft'})).not.toBeInTheDocument();
  await waitFor(()=>{
    expect(api.listCompensationChanges).not.toHaveBeenCalled();
    expect(api.listOverrides).not.toHaveBeenCalled();
    expect(api.listLineage).not.toHaveBeenCalled();
  });
});

test('submits source-event lineage only for correction or reversal compensation events',async()=>{
  const api=fakeApi();const permissions=new Set(['employee-payroll.compensation-change.create']);
  render(<EmployeePayrollBindingPanel relationship={relationship} assignment={assignment} payGroups={[]} salaries={[]} permissions={permissions} api={api}/>);
  fireEvent.change(screen.getByLabelText('Compensation event type'),{target:{value:'CORRECTION'}});
  fireEvent.change(screen.getByLabelText('Source compensation event ID'),{target:{value:'prior-event-1'}});
  fireEvent.change(screen.getByLabelText('Compensation change reason'),{target:{value:'Correct source event'}});
  fireEvent.click(screen.getByRole('button',{name:'Create compensation change draft'}));
  await waitFor(()=>expect(api.createCompensationChange).toHaveBeenCalledWith(expect.objectContaining({
    payrollAssignmentId:'a1',eventType:'CORRECTION',sourceEventId:'prior-event-1',reason:'Correct source event'
  })));
});

test('blocks compensation approval until mandatory impact assessment exists',async()=>{
  const api=fakeApi({listCompensationChanges:vi.fn().mockResolvedValue([draftChange])});
  const permissions=new Set(['employee-payroll.compensation-change.read','employee-payroll.compensation-change.assess','employee-payroll.compensation-change.approve']);
  render(<EmployeePayrollBindingPanel relationship={relationship} assignment={assignment} payGroups={[]} salaries={[]} permissions={permissions} api={api}/>);
  const reason=await screen.findByText('Needs assessment');
  const card=reason.closest('article');expect(card).not.toBeNull();
  expect(within(card as HTMLElement).queryByRole('button',{name:'Approve'})).not.toBeInTheDocument();
  expect(within(card as HTMLElement).getByText('Impact assessment is required before approval.')).toBeInTheDocument();
});

test('exposes compensation approval after assessment evidence exists',async()=>{
  const api=fakeApi({listCompensationChanges:vi.fn().mockResolvedValue([assessedChange])});
  const permissions=new Set(['employee-payroll.compensation-change.read','employee-payroll.compensation-change.approve']);
  render(<EmployeePayrollBindingPanel relationship={relationship} assignment={assignment} payGroups={[]} salaries={[]} permissions={permissions} api={api}/>);
  const reason=await screen.findByText('Needs assessment');
  const card=reason.closest('article');expect(card).not.toBeNull();
  expect(within(card as HTMLElement).getByRole('button',{name:'Approve'})).toBeInTheDocument();
});

test('creates component override against exact salary line and component lineage',async()=>{
  const api=fakeApi();const permissions=new Set(['employee-payroll.component-override.create']);
  render(<EmployeePayrollBindingPanel relationship={relationship} assignment={assignment} payGroups={[]} salaries={[salary]} permissions={permissions} api={api}/>);
  const form=screen.getByRole('form',{name:'Create component override draft'});
  expect(within(form).getByLabelText('Salary assignment ID')).toHaveValue('s1');
  fireEvent.change(within(form).getByLabelText('Salary structure line ID'),{target:{value:'line1'}});
  fireEvent.change(within(form).getByLabelText('Component version ID'),{target:{value:'component1'}});
  fireEvent.change(within(form).getByLabelText('Override value'),{target:{value:'1250'}});
  fireEvent.click(within(form).getByRole('button',{name:'Create component override draft'}));
  await waitFor(()=>expect(api.createOverride).toHaveBeenCalledWith(expect.objectContaining({
    payrollAssignmentVersionId:'av1',salaryAssignmentId:'s1',salaryStructureLineId:'line1',componentVersionId:'component1',overrideKind:'AMOUNT',overrideValue:1250
  })));
});

test('enforces valid concurrent-assignment lineage before calling backend',async()=>{
  const api=fakeApi();const permissions=new Set(['employee-payroll.lifecycle-lineage.create']);
  render(<EmployeePayrollBindingPanel relationship={relationship} assignment={assignment} payGroups={[]} salaries={[]} permissions={permissions} api={api}/>);
  const form=screen.getByRole('form',{name:'Create payroll lifecycle lineage'});
  expect(within(form).getByLabelText('Relationship decision')).toBeDisabled();
  expect(within(form).getByLabelText('Relationship decision')).toHaveValue('CONTINUE');
  expect(within(form).getByLabelText('Successor relationship ID')).toHaveValue('r1');
  fireEvent.change(within(form).getByLabelText('Successor assignment ID'),{target:{value:'a1'}});
  fireEvent.change(within(form).getByLabelText('Lifecycle reason'),{target:{value:'Concurrent role'}});
  fireEvent.click(within(form).getByRole('button',{name:'Create lifecycle lineage draft'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('distinct predecessor and successor assignment IDs');
  expect(api.createLineage).not.toHaveBeenCalled();

  fireEvent.change(within(form).getByLabelText('Successor assignment ID'),{target:{value:'a2'}});
  fireEvent.click(within(form).getByRole('button',{name:'Create lifecycle lineage draft'}));
  await waitFor(()=>expect(api.createLineage).toHaveBeenCalledWith(expect.objectContaining({
    eventType:'CONCURRENT_ASSIGNMENT',relationshipDecision:'CONTINUE',predecessorRelationshipId:'r1',successorRelationshipId:'r1',predecessorAssignmentId:'a1',successorAssignmentId:'a2'
  })));
});

test('enforces distinct successor relationship for transfer successor lineage',async()=>{
  const api=fakeApi();const permissions=new Set(['employee-payroll.lifecycle-lineage.create']);
  render(<EmployeePayrollBindingPanel relationship={relationship} assignment={assignment} payGroups={[]} salaries={[]} permissions={permissions} api={api}/>);
  const form=screen.getByRole('form',{name:'Create payroll lifecycle lineage'});
  fireEvent.change(within(form).getByLabelText('Lifecycle event type'),{target:{value:'TRANSFER'}});
  fireEvent.change(within(form).getByLabelText('Relationship decision'),{target:{value:'SUCCESSOR'}});
  fireEvent.change(within(form).getByLabelText('Lifecycle reason'),{target:{value:'Transfer'}});
  fireEvent.click(within(form).getByRole('button',{name:'Create lifecycle lineage draft'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('SUCCESSOR requires a distinct successor relationship ID');
  expect(api.createLineage).not.toHaveBeenCalled();
});
