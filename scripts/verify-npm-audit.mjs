#!/usr/bin/env node
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {fileURLToPath} from 'node:url';

const ALLOWED_ADVISORY = Object.freeze({
  source: 1124282,
  packageName: 'react-router',
  dependency: 'react-router',
  severity: 'high',
  url: 'https://github.com/advisories/GHSA-qwww-vcr4-c8h2',
  range: '>=7.12.0 <8.3.0'
});

const ALLOWED_HIGH_PACKAGES = new Set([
  'react-router',
  'react-router-dom'
]);

const EXPECTED_ROUTER_VERSION = '7.18.1';
const EXCEPTION_REVIEW_DEADLINE = '2026-10-31';

const FORBIDDEN_DEPENDENCIES = new Set([
  '@react-router/dev',
  '@react-router/node',
  '@react-router/serve',
  '@vitejs/plugin-rsc',
  'react-server-dom-parcel',
  'react-server-dom-turbopack',
  'react-server-dom-webpack'
]);

const FORBIDDEN_SOURCE_PATTERNS = [
  ['React Router RSC Vite plugin', /\bunstable_reactRouterRSC\b/],
  ['RSC server matcher', /\bmatchRSCServerRequest\b/],
  ['RSC server router', /\brouteRSCServerRequest\b/],
  ['RSC static router', /\bRSCStaticRouter\b/],
  ['RSC hydrated router', /\bRSCHydratedRouter\b/],
  ['React server component package', /\breact-server-dom(?:-[\w-]+)?\b/],
  ['React Router data router', /\bcreateBrowserRouter\b/],
  ['React Router provider', /\bRouterProvider\b/],
  ['React Router hydrated framework router', /\bHydratedRouter\b/],
  ['React Router server router', /\bServerRouter\b/]
];

function fail(message) {
  throw new Error(message);
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    fail(`Unable to parse JSON at ${filePath}: ${error.message}`);
  }
}

function parseAuditJson(text) {
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first < 0 || last < first) {
    fail('npm audit did not return a JSON object.');
  }

  const candidate = text.slice(first, last + 1);
  try {
    return JSON.parse(candidate);
  } catch (error) {
    fail(`npm audit JSON could not be parsed: ${error.message}`);
  }
}

function severityRank(severity) {
  return {
    info: 0,
    low: 1,
    moderate: 2,
    high: 3,
    critical: 4
  }[severity] ?? -1;
}

function isHighOrCritical(vulnerability) {
  return severityRank(vulnerability.severity) >= severityRank('high');
}

function isAllowedAdvisoryObject(entry) {
  return (
    entry &&
    typeof entry === 'object' &&
    entry.source === ALLOWED_ADVISORY.source &&
    entry.name === ALLOWED_ADVISORY.packageName &&
    entry.dependency === ALLOWED_ADVISORY.dependency &&
    entry.severity === ALLOWED_ADVISORY.severity &&
    entry.url === ALLOWED_ADVISORY.url &&
    entry.range === ALLOWED_ADVISORY.range
  );
}

function resolveHighAdvisories(report, packageName, visiting = new Set()) {
  const vulnerabilities = report.vulnerabilities ?? {};
  const vulnerability = vulnerabilities[packageName];

  if (!vulnerability) {
    fail(`Audit entry references missing vulnerability package: ${packageName}`);
  }

  if (visiting.has(packageName)) {
    fail(`Circular npm audit vulnerability chain detected at ${packageName}`);
  }

  const nextVisiting = new Set(visiting);
  nextVisiting.add(packageName);

  const resolved = [];

  for (const viaEntry of vulnerability.via ?? []) {
    if (typeof viaEntry === 'string') {
      resolved.push(
        ...resolveHighAdvisories(report, viaEntry, nextVisiting)
      );
      continue;
    }

    if (severityRank(viaEntry.severity) >= severityRank('high')) {
      resolved.push(viaEntry);
    }
  }

  return resolved;
}

