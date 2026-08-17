import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {expect,test,vi} from 'vitest';
import {SalaryStructureDesignImpactPanel} from './SalaryStructureDesignImpactPanel';
import type {SalaryStructureVersion} from './salary-structure-api';
import type {
  SalaryStructureDesignImpact,
  SalaryStructureDesignImpactApi
} from './salary-structure-design-impact-api';

const baseline={
  identityId:'s1',code:'DEFAULT',identityStatus:'ACTIVE',versionId:'sv1',versionSequence:1,
  versionNo:1,name:'Default v1',currency:'INR',structureSchemaVersion:1,structureType:'STANDARD',
  payFrequency:'MONTHLY',confidentialityLevel:'STANDARD',ctcPolicyVersionId:'ctc1',
  eligibilityRuleVersionId:null,targetType:'ANNUAL_CTC',targetAnnualAmount:1200000,
  toleranceAmount:.01,residualComponentVersionId:'cv1',configurationHash:'a'.repeat(64),
  validationFingerprint:'b'.repeat(64),effectiveFrom:'2027-01-01',effectiveTo:null,
  approvalStatus:'APPROVED',supersedesVersionId:null,superseded:true,lines:[]
} as SalaryStructureVersion;
const proposed={
  ...baseline,versionId:'sv2',versionSequence:2,versionNo:2,name:'Default v2',
  targetAnnualAmount:1320000,configurationHash:'c'.repeat(64),
  validationFingerprint:'d'.repeat(64),approvalStatus:'DRAFT',superseded:false
} as SalaryStructureVersion;

const result:SalaryStructureDesignImpact={
  identityId:'s1',
  baseline:{identityId:'s1',versionId:'sv1',versionSequence:1,name:'Default v1',
    workflowStatus:'PUBLISHED',approvalStatus:'APPROVED',configurationHash:'a'.repeat(64),
    validationFingerprint:'b'.repeat(64),statutoryBindingRevision:1,
    statutoryEvidenceHash:'e'.repeat(64),effectiveFrom:'2027-01-01',effectiveTo:null},
  proposed:{identityId:'s1',versionId:'sv2',versionSequence:2,name:'Default v2',
    workflowStatus:'DRAFT',approvalStatus:'DRAFT',configurationHash:'c'.repeat(64),
    validationFingerprint:'d'.repeat(64),statutoryBindingRevision:2,
    statutoryEvidenceHash:null,effectiveFrom:'2027-01-01',effectiveTo:null},
  changes:[{area:'TARGET',key:'TARGET_ANNUAL_AMOUNT',changeType:'MODIFIED',
    beforeValue:'1200000',afterValue:'1320000'}],
  baselineDependencies:[],
  proposedDependencies:[],
  downstreamImpacts:[{impactCode:'CONFIGURATION_VALIDATION_REQUIRED',severity:'REQUIRED',
    detail:'Re-run governed salary-structure validation before approval or publication.'}],
  comparisonHash:'f'.repeat(64),
  disclaimer:'DESIGN-TIME SALARY-STRUCTURE COMPARISON — NOT AN EMPLOYEE PAYROLL, TAX OR STATUTORY RESULT'
};

test('compares selected baseline to the current proposed version',async()=>{
  const api:SalaryStructureDesignImpactApi={compare:vi.fn().mockResolvedValue(result)};
  render(<SalaryStructureDesignImpactPanel structure={proposed} history={[baseline,proposed]}
    permissions={new Set(['compensation.structure.read'])} api={api}/>);
  fireEvent.click(screen.getByRole('button',{name:'Open design impact'}));
  fireEvent.click(screen.getByRole('button',{name:'Compare selected versions'}));
  await waitFor(()=>expect(api.compare).toHaveBeenCalledWith('s1','sv1','sv2'));
  expect(await screen.findByText('TARGET · TARGET_ANNUAL_AMOUNT')).toBeInTheDocument();
  expect(screen.getByText('CONFIGURATION_VALIDATION_REQUIRED')).toBeInTheDocument();
  expect(screen.getByText(/NOT AN EMPLOYEE PAYROLL/)).toBeInTheDocument();
});

test('does not invent comparison when no baseline exists',()=>{
  const api:SalaryStructureDesignImpactApi={compare:vi.fn().mockResolvedValue(result)};
  render(<SalaryStructureDesignImpactPanel structure={proposed} history={[proposed]}
    permissions={new Set(['compensation.structure.read'])} api={api}/>);
  fireEvent.click(screen.getByRole('button',{name:'Open design impact'}));
  expect(screen.getByText('No other version is available for comparison.')).toBeInTheDocument();
  expect(api.compare).not.toHaveBeenCalled();
});
