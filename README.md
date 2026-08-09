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

While the UI remains inside the monorepo, the backend repository is discovered
from the existing `frontend/payroll-web` location, so current commands keep the
same behavior.

For an independently checked-out UI, set:

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
