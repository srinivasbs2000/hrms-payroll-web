export type OrganisationKind =
  | 'LEGAL_ENTITY'
  | 'PAYROLL_STATUTORY_UNIT'
  | 'ESTABLISHMENT';

export type ResponsibilityScope =
  | 'TAX_AND_STATUTORY'
  | 'TAX_ONLY'
  | 'STATUTORY_ONLY'
  | 'PAYROLL_OPERATIONS';

export type EstablishmentType =
  | 'OFFICE'
  | 'BRANCH'
  | 'FACTORY'
  | 'SHOP'
  | 'CONSTRUCTION'
  | 'OTHER';

export interface OrganisationVersion {
  kind: OrganisationKind;
  identityId: string;
  code: string;
  identityStatus: 'PENDING_APPROVAL' | 'ACTIVE' | 'RETIRED';
  identityVersionNo: number;
  retirementEffectiveDate: string | null;
  retirementReason: string | null;
  retiredAt: string | null;
  retiredBy: string | null;
  versionId: string;
  versionSequence: number;
  versionNo: number;
  name: string;
  countryCode: string | null;
  currency: string | null;
  stateCode: string | null;
  parentVersionId: string | null;
  responsibilityScope: ResponsibilityScope | null;
  establishmentType: EstablishmentType | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  approvalStatus: 'DRAFT' | 'APPROVED' | 'REJECTED';
  supersedesVersionId: string | null;
  superseded: boolean;
  createdBy: string;
  approvedBy: string | null;
}

export interface HierarchyNode {
  value: OrganisationVersion;
  children: HierarchyNode[];
}

export interface OrganisationHierarchy {
  asOf: string;
  legalEntities: HierarchyNode[];
}

export interface OrganisationWrite {
  code?: string;
  name: string;
  countryCode?: string;
  currency?: string;
  stateCode?: string;
  parentVersionId?: string;
  responsibilityScope?: ResponsibilityScope;
  establishmentType?: EstablishmentType;
  effectiveFrom: string;
  effectiveTo?: string;
}

export interface OrganisationRetirement {
  effectiveDate: string;
  reason: string;
}


export interface PayrollJurisdictionVersionWrite {
  name: string;
  countryCode: string;
  levelCode: string;
  levelRank: number;
  parentJurisdictionId?: string;
  parentJurisdictionVersionId?: string;
  effectiveFrom: string;
  effectiveTo?: string;
}

export interface PayrollJurisdictionCreate {
  code: string;
  version: PayrollJurisdictionVersionWrite;
}

export interface PayrollJurisdictionView {
  identityId: string;
  code: string;
  identityStatus: string;
  identityVersionNo: number;
  versionId: string;
  versionSequence: number;
  versionNo: number;
  name: string;
  countryCode: string;
  levelCode: string;
  levelRank: number;
  parentJurisdictionId: string | null;
  parentJurisdictionVersionId: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  approvalStatus: 'DRAFT' | 'APPROVED' | 'REJECTED';
  superseded: boolean;
}

export interface WorkLocationVersionWrite {
  name: string;
  establishmentVersionId?: string;
  payrollJurisdictionId: string;
  payrollJurisdictionVersionId: string;
  addressLine1?: string;
  locality?: string;
  stateCode?: string;
  postalCode?: string;
  countryCode: string;
  effectiveFrom: string;
  effectiveTo?: string;
}

export interface WorkLocationCreate {
  code: string;
  version: WorkLocationVersionWrite;
}

export interface WorkLocationView {
  identityId: string;
  code: string;
  identityStatus: string;
  identityVersionNo: number;
  versionId: string;
  versionSequence: number;
  versionNo: number;
  name: string;
  establishmentVersionId: string | null;
  payrollJurisdictionId: string;
  payrollJurisdictionVersionId: string;
  countryCode: string;
  stateCode: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  approvalStatus: 'DRAFT' | 'APPROVED' | 'REJECTED';
  superseded: boolean;
}

