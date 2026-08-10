import {spawn,spawnSync} from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const frontendRoot=path.resolve(here,'..');
const defaultBackendRepository=path.resolve(frontendRoot,'../..');
const configuredBackendRepository=
  process.env.PAYROLL_BACKEND_REPOSITORY_PATH?.trim();
const backendRepository=path.resolve(
  configuredBackendRepository||defaultBackendRepository
);
const environmentPath=path.join(backendRepository,'deploy','local','.env');
const expectedBackendSha=process.env.PAYROLL_BACKEND_EXPECTED_SHA?.trim();

function requireFile(file,label){
  if(!fs.existsSync(file))throw new Error(`${label} does not exist: ${file}`);
}

function readEnvironment(file){
  requireFile(file,'Environment file');
  const values={};
  for(const original of fs.readFileSync(file,'utf8').split(/\r?\n/)){
    const line=original.trim();
    if(!line||line.startsWith('#'))continue;
    const separator=line.indexOf('=');
    if(separator<1)throw new Error(`Invalid environment entry: ${original}`);
    values[line.slice(0,separator).trim()]=line.slice(separator+1);
  }
  return values;
}

function commandOutput(command,args,label){
  const result=spawnSync(command,args,{
    cwd:backendRepository,
    encoding:'utf8',
    shell:false
  });
  if(result.error)throw result.error;
  if(result.status!==0)throw new Error(`${label} failed with exit code ${result.status}.`);
  return String(result.stdout??'').trim();
}

if(expectedBackendSha){
  const actual=commandOutput('git',['rev-parse','HEAD'],'Backend SHA validation');
  if(actual!==expectedBackendSha)throw new Error(
    `Backend HEAD ${actual} does not match required merged main ${expectedBackendSha}.`
  );
  console.log(`Exact merged backend main: PASS (${actual})`);
}

function syntheticKey(label){
  return crypto.createHash('sha256')
    .update(`hrms-payroll-isolated-e2e:${label}`,'utf8')
    .digest('base64');
}

const wrapper=path.join(
  backendRepository,
  process.platform==='win32'?'mvnw.cmd':'mvnw'
);
const backendPom=path.join(
  backendRepository,
  'backend',
  'payroll-boot',
  'pom.xml'
);

requireFile(wrapper,'Maven wrapper');
requireFile(backendPom,'Payroll backend POM');

const values=readEnvironment(environmentPath);
for(const required of ['PAYROLL_APP_PASSWORD']){
  if(!values[required])throw new Error(`Missing ${required} in ${environmentPath}`);
}

if(process.argv.includes('--validate-only')){
  const rootPom=path.join(backendRepository,'pom.xml');
  requireFile(rootPom,'Backend root POM');
  const rootPomText=fs.readFileSync(rootPom,'utf8');
  if(!rootPomText.includes('<module>backend/payroll-boot</module>'))throw new Error(
    'Backend root reactor does not include backend/payroll-boot.'
  );
  const bootPomText=fs.readFileSync(backendPom,'utf8');
  if(!bootPomText.includes('<artifactId>payroll-boot</artifactId>'))throw new Error(
    'Payroll boot artifact identity is not payroll-boot.'
  );
  console.log(`Backend repository contract validated: ${backendRepository}`);
  console.log('Backend reactor/boot module contract: PASS');
  process.exit(0);
}

