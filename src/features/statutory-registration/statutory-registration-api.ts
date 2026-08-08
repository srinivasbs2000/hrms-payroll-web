export type RegistrationOwnerKind =
  | 'LEGAL_ENTITY'
  | 'PAYROLL_STATUTORY_UNIT'
  | 'ESTABLISHMENT';

export interface RegistrationTypeVersionWrite {
  name: string;
  obligationCode: string;
  authorityCode: string;
  jurisdictionLevelCode: string;
  identifierPattern?: string;
  identifierCasePolicy: 'UPPER' | 'PRESERVE';
  parentRequired: boolean;
  parentRegistrationTypeId?: string;
  ownerKinds: RegistrationOwnerKind[];
  effectiveFrom: string;
  effectiveTo?: string;
}

export interface RegistrationTypeView {
  identityId: string;
  code: string;
  versionId: string;
  versionSequence: number;
  versionNo: number;
  name: string;
  obligationCode: string;
  authorityCode: string;
  jurisdictionLevelCode: string;
  identifierPattern: string | null;
  identifierPatternDialect: 'JAVA_REGEX_V1';
  identifierCasePolicy: 'UPPER' | 'PRESERVE';
  parentRequired: boolean;
  parentRegistrationTypeId: string | null;
  ownerKinds: RegistrationOwnerKind[];
  effectiveFrom: string;
  effectiveTo: string | null;
  approvalStatus: 'DRAFT' | 'APPROVED' | 'REJECTED';
}

export interface RegistrationVersionWrite {
  registrationTypeId: string;
  registrationTypeVersionId: string;
  identifier: string;
  ownerKind: RegistrationOwnerKind;
  ownerId: string;
  payrollJurisdictionId: string;
  payrollJurisdictionVersionId: string;
  parentRegistrationId?: string;
  parentRegistrationVersionId?: string;
  effectiveFrom: string;
  effectiveTo?: string;
}

export interface StatutoryRegistrationView {
  identityId: string;
  registrationTypeId: string;
  referenceCode: string;
  versionId: string;
  versionSequence: number;
  versionNo: number;
  registrationTypeVersionId: string;
  identifier: string;
  identifierNormalized: string;
  ownerKind: RegistrationOwnerKind;
  ownerId: string;
  payrollJurisdictionId: string;
  payrollJurisdictionVersionId: string;
  parentRegistrationId: string | null;
  parentRegistrationVersionId: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  lifecycleStatus:
    | 'DRAFT'
    | 'PENDING_VERIFICATION'
    | 'VERIFIED'
    | 'APPROVAL_PENDING'
    | 'ACTIVE'
    | 'REJECTED'
    | 'SUSPENDED'
    | 'EXPIRED'
    | 'SUPERSEDED';
  createdBy: string;
}

export interface RegistrationReadinessView {
  ready: boolean;
  registrationVersionId: string | null;
  findings: Array<{
    code: string;
    severity: 'BLOCKER' | 'WARNING';
    message: string;
  }>;
}

export interface RegistrationOwnerOption {
  kind: RegistrationOwnerKind;
  identityId: string;
  versionId: string;
  code: string;
  name: string;
}

export interface PayrollJurisdictionOption {
  identityId: string;
  versionId: string;
  code: string;
  name: string;
  countryCode: string;
  levelCode: string;
  levelRank: number;
}

export interface RegistrationIdentifierRevealView {
  identityId: string;
  versionId: string;
  identifier: string;
  identifierNormalized: string;
}

export interface StatutoryRegistrationApi {
  listTypes(asOf: string): Promise<RegistrationTypeView[]>;
  createType(
    code: string,
    version: RegistrationTypeVersionWrite,
  ): Promise<RegistrationTypeView>;
  approveType(view: RegistrationTypeView): Promise<RegistrationTypeView>;
  listRegistrations(asOf: string): Promise<StatutoryRegistrationView[]>;
  createRegistration(
    referenceCode: string,
    version: RegistrationVersionWrite,
  ): Promise<StatutoryRegistrationView>;
  addVersion(
    view: StatutoryRegistrationView,
    version: RegistrationVersionWrite,
  ): Promise<StatutoryRegistrationView>;
  submit(view: StatutoryRegistrationView): Promise<StatutoryRegistrationView>;
  verify(
    view: StatutoryRegistrationView,
    evidenceRef: string,
  ): Promise<StatutoryRegistrationView>;
  requestApproval(
    view: StatutoryRegistrationView,
  ): Promise<StatutoryRegistrationView>;
  approve(
    view: StatutoryRegistrationView,
    evidenceRef: string,
  ): Promise<StatutoryRegistrationView>;
  reject(
    view: StatutoryRegistrationView,
    reason: string,
    evidenceRef: string,
    authorityReference: string,
  ): Promise<StatutoryRegistrationView>;
  suspend(
    view: StatutoryRegistrationView,
    reason: string,
  ): Promise<StatutoryRegistrationView>;
  revealIdentifier(
    view: StatutoryRegistrationView,
  ): Promise<RegistrationIdentifierRevealView>;
  listOwners(asOf: string): Promise<RegistrationOwnerOption[]>;
  listJurisdictions(asOf: string): Promise<PayrollJurisdictionOption[]>;
  readiness(input: {
    registrationTypeId: string;
    ownerKind: RegistrationOwnerKind;
    ownerId: string;
    payrollJurisdictionId: string;
    asOf: string;
    warningHorizonDays: number;
  }): Promise<RegistrationReadinessView>;
}

