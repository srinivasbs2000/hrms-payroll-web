import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {expect, test, vi} from 'vitest';
import {StatutoryRegistrationPage} from './StatutoryRegistrationPage';
import type {
  PayrollJurisdictionOption,
  RegistrationOwnerOption,
  RegistrationTypeView,
  StatutoryRegistrationApi,
  StatutoryRegistrationView,
} from './statutory-registration-api';

const owner: RegistrationOwnerOption = {
  kind: 'LEGAL_ENTITY',
  identityId: 'owner-1',
  versionId: 'owner-version-1',
  code: 'LE01',
  name: 'Legal Entity One',
};

const jurisdiction: PayrollJurisdictionOption = {
  identityId: 'jurisdiction-1',
  versionId: 'jurisdiction-version-1',
  code: 'IN',
  name: 'India',
  countryCode: 'IN',
  levelCode: 'COUNTRY',
  levelRank: 1,
};

const type: RegistrationTypeView = {
  identityId: 'type-1',
  code: 'GENERIC_REG',
  versionId: 'type-version-1',
  versionSequence: 1,
  versionNo: 0,
  name: 'Generic registration',
  obligationCode: 'GENERIC_OBLIGATION',
  authorityCode: 'GENERIC_AUTHORITY',
  jurisdictionLevelCode: 'COUNTRY',
  identifierPattern: '^[A-Z0-9-]{3,30}$',
  identifierPatternDialect: 'JAVA_REGEX_V1',
  identifierCasePolicy: 'UPPER',
  parentRequired: false,
  parentRegistrationTypeId: null,
  ownerKinds: ['LEGAL_ENTITY'],
  effectiveFrom: '2026-01-01',
  effectiveTo: null,
  approvalStatus: 'APPROVED',
};

const registration: StatutoryRegistrationView = {
  identityId: 'registration-1',
  registrationTypeId: type.identityId,
  referenceCode: 'REG-001',
  versionId: 'registration-version-1',
  versionSequence: 1,
  versionNo: 4,
  registrationTypeVersionId: type.versionId,
  identifier: '****-123',
  identifierNormalized: '****-123',
  ownerKind: 'LEGAL_ENTITY',
  ownerId: owner.identityId,
  payrollJurisdictionId: jurisdiction.identityId,
  payrollJurisdictionVersionId: jurisdiction.versionId,
  parentRegistrationId: null,
  parentRegistrationVersionId: null,
  effectiveFrom: '2026-01-01',
  effectiveTo: '2027-01-01',
  lifecycleStatus: 'ACTIVE',
  createdBy: 'maker',
};

function api(): StatutoryRegistrationApi {
  return {
    listTypes: vi.fn().mockResolvedValue([]),
    createType: vi.fn(),
    approveType: vi.fn(),
    listRegistrations: vi.fn().mockResolvedValue([]),
    createRegistration: vi.fn(),
    addVersion: vi.fn(),
    submit: vi.fn(),
    verify: vi.fn(),
    requestApproval: vi.fn(),
    approve: vi.fn(),
    reject: vi.fn(),
    suspend: vi.fn(),
    revealIdentifier: vi.fn().mockResolvedValue({
      identityId: registration.identityId,
      versionId: registration.versionId,
      identifier: 'abc-123',
      identifierNormalized: 'ABC-123',
    }),
    listOwners: vi.fn().mockResolvedValue([]),
    listJurisdictions: vi.fn().mockResolvedValue([]),
    readiness: vi.fn(),
  };
}

test('requires statutory-registration.read', () => {
  const client = api();
  render(
    <StatutoryRegistrationPage
      api={client}
      permissions={new Set()}
    />,
  );
  expect(screen.getByRole('alert')).toHaveTextContent(
    'do not have permission',
  );
  expect(client.listTypes).not.toHaveBeenCalled();
});

test('loads the statutory registration workspace for a reader', async () => {
  const client = api();
  render(
    <StatutoryRegistrationPage
      api={client}
      permissions={new Set(['statutory-registration.read'])}
    />,
  );
  expect(
    await screen.findByText('Effective registration types'),
  ).toBeInTheDocument();
  expect(client.listTypes).toHaveBeenCalled();
  expect(client.listRegistrations).toHaveBeenCalled();
  expect(client.listOwners).not.toHaveBeenCalled();
});

test('uses business selectors instead of technical identifiers', async () => {
  const client = api();
  vi.mocked(client.listTypes).mockResolvedValue([type]);
  vi.mocked(client.listOwners).mockResolvedValue([owner]);
  vi.mocked(client.listJurisdictions).mockResolvedValue([
    jurisdiction,
  ]);

  render(
    <StatutoryRegistrationPage
      api={client}
      permissions={
        new Set([
          'statutory-registration.read',
          'statutory-registration.write',
          'statutory-registration-type.write',
          'organisation.read',
        ])
      }
    />,
  );

  expect(
    (
      await screen.findAllByRole('option', {
        name: 'LE01 - Legal Entity One',
      })
    ).length,
  ).toBeGreaterThan(0);
  expect(
    screen.getAllByRole('option', {name: 'IN - India'}).length,
  ).toBeGreaterThan(0);
  expect(
    screen.getByLabelText('Identifier pattern'),
  ).toHaveValue('^[A-Z0-9-]{3,30}$');
  expect(
    screen.queryByText(/UUID/i),
  ).not.toBeInTheDocument();
});

test('reveals exact identifier only through the elevated audited action', async () => {
  const client = api();
  vi.mocked(client.listTypes).mockResolvedValue([type]);
  vi.mocked(client.listRegistrations).mockResolvedValue([
    registration,
  ]);
  vi.mocked(client.listOwners).mockResolvedValue([owner]);
  vi.mocked(client.listJurisdictions).mockResolvedValue([
    jurisdiction,
  ]);

  render(
    <StatutoryRegistrationPage
      api={client}
      permissions={
        new Set([
          'statutory-registration.read',
          'statutory-registration.identifier.read',
          'organisation.read',
        ])
      }
    />,
  );

  fireEvent.click(
    await screen.findByRole('button', {
      name: /REG-001/i,
    }),
  );
  fireEvent.click(
    screen.getByRole('button', {
      name: 'Reveal exact identifier',
    }),
  );

  await waitFor(() =>
    expect(client.revealIdentifier).toHaveBeenCalledWith(
      registration,
    ),
  );
  expect(
    await screen.findByText('Exact identifier: ABC-123'),
  ).toBeInTheDocument();
});

test('offers renewal successor flow only for bounded registrations', async () => {
  const client = api();
  vi.mocked(client.listTypes).mockResolvedValue([type]);
  vi.mocked(client.listRegistrations).mockResolvedValue([
    registration,
  ]);
  vi.mocked(client.listOwners).mockResolvedValue([owner]);
  vi.mocked(client.listJurisdictions).mockResolvedValue([
    jurisdiction,
  ]);

  render(
    <StatutoryRegistrationPage
      api={client}
      permissions={
        new Set([
          'statutory-registration.read',
          'statutory-registration.write',
          'organisation.read',
        ])
      }
    />,
  );

  fireEvent.click(
    await screen.findByRole('button', {
      name: /REG-001/i,
    }),
  );

  expect(
    screen.getByText('Create renewal/successor draft'),
  ).toBeInTheDocument();
  expect(
    screen.getByLabelText('Renewal effective from'),
  ).toHaveValue('2027-01-01');
});
