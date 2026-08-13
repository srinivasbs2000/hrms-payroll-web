import {expect,test} from '@playwright/test';
import {e2ePassword,expectNoStoredTokens} from './support/auth';
import {guardApi,waitForApi} from './support/network';

function suffix(){
  return Date.now().toString().slice(-8);
}

function isoDate(offsetDays:number){
  const date=new Date();
  date.setUTCDate(date.getUTCDate()+offsetDays);
  return date.toISOString().slice(0,10);
}

function actorFromToken(token:string){
  const segment=token.split('.')[1];
  if(!segment)throw new Error('JWT payload is missing');
  const base64=segment.replaceAll('-','+').replaceAll('_','/');
  const payload=JSON.parse(atob(base64.padEnd(Math.ceil(base64.length/4)*4,'='))) as {
    iss?:unknown;sub?:unknown
  };
  if(typeof payload.iss!=='string'||typeof payload.sub!=='string'){
    throw new Error('JWT issuer/subject claims are missing');
  }
  return `${payload.iss}|${payload.sub}`;
}

test('approval authority uses stable organisation identity and supports bounded delegation',async({page,request})=>{
  const network=guardApi(page);
  const domainCode=`E2E_UI_${suffix()}`;

  await page.goto('/foundation-approval-authority');
  await expect(page.getByRole('heading',{name:'Approval authority & delegation'})).toBeVisible();

  const ownerSelect=page.getByLabel('Approval authority business owner');
  await expect(ownerSelect).toBeVisible();
  await expect(ownerSelect.locator('option')).not.toHaveCount(0);
  const ownerId=await ownerSelect.inputValue();
  expect(ownerId).not.toBe('');

  await page.getByLabel('Approval role').selectOption('FINAL_APPROVER');
  await page.getByLabel('Domain code').fill(domainCode);
  await page.getByLabel('Action code').fill('APPROVE');
  const adminToken=await page.evaluate(()=>window.payrollSession?.accessToken??'');
  const adminActorId=actorFromToken(adminToken);
  await expect(page.getByLabel('Actor ID',{exact:true})).toHaveValue(adminActorId);

  const authorityResponse=await waitForApi(
    page,
    'POST',
    '/api/v1/foundation-approval-authorities',
    ()=>page.getByRole('button',{name:'Create authority'}).click()
  );
  expect(authorityResponse.status()).toBe(201);
  const authority=await authorityResponse.json() as {
    id:string;ownerId:string;actorId:string;domainCode:string;status:string
  };
  expect(authority).toMatchObject({
    ownerId,
    actorId:adminActorId,
    domainCode,
    status:'ACTIVE'
  });

  const authorityRow=page.getByRole('row').filter({hasText:domainCode});
  await expect(authorityRow).toContainText(adminActorId);

  await page.getByLabel('Source authority').selectOption(authority.id);
  const smokeTokenResponse=await request.post(
    'http://localhost:8081/realms/payroll/protocol/openid-connect/token',
    {form:{
      client_id:'payroll-web',
      grant_type:'password',
      username:'payroll.smoke',
      password:e2ePassword('PAYROLL_E2E_SMOKE_PASSWORD')
    }}
  );
  expect(smokeTokenResponse.status()).toBe(200);
  const smokeTokenBody=await smokeTokenResponse.json() as {access_token?:unknown};
  expect(typeof smokeTokenBody.access_token).toBe('string');
  const smokeActorId=actorFromToken(smokeTokenBody.access_token as string);
  await page.getByLabel('Delegate actor ID').fill(smokeActorId);
  await page.getByLabel('Effective from').last().fill(isoDate(0));
  await page.getByLabel('Effective to').last().fill(isoDate(1));

  const delegationResponse=await waitForApi(
    page,
    'POST',
    '/api/v1/foundation-approval-delegations',
    ()=>page.getByRole('button',{name:'Create delegation'}).click()
  );
  expect(delegationResponse.status()).toBe(201);
  const delegation=await delegationResponse.json() as {id:string;delegateActorId:string;status:string};
  expect(delegation).toMatchObject({delegateActorId:smokeActorId,status:'ACTIVE'});

  const delegationRow=page.getByRole('row').filter({hasText:smokeActorId});
  await expect(delegationRow).toContainText('ACTIVE');
  await delegationRow.getByRole('button',{name:'Revoke'}).click();
  await delegationRow.getByLabel('Revoke reason').fill('P5-E2E-UI-01 browser cleanup');
  const revokeResponse=await waitForApi(
    page,
    'POST',
    `/api/v1/foundation-approval-delegations/${delegation.id}/revocation`,
    ()=>delegationRow.getByRole('button',{name:'Revoke'}).click()
  );
  expect(revokeResponse.status()).toBe(200);

  const refreshedAuthorityRow=page.getByRole('row').filter({hasText:domainCode});
  await refreshedAuthorityRow.getByRole('button',{name:'Retire'}).click();
  await refreshedAuthorityRow.getByLabel('Retire reason').fill('P5-E2E-UI-01 browser cleanup');
  const retireResponse=await waitForApi(
    page,
    'POST',
    `/api/v1/foundation-approval-authorities/${authority.id}/retirement`,
    ()=>refreshedAuthorityRow.getByRole('button',{name:'Retire'}).click()
  );
  expect(retireResponse.status()).toBe(200);

  await expectNoStoredTokens(page);
  network.assertClean();
});

test('weekly calendar exposes authoritative readiness blockers and prevents premature publication',async({page})=>{
  const network=guardApi(page);
  const code=`E2E_WK_${suffix()}`;

  await page.goto('/payroll-calendars');
  await expect(page.getByRole('heading',{name:'Payroll calendars'})).toBeVisible();

  await page.getByLabel('Calendar code').fill(code);
  await page.getByLabel('Calendar name').fill('P5 E2E weekly calendar');
  await page.getByLabel('Frequency').selectOption('WEEKLY');

  const createResponse=await waitForApi(
    page,
    'POST',
    '/api/v1/payroll-calendars',
    ()=>page.getByRole('button',{name:'Create calendar'}).click()
  );
  expect(createResponse.status()).toBe(201);

  await expect(page.getByRole('heading',{name:`${code} operational status`})).toBeVisible();
  await expect(page.getByText('Frequency: WEEKLY')).toBeVisible();
  await expect(page.getByText('Milestone rules: 0/5')).toBeVisible();
  await expect(page.getByText(/Exactly five milestone rules are required/)).toBeVisible();
  await expect(page.getByText(/Calendar lifecycle is DRAFT/)).toBeVisible();
  await expect(page.getByRole('button',{name:'Publish calendar'})).toBeDisabled();
  await expect(page.getByText(/does not invent edit controls/)).toBeVisible();

  await expectNoStoredTokens(page);
  network.assertClean();
});