type OrganisationHierarchyNode = {
  value: RegistrationOwnerOption;
  children: OrganisationHierarchyNode[];
};

type OrganisationHierarchy = {
  asOf: string;
  legalEntities: OrganisationHierarchyNode[];
};

function flattenOwners(nodes: OrganisationHierarchyNode[]): RegistrationOwnerOption[] {
  return nodes.flatMap(node => [
    node.value,
    ...flattenOwners(node.children),
  ]);
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
  const response = await fetch(`/api/v1${path}`, {...init, headers});
  if (!response.ok) {
    let detail = `Request failed (${response.status})`;
    try {
      const problem = (await response.json()) as {detail?: string};
      detail = problem.detail ?? detail;
    } catch {
      // Empty or non-JSON RFC 9457 response.
    }
    throw new Error(detail);
  }
  return response.json() as Promise<T>;
}

function transition(
  view: StatutoryRegistrationView,
  action: string,
  body?: object,
): Promise<StatutoryRegistrationView> {
  return request(
    `/statutory-registrations/${view.identityId}/versions/${view.versionId}/${action}`,
    {
      method: 'POST',
      headers: {'If-Match': String(view.versionNo)},
      body: body ? JSON.stringify(body) : undefined,
    },
  );
}

export const httpStatutoryRegistrationApi: StatutoryRegistrationApi = {
  listTypes: asOf =>
    request(
      `/statutory-registration-types?asOf=${encodeURIComponent(asOf)}`,
    ),
  createType: (code, version) =>
    request('/statutory-registration-types', {
      method: 'POST',
      body: JSON.stringify({code, version}),
    }),
  approveType: view =>
    request(
      `/statutory-registration-types/${view.identityId}/versions/${view.versionId}/approval`,
      {
        method: 'POST',
        headers: {'If-Match': String(view.versionNo)},
      },
    ),
  listRegistrations: asOf =>
    request(
      `/statutory-registrations?asOf=${encodeURIComponent(asOf)}`,
    ),
  createRegistration: (referenceCode, version) =>
    request('/statutory-registrations', {
      method: 'POST',
      body: JSON.stringify({
        registrationTypeId: version.registrationTypeId,
        referenceCode,
        version,
      }),
    }),
  addVersion: (view, version) =>
    request(`/statutory-registrations/${view.identityId}/versions`, {
      method: 'POST',
      body: JSON.stringify(version),
    }),
  submit: view => transition(view, 'submission'),
  verify: (view, evidenceRef) =>
    transition(view, 'verification', {evidenceRef}),
  requestApproval: view => transition(view, 'approval-request'),
  approve: (view, evidenceRef) =>
    transition(view, 'approval', {evidenceRef}),
  reject: (view, reason, evidenceRef, authorityReference) =>
    transition(view, 'rejection', {
      reason,
      evidenceRef,
      authorityReference,
    }),
  suspend: (view, reason) =>
    transition(view, 'suspension', {reason}),
  revealIdentifier: view =>
    request(
      `/statutory-registrations/${view.identityId}/versions/${view.versionId}/identifier-reveal`,
      {method: 'POST'},
    ),
  listOwners: async asOf => {
    const hierarchy = await request<OrganisationHierarchy>(
      `/organisation-hierarchy?asOf=${encodeURIComponent(asOf)}`,
    );
    return flattenOwners(hierarchy.legalEntities);
  },
  listJurisdictions: asOf =>
    request(
      `/payroll-jurisdictions?asOf=${encodeURIComponent(asOf)}`,
    ),
  readiness: input =>
    request('/foundation-readiness/jurisdiction-registration', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
};
