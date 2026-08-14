import fs from 'node:fs';
import path from 'node:path';
import {expect,test as setup} from '@playwright/test';
import {e2ePassword,login} from './support/auth';

const authDirectory=path.join(import.meta.dirname,'.auth');
const verifierState=path.join(authDirectory,'fba-verifier.json');
const approverState=path.join(authDirectory,'fba-approver.json');
const tenantId='00000000-0000-0000-0000-000000000001';
const legalEntityId='41000000-0000-0000-0000-000000000001';
const actorPassword=process.env.E2E_FBA_ACTOR_PASSWORD||'change-me';

type ActorDefinition={
  username:string;
  lastName:string;
  realmRoles:string[];
  permissions:string[];
  state:string;
};

type TokenClaims={
  iss?:string;
  sub?:string;
  preferred_username?:string;
  tenant_id?:string;
  permissions?:string|string[];
};

type AuthoritySeed={
  actorId:string;
  approvalRole:'VERIFIER'|'FINAL_APPROVER';
  domainCode:'EMPLOYER_BANK_ACCOUNT'|'AUTHORISED_SIGNATORY';
  actionCode:'VERIFY'|'REQUEST_APPROVAL'|'APPROVE';
};

const actors:ActorDefinition[]=[
  {
    username:'payroll.fba.verifier',
    lastName:'FBA Verifier',
    realmRoles:['PAYROLL_REVIEWER'],
    permissions:[
      'organisation.read',
      'organisation.bank-account.read',
      'organisation.bank-account.verify',
      'organisation.banking-readiness.read',
      'organisation.signatory.read',
      'organisation.signatory.verify'
    ],
    state:verifierState
  },
  {
    username:'payroll.fba.approver',
    lastName:'FBA Approver',
    realmRoles:['PAYROLL_REVIEWER'],
    permissions:[
      'organisation.read',
      'organisation.bank-account.approve',
      'organisation.bank-account.read',
      'organisation.bank-account.reveal',
      'organisation.banking-readiness.read',
      'organisation.signatory.approve',
      'organisation.signatory.read'
    ],
    state:approverState
  }
];

function backendEnvironment(){
  const backend=process.env.PAYROLL_BACKEND_REPOSITORY_PATH?.trim();
  if(!backend)throw new Error(
    'PAYROLL_BACKEND_REPOSITORY_PATH is required for FBA actor provisioning.'
  );
  const file=path.join(backend,'deploy','local','.env');
  if(!fs.existsSync(file))throw new Error(
    `Backend E2E environment does not exist: ${file}`
  );
  const values:Record<string,string>={};
  for(const raw of fs.readFileSync(file,'utf8').split(/\r?\n/)){
    const line=raw.trim();
    if(!line||line.startsWith('#'))continue;
    const separator=line.indexOf('=');
    if(separator<1)continue;
    values[line.slice(0,separator).trim()]=line.slice(separator+1);
  }
  return values;
}

async function tokenRequest(
  realm:string,
  clientId:string,
  username:string,
  password:string
){
  const body=new URLSearchParams({
    client_id:clientId,
    grant_type:'password',
    username,
    password
  });
  const response=await fetch(
    `http://localhost:8081/realms/${realm}/protocol/openid-connect/token`,
    {
      method:'POST',
      headers:{'content-type':'application/x-www-form-urlencoded'},
      body:body.toString()
    }
  );
  if(!response.ok)throw new Error(
    `Token request failed for ${username} in ${realm}: HTTP ${response.status} ${await response.text()}`
  );
  const token=await response.json() as {access_token?:string};
  if(!token.access_token)throw new Error(`Access token is missing for ${username}.`);
  return token.access_token;
}

async function masterToken(values:Record<string,string>){
  return tokenRequest(
    'master',
    'admin-cli',
    values.KEYCLOAK_ADMIN||'admin',
    values.KEYCLOAK_ADMIN_PASSWORD||'admin'
  );
}

function userRepresentation(actor:ActorDefinition){
  return {
    username:actor.username,
    enabled:true,
    firstName:'Payroll',
    lastName:actor.lastName,
    email:`${actor.username}@example.invalid`,
    emailVerified:true,
    requiredActions:[],
    credentials:[{
      type:'password',
      value:actorPassword,
      temporary:false
    }],
    realmRoles:actor.realmRoles,
    attributes:{
      tenant_id:[tenantId],
      permissions:actor.permissions
    }
  };
}

async function importActors(accessToken:string){
  const response=await fetch(
    'http://localhost:8081/admin/realms/payroll/partialImport',
    {
      method:'POST',
      headers:{
        Authorization:`Bearer ${accessToken}`,
        'content-type':'application/json'
      },
      body:JSON.stringify({
        ifResourceExists:'OVERWRITE',
        users:actors.map(userRepresentation)
      })
    }
  );
  if(!response.ok)throw new Error(
    `Keycloak partial user import failed: HTTP ${response.status} ${await response.text()}`
  );
}

