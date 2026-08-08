import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  currentPermissions,
  EstablishmentType,
  HierarchyNode,
  httpOrganisationApi,
  OrganisationApi,
  OrganisationVersion,
  OrganisationWrite,
  PayrollJurisdictionView,
  ResponsibilityScope,
  WorkLocationView,
} from './organisation-api';

type Props = {
  api?: OrganisationApi;
  permissions?: Set<string>;
};

const collections = {
  LEGAL_ENTITY: 'legal-entities',
  PAYROLL_STATUTORY_UNIT: 'payroll-statutory-units',
  ESTABLISHMENT: 'establishments',
} as const;

export function SetupPage({
  api = httpOrganisationApi,
  permissions,
}: Props) {
  const effectivePermissions = useMemo(
    () => permissions ?? currentPermissions(),
    [permissions],
  );
  const [asOf, setAsOf] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [hierarchy, setHierarchy] = useState<
    Awaited<ReturnType<OrganisationApi['hierarchy']>> | null
  >(null);
  const [history, setHistory] = useState<
    OrganisationVersion[]
  >([]);
  const [selected, setSelected] =
    useState<OrganisationVersion | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const canRead =
    effectivePermissions.has('organisation.read');
  const canCreate =
    effectivePermissions.has('organisation.create');

  const load = useCallback(async () => {
    if (!canRead) {
      return;
    }
    setLoading(true);
    setError('');
    try {
      setHierarchy(await api.hierarchy(asOf));
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setLoading(false);
    }
  }, [api, asOf, canRead]);

  useEffect(() => {
    void load();
  }, [load]);

  async function select(item: OrganisationVersion) {
    setSelected(item);
    setError('');
    try {
      setHistory(
        await api.history(
          collections[item.kind],
          item.identityId,
        ),
      );
    } catch (caught) {
      setError((caught as Error).message);
    }
  }

  async function create(
    kind: keyof typeof collections,
    input: OrganisationWrite,
  ) {
    setError('');
    try {
      const result = await api.create(
        collections[kind],
        input,
      );
      await select(result);
      await load();
    } catch (caught) {
      setError((caught as Error).message);
    }
  }

  async function approve(item: OrganisationVersion) {
    setError('');
    try {
      const result = await api.approve(
        collections[item.kind],
        item.identityId,
        item.versionId,
      );
      await select(result);
      await load();
    } catch (caught) {
      setError((caught as Error).message);
    }
  }

  async function addVersion(
    item: OrganisationVersion,
    input: OrganisationWrite,
  ) {
    setError('');
    try {
      const result = await api.addVersion(
        collections[item.kind],
        item.identityId,
        input,
      );
      await select(result);
      await load();
    } catch (caught) {
      setError((caught as Error).message);
    }
  }

  async function correct(
    item: OrganisationVersion,
    input: OrganisationWrite,
  ) {
    setError('');
    try {
      const result = await api.correct(
        collections[item.kind],
        item.identityId,
        item.versionId,
        input,
      );
      await select(result);
      await load();
    } catch (caught) {
      setError((caught as Error).message);
    }
  }

  async function endDate(
    item: OrganisationVersion,
    effectiveTo: string,
  ) {
    setError('');
    try {
      const result = await api.endDate(
        collections[item.kind],
        item.identityId,
        item.versionId,
        item.versionNo,
        effectiveTo,
      );
      await select(result);
      await load();
    } catch (caught) {
      setError((caught as Error).message);
    }
  }

  async function retire(
    item: OrganisationVersion,
    effectiveDate: string,
    reason: string,
  ) {
    setError('');
    try {
      const result = await api.retire(
        collections[item.kind],
        item.identityId,
        item.identityVersionNo,
        {effectiveDate, reason},
      );
      await select(result);
      await load();
    } catch (caught) {
      setError((caught as Error).message);
    }
  }

  if (!canRead) {
    return (
      <section
        className="card"
        aria-labelledby="org-title"
      >
        <h2 id="org-title">Organisation foundation</h2>
        <p role="alert">
          You do not have permission to view organisation data.
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="org-title">
      <div className="page-heading">
        <div>
          <p className="eyebrow">P5-A1 foundation closure</p>
          <h2 id="org-title">Organisation hierarchy</h2>
          <p>
            Stable identities with immutable, effective-dated
            version history and controlled lifecycle.
          </p>
        </div>
        <label>
          Effective date
          <input
            aria-label="Effective date"
            type="date"
            value={asOf}
            onChange={event => setAsOf(event.target.value)}
          />
        </label>
      </div>

      {loading && (
        <p role="status">Loading organisation hierarchy...</p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {!loading &&
        hierarchy?.legalEntities.length === 0 && (
          <div className="card empty">
            <h3>No organisation configured</h3>
            <p>
              Create the first legal entity to begin the
              hierarchy.
            </p>
          </div>
        )}

      {hierarchy &&
        hierarchy.legalEntities.length > 0 && (
          <div className="card">
            <h3>Effective on {hierarchy.asOf}</h3>
            <ul className="tree">
              {hierarchy.legalEntities.map(node => (
                <TreeNode
                  key={node.value.versionId}
                  node={node}
                  onSelect={select}
                />
              ))}
            </ul>
          </div>
        )}

      <JurisdictionLocationFoundation
        api={api}
        asOf={asOf}
        hierarchy={hierarchy}
        permissions={effectivePermissions}
      />

      {canCreate ? (
        <OrganisationForms
          hierarchy={hierarchy}
          onCreate={create}
        />
      ) : (
        <p className="permission-note">
          Create controls are hidden because{' '}
          <code>organisation.create</code> is not granted.
        </p>
      )}

      {selected && (
        <VersionTimeline
          selected={selected}
          history={history}
          permissions={effectivePermissions}
          onApprove={approve}
          onAddVersion={addVersion}
          onCorrect={correct}
          onEndDate={endDate}
          onRetire={retire}
        />
      )}
    </section>
  );
}



function JurisdictionLocationFoundation({
  api,
  asOf,
  hierarchy,
  permissions,
}: {
  api: OrganisationApi;
  asOf: string;
  hierarchy: Awaited<ReturnType<OrganisationApi['hierarchy']>> | null;
  permissions: Set<string>;
}) {
  const [jurisdictions, setJurisdictions] = useState<PayrollJurisdictionView[]>([]);
  const [locations, setLocations] = useState<WorkLocationView[]>([]);
  const [jurisdictionDraft, setJurisdictionDraft] = useState<PayrollJurisdictionView | null>(null);
  const [locationDraft, setLocationDraft] = useState<WorkLocationView | null>(null);
  const [error, setError] = useState('');
  const [jurisdictionCode, setJurisdictionCode] = useState('');
  const [jurisdictionName, setJurisdictionName] = useState('');
  const [countryCode, setCountryCode] = useState('IN');
  const [levelCode, setLevelCode] = useState('COUNTRY');
  const [parentVersionId, setParentVersionId] = useState('');
  const [locationCode, setLocationCode] = useState('');
  const [locationName, setLocationName] = useState('');
  const [locationJurisdictionVersionId, setLocationJurisdictionVersionId] = useState('');
  const [establishmentVersionId, setEstablishmentVersionId] = useState('');
  const canCreate = permissions.has('organisation.create');
  const canApprove = permissions.has('organisation.approve');

  const establishments = useMemo(() => {
    function collect(nodes: HierarchyNode[]): OrganisationVersion[] {
      return nodes.flatMap(node => [
        node.value,
        ...collect(node.children),
      ]);
    }
    return hierarchy
      ? collect(hierarchy.legalEntities).filter(
          item => item.kind === 'ESTABLISHMENT',
        )
      : [];
  }, [hierarchy]);

  const load = useCallback(async () => {
    setError('');
    try {
      const [nextJurisdictions, nextLocations] = await Promise.all([
        api.listJurisdictions(asOf),
        api.listWorkLocations(asOf),
      ]);
      setJurisdictions(nextJurisdictions);
      setLocations(nextLocations);
    } catch (caught) {
      setError((caught as Error).message);
    }
  }, [api, asOf]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createJurisdiction(event: FormEvent) {
    event.preventDefault();
    const parent = jurisdictions.find(item => item.versionId === parentVersionId);
    try {
      const created = await api.createJurisdiction({
        code: jurisdictionCode,
        version: {
          name: jurisdictionName,
          countryCode,
          levelCode,
          levelRank: parent ? parent.levelRank + 1 : 1,
          parentJurisdictionId: parent?.identityId,
          parentJurisdictionVersionId: parent?.versionId,
          effectiveFrom: asOf,
        },
      });
      setJurisdictionDraft(created);
      setJurisdictionCode('');
      setJurisdictionName('');
    } catch (caught) {
      setError((caught as Error).message);
    }
  }

  async function createLocation(event: FormEvent) {
    event.preventDefault();
    const jurisdiction = jurisdictions.find(
      item => item.versionId === locationJurisdictionVersionId,
    );
    if (!jurisdiction) {
      setError('Select an approved payroll jurisdiction');
      return;
    }
    try {
      const created = await api.createWorkLocation({
        code: locationCode,
        version: {
          name: locationName,
          establishmentVersionId: establishmentVersionId || undefined,
          payrollJurisdictionId: jurisdiction.identityId,
          payrollJurisdictionVersionId: jurisdiction.versionId,
          countryCode: jurisdiction.countryCode,
          effectiveFrom: asOf,
        },
      });
      setLocationDraft(created);
      setLocationCode('');
      setLocationName('');
    } catch (caught) {
      setError((caught as Error).message);
    }
  }

  async function approveJurisdiction() {
    if (!jurisdictionDraft) return;
    try {
      const approved = await api.approveJurisdiction(
        jurisdictionDraft.identityId,
        jurisdictionDraft.versionId,
        jurisdictionDraft.versionNo,
      );
      setJurisdictionDraft(approved);
      await load();
    } catch (caught) {
      setError((caught as Error).message);
    }
  }

  async function approveLocation() {
    if (!locationDraft) return;
    try {
      const approved = await api.approveWorkLocation(
        locationDraft.identityId,
        locationDraft.versionId,
        locationDraft.versionNo,
      );
      setLocationDraft(approved);
      await load();
    } catch (caught) {
      setError((caught as Error).message);
    }
  }

  return (
    <section className="card" aria-labelledby="jurisdiction-location-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">P5-JRF-01 foundation</p>
          <h3 id="jurisdiction-location-title">Work locations &amp; jurisdictions</h3>
        </div>
      </div>
      <p>
        Work locations remain separate from the legal hierarchy and resolve to
        approved, effective-dated payroll jurisdictions.
      </p>
      {error && <p className="error" role="alert">{error}</p>}

      <div className="two-column">
        <div>
          <h4>Effective payroll jurisdictions</h4>
          {jurisdictions.length === 0 ? (
            <p>No approved jurisdiction is effective on {asOf}.</p>
          ) : (
            <ul className="timeline">
              {jurisdictions.map(item => (
                <li key={item.versionId}>
                  <strong>{item.code} · {item.name}</strong>
                  <span>{item.levelCode} level {item.levelRank}</span>
                  <span>{item.effectiveFrom} to {item.effectiveTo ?? 'open'}</span>
                </li>
              ))}
            </ul>
          )}
          {jurisdictionDraft && (
            <div className="action-summary">
              <span>Latest draft: {jurisdictionDraft.code} · {jurisdictionDraft.approvalStatus}</span>
              {canApprove && jurisdictionDraft.approvalStatus === 'DRAFT' && (
                <button type="button" onClick={() => void approveJurisdiction()}>
                  Approve jurisdiction
                </button>
              )}
            </div>
          )}
        </div>
        <div>
          <h4>Effective work locations</h4>
          {locations.length === 0 ? (
            <p>No approved work location is effective on {asOf}.</p>
          ) : (
            <ul className="timeline">
              {locations.map(item => (
                <li key={item.versionId}>
                  <strong>{item.code} · {item.name}</strong>
                  <span>Jurisdiction version {item.payrollJurisdictionVersionId}</span>
                  <span>{item.effectiveFrom} to {item.effectiveTo ?? 'open'}</span>
                </li>
              ))}
            </ul>
          )}
          {locationDraft && (
            <div className="action-summary">
              <span>Latest draft: {locationDraft.code} · {locationDraft.approvalStatus}</span>
              {canApprove && locationDraft.approvalStatus === 'DRAFT' && (
                <button type="button" onClick={() => void approveLocation()}>
                  Approve work location
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {canCreate && (
        <div className="two-column">
          <form className="form-grid" onSubmit={event => void createJurisdiction(event)}>
            <h4>Create jurisdiction draft</h4>
            <label>Jurisdiction code<input required value={jurisdictionCode} onChange={event => setJurisdictionCode(event.target.value.toUpperCase())}/></label>
            <label>Jurisdiction name<input required value={jurisdictionName} onChange={event => setJurisdictionName(event.target.value)}/></label>
            <label>Country code<input required maxLength={2} value={countryCode} onChange={event => setCountryCode(event.target.value.toUpperCase())}/></label>
            <label>Level code<input required value={levelCode} onChange={event => setLevelCode(event.target.value.toUpperCase())}/></label>
            <label>Parent jurisdiction<select value={parentVersionId} onChange={event => setParentVersionId(event.target.value)}><option value="">Root jurisdiction</option>{jurisdictions.map(item => <option key={item.versionId} value={item.versionId}>{item.code} - {item.name}</option>)}</select></label>
            <button type="submit">Create jurisdiction draft</button>
          </form>
          <form className="form-grid" onSubmit={event => void createLocation(event)}>
            <h4>Create work-location draft</h4>
            <label>Work-location code<input required value={locationCode} onChange={event => setLocationCode(event.target.value.toUpperCase())}/></label>
            <label>Work-location name<input required value={locationName} onChange={event => setLocationName(event.target.value)}/></label>
            <label>Payroll jurisdiction<select required value={locationJurisdictionVersionId} onChange={event => setLocationJurisdictionVersionId(event.target.value)}><option value="">Select jurisdiction</option>{jurisdictions.map(item => <option key={item.versionId} value={item.versionId}>{item.code} - {item.name}</option>)}</select></label>
            <label>
              Establishment (optional)
              <select
                value={establishmentVersionId}
                onChange={event => setEstablishmentVersionId(event.target.value)}
              >
                <option value="">No establishment linkage</option>
                {establishments.map(item => (
                  <option key={item.versionId} value={item.versionId}>
                    {item.code} - {item.name}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit">Create work-location draft</button>
          </form>
        </div>
      )}
    </section>
  );
}
function TreeNode({
  node,
  onSelect,
}: {
  node: HierarchyNode;
  onSelect: (version: OrganisationVersion) => void;
}) {
  return (
    <li>
      <button
        className="tree-item"
        onClick={() => void onSelect(node.value)}
      >
        <strong>{node.value.code}</strong>
        <span>{node.value.name}</span>
        <small>
          {node.value.kind.replaceAll('_', ' ')} ·{' '}
          {node.value.identityStatus}
        </small>
      </button>
      {node.children.length > 0 && (
        <ul>
          {node.children.map(child => (
            <TreeNode
              key={child.value.versionId}
              node={child}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function OrganisationForms({
  hierarchy,
  onCreate,
}: {
  hierarchy: Awaited<
    ReturnType<OrganisationApi['hierarchy']>
  > | null;
  onCreate: (
    kind: keyof typeof collections,
    input: OrganisationWrite,
  ) => Promise<void>;
}) {
  const [kind, setKind] =
    useState<keyof typeof collections>('LEGAL_ENTITY');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [parent, setParent] = useState('');
  const [state, setState] = useState('KA');
  const [responsibilityScope, setResponsibilityScope] =
    useState<ResponsibilityScope>('TAX_AND_STATUTORY');
  const [establishmentType, setEstablishmentType] =
    useState<EstablishmentType>('OTHER');
  const [from, setFrom] = useState(
    () => new Date().toISOString().slice(0, 10),
  );

  const parents = useMemo(
    () =>
      kind === 'PAYROLL_STATUTORY_UNIT'
        ? hierarchy?.legalEntities.map(node => node.value) ?? []
        : kind === 'ESTABLISHMENT'
          ? hierarchy?.legalEntities.flatMap(node =>
              node.children.map(child => child.value),
            ) ?? []
          : [],
    [hierarchy, kind],
  );

  async function submit(event: FormEvent) {
    event.preventDefault();
    await onCreate(kind, {
      code,
      name,
      effectiveFrom: from,
      parentVersionId: parent || undefined,
      stateCode:
        kind === 'ESTABLISHMENT' ? state : undefined,
      countryCode:
        kind === 'LEGAL_ENTITY' ? 'IN' : undefined,
      currency:
        kind === 'LEGAL_ENTITY' ? 'INR' : undefined,
      responsibilityScope:
        kind === 'PAYROLL_STATUTORY_UNIT'
          ? responsibilityScope
          : undefined,
      establishmentType:
        kind === 'ESTABLISHMENT'
          ? establishmentType
          : undefined,
    });
    setName('');
    setCode('');
  }

  return (
    <form
      className="card form-grid"
      onSubmit={event => void submit(event)}
    >
      <h3>Create organisation identity</h3>
      <label>
        Type
        <select
          value={kind}
          onChange={event => {
            setKind(
              event.target.value as keyof typeof collections,
            );
            setParent('');
          }}
        >
          <option value="LEGAL_ENTITY">Legal entity</option>
          <option value="PAYROLL_STATUTORY_UNIT">
            Payroll statutory unit
          </option>
          <option value="ESTABLISHMENT">
            Establishment
          </option>
        </select>
      </label>
      <label>
        Code
        <input
          required
          pattern="[A-Z][A-Z0-9_]{1,39}"
          value={code}
          onChange={event =>
            setCode(event.target.value.toUpperCase())
          }
        />
      </label>
      <label>
        Name
        <input
          required
          value={name}
          onChange={event => setName(event.target.value)}
        />
      </label>
      {kind !== 'LEGAL_ENTITY' && (
        <label>
          Parent version
          <select
            required
            value={parent}
            onChange={event =>
              setParent(event.target.value)
            }
          >
            <option value="">Select parent</option>
            {parents.map(item => (
              <option
                key={item.versionId}
                value={item.versionId}
              >
                {item.code} - {item.name} - v
                {item.versionSequence}
              </option>
            ))}
          </select>
        </label>
      )}
      {kind === 'PAYROLL_STATUTORY_UNIT' && (
        <label>
          Responsibility scope
          <select
            aria-label="Responsibility scope"
            value={responsibilityScope}
            onChange={event =>
              setResponsibilityScope(
                event.target.value as ResponsibilityScope,
              )
            }
          >
            <option value="TAX_AND_STATUTORY">
              Tax and statutory
            </option>
            <option value="TAX_ONLY">Tax only</option>
            <option value="STATUTORY_ONLY">
              Statutory only
            </option>
            <option value="PAYROLL_OPERATIONS">
              Payroll operations
            </option>
          </select>
        </label>
      )}
      {kind === 'ESTABLISHMENT' && (
        <>
          <label>
            State code
            <input
              required
              value={state}
              onChange={event =>
                setState(event.target.value.toUpperCase())
              }
            />
          </label>
          <label>
            Establishment type
            <select
              aria-label="Establishment type"
              value={establishmentType}
              onChange={event =>
                setEstablishmentType(
                  event.target.value as EstablishmentType,
                )
              }
            >
              <option value="OFFICE">Office</option>
              <option value="BRANCH">Branch</option>
              <option value="FACTORY">Factory</option>
              <option value="SHOP">Shop</option>
              <option value="CONSTRUCTION">
                Construction
              </option>
              <option value="OTHER">Other</option>
            </select>
          </label>
        </>
      )}
      <label>
        Effective from
        <input
          required
          type="date"
          value={from}
          onChange={event => setFrom(event.target.value)}
        />
      </label>
      <button type="submit">Create draft</button>
    </form>
  );
}

type TimelineProps = {
  selected: OrganisationVersion;
  history: OrganisationVersion[];
  permissions: Set<string>;
  onApprove: (
    version: OrganisationVersion,
  ) => Promise<void>;
  onAddVersion: (
    version: OrganisationVersion,
    input: OrganisationWrite,
  ) => Promise<void>;
  onCorrect: (
    version: OrganisationVersion,
    input: OrganisationWrite,
  ) => Promise<void>;
  onEndDate: (
    version: OrganisationVersion,
    effectiveTo: string,
  ) => Promise<void>;
  onRetire: (
    version: OrganisationVersion,
    effectiveDate: string,
    reason: string,
  ) => Promise<void>;
};

function VersionTimeline({
  selected,
  history,
  permissions,
  onApprove,
  onAddVersion,
  onCorrect,
  onEndDate,
  onRetire,
}: TimelineProps) {
  const [name, setName] = useState(selected.name);
  const [from, setFrom] = useState(
    selected.effectiveFrom,
  );
  const [to, setTo] = useState(
    selected.effectiveTo ?? '',
  );
  const [retirementDate, setRetirementDate] = useState(
    selected.retirementEffectiveDate ??
      new Date().toISOString().slice(0, 10),
  );
  const [retirementReason, setRetirementReason] =
    useState('');

  useEffect(() => {
    setName(selected.name);
    setFrom(selected.effectiveFrom);
    setTo(selected.effectiveTo ?? '');
    setRetirementDate(
      selected.retirementEffectiveDate ??
        new Date().toISOString().slice(0, 10),
    );
    setRetirementReason(
      selected.retirementReason ?? '',
    );
  }, [selected]);

  const input: OrganisationWrite = {
    name,
    effectiveFrom: from,
    effectiveTo: to || undefined,
    countryCode: selected.countryCode ?? undefined,
    currency: selected.currency ?? undefined,
    stateCode: selected.stateCode ?? undefined,
    parentVersionId:
      selected.parentVersionId ?? undefined,
    responsibilityScope:
      selected.responsibilityScope ?? undefined,
    establishmentType:
      selected.establishmentType ?? undefined,
  };

  return (
    <section
      className="card"
      aria-labelledby="history-title"
    >
      <div className="section-heading">
        <h3 id="history-title">
          {selected.code} version timeline
        </h3>
        <span
          className={`badge ${selected.approvalStatus.toLowerCase()}`}
        >
          {selected.approvalStatus}
        </span>
        <span
          className={`badge ${selected.identityStatus.toLowerCase()}`}
        >
          {selected.identityStatus}
        </span>
      </div>

      <p>
        Identity version {selected.identityVersionNo}; exact
        parent version{' '}
        {selected.parentVersionId ?? 'not applicable'}.
      </p>
      {selected.responsibilityScope && (
        <p>
          Responsibility scope:{' '}
          {selected.responsibilityScope}
        </p>
      )}
      {selected.establishmentType && (
        <p>
          Establishment type: {selected.establishmentType}
        </p>
      )}
      {selected.identityStatus === 'RETIRED' && (
        <p role="status">
          Retired effective{' '}
          {selected.retirementEffectiveDate}: {' '}
          {selected.retirementReason}
        </p>
      )}

      {history.length === 0 ? (
        <p role="status">Loading version history...</p>
      ) : (
        <ol className="timeline">
          {history.map(item => (
            <li key={item.versionId}>
              <strong>
                Version {item.versionSequence}: {item.name}
              </strong>
              <span>
                {item.effectiveFrom} to{' '}
                {item.effectiveTo ?? 'open'}
              </span>
              <span>
                {item.superseded
                  ? 'Superseded'
                  : item.approvalStatus}
              </span>
              <span>
                Created by {item.createdBy}; approved by{' '}
                {item.approvedBy ?? 'not approved'}
              </span>
              {item.approvalStatus === 'DRAFT' &&
                permissions.has(
                  'organisation.approve',
                ) && (
                  <button
                    onClick={() => void onApprove(item)}
                  >
                    Approve
                  </button>
                )}
            </li>
          ))}
        </ol>
      )}

      {selected.identityStatus !== 'RETIRED' &&
        (permissions.has(
          'organisation.version.create',
        ) ||
          permissions.has(
            'organisation.version.correct',
          )) && (
          <form
            className="form-grid lifecycle-form"
            onSubmit={event => event.preventDefault()}
            aria-label="Version lifecycle"
          >
            <label>
              Version name
              <input
                required
                value={name}
                onChange={event =>
                  setName(event.target.value)
                }
              />
            </label>
            <label>
              Version effective from
              <input
                required
                type="date"
                value={from}
                onChange={event =>
                  setFrom(event.target.value)
                }
              />
            </label>
            <label>
              Version effective to
              <input
                type="date"
                value={to}
                onChange={event =>
                  setTo(event.target.value)
                }
              />
            </label>
            <div className="button-row">
              {permissions.has(
                'organisation.version.create',
              ) && (
                <button
                  type="button"
                  onClick={() =>
                    void onAddVersion(selected, input)
                  }
                >
                  Add version
                </button>
              )}
              {selected.approvalStatus === 'DRAFT' &&
                permissions.has(
                  'organisation.version.correct',
                ) && (
                  <button
                    type="button"
                    onClick={() =>
                      void onCorrect(selected, input)
                    }
                  >
                    Correct future draft
                  </button>
                )}
            </div>
          </form>
        )}

      {selected.identityStatus !== 'RETIRED' &&
        permissions.has(
          'organisation.version.end-date',
        ) && (
          <form
            className="form-grid lifecycle-form"
            onSubmit={event => {
              event.preventDefault();
              void onEndDate(selected, to);
            }}
            aria-label="End-date version"
          >
            <label>
              End date
              <input
                required
                type="date"
                value={to}
                onChange={event =>
                  setTo(event.target.value)
                }
              />
            </label>
            <button type="submit">
              End-date active version
            </button>
          </form>
        )}

      {selected.identityStatus === 'ACTIVE' &&
        permissions.has('organisation.retire') && (
          <form
            className="form-grid lifecycle-form"
            onSubmit={event => {
              event.preventDefault();
              void onRetire(
                selected,
                retirementDate,
                retirementReason,
              );
            }}
            aria-label="Retire organisation identity"
          >
            <label>
              Retirement effective date
              <input
                required
                type="date"
                value={retirementDate}
                onChange={event =>
                  setRetirementDate(event.target.value)
                }
              />
            </label>
            <label>
              Retirement reason
              <textarea
                required
                maxLength={500}
                value={retirementReason}
                onChange={event =>
                  setRetirementReason(event.target.value)
                }
              />
            </label>
            <button type="submit">
              Retire organisation identity
            </button>
          </form>
        )}

      <div
        className="action-summary"
        aria-label="Available lifecycle permissions"
      >
        <span>
          Add version:{' '}
          {permissions.has(
            'organisation.version.create',
          )
            ? 'allowed'
            : 'not allowed'}
        </span>
        <span>
          Approve:{' '}
          {permissions.has('organisation.approve')
            ? 'allowed'
            : 'not allowed'}
        </span>
        <span>
          Retire:{' '}
          {permissions.has('organisation.retire')
            ? 'allowed'
            : 'not allowed'}
        </span>
      </div>
    </section>
  );
}