function validateAllowedAuditReport(report) {
  if (report.auditReportVersion !== 2) {
    fail(
      `Unsupported npm audit report version: ${report.auditReportVersion}`
    );
  }

  const vulnerabilities = report.vulnerabilities ?? {};
  const entries = Object.entries(vulnerabilities);
  const highEntries = entries.filter(([, vulnerability]) =>
    isHighOrCritical(vulnerability)
  );

  if (highEntries.length === 0) {
    return {
      status: 'clean',
      highPackageCount: 0,
      advisoryCount: 0
    };
  }

  const highPackageNames = new Set(highEntries.map(([name]) => name));
  for (const packageName of highPackageNames) {
    if (!ALLOWED_HIGH_PACKAGES.has(packageName)) {
      fail(
        `Unapproved high/critical npm advisory package: ${packageName}`
      );
    }
  }

  const resolvedByPackage = new Map();

  for (const [packageName] of highEntries) {
    const resolved = resolveHighAdvisories(report, packageName);

    if (resolved.length === 0) {
      fail(
        `High/critical package ${packageName} has no resolvable advisory`
      );
    }

    for (const advisory of resolved) {
      if (!isAllowedAdvisoryObject(advisory)) {
        fail(
          `Unapproved advisory for ${packageName}: ` +
          `${advisory.url ?? advisory.source ?? 'unknown'}`
        );
      }
    }

    resolvedByPackage.set(packageName, resolved);
  }

  const router = vulnerabilities['react-router'];
  const routerDom = vulnerabilities['react-router-dom'];

  if (!router || !routerDom) {
    fail(
      'The approved advisory must be represented by react-router and ' +
      'react-router-dom audit entries.'
    );
  }

  if (router.isDirect !== false) {
    fail('react-router must remain a transitive dependency.');
  }

  if (routerDom.isDirect !== true) {
    fail('react-router-dom must remain the direct dependency.');
  }

  if (
    !Array.isArray(routerDom.via) ||
    routerDom.via.length !== 1 ||
    routerDom.via[0] !== 'react-router'
  ) {
    fail(
      'react-router-dom must inherit only the react-router advisory.'
    );
  }

  const uniqueSources = new Set();
  for (const advisories of resolvedByPackage.values()) {
    for (const advisory of advisories) {
      uniqueSources.add(advisory.source);
    }
  }

  if (
    uniqueSources.size !== 1 ||
    !uniqueSources.has(ALLOWED_ADVISORY.source)
  ) {
    fail('The audit exception resolved to more than one advisory source.');
  }

  const metadata = report.metadata?.vulnerabilities;
  if (metadata) {
    const computedHigh = highEntries.filter(
      ([, vulnerability]) => vulnerability.severity === 'high'
    ).length;
    const computedCritical = highEntries.filter(
      ([, vulnerability]) => vulnerability.severity === 'critical'
    ).length;

    if (
      metadata.high !== computedHigh ||
      metadata.critical !== computedCritical
    ) {
      fail(
        'npm audit metadata does not match the parsed high/critical entries.'
      );
    }
  }

  return {
    status: 'allowed-exception',
    highPackageCount: highEntries.length,
    advisoryCount: uniqueSources.size
  };
}

function walkFiles(root) {
  const output = [];
  if (!fs.existsSync(root)) {
    return output;
  }

  for (const entry of fs.readdirSync(root, {withFileTypes: true})) {
    const absolute = path.join(root, entry.name);
    if (entry.isDirectory()) {
      output.push(...walkFiles(absolute));
    } else if (entry.isFile()) {
      output.push(absolute);
    }
  }
  return output;
}

function inspectProject(projectRoot) {
  const packageJsonPath = path.join(projectRoot, 'package.json');
  const packageLockPath = path.join(projectRoot, 'package-lock.json');

  const packageJson = readJson(packageJsonPath);
  const packageLock = readJson(packageLockPath);

  const dependencyGroups = [
    packageJson.dependencies ?? {},
    packageJson.devDependencies ?? {},
    packageJson.optionalDependencies ?? {},
    packageJson.peerDependencies ?? {}
  ];

  for (const group of dependencyGroups) {
    for (const dependencyName of Object.keys(group)) {
      if (
        FORBIDDEN_DEPENDENCIES.has(dependencyName) ||
        dependencyName.startsWith('react-server-dom-')
      ) {
        fail(
          `RSC/framework dependency is incompatible with the exception: ` +
          dependencyName
        );
      }
    }
  }

  const rootDomVersion =
    packageJson.dependencies?.['react-router-dom'];
  const lockRootDomVersion =
    packageLock.packages?.['']?.dependencies?.['react-router-dom'];
  const lockedDomVersion =
    packageLock.packages?.['node_modules/react-router-dom']?.version;
  const lockedRouterVersion =
    packageLock.packages?.['node_modules/react-router']?.version;

  for (const [label, version] of [
    ['package.json react-router-dom', rootDomVersion],
    ['package-lock root react-router-dom', lockRootDomVersion],
    ['locked react-router-dom', lockedDomVersion],
    ['locked react-router', lockedRouterVersion]
  ]) {
    if (version !== EXPECTED_ROUTER_VERSION) {
      fail(
        `${label} must be ${EXPECTED_ROUTER_VERSION}; found ${version}`
      );
    }
  }

  const inspectionFiles = [
    ...walkFiles(path.join(projectRoot, 'src')),
    path.join(projectRoot, 'vite.config.ts'),
    packageJsonPath
  ].filter(filePath => fs.existsSync(filePath));

  let browserRouterFound = false;

  for (const filePath of inspectionFiles) {
    const text = fs.readFileSync(filePath, 'utf8');

    if (/\bBrowserRouter\b/.test(text)) {
      browserRouterFound = true;
    }

    for (const [label, pattern] of FORBIDDEN_SOURCE_PATTERNS) {
      if (pattern.test(text)) {
        fail(
          `${label} is incompatible with the approved audit exception: ` +
          path.relative(projectRoot, filePath)
        );
      }
    }
  }

  if (!browserRouterFound) {
    fail(
      'BrowserRouter declarative-mode evidence was not found in the frontend.'
    );
  }

  const deadline = new Date(`${EXCEPTION_REVIEW_DEADLINE}T00:00:00Z`);
  const now = new Date();

  if (now >= deadline) {
    fail(
      `The React Router audit exception expired on ` +
      `${EXCEPTION_REVIEW_DEADLINE}. Re-review or remove it.`
    );
  }

  return {
    routerVersion: EXPECTED_ROUTER_VERSION,
    mode: 'declarative-browser-router',
    reviewDeadline: EXCEPTION_REVIEW_DEADLINE
  };
}

