export type FoundationOwnerKind='LEGAL_ENTITY'|'PAYROLL_STATUTORY_UNIT';

export interface FoundationCycleOption{
  id:string;
  payGroupCode:string;
  payGroupName:string;
  periodCode:string;
  periodStart:string;
  periodEnd:string;
  paymentDate:string;
  status:string;
}

export interface RegistrationTypeOption{
  identityId:string;
  code:string;
  name:string;
  ownerKinds:string[];
  approvalStatus:string;
}

export interface JurisdictionOption{
  identityId:string;
  code:string;
  name:string;
  countryCode:string;
  levelCode:string;
}

export interface FoundationReadinessRequest{
  banking:{
    ownerKind:FoundationOwnerKind;
    currencyCode:string;
    purposeCode:string;
    amount?:number;
  };
  registrations:Array<{
    registrationTypeId:string;
    ownerKind:FoundationOwnerKind;
    payrollJurisdictionId:string;
    warningHorizonDays:number;
  }>;
}

export interface FoundationReadinessView{
  readinessScope:'FOUNDATION_ONLY';
  payrollCycleId:string;
  cycleStatus:string;
  payGroupVersionId:string;
  payrollStatutoryUnitVersionId:string;
  payrollStatutoryUnitId:string;
  legalEntityVersionId:string;
  legalEntityId:string;
  periodStart:string;
  periodEnd:string;
  paymentDate:string;
  foundationConfigurationSnapshotId:string|null;
  foundationConfigurationSnapshotHash:string|null;
  foundationConfigurationCount:number|null;
  foundationConfigurationSealedAt:string|null;
  foundationReady:boolean;
  readinessStatus:'READY'|'READY_WITH_WARNINGS'|'BLOCKED';
  dimensions:Array<{
    code:string;
    ready:boolean;
    status:'READY'|'READY_WITH_WARNINGS'|'BLOCKED';
    blockerCount:number;
    warningCount:number;
    coverage:string;
  }>;
  registrationChecks:Array<{
    registrationTypeId:string;
    ownerKind:FoundationOwnerKind;
    ownerId:string;
    payrollJurisdictionId:string;
    asOf:string;
    ready:boolean;
    registrationVersionId:string|null;
  }>;
  findings:Array<{
    code:string;
    source:string;
    severity:'BLOCKER'|'WARNING';
    detail:string;
  }>;
  excludedCapabilities:string[];
}

export interface FoundationReadinessApi{
  listCycles():Promise<FoundationCycleOption[]>;
  listRegistrationTypes(asOf:string):Promise<RegistrationTypeOption[]>;
  listJurisdictions(asOf:string):Promise<JurisdictionOption[]>;
  evaluate(cycleId:string,input:FoundationReadinessRequest):Promise<FoundationReadinessView>;
}

async function request<T>(path:string,init:RequestInit={}):Promise<T>{
  const headers=new Headers(init.headers);
  headers.set('X-Correlation-ID',crypto.randomUUID());
  if(init.method&&init.method!=='GET')headers.set('Idempotency-Key',crypto.randomUUID());
  if(init.body)headers.set('Content-Type','application/json');
  const token=window.payrollSession?.accessToken;
  if(token)headers.set('Authorization',`Bearer ${token}`);
  const response=await fetch(`/api/v1${path}`,{...init,headers});
  if(!response.ok){
    let detail=`Request failed (${response.status})`;
    try{
      const problem=await response.json() as {detail?:string};
      detail=problem.detail??detail;
    }catch{
      // Empty or non-JSON RFC 9457 response.
    }
    throw new Error(detail);
  }
  return response.json() as Promise<T>;
}

export const httpFoundationReadinessApi:FoundationReadinessApi={
  listCycles:()=>request('/payroll-cycles'),
  listRegistrationTypes:asOf=>request(
    `/statutory-registration-types?asOf=${encodeURIComponent(asOf)}`
  ),
  listJurisdictions:asOf=>request(
    `/payroll-jurisdictions?asOf=${encodeURIComponent(asOf)}`
  ),
  evaluate:(cycleId,input)=>request(
    `/payroll-cycles/${cycleId}/foundation-readiness`,
    {method:'POST',body:JSON.stringify(input)}
  )
};
