import fs from 'node:fs';
import path from 'node:path';
import {expect,test as setup} from '@playwright/test';
import {login} from './support/auth';

const authDirectory=path.join(import.meta.dirname,'.auth');
const verifierState=path.join(authDirectory,'fba-verifier.json');
const approverState=path.join(authDirectory,'fba-approver.json');
const tenantId='00000000-0000-0000-0000-000000000001';
const actorPassword=process.env.E2E_FBA_ACTOR_PASSWORD||'change-me';

type ActorDefinition={
  username:string;
  lastName:string;
  realmRoles:string[];
  permissions:string[];
  state:string;
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

async function masterToken(values:Record<string,string>){
  const body=new URLSearchParams({
    client_id:'admin-cli',
    grant_type:'password',
    username:values.KEYCLOAK_ADMIN||'admin',
    password:values.KEYCLOAK_ADMIN_PASSWORD||'admin'
  });
  const response=await fetch(
    'http://localhost:8081/realms/master/protocol/openid-connect/token',
    {
      method:'POST',
      headers:{'content-type':'application/x-www-form-urlencoded'},
      body:body.toString()
    }
  );
  if(!response.ok)throw new Error(
    `Keycloak admin token failed: HTTP ${response.status}`
  );
  const token=await response.json() as {access_token?:string};
  if(!token.access_token)throw new Error('Keycloak admin token is missing.');
  return token.access_token;
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

function decodeClaims(accessToken:string){
  const parts=accessToken.split('.');
  if(parts.length!==3)throw new Error(
    'Synthetic actor access token is not a JWT.'
  );
  return JSON.parse(
    Buffer.from(parts[1],'base64url').toString('utf8')
  ) as {
    preferred_username?:string;
    tenant_id?:string;
    permissions?:string|string[];
  };
}

async function verifyRealToken(actor:ActorDefinition){
  const body=new URLSearchParams({
    client_id:'payroll-web',
    grant_type:'password',
    scope:'openid',
    username:actor.username,
    password:actorPassword
  });
  const response=await fetch(
    'http://localhost:8081/realms/payroll/protocol/openid-connect/token',
    {
      method:'POST',
      headers:{'content-type':'application/x-www-form-urlencoded'},
      body:body.toString()
    }
  );
  if(!response.ok)throw new Error(
    `Synthetic actor token request failed for ${actor.username}: HTTP ${response.status}`
  );
  const bodyJson=await response.json() as {access_token?:string};
  if(!bodyJson.access_token)throw new Error(
    `Synthetic actor token is missing for ${actor.username}.`
  );
  const claims=decodeClaims(bodyJson.access_token);
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
}

setup('provision distinct FBA verifier and approver identities',async({browser})=>{
  fs.mkdirSync(authDirectory,{recursive:true});
  const values=backendEnvironment();
  const token=await masterToken(values);
  await importActors(token);

  for(const actor of actors){
    await verifyRealToken(actor);
  }

  for(const actor of actors){
    const context=await browser.newContext();
    const page=await context.newPage();
    await login(page,actor.username,actorPassword);
    await expect(page.getByText(actor.username,{exact:true})).toBeVisible();
    await context.storageState({path:actor.state});
    await context.close();
  }
});
