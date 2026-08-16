import {expect,test} from '@playwright/test';
import {expectNoStoredTokens} from './support/auth';
import {guardApi,waitForApi} from './support/network';

function componentTarget(page:Parameters<typeof guardApi>[0]){
  return page.getByRole('heading',{
    name:'Component control target',
    exact:true
  }).locator('..');
}

test('administrator uses governed component controls and maker-checker blocks self approval',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='p5-ccf-01-g03-admin');
  const network=guardApi(page);

  await page.goto('/component-controls');
  await expect(page.getByRole('heading',{
    name:'Component formula & controls',
    exact:true
  })).toBeVisible();

  const target=componentTarget(page);
  const firstComponent=target.getByRole('button').first();
  await expect(firstComponent).toBeVisible();
  const code=(await firstComponent.locator('strong').textContent())?.trim();
  expect(code).toBeTruthy();

  const search=target.getByLabel('Search components',{exact:true});
  await search.fill('__NO_SUCH_COMPONENT__');
  await expect(page.getByText(
    'No components match "__NO_SUCH_COMPONENT__".',
    {exact:true}
  )).toBeVisible();
  await search.fill(code!);
  await expect(firstComponent).toBeVisible();
  await firstComponent.click();

  const formulaForm=page.getByRole('form',{
    name:'Validate component formula',
    exact:true
  });
  await formulaForm.getByLabel('Formula expression',{exact:true}).fill('1+2');
  await formulaForm.getByLabel('Calculation phase',{exact:true}).selectOption('PRE_TAX');
  const formulaResponse=await waitForApi(
    page,
    'POST',
    '/api/v1/pay-components/formula-validation',
    ()=>formulaForm.getByRole('button',{
      name:'Validate formula',
      exact:true
    }).click()
  );
  expect(formulaResponse.status()).toBe(200);
  const formulaResult=page.getByLabel('Formula validation result',{exact:true});
  await expect(formulaResult).toContainText('Fingerprint:');
  await expect(formulaResult).toContainText('Dependencies: None');

  const impactResponse=page.waitForResponse(response=>
    response.request().method()==='GET'&&
    response.url().includes('/impact')
  );
  const wageResponse=page.waitForResponse(response=>
    response.request().method()==='GET'&&
    response.url().includes('/statutory-wage-references')
  );
  await page.getByRole('button',{
    name:'Inspect dependency impact & statutory references',
    exact:true
  }).click();
  const [impact,wage]=await Promise.all([impactResponse,wageResponse]);
  expect(impact.status()).toBe(200);
  expect(wage.status()).toBe(200);
  await expect(page.getByRole('heading',{
    name:'Dependency impact',
    exact:true
  })).toBeVisible();
  await expect(page.getByRole('heading',{
    name:'Exact statutory wage-rule references',
    exact:true
  })).toBeVisible();

  const componentAudit=await waitForApi(
    page,
    'GET',
    '/audit',
    ()=>page.getByRole('button',{
      name:'Load component audit',
      exact:true
    }).click()
  );
  expect(componentAudit.status()).toBe(200);
  await expect(page.getByRole('heading',{
    name:'Component audit evidence',
    exact:true
  })).toBeVisible();

  const uniqueCode=`E2E_G03_RATE_${Date.now()}`;
  const rateCreateForm=page.getByRole('form',{
    name:'Create rate table',
    exact:true
  });
  await rateCreateForm.getByLabel('Rate table code',{exact:true}).fill(uniqueCode);
  await rateCreateForm.getByLabel('Rate table name',{exact:true})
    .fill('G03 browser evidence rate');
  await rateCreateForm.getByLabel('Cell 1 GRADE',{exact:true}).fill('A');
  await rateCreateForm.getByLabel('Cell 1 rate value',{exact:true}).fill('1000.25');

  const created=await waitForApi(
    page,
    'POST',
    '/api/v1/component-rate-tables',
    ()=>rateCreateForm.getByRole('button',{
      name:'Create rate table',
      exact:true
    }).click()
  );
  expect(created.status()).toBe(201);
  const createdRate=await created.json() as {
    identityId:string;
    versionId:string;
    versionNo:number;
    code:string;
  };
  expect(createdRate.code).toBe(uniqueCode);
  await expect(page.getByText('Rate table draft created.',{exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{
    name:`${uniqueCode} lifecycle`,
    exact:true
  })).toBeVisible();

  const rateLifecycle=page.locator('[aria-label="Rate table lifecycle"]');
  await expect(rateLifecycle).toBeVisible();

  network.allowNext(
    409,
    'POST',
    `/api/v1/component-rate-tables/${createdRate.identityId}/versions/${createdRate.versionId}/approval`
  );
  const selfApproval=await waitForApi(
    page,
    'POST',
    `/api/v1/component-rate-tables/${createdRate.identityId}/versions/${createdRate.versionId}/approval`,
    ()=>rateLifecycle.getByRole('button',{
      name:'Approve rate version',
      exact:true
    }).click()
  );
  expect(selfApproval.status()).toBe(409);
  await expect(page.getByRole('alert')).toContainText(/checker|maker|approvable/i);

  const rateAudit=await waitForApi(
    page,
    'GET',
    `/api/v1/component-rate-tables/${createdRate.identityId}/audit`,
    ()=>rateLifecycle.getByRole('button',{
      name:'Load rate audit',
      exact:true
    }).click()
  );
  expect(rateAudit.status()).toBe(200);
  await expect(page.getByRole('heading',{
    name:'Rate audit evidence',
    exact:true
  })).toBeVisible();

  await expectNoStoredTokens(page);
  network.assertClean();
});

test('read-only user sees component intelligence but no mutation or audit actions',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='p5-ccf-01-g03-read-only');
  const network=guardApi(page);

  await page.goto('/component-controls');
  await expect(page.getByRole('heading',{
    name:'Component formula & controls',
    exact:true
  })).toBeVisible();

  await expect(page.getByRole('button',{
    name:'Create rate table',
    exact:true
  })).toHaveCount(0);
  await expect(page.getByRole('button',{
    name:'Create rounding policy',
    exact:true
  })).toHaveCount(0);
  await expect(page.getByRole('button',{
    name:'Create proration policy',
    exact:true
  })).toHaveCount(0);

  const target=componentTarget(page);
  const firstComponent=target.getByRole('button').first();
  await expect(firstComponent).toBeVisible();
  await firstComponent.click();

  await expect(page.getByRole('button',{
    name:'Create controlled version',
    exact:true
  })).toHaveCount(0);
  await expect(page.getByRole('button',{
    name:'Load component audit',
    exact:true
  })).toHaveCount(0);
  await expect(page.getByRole('button',{
    name:'Validate formula',
    exact:true
  })).toBeVisible();
  await expect(page.getByRole('button',{
    name:'Inspect dependency impact & statutory references',
    exact:true
  })).toBeVisible();

  await expectNoStoredTokens(page);
  network.assertClean();
});
