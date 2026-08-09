import {spawn} from 'node:child_process';
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

const args=[
  '-f',
  backendPom,
  '-Dspring-boot.run.jvmArguments=-Duser.timezone=Asia/Kolkata',
  'spring-boot:run'
];

const child=spawn(wrapper,args,{
  cwd:backendRepository,
  env:{
    ...process.env,
    JAVA_TOOL_OPTIONS:'-Duser.timezone=Asia/Kolkata',
    DB_URL:'jdbc:postgresql://127.0.0.1:25432/payroll',
    DB_USER:'payroll_app',
    DB_PASSWORD:values.PAYROLL_APP_PASSWORD,
    OIDC_ISSUER:'http://localhost:8081/realms/payroll'
  },
  stdio:'inherit',
  shell:process.platform==='win32'
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
