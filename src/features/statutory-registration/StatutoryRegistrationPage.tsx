import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  httpStatutoryRegistrationApi,
  PayrollJurisdictionOption,
  RegistrationOwnerKind,
  RegistrationOwnerOption,
  RegistrationReadinessView,
  RegistrationTypeVersionWrite,
  RegistrationTypeView,
  RegistrationVersionWrite,
  StatutoryRegistrationApi,
  StatutoryRegistrationView,
} from './statutory-registration-api';

type Props = {
  api?: StatutoryRegistrationApi;
  permissions?: Set<string>;
};

const ownerKinds: RegistrationOwnerKind[] = [
  'LEGAL_ENTITY',
  'PAYROLL_STATUTORY_UNIT',
  'ESTABLISHMENT',
];

function sessionPermissions(): Set<string> {
  return new Set(window.payrollSession?.permissions ?? []);
}

function ownerKindLabel(kind: RegistrationOwnerKind): string {
  return kind
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/^\w/, value => value.toUpperCase());
}

function ownerLabel(
  owners: RegistrationOwnerOption[],
  kind: RegistrationOwnerKind,
  ownerId: string,
): string {
  const owner = owners.find(
    item => item.kind === kind && item.identityId === ownerId,
  );
  return owner ? `${owner.code} · ${owner.name}` : ownerKindLabel(kind);
}

function jurisdictionLabel(
  jurisdictions: PayrollJurisdictionOption[],
  identityId: string,
): string {
  const jurisdiction = jurisdictions.find(
    item => item.identityId === identityId,
  );
  return jurisdiction
    ? `${jurisdiction.code} · ${jurisdiction.name}`
    : 'Payroll jurisdiction';
}

