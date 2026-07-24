import {expect,test} from '@playwright/test';
import {expectNoStoredTokens} from './support/auth';
import {guardApi} from './support/network';

test('read-only user can inspect evidence but cannot mutate',async({page})=>{
  const network=guardApi(page);

  await page.goto('/payroll-execution');
  await expect(page.getByText('payroll.smoke',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:/E2E-2026-07/}).click();

  const activePopulation=page.getByRole('heading',{
    name:'Active population'
  }).locator('..').locator('..');
  await expect(
    activePopulation.getByRole('cell',{
      name:'E2E-EMP-001',
      exact:true
    })
  ).toBeVisible();
  await expect(
    page.getByRole('heading',{name:'Persisted payroll results'})
  ).toBeVisible();

  await expect(
    page.getByRole('button',{name:'Create payroll cycle'})
  ).toHaveCount(0);
  await expect(
    page.getByRole('button',{name:'Resolve population'})
  ).toHaveCount(0);
  await expect(
    page.getByRole('button',{name:'Seal immutable inputs'})
  ).toHaveCount(0);
  await expect(
    page.getByRole('button',{name:'Calculate payroll'})
  ).toHaveCount(0);
  await expect(
    page.getByRole('button',{name:'Recalculate payroll'})
  ).toHaveCount(0);

  network.allowNext(
    403,
    'POST',
    '/population-resolution'
  );
  const status=await page.evaluate(async()=>{
    const token=window.payrollSession?.accessToken;
    if(!token)return 0;
    const cycles=await fetch('/api/v1/payroll-cycles',{
      headers:{Authorization:`Bearer ${token}`}
    }).then(response=>response.json()) as Array<{
      id:string;
      periodCode:string;
      versionNo:number;
    }>;
    const selected=cycles.find(cycle=>cycle.periodCode==='E2E-2026-07');
    if(!selected)return 0;
    const response=await fetch(
      `/api/v1/payroll-cycles/${selected.id}/population-resolution`,
      {
        method:'POST',
        headers:{
          Authorization:`Bearer ${token}`,
          'If-Match':String(selected.versionNo),
          'Idempotency-Key':crypto.randomUUID(),
          'X-Correlation-ID':crypto.randomUUID()
        }
      }
    );
    return response.status;
  });
  expect(status).toBe(403);

  await page.reload();
  await expect(page.getByText('payroll.smoke',{exact:true})).toBeVisible();
  await expectNoStoredTokens(page);

  network.assertClean();
});
