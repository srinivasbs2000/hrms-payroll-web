import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {expect,test,vi} from 'vitest';
import {EmployeePayrollPage} from './EmployeePayrollPage';
import {
  EmployeePayrollApi,
  EmployeePayrollProfileView,
  PayGroupAssignmentView,
  PayrollAssignmentView,
  PayrollRelationshipView,
  SalaryAssignmentView
} from './employee-payroll-api';

const relationship:PayrollRelationshipView={
  identityId:'31000000-0000-0000-0000-000000000001',
  externalEmployeeId:'EMP-EXT-001',
  employeeNumber:'EMP-001',
  identityStatus:'ACTIVE',
  versionId:'31100000-0000-0000-0000-000000000001',
  versionSequence:1,
  versionNo:1,
  legalEntityVersionId:'21100000-0000-0000-0000-000000000001',
  relationshipStart:'2026-01-01',
  relationshipEnd:'2029-01-01',
  approvalStatus:'APPROVED',
  supersedesVersionId:null,
  superseded:false
};

const assignment:PayrollAssignmentView={
  identityId:'32000000-0000-0000-0000-000000000001',
  payrollRelationshipId:relationship.identityId,
  assignmentNumber:'ASN-001',
  identityStatus:'ACTIVE',
  versionId:'32100000-0000-0000-0000-000000000001',
  versionSequence:1,
  versionNo:1,
  payrollRelationshipVersionId:relationship.versionId,
  establishmentVersionId:'23100000-0000-0000-0000-000000000001',
  assignmentStart:'2026-01-01',
  assignmentEnd:'2029-01-01',
  approvalStatus:'APPROVED',
  supersedesVersionId:null,
  superseded:false
};

const profile:EmployeePayrollProfileView={
  id:'33000000-0000-0000-0000-000000000001',
  payrollRelationshipId:relationship.identityId,
  employeeNumber:'EMP-001',
  currency:'INR',
  payrollStatus:'INCOMPLETE',
  versionNo:0
};

const groupAssignment:PayGroupAssignmentView={
  id:'34000000-0000-0000-0000-000000000001',
  payrollAssignmentVersionId:assignment.versionId,
  payGroupVersionId:'25100000-0000-0000-0000-000000000001',
  effectiveFrom:'2026-01-01',
  effectiveTo:'2029-01-01',
  approvalStatus:'DRAFT',
  supersedesAssignmentId:null,
  superseded:false,
  versionNo:0
};

const salaryAssignment:SalaryAssignmentView={
  id:'35000000-0000-0000-0000-000000000001',
  payrollAssignmentVersionId:assignment.versionId,
  salaryStructureVersionId:'27100000-0000-0000-0000-000000000001',
  monthlyAmount:75000,
  currency:'INR',
  effectiveFrom:'2026-01-01',
  effectiveTo:'2029-01-01',
  approvalStatus:'DRAFT',
  supersedesAssignmentId:null,
  superseded:false,
  versionNo:0
};

function fakeApi(overrides:Partial<EmployeePayrollApi>={}):EmployeePayrollApi{
  return {
    listRelationships:vi.fn().mockResolvedValue([]),
    relationshipHistory:vi.fn().mockResolvedValue([relationship]),
    createRelationship:vi.fn().mockResolvedValue(relationship),
    addRelationshipVersion:vi.fn().mockResolvedValue(relationship),
    correctRelationship:vi.fn().mockResolvedValue(relationship),
    approveRelationship:vi.fn().mockResolvedValue(relationship),
    endDateRelationship:vi.fn().mockResolvedValue({...relationship,versionNo:2}),
    listAssignments:vi.fn().mockResolvedValue([]),
    assignmentHistory:vi.fn().mockResolvedValue([assignment]),
    createAssignment:vi.fn().mockResolvedValue(assignment),
    addAssignmentVersion:vi.fn().mockResolvedValue(assignment),
    correctAssignment:vi.fn().mockResolvedValue(assignment),
    approveAssignment:vi.fn().mockResolvedValue(assignment),
    endDateAssignment:vi.fn().mockResolvedValue({...assignment,versionNo:2}),
    profileForRelationship:vi.fn().mockResolvedValue(null),
    createProfile:vi.fn().mockResolvedValue(profile),
    updateProfileStatus:vi.fn().mockResolvedValue({...profile,payrollStatus:'READY',versionNo:1}),
    listPayGroupAssignments:vi.fn().mockResolvedValue([]),
    createPayGroupAssignment:vi.fn().mockResolvedValue(groupAssignment),
    correctPayGroupAssignment:vi.fn().mockResolvedValue(groupAssignment),
    approvePayGroupAssignment:vi.fn().mockResolvedValue({...groupAssignment,approvalStatus:'APPROVED',versionNo:1}),
    endDatePayGroupAssignment:vi.fn().mockResolvedValue({...groupAssignment,versionNo:1}),
    listSalaryAssignments:vi.fn().mockResolvedValue([]),
    createSalaryAssignment:vi.fn().mockResolvedValue(salaryAssignment),
    correctSalaryAssignment:vi.fn().mockResolvedValue(salaryAssignment),
    approveSalaryAssignment:vi.fn().mockResolvedValue({...salaryAssignment,approvalStatus:'APPROVED',versionNo:1}),
    endDateSalaryAssignment:vi.fn().mockResolvedValue({...salaryAssignment,versionNo:1}),
    ...overrides
  };
}

const readPermissions=new Set([
  'employee-payroll.relationship.read',
  'employee-payroll.assignment.read',
  'employee-payroll.profile.read',
  'employee-payroll.pay-group-assignment.read',
  'employee-payroll.salary-assignment.read'
]);