function decodeClaims(accessToken:string):TokenClaims{
  const parts=accessToken.split('.');
  if(parts.length!==3)throw new Error('Synthetic actor access token is not a JWT.');
  return JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8')) as TokenClaims;
}

function canonicalActor(claims:TokenClaims,username:string){
  if(!claims.iss||!claims.sub)throw new Error(
    `Synthetic actor ${username} token is missing issuer/subject claims.`
  );
  return `${claims.iss}|${claims.sub}`;
}

async function verifyRealToken(actor:ActorDefinition){
  const accessToken=await tokenRequest('payroll','payroll-web',actor.username,actorPassword);
  const claims=decodeClaims(accessToken);
  if(claims.preferred_username!==actor.username)throw new Error(
    `Unexpected subject username for ${actor.username}.`
  );
  if(claims.tenant_id!==tenantId)throw new Error(
    `Synthetic actor ${actor.username} token tenant_id mismatch: ${claims.tenant_id??'<missing>'}`
  );
  const permissions=Array.isArray(claims.permissions)
    ?claims.permissions
    :typeof claims.permissions==='string'
      ?claims.permissions.split(/[ ,]+/).filter(Boolean)
      :[];
  for(const permission of actor.permissions){
    if(!permissions.includes(permission))throw new Error(
      `Synthetic actor ${actor.username} token missing permission ${permission}.`
    );
  }
  return canonicalActor(claims,actor.username);
}

function authoritySeeds(verifierActorId:string,approverActorId:string):AuthoritySeed[]{
  return [
    {actorId:verifierActorId,approvalRole:'VERIFIER',domainCode:'EMPLOYER_BANK_ACCOUNT',actionCode:'VERIFY'},
    {actorId:verifierActorId,approvalRole:'VERIFIER',domainCode:'EMPLOYER_BANK_ACCOUNT',actionCode:'REQUEST_APPROVAL'},
    {actorId:verifierActorId,approvalRole:'VERIFIER',domainCode:'AUTHORISED_SIGNATORY',actionCode:'VERIFY'},
    {actorId:verifierActorId,approvalRole:'VERIFIER',domainCode:'AUTHORISED_SIGNATORY',actionCode:'REQUEST_APPROVAL'},
    {actorId:approverActorId,approvalRole:'FINAL_APPROVER',domainCode:'EMPLOYER_BANK_ACCOUNT',actionCode:'APPROVE'},
    {actorId:approverActorId,approvalRole:'FINAL_APPROVER',domainCode:'AUTHORISED_SIGNATORY',actionCode:'APPROVE'}
  ];
}

async function seedApplicationAuthorities(
  verifierActorId:string,
  approverActorId:string
){
  const adminToken=await tokenRequest(
    'payroll',
    'payroll-web',
    'payroll.admin',
    e2ePassword('E2E_PAYROLL_ADMIN_PASSWORD')
  );

  for(const seed of authoritySeeds(verifierActorId,approverActorId)){
    const response=await fetch(
      'http://localhost:8080/api/v1/foundation-approval-authorities',
      {
        method:'POST',
        headers:{
          Authorization:`Bearer ${adminToken}`,
          'content-type':'application/json',
          'Idempotency-Key':crypto.randomUUID(),
          'X-Correlation-ID':crypto.randomUUID()
        },
        body:JSON.stringify({
          ownerKind:'LEGAL_ENTITY',
          ownerId:legalEntityId,
          approvalRole:seed.approvalRole,
          domainCode:seed.domainCode,
          actionCode:seed.actionCode,
          actorId:seed.actorId,
          effectiveFrom:'2026-01-01',
          effectiveTo:null
        })
      }
    );
    if(response.status!==201)throw new Error(
      `Approval authority seed failed for ${seed.domainCode}/${seed.actionCode}/${seed.approvalRole}: HTTP ${response.status} ${await response.text()}`
    );
  }
}

setup('provision distinct FBA verifier and approver identities',async({browser})=>{
  fs.mkdirSync(authDirectory,{recursive:true});
  const values=backendEnvironment();
  const token=await masterToken(values);
  await importActors(token);

  const actorIds=new Map<string,string>();
  for(const actor of actors){
    actorIds.set(actor.username,await verifyRealToken(actor));
  }

  const verifierActorId=actorIds.get('payroll.fba.verifier');
  const approverActorId=actorIds.get('payroll.fba.approver');
  if(!verifierActorId||!approverActorId)throw new Error(
    'Canonical FBA actor identities were not resolved.'
  );
  await seedApplicationAuthorities(verifierActorId,approverActorId);

  for(const actor of actors){
    const context=await browser.newContext();
    const page=await context.newPage();
    await login(page,actor.username,actorPassword);
    await expect(page.getByText(actor.username,{exact:true})).toBeVisible();
    await context.storageState({path:actor.state});
    await context.close();
  }
});
