import {expect,test} from '@playwright/test';
import {expectNoStoredTokens} from './support/auth';
import {guardApi,waitForApi} from './support/network';

const payGroupVersionId='45100000-0000-0000-0000-000000000001';
const payPeriodId='44100000-0000-0000-0000-000000000001';

test('administrator completes controlled payroll and stale conflict',async({
  page,
  context
})=>{
  const network=guardApi(page);

  await page.goto('/payroll-execution');
  await expect(
    page.getByRole('heading',{name:'Payroll execution'})
  ).toBeVisible();

  await page.getByLabel('Pay-group version ID').fill(payGroupVersionId);
  await page.getByLabel('Pay-period ID').fill(payPeriodId);

  const created=await waitForApi(
    page,
    'POST',
    '/api/v1/payroll-cycles',
    ()=>page.getByRole('button',{name:'Create payroll cycle'}).click()
  );
  expect(created.status()).toBe(201);
  const cycle=await created.json() as {id:string;versionNo:number};
  expect(cycle.versionNo).toBe(0);

  const cycleSummary=page.getByRole('heading',{
    name:'Synthetic Monthly India · E2E-2026-07'
  }).locator('..');
  await expect(cycleSummary).toBeVisible();
  await expect(
    cycleSummary.getByText('DRAFT',{exact:true})
  ).toBeVisible();

  const populationResponse=await waitForApi(
    page,
    'POST',
    `/api/v1/payroll-cycles/${cycle.id}/population-resolution`,
    ()=>page.getByRole('button',{name:'Resolve population'}).click()
  );
  expect(populationResponse.status()).toBe(200);
  expect(await populationResponse.json()).toMatchObject({
    includedCount:1,
    excludedCount:1,
    cycleVersionNo:1
  });
  await expect(page.getByText('E2E-EMP-001',{exact:true})).toBeVisible();
  await expect(page.getByText('E2E-EMP-ON-HOLD',{exact:true})).toHaveCount(0);

  const sealResponse=await waitForApi(
    page,
    'POST',
    `/api/v1/payroll-cycles/${cycle.id}/seal-inputs`,
    ()=>page.getByRole('button',{name:'Seal immutable inputs'}).click()
  );
  expect(sealResponse.status()).toBe(200);
  expect(await sealResponse.json()).toMatchObject({
    snapshotCount:1,
    cycleVersionNo:2
  });
  await expect(
    cycleSummary.getByText('INPUTS SEALED',{exact:true})
  ).toBeVisible();

  const calculationResponse=await waitForApi(
    page,
    'POST',
    `/api/v1/payroll-cycles/${cycle.id}/calculation`,
    ()=>page.getByRole('button',{name:'Calculate payroll'}).click()
  );
  expect(calculationResponse.status()).toBe(200);
  expect(await calculationResponse.json()).toMatchObject({
    resultCount:1,
    grossTotal:90000,
    deductionTotal:0,
    netTotal:90000,
    cycleVersionNo:3
  });
  await expect(
    cycleSummary.getByText('CALCULATED',{exact:true})
  ).toBeVisible();

  const resultTable=page.getByRole('heading',{
    name:'Persisted payroll results'
  }).locator('..').locator('..');
  await expect(resultTable.getByText('E2E-EMP-001')).toBeVisible();
  await expect(resultTable.getByText('₹90,000.00')).toHaveCount(2);
  await resultTable.getByRole('link',{name:'View'}).first().click();

  const payslip=page.getByRole('article');
  await expect(
    payslip.getByText('DRAFT · NOT FOR PAYMENT · NOT A LEGAL PAYSLIP')
  ).toBeVisible();
  await expect(
    payslip.getByRole('cell',{name:'E2E_BASIC',exact:true})
  ).toBeVisible();
  await expect(
    payslip.getByText('Gross earnings').locator('..')
  ).toContainText('₹90,000.00');
  await expect(
    payslip.getByText('Total deductions').locator('..')
  ).toContainText('₹0.00');
  await expect(
    payslip.getByText('Net pay').locator('..')
  ).toContainText('₹90,000.00');

  await page.getByRole('link',{name:'Back to payroll execution'}).click();
  await page.getByRole('button',{name:/E2E-2026-07/}).click();

  const stalePage=await context.newPage();
  const staleNetwork=guardApi(stalePage);
  await stalePage.goto('/payroll-execution');
  await stalePage.getByRole('button',{name:/E2E-2026-07/}).click();
  await expect(
    stalePage.getByLabel('Controlled recalculation reason')
  ).toBeVisible();

  await page.getByLabel('Controlled recalculation reason').fill(
    'Approved deterministic recalculation for E2E evidence'
  );
  const recalculationResponse=await waitForApi(
    page,
    'POST',
    `/api/v1/payroll-cycles/${cycle.id}/recalculation`,
    ()=>page.getByRole('button',{name:'Recalculate payroll'}).click()
  );
  expect(recalculationResponse.status()).toBe(200);
  expect(await recalculationResponse.json()).toMatchObject({
    attemptNo:2,
    resultCount:1,
    grossTotal:90000,
    deductionTotal:0,
    netTotal:90000,
    cycleVersionNo:4
  });

  await stalePage.getByLabel('Controlled recalculation reason').fill(
    'Stale browser must be rejected by optimistic concurrency'
  );
  staleNetwork.allowNext(
    409,
    'POST',
    `/api/v1/payroll-cycles/${cycle.id}/recalculation`
  );
  const staleResponse=await waitForApi(
    stalePage,
    'POST',
    `/api/v1/payroll-cycles/${cycle.id}/recalculation`,
    ()=>stalePage.getByRole('button',{name:'Recalculate payroll'}).click()
  );
  expect(staleResponse.status()).toBe(409);
  await expect(stalePage.getByRole('alert')).toBeVisible();
  await expect(
    stalePage.getByText('Payroll recalculation completed')
  ).toHaveCount(0);
  staleNetwork.assertClean();
  await stalePage.close();

  await page.reload();
  await expect(page.getByText('payroll.admin',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:/E2E-2026-07/}).click();

  const attempts=page.getByRole('heading',{
    name:'Calculation attempts'
  }).locator('..').locator('..');
  await expect(attempts.locator('tbody tr')).toHaveCount(2);
  await expect(attempts.locator('tbody tr').first()).toContainText('2');
  await expect(attempts.locator('tbody tr').first()).toContainText(
    'RECALCULATION'
  );

  await expectNoStoredTokens(page);
  network.assertClean();
});