test('rejects the screen when payroll relationship read is absent',()=>{
  const api=fakeApi();
  render(<EmployeePayrollPage api={api} permissions={new Set()}/>);
  expect(screen.getByRole('alert')).toHaveTextContent('do not have permission');
  expect(api.listRelationships).not.toHaveBeenCalled();
});

test('loads the selected relationship, assignment and profile workspace',async()=>{
  const api=fakeApi({
    listRelationships:vi.fn().mockResolvedValue([relationship]),
    listAssignments:vi.fn().mockResolvedValue([assignment]),
    profileForRelationship:vi.fn().mockResolvedValue(profile)
  });
  render(<EmployeePayrollPage api={api} permissions={readPermissions}/>);

  fireEvent.click(await screen.findByRole('button',{name:/EMP-001/}));
  expect(await screen.findByText('EMP-001 relationship timeline')).toBeInTheDocument();
  expect(screen.getByText('Employee payroll profile')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button',{name:/ASN-001/}));
  expect(await screen.findByText('ASN-001 assignment timeline')).toBeInTheDocument();
  expect(api.listPayGroupAssignments).toHaveBeenCalledWith(assignment.versionId);
  expect(api.listSalaryAssignments).toHaveBeenCalledWith(assignment.versionId);
});

test('creates a payroll relationship draft with exact legal-entity lineage',async()=>{
  const api=fakeApi();
  render(<EmployeePayrollPage api={api} permissions={new Set([
    'employee-payroll.relationship.read',
    'employee-payroll.relationship.create'
  ])}/>);

  await screen.findByText(/No approved payroll relationships/);
  fireEvent.change(screen.getByLabelText('External employee ID'),{target:{value:'EMP-EXT-001'}});
  fireEvent.change(screen.getByLabelText('Employee number'),{target:{value:'EMP-001'}});
  fireEvent.change(screen.getByLabelText('Legal entity version ID'),{target:{value:relationship.legalEntityVersionId}});
  fireEvent.change(screen.getByLabelText('Relationship start'),{target:{value:'2026-01-01'}});
  fireEvent.click(screen.getByRole('button',{name:'Create relationship draft'}));

  await waitFor(()=>expect(api.createRelationship).toHaveBeenCalledWith(expect.objectContaining({
    externalEmployeeId:'EMP-EXT-001',
    employeeNumber:'EMP-001',
    legalEntityVersionId:relationship.legalEntityVersionId,
    relationshipStart:'2026-01-01'
  })));
});

test('creates an assignment using the selected relationship version',async()=>{
  const api=fakeApi({listRelationships:vi.fn().mockResolvedValue([relationship])});
  render(<EmployeePayrollPage api={api} permissions={new Set([
    ...readPermissions,
    'employee-payroll.assignment.create'
  ])}/>);

  fireEvent.click(await screen.findByRole('button',{name:/EMP-001/}));
  fireEvent.change(await screen.findByLabelText('Assignment number'),{target:{value:'ASN-001'}});
  fireEvent.change(screen.getByLabelText('Establishment version ID'),{target:{value:assignment.establishmentVersionId}});
  fireEvent.click(screen.getByRole('button',{name:'Create assignment draft'}));

  await waitFor(()=>expect(api.createAssignment).toHaveBeenCalledWith(expect.objectContaining({
    payrollRelationshipId:relationship.identityId,
    payrollRelationshipVersionId:relationship.versionId,
    assignmentNumber:'ASN-001',
    establishmentVersionId:assignment.establishmentVersionId
  })));
});

test('creates assignment configuration and moves the profile to ready',async()=>{
  const api=fakeApi({
    listRelationships:vi.fn().mockResolvedValue([relationship]),
    listAssignments:vi.fn().mockResolvedValue([assignment]),
    profileForRelationship:vi.fn().mockResolvedValue(profile)
  });
  render(<EmployeePayrollPage api={api} permissions={new Set([
    ...readPermissions,
    'employee-payroll.profile.status.update',
    'employee-payroll.pay-group-assignment.create',
    'employee-payroll.salary-assignment.create'
  ])}/>);

  fireEvent.click(await screen.findByRole('button',{name:/EMP-001/}));
  fireEvent.click(await screen.findByRole('button',{name:/ASN-001/}));

  fireEvent.change(await screen.findByLabelText('Pay-group version ID'),{target:{value:groupAssignment.payGroupVersionId}});
  fireEvent.click(screen.getByRole('button',{name:'Create pay-group assignment draft'}));
  await waitFor(()=>expect(api.createPayGroupAssignment).toHaveBeenCalledWith(expect.objectContaining({
    payrollAssignmentVersionId:assignment.versionId,
    payGroupVersionId:groupAssignment.payGroupVersionId
  })));

  fireEvent.change(screen.getByLabelText('Salary-structure version ID'),{target:{value:salaryAssignment.salaryStructureVersionId}});
  fireEvent.change(screen.getByLabelText('Monthly amount'),{target:{value:'75000'}});
  fireEvent.click(screen.getByRole('button',{name:'Create salary assignment draft'}));
  await waitFor(()=>expect(api.createSalaryAssignment).toHaveBeenCalledWith(expect.objectContaining({
    payrollAssignmentVersionId:assignment.versionId,
    salaryStructureVersionId:salaryAssignment.salaryStructureVersionId,
    monthlyAmount:75000,
    currency:'INR'
  })));

  fireEvent.click(screen.getByRole('button',{name:'READY'}));
  await waitFor(()=>expect(api.updateProfileStatus).toHaveBeenCalledWith(profile.id,profile.versionNo,'READY'));
});