function sampleAllowedReport() {
  return {
    auditReportVersion: 2,
    vulnerabilities: {
      'react-router': {
        name: 'react-router',
        severity: 'high',
        isDirect: false,
        via: [{
          source: 1124282,
          name: 'react-router',
          dependency: 'react-router',
          title:
            'React Router: RSC Mode CSRF Bypass Allows Action ' +
            'Execution Before 400 Response',
          url:
            'https://github.com/advisories/' +
            'GHSA-qwww-vcr4-c8h2',
          severity: 'high',
          cwe: ['CWE-352'],
          cvss: {score: 0, vectorString: null},
          range: '>=7.12.0 <8.3.0'
        }],
        effects: ['react-router-dom'],
        range: '7.12.0 - 8.2.0',
        nodes: ['node_modules/react-router'],
        fixAvailable: {
          name: 'react-router-dom',
          version: '7.11.0',
          isSemVerMajor: true
        }
      },
      'react-router-dom': {
        name: 'react-router-dom',
        severity: 'high',
        isDirect: true,
        via: ['react-router'],
        effects: [],
        range: '>=7.12.0-pre.0',
        nodes: ['node_modules/react-router-dom'],
        fixAvailable: {
          name: 'react-router-dom',
          version: '7.11.0',
          isSemVerMajor: true
        }
      }
    },
    metadata: {
      vulnerabilities: {
        info: 0,
        low: 0,
        moderate: 0,
        high: 2,
        critical: 0,
        total: 2
      }
    }
  };
}

function expectFailure(label, callback) {
  try {
    callback();
  } catch {
    return;
  }
  fail(`Self-test expected failure but passed: ${label}`);
}

function runSelfTests() {
  const windowsInvocation = buildNpmAuditInvocation(
    'win32',
    {ComSpec: 'C:\\Windows\\System32\\cmd.exe'}
  );

  if (
    windowsInvocation.executable !==
      'C:\\Windows\\System32\\cmd.exe' ||
    windowsInvocation.arguments.join('|') !==
      '/d|/s|/c|npm.cmd audit --audit-level=high --json'
  ) {
    fail('Windows npm audit invocation self-test failed.');
  }

  const unixInvocation = buildNpmAuditInvocation('linux', {});

  if (
    unixInvocation.executable !== 'npm' ||
    unixInvocation.arguments.join('|') !==
      'audit|--audit-level=high|--json'
  ) {
    fail('Unix npm audit invocation self-test failed.');
  }

  const fallbackWindowsInvocation = buildNpmAuditInvocation(
    'win32',
    {}
  );

  if (fallbackWindowsInvocation.executable !== 'cmd.exe') {
    fail('Windows ComSpec fallback self-test failed.');
  }

  const allowed = sampleAllowedReport();
  const allowedResult = validateAllowedAuditReport(allowed);

  if (allowedResult.status !== 'allowed-exception') {
    fail('Allowed report self-test did not use the exception path.');
  }

  const clean = {
    auditReportVersion: 2,
    vulnerabilities: {},
    metadata: {
      vulnerabilities: {
        info: 0,
        low: 0,
        moderate: 0,
        high: 0,
        critical: 0,
        total: 0
      }
    }
  };

  if (validateAllowedAuditReport(clean).status !== 'clean') {
    fail('Clean audit self-test did not pass.');
  }

  const extraAdvisory = structuredClone(allowed);
  extraAdvisory.vulnerabilities['react-router'].via.push({
    source: 9999999,
    name: 'react-router',
    dependency: 'react-router',
    url: 'https://github.com/advisories/GHSA-xxxx-yyyy-zzzz',
    severity: 'high',
    range: '*'
  });
  expectFailure(
    'additional high advisory',
    () => validateAllowedAuditReport(extraAdvisory)
  );

  const wrongUrl = structuredClone(allowed);
  wrongUrl.vulnerabilities['react-router'].via[0].url =
    'https://github.com/advisories/GHSA-wrong';
  expectFailure(
    'allowed source with wrong URL',
    () => validateAllowedAuditReport(wrongUrl)
  );

  const unknownWrapper = structuredClone(allowed);
  unknownWrapper.vulnerabilities['react-router-dom'].via =
    ['missing-package'];
  expectFailure(
    'wrapper references unknown package',
    () => validateAllowedAuditReport(unknownWrapper)
  );

  const directRouter = structuredClone(allowed);
  directRouter.vulnerabilities['react-router'].isDirect = true;
  expectFailure(
    'react-router becomes direct',
    () => validateAllowedAuditReport(directRouter)
  );

  console.log('npm audit policy self-tests: PASS');
}

