import {payrollRequest} from '../pay-component/pay-component-api';

export interface SalaryStructureDesignEvidence{
  identityId:string;
  versionId:string;
  versionSequence:number;
  name:string;
  workflowStatus:string;
  approvalStatus:string;
  configurationHash:string;
  validationFingerprint:string|null;
  statutoryBindingRevision:number;
  statutoryEvidenceHash:string|null;
  effectiveFrom:string;
  effectiveTo:string|null;
}

export interface SalaryStructureDependency{
  dependencyType:string;
  objectId:string;
  versionId:string;
  code:string|null;
  role:string;
  status:string|null;
}

export interface SalaryStructureDesignChange{
  area:string;
  key:string;
  changeType:'ADDED'|'REMOVED'|'MODIFIED';
  beforeValue:string|null;
  afterValue:string|null;
}

export interface SalaryStructureDownstreamImpact{
  impactCode:string;
  severity:'REQUIRED'|'INFO';
  detail:string;
}

export interface SalaryStructureDesignImpact{
  identityId:string;
  baseline:SalaryStructureDesignEvidence;
  proposed:SalaryStructureDesignEvidence;
  changes:SalaryStructureDesignChange[];
  baselineDependencies:SalaryStructureDependency[];
  proposedDependencies:SalaryStructureDependency[];
  downstreamImpacts:SalaryStructureDownstreamImpact[];
  comparisonHash:string;
  disclaimer:string;
}

export interface SalaryStructureDesignImpactApi{
  compare(
    identityId:string,
    baselineVersionId:string,
    proposedVersionId:string
  ):Promise<SalaryStructureDesignImpact>;
}

export const httpSalaryStructureDesignImpactApi:SalaryStructureDesignImpactApi={
  compare:(identityId,baselineVersionId,proposedVersionId)=>{
    const query=new URLSearchParams({baselineVersionId,proposedVersionId});
    return payrollRequest(
      `/salary-structures/${identityId}/design-impact?${query.toString()}`);
  }
};
