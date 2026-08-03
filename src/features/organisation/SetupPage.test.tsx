import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import {expect, test, vi} from 'vitest';
import {SetupPage} from './SetupPage';
import {
  OrganisationApi,
  OrganisationVersion,
} from './organisation-api';

const legal: OrganisationVersion = {
  kind: 'LEGAL_ENTITY',
  identityId:
    '10000000-0000-0000-0000-000000000001',
  code: 'ACME_IN',
  identityStatus: 'ACTIVE',
  identityVersionNo: 1,
  retirementEffectiveDate: null,
  retirementReason: null,
  retiredAt: null,
  retiredBy: null,
  versionId:
    '11000000-0000-0000-0000-000000000001',
  versionSequence: 1,
  versionNo: 1,
  name: 'Acme India',
  countryCode: 'IN',
  currency: 'INR',
  stateCode: null,
  parentVersionId: null,
  responsibilityScope: null,
  establishmentType: null,
  effectiveFrom: '2026-01-01',
  effectiveTo: null,
  approvalStatus: 'APPROVED',
  supersedesVersionId: null,
  superseded: false,
  createdBy: 'issuer|creator',
  approvedBy: 'issuer|approver',
};

function fakeApi(
  overrides: Partial<OrganisationApi> = {},
): OrganisationApi {
  return {
    hierarchy: vi.fn().mockResolvedValue({
      asOf: '2026-07-19',
      legalEntities: [],
    }),
    history: vi.fn().mockResolvedValue([legal]),
    create: vi.fn().mockResolvedValue(legal),
    addVersion: vi.fn().mockResolvedValue({
      ...legal,
      versionSequence: 2,
      approvalStatus: 'DRAFT',
    }),
    correct: vi.fn().mockResolvedValue({
      ...legal,
      versionSequence: 2,
      approvalStatus: 'DRAFT',
    }),
    endDate: vi.fn().mockResolvedValue({
      ...legal,
      effectiveTo: '2027-01-01',
      versionNo: 2,
    }),
    approve: vi.fn().mockResolvedValue(legal),
    retire: vi.fn().mockResolvedValue({
      ...legal,
      identityStatus: 'RETIRED',
      identityVersionNo: 2,
      retirementEffectiveDate: '2028-01-01',
      retirementReason: 'Employer closed',
      effectiveTo: '2028-01-01',
    }),
    ...overrides,
  };
}

test('rejects the screen when organisation.read is absent', () => {
  const api = fakeApi();
  render(
    <SetupPage api={api} permissions={new Set()} />,
  );
  expect(screen.getByRole('alert')).toHaveTextContent(
    'do not have permission',
  );
  expect(api.hierarchy).not.toHaveBeenCalled();
});

test('shows loading then the empty hierarchy state', async () => {
  let resolve: (value: {
    asOf: string;
    legalEntities: [];
  }) => void = () => {};
  const api = fakeApi({
    hierarchy: vi.fn(
      () =>
        new Promise<{
          asOf: string;
          legalEntities: [];
        }>(result => {
          resolve = result;
        }),
    ),
  });
  render(
    <SetupPage
      api={api}
      permissions={new Set(['organisation.read'])}
    />,
  );
  expect(screen.getByRole('status')).toHaveTextContent(
    'Loading',
  );
  resolve({asOf: '2026-07-19', legalEntities: []});
  expect(
    await screen.findByText('No organisation configured'),
  ).toBeInTheDocument();
});

test('keeps a newly created pending identity selected when the approved hierarchy is empty', async () => {
  const pendingLegal: OrganisationVersion = {
    ...legal,
    identityId:
      '10000000-0000-0000-0000-000000000002',
    code: 'NEW_LEGAL',
    identityStatus: 'PENDING_APPROVAL',
    identityVersionNo: 0,
    versionId:
      '11000000-0000-0000-0000-000000000002',
    versionNo: 0,
    name: 'New Legal Entity',
    approvalStatus: 'DRAFT',
    approvedBy: null,
  };
  const api = fakeApi({
    hierarchy: vi.fn().mockResolvedValue({
      asOf: '2026-07-19',
      legalEntities: [],
    }),
    history: vi.fn().mockResolvedValue([pendingLegal]),
    create: vi.fn().mockResolvedValue(pendingLegal),
  });

  render(
    <SetupPage
      api={api}
      permissions={
        new Set([
          'organisation.read',
          'organisation.create',
          'organisation.approve',
        ])
      }
    />,
  );

  await screen.findByText('No organisation configured');
  fireEvent.change(screen.getByLabelText('Code'), {
    target: {value: 'new_legal'},
  });
  fireEvent.change(screen.getByLabelText('Name'), {
    target: {value: 'New Legal Entity'},
  });
  fireEvent.click(
    screen.getByRole('button', {
      name: 'Create draft',
    }),
  );

  expect(
    await screen.findByText('NEW_LEGAL version timeline'),
  ).toBeInTheDocument();
  expect(screen.getByText('PENDING_APPROVAL')).toBeInTheDocument();
  expect(screen.getAllByText('DRAFT')).not.toHaveLength(0);
  expect(
    screen.getByRole('button', {name: 'Approve'}),
  ).toBeInTheDocument();
  expect(api.history).toHaveBeenCalledWith(
    'legal-entities',
    pendingLegal.identityId,
  );
  expect(api.hierarchy).toHaveBeenCalledTimes(2);
});