function parseArguments(argv) {
  const result = {
    selfTest: false,
    input: null,
    projectRoot: process.cwd()
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === '--self-test') {
      result.selfTest = true;
      continue;
    }

    if (argument === '--input') {
      result.input = argv[index + 1];
      index += 1;
      continue;
    }

    if (argument === '--project-root') {
      result.projectRoot = argv[index + 1];
      index += 1;
      continue;
    }

    fail(`Unknown argument: ${argument}`);
  }

  return result;
}

function buildNpmAuditInvocation(
  platform = process.platform,
  environment = process.env
) {
  const auditArguments = [
    'audit',
    '--audit-level=high',
    '--json'
  ];

  if (platform === 'win32') {
    return {
      executable:
        environment.ComSpec ??
        environment.COMSPEC ??
        'cmd.exe',
      arguments: [
        '/d',
        '/s',
        '/c',
        'npm.cmd audit --audit-level=high --json'
      ]
    };
  }

  return {
    executable: 'npm',
    arguments: auditArguments
  };
}

function runNpmAudit(projectRoot) {
  const invocation = buildNpmAuditInvocation();

  const result = spawnSync(
    invocation.executable,
    invocation.arguments,
    {
      cwd: projectRoot,
      encoding: 'utf8',
      windowsHide: true,
      maxBuffer: 20 * 1024 * 1024
    }
  );

  if (result.error) {
    fail(
      `Unable to execute npm audit through ` +
      `${invocation.executable}: ${result.error.message}`
    );
  }

  if (result.stderr?.trim()) {
    process.stderr.write(result.stderr);
  }

  if (![0, 1].includes(result.status)) {
    fail(
      `npm audit failed unexpectedly with exit code ` +
      `${result.status}`
    );
  }

  const report = parseAuditJson(result.stdout ?? '');
  return {report, exitCode: result.status};
}

function main() {
  const options = parseArguments(process.argv.slice(2));

  runSelfTests();

  if (options.selfTest && !options.input) {
    return;
  }

  const project = inspectProject(
    path.resolve(options.projectRoot)
  );

  const audit = options.input
    ? {
        report: readJson(path.resolve(options.input)),
        exitCode: 1
      }
    : runNpmAudit(path.resolve(options.projectRoot));

  const evaluation = validateAllowedAuditReport(audit.report);

  if (evaluation.status === 'clean') {
    if (audit.exitCode !== 0) {
      fail(
        'npm audit returned a failure exit code without high/critical ' +
        'vulnerabilities.'
      );
    }

    console.log('npm audit policy: PASS — no high/critical advisories.');
    return;
  }

  if (audit.exitCode !== 1) {
    fail(
      'The approved advisory exception requires npm audit exit code 1.'
    );
  }

  console.log(
    'npm audit policy: PASS — approved exception ' +
    `${ALLOWED_ADVISORY.url}`
  );
  console.log(
    `Frontend mode: ${project.mode}; router ${project.routerVersion}`
  );
  console.log(
    `Exception review deadline: ${project.reviewDeadline}`
  );
}

try {
  main();
} catch (error) {
  console.error(`npm audit policy: FAIL — ${error.message}`);
  process.exit(1);
}