function cmdQuote(value){
  if(!/[\s"&|<>^]/.test(value))return value;
  return `"${value.replaceAll('"','""')}"`;
}

function mavenCommand(args){
  if(process.platform==='win32'){
    return {
      command:'cmd.exe',
      args:['/d','/c',['mvnw.cmd',...args].map(cmdQuote).join(' ')]
    };
  }
  return {command:wrapper,args};
}

function inspectRuntimeJar(moduleName,requiredClass,label){
  const target=path.join(backendRepository,'backend',moduleName,'target');
  requireFile(target,`${label} target directory`);
  const jars=fs.readdirSync(target)
    .filter(name=>
      new RegExp(`^${moduleName}-.*\\.jar$`).test(name)&&
      !name.endsWith('-sources.jar')&&
      !name.endsWith('-javadoc.jar')
    );
  if(jars.length!==1)throw new Error(
    `Expected one ${label} runtime JAR, found ${jars.length}.`
  );
  const jar=path.join(target,jars[0]);
  const jarList=spawnSync('jar',['tf',jar],{
    cwd:backendRepository,
    encoding:'utf8',
    shell:false
  });
  if(jarList.error)throw jarList.error;
  if(jarList.status!==0)throw new Error(`Unable to inspect ${label} runtime JAR: ${jar}`);
  if(!String(jarList.stdout??'').includes(requiredClass))throw new Error(
    `Fresh ${label} runtime JAR is missing ${requiredClass}`
  );
  console.log(`Fresh ${label} runtime artifact: PASS`);
}

function runCurrentReactorInstall(){
  const invocation=mavenCommand([
    '--batch-mode',
    '-DskipTests',
    '-DskipITs',
    'clean',
    'install'
  ]);
  console.log(`Backend reactor command: ${invocation.command} ${invocation.args.join(' ')}`);
  console.log(`Backend reactor cwd: ${backendRepository}`);
  const result=spawnSync(invocation.command,invocation.args,{
    cwd:backendRepository,
    env:{
      ...process.env,
      JAVA_TOOL_OPTIONS:'-Duser.timezone=Asia/Kolkata'
    },
    stdio:'inherit',
    shell:false
  });
  if(result.error)throw result.error;
  if(result.status!==0)throw new Error(
    `Current backend reactor install failed with exit code ${result.status}.`
  );
  console.log('Backend current-source full reactor install: PASS');
}

const prebuilt=
  process.env.PAYROLL_BACKEND_PREBUILT?.trim().toLowerCase()==='true';

if(!prebuilt)runCurrentReactorInstall();
else console.log('Backend reactor prebuilt by deterministic outer runner: PASS');

inspectRuntimeJar(
  'organisation',
  'com/acme/hrms/payroll/organisation/EmployerBankAccountController.class',
  'organisation FBA controller'
);
inspectRuntimeJar(
  'payroll-operations',
  'com/acme/hrms/payroll/payrolloperations/FoundationReadinessController.class',
  'payroll-operations FSR controller'
);

const args=[
  '-f',
  backendPom,
  '-Dspring-boot.run.jvmArguments=-Duser.timezone=Asia/Kolkata',
  'spring-boot:run'
];

const activeBankKey=
  process.env.PAYROLL_BANK_ACTIVE_KEY_VERSION?.trim()||'isolated-e2e-v1';
const encryptionKeys=
  process.env.PAYROLL_BANK_ENCRYPTION_KEYS?.trim()||
  `${activeBankKey}=${syntheticKey('bank-encryption-v1')}`;
const fingerprintKey=
  process.env.PAYROLL_BANK_FINGERPRINT_KEY?.trim()||
  syntheticKey('bank-fingerprint-v1');

const runtime=mavenCommand(args);
const child=spawn(runtime.command,runtime.args,{
  cwd:backendRepository,
  env:{
    ...process.env,
    JAVA_TOOL_OPTIONS:'-Duser.timezone=Asia/Kolkata',
    DB_URL:'jdbc:postgresql://127.0.0.1:25432/payroll',
    DB_USER:'payroll_app',
    DB_PASSWORD:values.PAYROLL_APP_PASSWORD,
    OIDC_ISSUER:'http://localhost:8081/realms/payroll',
    PAYROLL_BANK_ACTIVE_KEY_VERSION:activeBankKey,
    PAYROLL_BANK_ENCRYPTION_KEYS:encryptionKeys,
    PAYROLL_BANK_FINGERPRINT_KEY:fingerprintKey
  },
  stdio:'inherit',
  shell:false
});

function stop(signal){
  if(!child.killed)child.kill(signal);
}

process.on('SIGINT',()=>stop('SIGINT'));
process.on('SIGTERM',()=>stop('SIGTERM'));
child.on('exit',code=>process.exit(code??1));
child.on('error',error=>{
  console.error(error.message);
  process.exit(1);
});
