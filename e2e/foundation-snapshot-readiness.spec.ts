import {expect,test} from '@playwright/test';
import {expectNoStoredTokens} from './support/auth';
import {guardApi,waitForApi} from './support/network';

const payGroupVersionId='45100000-0000-0000-0000-000000000001';
const augustPayPeriodId='44100000-0000-0000-0000-000000000002';

test('sealed August cycle exposes bounded composed foundation readiness',async({page})=>{
  const network=guardApi(page);

  await page.goto('/payroll-execution');
  await page.getByLabel('Pay-group version ID').fill(payGroupVersionId);
  await page.getByLabel('Pay-period ID').fill(augustPayPeriodId);

  const created=await waitForApi(
    page,
    'POST',
    '/api/v1/payroll-cycles',
    ()=>page.getByRole('button',{name:'Create payroll cycle'}).click()
  );
  expect(created.status()).toBe(201);
  const cycle=await created.json() as {id:string;versionNo:number};

  expect((await waitForApi(
    page,
    'POST',
    `/api/v1/payroll-cycles/${cycle.id}/population-resolution`,
    ()=>page.getByRole('button',{name:'Resolve population'}).click()
  )).status()).toBe(200);

  const sealed=await waitForApi(
    page,
    'POST',
    `/api/v1/payroll-cycles/${cycle.id}/seal-inputs`,
    ()=>page.getByRole('button',{name:'Seal immutable inputs'}).click()
  );
  expect(sealed.status()).toBe(200);

  await page.goto('/foundation-readiness');
  await expect(page.getByRole('heading',{name:'Foundation readiness'})).toBeVisible();
  await page.getByLabel('Foundation payroll cycle').selectOption(cycle.id);

  const response=await waitForApi(
    page,
    'POST',
    `/api/v1/payroll-cycles/${cycle.id}/foundation-readiness`,
    ()=>page.getByRole('button',{name:'Evaluate foundation readiness'}).click()
  );
  expect(response.status()).toBe(200);
  const result=await response.json() as {
    readinessScope:string;
    foundationReady:boolean;
    readinessStatus:string;
    foundationConfigurationSnapshotId:string|null;
    foundationConfigurationSnapshotHash:string|null;
    foundationConfigurationCount:number|null;
    dimensions:Array<{code:string;coverage:string;ready:boolean}>;
    registrationChecks:Array<unknown>;
    excludedCapabilities:string[];
  };

  expect(result).toMatchObject({
    readinessScope:'FOUNDATION_ONLY',
    foundationReady:true,
    readinessStatus:'READY'
  });
  expect(result.foundationConfigurationSnapshotId).toBeTruthy();
  expect(result.foundationConfigurationSnapshotHash).toMatch(/^[0-9a-f]{64}$/);
  expect(result.foundationConfigurationCount).toBeGreaterThanOrEqual(6);
  expect(result.registrationChecks).toEqual([]);
  expect(result.dimensions).toEqual(expect.arrayContaining([
    expect.objectContaining({
      code:'CONFIGURATION_SNAPSHOT',
      coverage:'EXACT_CYCLE_SNAPSHOT_ONLY',
      ready:true
    }),
    expect.objectContaining({
      code:'BANK_ACCOUNT',
      coverage:'BANKING_AND_SIGNATORY_ONLY',
      ready:true
    }),
    expect.objectContaining({
      code:'SIGNATORY_AUTHORITY',
      coverage:'BANKING_AND_SIGNATORY_ONLY',
      ready:true
    }),
    expect.objectContaining({
      code:'JURISDICTION_REGISTRATION',
      coverage:'CALLER_DECLARED_REQUIREMENTS_ONLY',
      ready:true
    })
  ]));
  expect(result.excludedCapabilities).toEqual(expect.arrayContaining([
    'COUNTRY_SPECIFIC_STATUTORY_RULES_RATES',
    'PAYMENT_EXECUTION_BANK_INTEGRATION'
  ]));

  const readinessCard=page.getByRole('heading',{name:'Foundation ready'}).locator('..');
  await expect(readinessCard).toBeVisible();
  await expect(readinessCard).toContainText('EXACT_CYCLE_SNAPSHOT_ONLY');
  await expect(readinessCard).toContainText('BANKING_AND_SIGNATORY_ONLY');
  await expect(readinessCard).toContainText('CALLER_DECLARED_REQUIREMENTS_ONLY');
  await expect(readinessCard).toContainText('COUNTRY_SPECIFIC_STATUTORY_RULES_RATES');

  await expectNoStoredTokens(page);
  network.assertClean();
});
