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
  console.log(`Backend repository contract validated: ${backendRepository}`);
  process.exit(0);
}

function mavenCommand(args){
  if(process.platform==='win32'){
    return {
      command:'cmd.exe',
      args:['/d','/c',['mvnw.cmd',...args].join(' ')]
    };
  }
  return {command:wrapper,args};
}

function runCurrentReactorInstall(){
  const invocation=mavenCommand([
    '--batch-mode',
    '-pl','backend/payroll-boot',
    '-am',
    '-DskipTests',
    '-DskipITs',
    'clean',
    'install'
  ]);
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

  const organisationTarget=path.join(
    backendRepository,
    'backend',
    'organisation',
    'target'
  );
  requireFile(organisationTarget,'Organisation target directory');
  const organisationJars=fs.readdirSync(organisationTarget)
    .filter(name=>
      /^organisation-.*\.jar$/.test(name)&&
      !name.endsWith('-sources.jar')&&
      !name.endsWith('-javadoc.jar')
    );
  if(organisationJars.length!==1)throw new Error(
    `Expected one organisation runtime JAR, found ${organisationJars.length}.`
  );
  const organisationJar=path.join(
    organisationTarget,
    organisationJars[0]
  );
  const jarList=spawnSync('jar',['tf',organisationJar],{
    cwd:backendRepository,
    encoding:'utf8',
    shell:false
  });
  if(jarList.error)throw jarList.error;
  if(jarList.status!==0)throw new Error(
    `Unable to inspect organisation runtime JAR: ${organisationJar}`
  );
  const requiredClass=
    'com/acme/hrms/payroll/organisation/EmployerBankAccountController.class';
  if(!String(jarList.stdout??'').includes(requiredClass))throw new Error(
    `Fresh organisation runtime JAR is missing ${requiredClass}`
  );

  console.log('Backend current-source reactor install: PASS');
  console.log('Fresh organisation FBA controller artifact: PASS');
}

runCurrentReactorInstall();

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