export function StatutoryRegistrationPage({
  api = httpStatutoryRegistrationApi,
  permissions,
}: Props) {
  const effectivePermissions = useMemo(
    () => permissions ?? sessionPermissions(),
    [permissions],
  );
  const [asOf, setAsOf] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [types, setTypes] = useState<RegistrationTypeView[]>([]);
  const [registrations, setRegistrations] = useState<
    StatutoryRegistrationView[]
  >([]);
  const [owners, setOwners] = useState<RegistrationOwnerOption[]>([]);
  const [jurisdictions, setJurisdictions] = useState<
    PayrollJurisdictionOption[]
  >([]);
  const [typeDraft, setTypeDraft] =
    useState<RegistrationTypeView | null>(null);
  const [selected, setSelected] =
    useState<StatutoryRegistrationView | null>(null);
  const [readiness, setReadiness] =
    useState<RegistrationReadinessView | null>(null);
  const [error, setError] = useState('');

  const canRead =
    effectivePermissions.has('statutory-registration.read');
  const canWrite =
    effectivePermissions.has('statutory-registration.write');
  const canTypeWrite =
    effectivePermissions.has('statutory-registration-type.write');
  const canVerify =
    effectivePermissions.has('statutory-registration.verify');
  const canApprove =
    effectivePermissions.has('statutory-registration.approve');
  const canReveal =
    effectivePermissions.has('statutory-registration.identifier.read');
  const canReadOrganisation =
    effectivePermissions.has('organisation.read');

  const load = useCallback(async () => {
    if (!canRead) {
      return;
    }
    setError('');
    try {
      const [nextTypes, nextRegistrations] = await Promise.all([
        api.listTypes(asOf),
        api.listRegistrations(asOf),
      ]);
      setTypes(nextTypes);
      setRegistrations(nextRegistrations);

      if (canReadOrganisation) {
        const [nextOwners, nextJurisdictions] = await Promise.all([
          api.listOwners(asOf),
          api.listJurisdictions(asOf),
        ]);
        setOwners(nextOwners);
        setJurisdictions(nextJurisdictions);
      } else {
        setOwners([]);
        setJurisdictions([]);
      }
    } catch (caught) {
      setError((caught as Error).message);
    }
  }, [api, asOf, canRead, canReadOrganisation]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!canRead) {
    return (
      <section
        className="card"
        aria-labelledby="registration-title"
      >
        <h2 id="registration-title">Statutory registrations</h2>
        <p role="alert">
          You do not have permission to view statutory registrations.
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="registration-title">
      <div className="page-heading">
        <div>
          <p className="eyebrow">P5-JRF-01 foundation</p>
          <h2 id="registration-title">Statutory registrations</h2>
          <p>
            Jurisdiction-neutral registration metadata, maker-checker
            lifecycle and bounded readiness.
          </p>
        </div>
        <label>
          Effective date
          <input
            aria-label="Registration effective date"
            type="date"
            value={asOf}
            onChange={event => setAsOf(event.target.value)}
          />
        </label>
      </div>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {!canReadOrganisation && (canWrite || canTypeWrite) && (
        <p className="permission-note">
          Business selectors require <code>organisation.read</code>.
          Technical identifiers are intentionally not accepted by this
          workspace.
        </p>
      )}

      <div className="two-column">
        <section className="card">
          <h3>Effective registration types</h3>
          {types.length === 0 ? (
            <p>No approved registration type is effective.</p>
          ) : (
            <ul className="timeline">
              {types.map(item => (
                <li key={item.versionId}>
                  <strong>
                    {item.code} · {item.name}
                  </strong>
                  <span>
                    {item.authorityCode} · {item.jurisdictionLevelCode}
                  </span>
                  <span>
                    Pattern {item.identifierPattern ?? 'not constrained'} ·{' '}
                    {item.identifierPatternDialect}
                  </span>
                  <span>
                    Case {item.identifierCasePolicy} · Owners:{' '}
                    {item.ownerKinds
                      .map(ownerKindLabel)
                      .join(', ')}
                  </span>
                  {item.parentRequired && (
                    <span>Parent registration required</span>
                  )}
                </li>
              ))}
            </ul>
          )}
          {typeDraft && (
            <div className="action-summary">
              <span>
                Latest type draft: {typeDraft.code} ·{' '}
                {typeDraft.approvalStatus}
              </span>
              {canApprove &&
                typeDraft.approvalStatus === 'DRAFT' && (
                  <button
                    type="button"
                    onClick={() => void approveType()}
                  >
                    Approve registration type
                  </button>
                )}
            </div>
          )}
        </section>

        <section className="card">
          <h3>Effective registrations</h3>
          {registrations.length === 0 ? (
            <p>No active registration is effective.</p>
          ) : (
            <ul className="timeline">
              {registrations.map(item => (
                <li key={item.versionId}>
                  <button
                    className="tree-item"
                    onClick={() => setSelected(item)}
                  >
                    <strong>
                      {item.referenceCode} · {item.identifierNormalized}
                    </strong>
                    <span>
                      {ownerLabel(owners, item.ownerKind, item.ownerId)}
                    </span>
                    <small>{item.lifecycleStatus}</small>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {canTypeWrite && (
        <RegistrationTypeForm
          asOf={asOf}
          types={types}
          onCreate={async (code, input) => {
            setError('');
            try {
              setTypeDraft(await api.createType(code, input));
            } catch (caught) {
              setError((caught as Error).message);
            }
          }}
        />
      )}

      {canWrite && canReadOrganisation && (
        <RegistrationForm
          asOf={asOf}
          types={types}
          owners={owners}
          jurisdictions={jurisdictions}
          registrations={registrations}
          onCreate={async (referenceCode, version) => {
            setError('');
            try {
              const created = await api.createRegistration(
                referenceCode,
                version,
              );
              setSelected(created);
              return created;
            } catch (caught) {
              setError((caught as Error).message);
              throw caught;
            }
          }}
        />
      )}

      {selected && (
        <>
          <RegistrationLifecycle
            selected={selected}
            owners={owners}
            jurisdictions={jurisdictions}
            canWrite={canWrite}
            canVerify={canVerify}
            canApprove={canApprove}
            canReveal={canReveal}
            onChange={next => setSelected(next)}
            api={api}
            onError={setError}
          />
          {canWrite && selected.effectiveTo && (
            <RenewalForm
              selected={selected}
              types={types}
              api={api}
              onCreated={next => setSelected(next)}
              onError={setError}
            />
          )}
        </>
      )}

      {canReadOrganisation ? (
        <ReadinessForm
          asOf={asOf}
          types={types}
          owners={owners}
          jurisdictions={jurisdictions}
          api={api}
          value={readiness}
          onChange={setReadiness}
          onError={setError}
        />
      ) : (
        <section className="card">
          <h3>Jurisdiction-registration readiness</h3>
          <p>
            Organisation read access is required to select an owner and
            payroll jurisdiction.
          </p>
        </section>
      )}
    </section>
  );

  async function approveType() {
    if (!typeDraft) {
      return;
    }
    try {
      setTypeDraft(await api.approveType(typeDraft));
      await load();
    } catch (caught) {
      setError((caught as Error).message);
    }
  }
}

function RegistrationTypeForm({
  asOf,
  types,
  onCreate,
}: {
  asOf: string;
  types: RegistrationTypeView[];
  onCreate: (
    code: string,
    input: RegistrationTypeVersionWrite,
  ) => Promise<void>;
}) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [obligation, setObligation] = useState('GENERIC');
  const [authority, setAuthority] = useState('AUTHORITY');
  const [level, setLevel] = useState('COUNTRY');
  const [identifierPattern, setIdentifierPattern] =
    useState('^[A-Z0-9-]{3,30}$');
  const [casePolicy, setCasePolicy] =
    useState<'UPPER' | 'PRESERVE'>('UPPER');
  const [parentRequired, setParentRequired] = useState(false);
  const [parentTypeId, setParentTypeId] = useState('');
  const [selectedOwnerKinds, setSelectedOwnerKinds] =
    useState<RegistrationOwnerKind[]>(['LEGAL_ENTITY']);

  function toggleOwnerKind(kind: RegistrationOwnerKind) {
    setSelectedOwnerKinds(current =>
      current.includes(kind)
        ? current.filter(item => item !== kind)
        : [...current, kind],
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (
      selectedOwnerKinds.length === 0 ||
      (parentRequired && !parentTypeId)
    ) {
      return;
    }
    await onCreate(code, {
      name,
      obligationCode: obligation,
      authorityCode: authority,
      jurisdictionLevelCode: level,
      identifierPattern: identifierPattern || undefined,
      identifierCasePolicy: casePolicy,
      parentRequired,
      parentRegistrationTypeId:
        parentRequired ? parentTypeId : undefined,
      ownerKinds: selectedOwnerKinds,
      effectiveFrom: asOf,
    });
  }

  return (
    <form
      className="card form-grid"
      onSubmit={event => void submit(event)}
    >
      <h3>Create registration-type draft</h3>
      <label>
        Registration type code
        <input
          required
          value={code}
          onChange={event =>
            setCode(event.target.value.toUpperCase())
          }
        />
      </label>
      <label>
        Registration type name
        <input
          required
          value={name}
          onChange={event => setName(event.target.value)}
        />
      </label>
      <label>
        Obligation code
        <input
          required
          value={obligation}
          onChange={event =>
            setObligation(event.target.value.toUpperCase())
          }
        />
      </label>
      <label>
        Authority code
        <input
          required
          value={authority}
          onChange={event =>
            setAuthority(event.target.value.toUpperCase())
          }
        />
      </label>
      <label>
        Jurisdiction level
        <input
          required
          value={level}
          onChange={event =>
            setLevel(event.target.value.toUpperCase())
          }
        />
      </label>
      <label>
        Identifier pattern
        <input
          value={identifierPattern}
          onChange={event =>
            setIdentifierPattern(event.target.value)
          }
        />
      </label>
      <p className="permission-note">
        Pattern dialect: <code>JAVA_REGEX_V1</code>; whole identifier
        matching is used.
      </p>
      <label>
        Identifier case policy
        <select
          value={casePolicy}
          onChange={event =>
            setCasePolicy(
              event.target.value as 'UPPER' | 'PRESERVE',
            )
          }
        >
          <option value="UPPER">Upper case</option>
          <option value="PRESERVE">Preserve case</option>
        </select>
      </label>

      <fieldset>
        <legend>Allowed owner kinds</legend>
        {ownerKinds.map(kind => (
          <label key={kind}>
            <input
              type="checkbox"
              checked={selectedOwnerKinds.includes(kind)}
              onChange={() => toggleOwnerKind(kind)}
            />
            {ownerKindLabel(kind)}
          </label>
        ))}
      </fieldset>

      <label>
        <input
          type="checkbox"
          checked={parentRequired}
          onChange={event => {
            setParentRequired(event.target.checked);
            if (!event.target.checked) {
              setParentTypeId('');
            }
          }}
        />
        Parent registration required
      </label>

      {parentRequired && (
        <label>
          Allowed parent registration type
          <select
            required
            value={parentTypeId}
            onChange={event => setParentTypeId(event.target.value)}
          >
            <option value="">Select parent type</option>
            {types.map(item => (
              <option key={item.identityId} value={item.identityId}>
                {item.code} - {item.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <button
        type="submit"
        disabled={
          selectedOwnerKinds.length === 0 ||
          (parentRequired && !parentTypeId)
        }
      >
        Create registration type
      </button>
    </form>
  );
}

function RegistrationForm({
  asOf,
  types,
  owners,
  jurisdictions,
  registrations,
  onCreate,
}: {
  asOf: string;
  types: RegistrationTypeView[];
  owners: RegistrationOwnerOption[];
  jurisdictions: PayrollJurisdictionOption[];
  registrations: StatutoryRegistrationView[];
  onCreate: StatutoryRegistrationApi['createRegistration'];
}) {
  const [typeVersionId, setTypeVersionId] = useState('');
  const [referenceCode, setReferenceCode] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [ownerKind, setOwnerKind] =
    useState<RegistrationOwnerKind>('LEGAL_ENTITY');
  const [ownerId, setOwnerId] = useState('');
  const [jurisdictionVersionId, setJurisdictionVersionId] =
    useState('');
  const [parentVersionId, setParentVersionId] = useState('');

  const type = types.find(item => item.versionId === typeVersionId);
  const availableOwners = owners.filter(
    item => item.kind === ownerKind,
  );
  const jurisdiction = jurisdictions.find(
    item => item.versionId === jurisdictionVersionId,
  );
  const parentOptions = type?.parentRequired
    ? registrations.filter(
        item =>
          item.registrationTypeId ===
          type.parentRegistrationTypeId,
      )
    : [];
  const parent = parentOptions.find(
    item => item.versionId === parentVersionId,
  );

  function chooseType(nextVersionId: string) {
    setTypeVersionId(nextVersionId);
    setParentVersionId('');
    setOwnerId('');
    const nextType = types.find(
      item => item.versionId === nextVersionId,
    );
    setOwnerKind(nextType?.ownerKinds[0] ?? 'LEGAL_ENTITY');
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!type || !jurisdiction) {
      return;
    }
    if (type.parentRequired && !parent) {
      return;
    }
    await onCreate(referenceCode, {
      registrationTypeId: type.identityId,
      registrationTypeVersionId: type.versionId,
      identifier,
      ownerKind,
      ownerId,
      payrollJurisdictionId: jurisdiction.identityId,
      payrollJurisdictionVersionId: jurisdiction.versionId,
      parentRegistrationId: parent?.identityId,
      parentRegistrationVersionId: parent?.versionId,
      effectiveFrom: asOf,
    });
  }

  return (
    <form
      className="card form-grid"
      onSubmit={event => void submit(event)}
    >
      <h3>Create statutory-registration draft</h3>
      <label>
        Registration type
        <select
          required
          value={typeVersionId}
          onChange={event => chooseType(event.target.value)}
        >
          <option value="">Select type</option>
          {types.map(item => (
            <option key={item.versionId} value={item.versionId}>
              {item.code} - {item.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Reference code
        <input
          required
          value={referenceCode}
          onChange={event =>
            setReferenceCode(event.target.value.toUpperCase())
          }
        />
      </label>
      <label>
        Registration identifier
        <input
          required
          value={identifier}
          onChange={event => setIdentifier(event.target.value)}
        />
      </label>
      <label>
        Owner kind
        <select
          value={ownerKind}
          onChange={event => {
            setOwnerKind(
              event.target.value as RegistrationOwnerKind,
            );
            setOwnerId('');
          }}
        >
          {(type?.ownerKinds ?? ownerKinds).map(kind => (
            <option key={kind} value={kind}>
              {ownerKindLabel(kind)}
            </option>
          ))}
        </select>
      </label>
      <label>
        Registration owner
        <select
          required
          value={ownerId}
          onChange={event => setOwnerId(event.target.value)}
        >
          <option value="">Select owner</option>
          {availableOwners.map(item => (
            <option key={item.identityId} value={item.identityId}>
              {item.code} - {item.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Payroll jurisdiction
        <select
          required
          value={jurisdictionVersionId}
          onChange={event =>
            setJurisdictionVersionId(event.target.value)
          }
        >
          <option value="">Select jurisdiction</option>
          {jurisdictions.map(item => (
            <option key={item.versionId} value={item.versionId}>
              {item.code} - {item.name}
            </option>
          ))}
        </select>
      </label>

      {type?.parentRequired && (
        <label>
          Parent registration
          <select
            required
            value={parentVersionId}
            onChange={event =>
              setParentVersionId(event.target.value)
            }
          >
            <option value="">Select parent registration</option>
            {parentOptions.map(item => (
              <option key={item.versionId} value={item.versionId}>
                {item.referenceCode} - {item.identifierNormalized}
              </option>
            ))}
          </select>
        </label>
      )}

      <button
        type="submit"
        disabled={
          !type ||
          !ownerId ||
          !jurisdiction ||
          (type.parentRequired && !parent)
        }
      >
        Create registration draft
      </button>
    </form>
  );
}

function RegistrationLifecycle({
  selected,
  owners,
  jurisdictions,
  canWrite,
  canVerify,
  canApprove,
  canReveal,
  onChange,
  api,
  onError,
}: {
  selected: StatutoryRegistrationView;
  owners: RegistrationOwnerOption[];
  jurisdictions: PayrollJurisdictionOption[];
  canWrite: boolean;
  canVerify: boolean;
  canApprove: boolean;
  canReveal: boolean;
  onChange: (value: StatutoryRegistrationView) => void;
  api: StatutoryRegistrationApi;
  onError: (message: string) => void;
}) {
  const [evidence, setEvidence] = useState('manual-evidence');
  const [reason, setReason] =
    useState('Manual statutory decision');
  const [authorityReference, setAuthorityReference] =
    useState('authority-reference');
  const [revealedIdentifier, setRevealedIdentifier] =
    useState<string | null>(null);

  useEffect(() => {
    setRevealedIdentifier(null);
  }, [selected.versionId]);

  async function run(
    work: () => Promise<StatutoryRegistrationView>,
  ) {
    try {
      onError('');
      onChange(await work());
    } catch (caught) {
      onError((caught as Error).message);
    }
  }

  async function reveal() {
    try {
      onError('');
      const exact = await api.revealIdentifier(selected);
      setRevealedIdentifier(exact.identifierNormalized);
    } catch (caught) {
      onError((caught as Error).message);
    }
  }

  return (
    <section
      className="card"
      aria-labelledby="registration-lifecycle-title"
    >
      <div className="section-heading">
        <h3 id="registration-lifecycle-title">
          {selected.referenceCode} lifecycle
        </h3>
        <span className="badge">{selected.lifecycleStatus}</span>
      </div>
      <p>
        Identifier {selected.identifierNormalized}; owner{' '}
        {ownerLabel(
          owners,
          selected.ownerKind,
          selected.ownerId,
        )}; jurisdiction{' '}
        {jurisdictionLabel(
          jurisdictions,
          selected.payrollJurisdictionId,
        )}
      </p>

      {canReveal && (
        <div className="action-summary">
          <span>Exact identifier access is audited.</span>
          <button
            type="button"
            onClick={() => void reveal()}
          >
            Reveal exact identifier
          </button>
          {revealedIdentifier && (
            <strong>
              Exact identifier: {revealedIdentifier}
            </strong>
          )}
        </div>
      )}

      <label>
        Evidence reference
        <input
          value={evidence}
          onChange={event => setEvidence(event.target.value)}
        />
      </label>
      <label>
        Decision reason
        <input
          value={reason}
          onChange={event => setReason(event.target.value)}
        />
      </label>
      <label>
        Authority reference
        <input
          value={authorityReference}
          onChange={event =>
            setAuthorityReference(event.target.value)
          }
        />
      </label>
      <div className="button-row">
        {selected.lifecycleStatus === 'DRAFT' && canWrite && (
          <button
            onClick={() =>
              void run(() => api.submit(selected))
            }
          >
            Submit for verification
          </button>
        )}
        {selected.lifecycleStatus === 'PENDING_VERIFICATION' &&
          canVerify && (
            <button
              onClick={() =>
                void run(() => api.verify(selected, evidence))
              }
            >
              Verify registration
            </button>
          )}
        {selected.lifecycleStatus === 'VERIFIED' &&
          canVerify && (
            <button
              onClick={() =>
                void run(() => api.requestApproval(selected))
              }
            >
              Request approval
            </button>
          )}
        {selected.lifecycleStatus === 'APPROVAL_PENDING' &&
          canApprove && (
            <button
              onClick={() =>
                void run(() => api.approve(selected, evidence))
              }
            >
              Activate registration
            </button>
          )}
        {selected.lifecycleStatus === 'APPROVAL_PENDING' &&
          canApprove && (
            <button
              onClick={() =>
                void run(() =>
                  api.reject(
                    selected,
                    reason,
                    evidence,
                    authorityReference,
                  ),
                )
              }
            >
              Reject registration
            </button>
          )}
        {selected.lifecycleStatus === 'ACTIVE' &&
          canApprove && (
            <button
              onClick={() =>
                void run(() => api.suspend(selected, reason))
              }
            >
              Suspend registration
            </button>
          )}
      </div>
    </section>
  );
}

function RenewalForm({
  selected,
  types,
  api,
  onCreated,
  onError,
}: {
  selected: StatutoryRegistrationView;
  types: RegistrationTypeView[];
  api: StatutoryRegistrationApi;
  onCreated: (value: StatutoryRegistrationView) => void;
  onError: (message: string) => void;
}) {
  const [identifier, setIdentifier] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState(
    selected.effectiveTo ?? '',
  );

  useEffect(() => {
    setIdentifier('');
    setEffectiveFrom(selected.effectiveTo ?? '');
  }, [selected.versionId, selected.effectiveTo]);

  const currentType =
    types.find(
      item => item.identityId === selected.registrationTypeId,
    ) ?? null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!currentType || !effectiveFrom) {
      return;
    }
    const version: RegistrationVersionWrite = {
      registrationTypeId: selected.registrationTypeId,
      registrationTypeVersionId: currentType.versionId,
      identifier,
      ownerKind: selected.ownerKind,
      ownerId: selected.ownerId,
      payrollJurisdictionId: selected.payrollJurisdictionId,
      payrollJurisdictionVersionId:
        selected.payrollJurisdictionVersionId,
      parentRegistrationId:
        selected.parentRegistrationId ?? undefined,
      parentRegistrationVersionId:
        selected.parentRegistrationVersionId ?? undefined,
      effectiveFrom,
    };
    try {
      onError('');
      onCreated(await api.addVersion(selected, version));
    } catch (caught) {
      onError((caught as Error).message);
    }
  }

  return (
    <form
      className="card form-grid"
      onSubmit={event => void submit(event)}
    >
      <h3>Create renewal/successor draft</h3>
      <p>
        The current registration remains authoritative until a
        non-overlapping successor completes verification and approval.
      </p>
      <label>
        Renewal identifier
        <input
          required
          value={identifier}
          onChange={event => setIdentifier(event.target.value)}
        />
      </label>
      <label>
        Renewal effective from
        <input
          required
          type="date"
          value={effectiveFrom}
          onChange={event =>
            setEffectiveFrom(event.target.value)
          }
        />
      </label>
      <button
        type="submit"
        disabled={!identifier || !currentType || !effectiveFrom}
      >
        Create renewal draft
      </button>
    </form>
  );
}

function ReadinessForm({
  asOf,
  types,
  owners,
  jurisdictions,
  api,
  value,
  onChange,
  onError,
}: {
  asOf: string;
  types: RegistrationTypeView[];
  owners: RegistrationOwnerOption[];
  jurisdictions: PayrollJurisdictionOption[];
  api: StatutoryRegistrationApi;
  value: RegistrationReadinessView | null;
  onChange: (value: RegistrationReadinessView) => void;
  onError: (message: string) => void;
}) {
  const [typeId, setTypeId] = useState('');
  const [ownerKind, setOwnerKind] =
    useState<RegistrationOwnerKind>('LEGAL_ENTITY');
  const [ownerId, setOwnerId] = useState('');
  const [jurisdictionVersionId, setJurisdictionVersionId] =
    useState('');

  const type = types.find(item => item.identityId === typeId);
  const availableOwners = owners.filter(
    item => item.kind === ownerKind,
  );
  const jurisdiction = jurisdictions.find(
    item => item.versionId === jurisdictionVersionId,
  );

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!jurisdiction) {
      return;
    }
    try {
      onError('');
      onChange(
        await api.readiness({
          registrationTypeId: typeId,
          ownerKind,
          ownerId,
          payrollJurisdictionId: jurisdiction.identityId,
          asOf,
          warningHorizonDays: 45,
        }),
      );
    } catch (caught) {
      onError((caught as Error).message);
    }
  }

  return (
    <form
      className="card form-grid"
      onSubmit={event => void submit(event)}
    >
      <h3>Jurisdiction-registration readiness</h3>
      <label>
        Readiness registration type
        <select
          required
          value={typeId}
          onChange={event => {
            const nextTypeId = event.target.value;
            setTypeId(nextTypeId);
            setOwnerId('');
            const nextType = types.find(
              item => item.identityId === nextTypeId,
            );
            setOwnerKind(
              nextType?.ownerKinds[0] ?? 'LEGAL_ENTITY',
            );
          }}
        >
          <option value="">Select type</option>
          {types.map(item => (
            <option key={item.identityId} value={item.identityId}>
              {item.code} - {item.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Readiness owner kind
        <select
          value={ownerKind}
          onChange={event => {
            setOwnerKind(
              event.target.value as RegistrationOwnerKind,
            );
            setOwnerId('');
          }}
        >
          {(type?.ownerKinds ?? ownerKinds).map(kind => (
            <option key={kind} value={kind}>
              {ownerKindLabel(kind)}
            </option>
          ))}
        </select>
      </label>
      <label>
        Readiness owner
        <select
          required
          value={ownerId}
          onChange={event => setOwnerId(event.target.value)}
        >
          <option value="">Select owner</option>
          {availableOwners.map(item => (
            <option key={item.identityId} value={item.identityId}>
              {item.code} - {item.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Readiness jurisdiction
        <select
          required
          value={jurisdictionVersionId}
          onChange={event =>
            setJurisdictionVersionId(event.target.value)
          }
        >
          <option value="">Select jurisdiction</option>
          {jurisdictions.map(item => (
            <option key={item.versionId} value={item.versionId}>
              {item.code} - {item.name}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        disabled={!typeId || !ownerId || !jurisdiction}
      >
        Evaluate readiness
      </button>
      {value && (
        <div className="action-summary" role="status">
          <strong>{value.ready ? 'Ready' : 'Blocked'}</strong>
          {value.findings.map(item => (
            <span key={item.code}>
              {item.severity}: {item.code} — {item.message}
            </span>
          ))}
        </div>
      )}
    </form>
  );
}
