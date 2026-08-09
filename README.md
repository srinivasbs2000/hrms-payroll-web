# Payroll Web (React 18)

The Payroll UI is a React 18, TypeScript and Vite application. Its runtime API
calls remain relative under `/api/v1`; the Vite development server proxies
`/api` to the Payroll backend on `http://localhost:8080`.

## Local commands

```text
npm ci
npm run lint
npm test
npm run build
```

## Browser E2E backend boundary

The browser E2E suite starts the Payroll backend through
`e2e/start-backend.mjs`.

The UI is maintained in this standalone repository. Browser E2E resolves the
authoritative backend through `PAYROLL_BACKEND_REPOSITORY_PATH`.

For local browser E2E, set:

```text
PAYROLL_BACKEND_REPOSITORY_PATH=C:\dev\hrms-payroll
```

The referenced backend repository must contain `mvnw`/`mvnw.cmd`,
`backend/payroll-boot/pom.xml`, and `deploy/local/.env`. Validate that boundary
without starting the backend by running:

```text
npm run e2e:backend-check
```

This setting changes repository location only. It does not change API paths,
Keycloak client identity, tenant claims, permissions, browser token handling or
Payroll business behavior.

## Repository ownership after HK-UI-SPLIT-01

This repository is the independently published Payroll React UI repository.
From HK-UI-SPLIT-01C, frontend test/build, npm dependency automation, frontend
SBOM generation and UI-initiated browser E2E are owned here.

The `srinivasbs2000/hrms-payroll` repository remains authoritative for Payroll
program governance, API/OpenAPI contracts, database migrations, backend code,
Keycloak deployment, deterministic E2E fixtures and backend service evidence.

Cross-repository browser E2E checks out the backend authority separately and
passes its checkout through `PAYROLL_BACKEND_REPOSITORY_PATH`. HK-UI-SPLIT-01D
removed the former embedded UI source copy and duplicate backend-owned frontend
CI. The history-preserving extraction provenance remains in
`EXTRACTION_PROVENANCE.md`.
