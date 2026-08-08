#!/usr/bin/env node
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const EXPECTED_ROUTER_VERSION = '7.18.2';
const MIN_NANOID_VERSION = Object.freeze([3, 3, 17]);

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

  try {
    return JSON.parse(text.slice(first, last + 1));
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

function validateCleanAuditReport(report) {
  if (report.auditReportVersion !== 2) {
    fail(`Unsupported npm audit report version: ${report.auditReportVersion}`);
  }

  const vulnerabilities = report.vulnerabilities ?? {};
  const highEntries = Object.entries(vulnerabilities)
    .filter(([, vulnerability]) =>
      severityRank(vulnerability.severity) >= severityRank('high')
    );

  if (highEntries.length > 0) {
    const summary = highEntries
      .map(([name, vulnerability]) => `${name}:${vulnerability.severity}`)
      .join(', ');
    fail(`High/critical npm advisories are not permitted: ${summary}`);
  }

  const metadata = report.metadata?.vulnerabilities;
  if (metadata && (metadata.high !== 0 || metadata.critical !== 0)) {
    fail(
      'npm audit metadata reports high/critical vulnerabilities despite ' +
      'an empty parsed high/critical set.'
    );
  }

  return {status: 'clean'};
}

function walkFiles(root) {
  if (!fs.existsSync(root)) {
    return [];
  }

  const output = [];
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

function parseVersion(value) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(value ?? '');
  if (!match) {
    fail(`Expected a simple semantic version, found ${value}`);
  }
  return match.slice(1).map(Number);
}

function compareVersion(left, right) {
  for (let index = 0; index < 3; index += 1) {
    if (left[index] < right[index]) return -1;
    if (left[index] > right[index]) return 1;
  }
  return 0;
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
      if (dependencyName === 'nanoid') {
        fail('nanoid must remain transitive; do not add it as a direct dependency.');
      }
      if (
        FORBIDDEN_DEPENDENCIES.has(dependencyName) ||
        dependencyName.startsWith('react-server-dom-')
      ) {
        fail(`RSC/framework dependency is forbidden: ${dependencyName}`);
      }
    }
  }

  const versions = [
    ['package.json react-router-dom',
      packageJson.dependencies?.['react-router-dom']],
    ['package-lock root react-router-dom',
      packageLock.packages?.['']?.dependencies?.['react-router-dom']],
    ['locked react-router-dom',
      packageLock.packages?.['node_modules/react-router-dom']?.version],
    ['locked react-router',
      packageLock.packages?.['node_modules/react-router']?.version]
  ];

  for (const [label, version] of versions) {
    if (version !== EXPECTED_ROUTER_VERSION) {
      fail(`${label} must be ${EXPECTED_ROUTER_VERSION}; found ${version}`);
    }
  }

  const nanoidVersion =
    packageLock.packages?.['node_modules/nanoid']?.version;
  const nanoid = parseVersion(nanoidVersion);
  if (
    nanoid[0] !== 3 ||
    compareVersion(nanoid, MIN_NANOID_VERSION) < 0
  ) {
    fail(
      `locked nanoid must be >=3.3.17 and <4.0.0; found ${nanoidVersion}`
    );
  }

  const postcssNanoid =
    packageLock.packages?.['node_modules/postcss']?.dependencies?.nanoid;
  if (postcssNanoid !== '^3.3.12') {
    fail(
      `expected PostCSS nanoid range ^3.3.12; found ${postcssNanoid}`
    );
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
          `${label} is forbidden by the frontend security profile: ` +
          path.relative(projectRoot, filePath)
        );
      }
    }
  }

  if (!browserRouterFound) {
    fail('BrowserRouter declarative-mode evidence was not found.');
  }

  return {
    routerVersion: EXPECTED_ROUTER_VERSION,
    nanoidVersion,
    mode: 'declarative-browser-router'
  };
}

function sampleCleanReport() {
  return {
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
}

function expectFailure(label, callback) {
  try {
    callback();
  } catch {
    return;
  }
  fail(`Self-test expected failure but passed: ${label}`);
}

function buildNpmAuditInvocation(
  platform = process.platform,
  environment = process.env
) {
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
    arguments: ['audit', '--audit-level=high', '--json']
  };
}

function runSelfTests() {
  const windows = buildNpmAuditInvocation(
    'win32',
    {ComSpec: 'C:\\Windows\\System32\\cmd.exe'}
  );
  if (
    windows.executable !== 'C:\\Windows\\System32\\cmd.exe' ||
    windows.arguments.join('|') !==
      '/d|/s|/c|npm.cmd audit --audit-level=high --json'
  ) {
    fail('Windows npm audit invocation self-test failed.');
  }

  const unix = buildNpmAuditInvocation('linux', {});
  if (
    unix.executable !== 'npm' ||
    unix.arguments.join('|') !== 'audit|--audit-level=high|--json'
  ) {
    fail('Unix npm audit invocation self-test failed.');
  }

  validateCleanAuditReport(sampleCleanReport());

  const high = sampleCleanReport();
  high.vulnerabilities.nanoid = {
    name: 'nanoid',
    severity: 'high',
    via: [],
    effects: [],
    range: '<3.3.17',
    nodes: ['node_modules/nanoid']
  };
  high.metadata.vulnerabilities.high = 1;
  high.metadata.vulnerabilities.total = 1;
  expectFailure(
    'high advisory must be rejected',
    () => validateCleanAuditReport(high)
  );

  if (compareVersion([3, 3, 17], [3, 3, 17]) !== 0) {
    fail('version equality self-test failed.');
  }
  if (compareVersion([3, 3, 18], [3, 3, 17]) <= 0) {
    fail('version greater-than self-test failed.');
  }

  console.log('npm audit clean-policy self-tests: PASS');
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
      `Unable to execute npm audit through ${invocation.executable}: ` +
      result.error.message
    );
  }

  if (result.stderr?.trim()) {
    process.stderr.write(result.stderr);
  }

  if (![0, 1].includes(result.status)) {
    fail(`npm audit failed unexpectedly with exit code ${result.status}`);
  }

  return {
    report: parseAuditJson(result.stdout ?? ''),
    exitCode: result.status
  };
}

function main() {
  const options = parseArguments(process.argv.slice(2));

  runSelfTests();

  if (options.selfTest && !options.input) {
    return;
  }

  const projectRoot = path.resolve(options.projectRoot);
  const project = inspectProject(projectRoot);

  const audit = options.input
    ? {
        report: readJson(path.resolve(options.input)),
        exitCode: 0
      }
    : runNpmAudit(projectRoot);

  validateCleanAuditReport(audit.report);

  if (audit.exitCode !== 0) {
    fail(
      'npm audit returned a failure exit code despite the clean-policy result.'
    );
  }

  console.log('npm audit policy: PASS — no high/critical advisories.');
  console.log(
    `Frontend mode: ${project.mode}; router ${project.routerVersion}; ` +
    `nanoid ${project.nanoidVersion}`
  );
}

try {
  main();
} catch (error) {
  console.error(`npm audit policy: FAIL — ${error.message}`);
  process.exit(1);
}