test('renders lifecycle separately from approval status', async () => {
  const api = fakeApi({
    hierarchy: vi.fn().mockResolvedValue({
      asOf: '2026-07-19',
      legalEntities: [{value: legal, children: []}],
    }),
  });
  render(
    <SetupPage
      api={api}
      permissions={
        new Set([
          'organisation.read',
          'organisation.approve',
        ])
      }
    />,
  );
  fireEvent.click(
    await screen.findByRole('button', {
      name: /ACME_IN/,
    }),
  );
  expect(
    await screen.findByText('Version 1: Acme India'),
  ).toBeInTheDocument();
  expect(screen.getByText('ACTIVE')).toBeInTheDocument();
  expect(
    screen.getByText(/Identity version 1/),
  ).toBeInTheDocument();
});

test('exposes add-version and end-date with version concurrency', async () => {
  const api = fakeApi({
    hierarchy: vi.fn().mockResolvedValue({
      asOf: '2026-07-19',
      legalEntities: [{value: legal, children: []}],
    }),
  });
  render(
    <SetupPage
      api={api}
      permissions={
        new Set([
          'organisation.read',
          'organisation.version.create',
          'organisation.version.end-date',
        ])
      }
    />,
  );
  fireEvent.click(
    await screen.findByRole('button', {
      name: /ACME_IN/,
    }),
  );
  await screen.findByText('Version 1: Acme India');
  fireEvent.change(
    screen.getByLabelText('Version name'),
    {target: {value: 'Acme India 2027'}},
  );
  fireEvent.change(
    screen.getByLabelText('Version effective from'),
    {target: {value: '2027-01-01'}},
  );
  fireEvent.click(
    screen.getByRole('button', {
      name: 'Add version',
    }),
  );
  await waitFor(() =>
    expect(api.addVersion).toHaveBeenCalledWith(
      'legal-entities',
      legal.identityId,
      expect.objectContaining({
        name: 'Acme India 2027',
        effectiveFrom: '2027-01-01',
      }),
    ),
  );
  fireEvent.change(screen.getByLabelText('End date'), {
    target: {value: '2027-01-01'},
  });
  fireEvent.click(
    screen.getByRole('button', {
      name: 'End-date active version',
    }),
  );
  await waitFor(() =>
    expect(api.endDate).toHaveBeenCalledWith(
      'legal-entities',
      legal.identityId,
      legal.versionId,
      legal.versionNo,
      '2027-01-01',
    ),
  );
});

test('submits responsibility scope for a payroll statutory unit', async () => {
  const api = fakeApi({
    hierarchy: vi.fn().mockResolvedValue({
      asOf: '2026-07-19',
      legalEntities: [{value: legal, children: []}],
    }),
  });
  render(
    <SetupPage
      api={api}
      permissions={
        new Set([
          'organisation.read',
          'organisation.create',
        ])
      }
    />,
  );
  await screen.findByText('Effective on 2026-07-19');
  fireEvent.change(screen.getByLabelText('Type'), {
    target: {value: 'PAYROLL_STATUTORY_UNIT'},
  });
  fireEvent.change(screen.getByLabelText('Code'), {
    target: {value: 'psu_one'},
  });
  fireEvent.change(screen.getByLabelText('Name'), {
    target: {value: 'PSU One'},
  });
  fireEvent.change(
    screen.getByLabelText('Parent version'),
    {target: {value: legal.versionId}},
  );
  fireEvent.change(
    screen.getByLabelText('Responsibility scope'),
    {target: {value: 'PAYROLL_OPERATIONS'}},
  );
  fireEvent.click(
    screen.getByRole('button', {
      name: 'Create draft',
    }),
  );
  await waitFor(() =>
    expect(api.create).toHaveBeenCalledWith(
      'payroll-statutory-units',
      expect.objectContaining({
        code: 'PSU_ONE',
        responsibilityScope: 'PAYROLL_OPERATIONS',
        parentVersionId: legal.versionId,
      }),
    ),
  );
});

test('retires an active identity only when permission is granted', async () => {
  const api = fakeApi({
    hierarchy: vi.fn().mockResolvedValue({
      asOf: '2026-07-19',
      legalEntities: [{value: legal, children: []}],
    }),
  });
  render(
    <SetupPage
      api={api}
      permissions={
        new Set([
          'organisation.read',
          'organisation.retire',
        ])
      }
    />,
  );
  fireEvent.click(
    await screen.findByRole('button', {
      name: /ACME_IN/,
    }),
  );
  await screen.findByText('Version 1: Acme India');
  fireEvent.change(
    screen.getByLabelText(
      'Retirement effective date',
    ),
    {target: {value: '2028-01-01'}},
  );
  fireEvent.change(
    screen.getByLabelText('Retirement reason'),
    {target: {value: 'Employer closed'}},
  );
  fireEvent.click(
    screen.getByRole('button', {
      name: 'Retire organisation identity',
    }),
  );
  await waitFor(() =>
    expect(api.retire).toHaveBeenCalledWith(
      'legal-entities',
      legal.identityId,
      legal.identityVersionNo,
      {
        effectiveDate: '2028-01-01',
        reason: 'Employer closed',
      },
    ),
  );
});

test('surfaces API problem details as an accessible error', async () => {
  const api = fakeApi({
    hierarchy: vi
      .fn()
      .mockRejectedValue(
        new Error('Tenant context unavailable'),
      ),
  });
  render(
    <SetupPage
      api={api}
      permissions={new Set(['organisation.read'])}
    />,
  );
  expect(
    await screen.findByRole('alert'),
  ).toHaveTextContent('Tenant context unavailable');
});