export interface OrganisationApi {
  hierarchy(asOf: string): Promise<OrganisationHierarchy>;
  listJurisdictions(asOf: string): Promise<PayrollJurisdictionView[]>;
  createJurisdiction(input: PayrollJurisdictionCreate): Promise<PayrollJurisdictionView>;
  approveJurisdiction(
    identityId: string,
    versionId: string,
    versionNo: number,
  ): Promise<PayrollJurisdictionView>;
  listWorkLocations(asOf: string): Promise<WorkLocationView[]>;
  createWorkLocation(input: WorkLocationCreate): Promise<WorkLocationView>;
  approveWorkLocation(
    identityId: string,
    versionId: string,
    versionNo: number,
  ): Promise<WorkLocationView>;
  history(
    collection: string,
    identityId: string,
  ): Promise<OrganisationVersion[]>;
  create(
    collection: string,
    input: OrganisationWrite,
  ): Promise<OrganisationVersion>;
  addVersion(
    collection: string,
    identityId: string,
    input: OrganisationWrite,
  ): Promise<OrganisationVersion>;
  correct(
    collection: string,
    identityId: string,
    versionId: string,
    input: OrganisationWrite,
  ): Promise<OrganisationVersion>;
  endDate(
    collection: string,
    identityId: string,
    versionId: string,
    versionNo: number,
    effectiveTo: string,
  ): Promise<OrganisationVersion>;
  approve(
    collection: string,
    identityId: string,
    versionId: string,
  ): Promise<OrganisationVersion>;
  retire(
    collection: string,
    identityId: string,
    identityVersionNo: number,
    input: OrganisationRetirement,
  ): Promise<OrganisationVersion>;
}

declare global {
  interface Window {
    payrollSession?: {
      accessToken?: string;
      permissions?: string[];
    };
  }
}

export function currentPermissions(): Set<string> {
  return new Set(window.payrollSession?.permissions ?? []);
}

async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('X-Correlation-ID', crypto.randomUUID());
  if (init.method && init.method !== 'GET') {
    headers.set('Idempotency-Key', crypto.randomUUID());
  }
  if (init.body) {
    headers.set('Content-Type', 'application/json');
  }
  const token = window.payrollSession?.accessToken;
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  const response = await fetch(`/api/v1${path}`, {
    ...init,
    headers,
  });
  if (!response.ok) {
    let detail = `Request failed (${response.status})`;
    try {
      const problem = (await response.json()) as {
        detail?: string;
      };
      detail = problem.detail ?? detail;
    } catch {
      // Empty or non-JSON error response.
    }
    const error = new Error(detail) as Error & {
      status?: number;
    };
    error.status = response.status;
    throw error;
  }
  return response.json() as Promise<T>;
}

export const httpOrganisationApi: OrganisationApi = {
  listJurisdictions: asOf =>
    request(`/payroll-jurisdictions?asOf=${encodeURIComponent(asOf)}`),
  createJurisdiction: input =>
    request('/payroll-jurisdictions', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  approveJurisdiction: (identityId, versionId, versionNo) =>
    request(
      `/payroll-jurisdictions/${identityId}/versions/${versionId}/approval`,
      {method: 'POST', headers: {'If-Match': String(versionNo)}},
    ),
  listWorkLocations: asOf =>
    request(`/work-locations?asOf=${encodeURIComponent(asOf)}`),
  createWorkLocation: input =>
    request('/work-locations', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  approveWorkLocation: (identityId, versionId, versionNo) =>
    request(
      `/work-locations/${identityId}/versions/${versionId}/approval`,
      {method: 'POST', headers: {'If-Match': String(versionNo)}},
    ),
  hierarchy: asOf =>
    request(
      `/organisation-hierarchy?asOf=${encodeURIComponent(asOf)}`,
    ),
  history: (collection, identityId) =>
    request(`/${collection}/${identityId}/versions`),
  create: (collection, input) =>
    request(`/${collection}`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  addVersion: (collection, identityId, input) =>
    request(`/${collection}/${identityId}/versions`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  correct: (collection, identityId, versionId, input) =>
    request(
      `/${collection}/${identityId}/versions/${versionId}/corrections`,
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
    ),
  endDate: (
    collection,
    identityId,
    versionId,
    versionNo,
    effectiveTo,
  ) =>
    request(
      `/${collection}/${identityId}/versions/${versionId}/end-date`,
      {
        method: 'POST',
        headers: {'If-Match': String(versionNo)},
        body: JSON.stringify({effectiveTo}),
      },
    ),
  approve: (collection, identityId, versionId) =>
    request(
      `/${collection}/${identityId}/versions/${versionId}/approval`,
      {method: 'POST'},
    ),
  retire: (
    collection,
    identityId,
    identityVersionNo,
    input,
  ) =>
    request(`/${collection}/${identityId}/retirement`, {
      method: 'POST',
      headers: {'If-Match': String(identityVersionNo)},
      body: JSON.stringify(input),
    }),
};
