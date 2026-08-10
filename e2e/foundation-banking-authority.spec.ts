import path from 'node:path';
import {Browser,expect,test} from '@playwright/test';
import {expectNoStoredTokens} from './support/auth';
import {guardApi,waitForApi} from './support/network';

const authDirectory=path.join(import.meta.dirname,'.auth');
const accountNumber='E2E001234567890';

async function session(
  browser:Browser,
  state:string
){
  const context=await browser.newContext({
    storageState:path.join(authDirectory,state)
  });
  const page=await context.newPage();
  const network=guardApi(page);
  return {context,page,network};
}

test('distinct actors manage masked funding account, signatory authority and readiness',async({browser})=>{
  const admin=await session(browser,'admin.json');
  const verifier=await session(browser,'fba-verifier.json');
  const approver=await session(browser,'fba-approver.json');
  const smoke=await session(browser,'smoke.json');

  try{
    await admin.page.goto('/foundation-banking-authority');
    await expect(
      admin.page.getByRole('heading',{name:'Banking & authority'})
    ).toBeVisible();
    await expect(admin.page.getByLabel('Bank owner')).not.toHaveValue('');

    await admin.page.getByLabel('Bank code').fill('E2E_BANK_MAIN');
    await admin.page.getByLabel('Bank name').fill('E2E Funding Bank');
    await admin.page.getByLabel('Branch name').fill('Synthetic Branch');
    await admin.page.getByLabel('Routing code').fill('E2E0001');
    await admin.page.getByLabel('Account holder').fill('E2E Employer');
    await admin.page.getByLabel('Account number').fill(accountNumber);

    const bankCreatedResponse=await waitForApi(
      admin.page,
      'POST',
      '/api/v1/employer-bank-accounts',
      ()=>admin.page.getByRole('button',{name:'Create bank account'}).click()
    );
    expect(bankCreatedResponse.status()).toBe(201);
    const bank=await bankCreatedResponse.json() as {
      identityId:string;
      versionId:string;
      versionNo:number;
      maskedAccountNumber:string;
      lifecycleStatus:string;
    };
    expect(bank.maskedAccountNumber).toBe('****7890');
    expect(JSON.stringify(bank)).not.toContain(accountNumber);
    await expect(admin.page.getByText('****7890')).toBeVisible();

    const bankLink=`/foundation-banking-authority?bankAccountId=${bank.identityId}`;
    const submitted=await waitForApi(
      admin.page,
      'POST',
      `/api/v1/employer-bank-accounts/${bank.identityId}/versions/${bank.versionId}/submit`,
      ()=>admin.page.getByRole('button',{name:'Submit bank for verification'}).click()
    );
    expect(submitted.status()).toBe(200);
    await expect(admin.page.getByText('PENDING_VERIFICATION',{exact:true})).toBeVisible();

    await verifier.page.goto(bankLink);
    await expect(verifier.page.getByText('PENDING_VERIFICATION',{exact:true})).toBeVisible();
    await verifier.page.getByLabel('Bank verification evidence').fill('E2E:BANK:VERIFY');
    const verified=await waitForApi(
      verifier.page,
      'POST',
      '/verify',
      ()=>verifier.page.getByRole('button',{name:'Verify bank'}).click()
    );
    expect(verified.status()).toBe(200);
    await expect(verifier.page.getByText('VERIFIED',{exact:true})).toBeVisible();

    const approvalRequested=await waitForApi(
      verifier.page,
      'POST',
      '/request-approval',
      ()=>verifier.page.getByRole('button',{name:'Request bank approval'}).click()
    );
    expect(approvalRequested.status()).toBe(200);
    await expect(verifier.page.getByText('APPROVAL_PENDING',{exact:true})).toBeVisible();

    await approver.page.goto(bankLink);
    await expect(approver.page.getByText('APPROVAL_PENDING',{exact:true})).toBeVisible();
    await approver.page.getByLabel('Bank approval evidence').fill('E2E:BANK:APPROVE');
    const approved=await waitForApi(
      approver.page,
      'POST',
      '/approve',
      ()=>approver.page.getByRole('button',{name:'Approve bank'}).click()
    );
    expect(approved.status()).toBe(200);
    await expect(approver.page.getByText('ACTIVE',{exact:true})).toBeVisible();

    await approver.page.getByLabel('Reveal reason').fill('E2E privileged reveal verification');
    const revealResponse=await waitForApi(
      approver.page,
      'POST',
      '/reveal',
      ()=>approver.page.getByRole('button',{name:'Reveal account number'}).click()
    );
    expect(revealResponse.status()).toBe(200);
    expect(revealResponse.headers()['cache-control']).toContain('no-store');
    expect((await revealResponse.json() as {accountNumber:string}).accountNumber).toBe(accountNumber);
    await expect(approver.page.getByText(accountNumber,{exact:true})).toBeVisible();
    await expect(approver.page.getByText('****7890')).toBeVisible();
    await approver.page.getByRole('button',{name:'Clear revealed account number'}).click();
    await expect(approver.page.getByText(accountNumber,{exact:true})).toHaveCount(0);

    await admin.page.goto('/foundation-banking-authority');
    await expect(admin.page.getByLabel('Signatory owner')).not.toHaveValue('');
    await admin.page.getByLabel('Signatory code').fill('E2E_SIGNATORY_MAIN');
    await admin.page.getByLabel('Full name').fill('E2E Authorised Signatory');
    await admin.page.getByLabel('Designation').fill('Director');
    await admin.page.getByLabel('Authority reference').fill('E2E:BOARD:2026:001');

    const signatoryCreatedResponse=await waitForApi(
      admin.page,
      'POST',
      '/api/v1/authorised-signatories',
      ()=>admin.page.getByRole('button',{name:'Create signatory'}).click()
    );
    expect(signatoryCreatedResponse.status()).toBe(201);
    const signatory=await signatoryCreatedResponse.json() as {
      identityId:string;
      versionId:string;
      lifecycleStatus:string;
    };
    const signatoryLink=
      `/foundation-banking-authority?signatoryId=${signatory.identityId}`;

    const signatorySubmitted=await waitForApi(
      admin.page,
      'POST',
      `/api/v1/authorised-signatories/${signatory.identityId}/versions/${signatory.versionId}/submit`,
      ()=>admin.page.getByRole('button',{name:'Submit signatory for verification'}).click()
    );
    expect(signatorySubmitted.status()).toBe(200);

    await verifier.page.goto(signatoryLink);
    await expect(verifier.page.getByText('PENDING_VERIFICATION',{exact:true})).toBeVisible();
    await verifier.page.getByLabel('Signatory verification evidence').fill('E2E:SIGNATORY:VERIFY');
    expect((await waitForApi(
      verifier.page,
      'POST',
      '/verify',
      ()=>verifier.page.getByRole('button',{name:'Verify signatory'}).click()
    )).status()).toBe(200);
    expect((await waitForApi(
      verifier.page,
      'POST',
      '/request-approval',
      ()=>verifier.page.getByRole('button',{name:'Request signatory approval'}).click()
    )).status()).toBe(200);

    await approver.page.goto(signatoryLink);
    await expect(approver.page.getByText('APPROVAL_PENDING',{exact:true})).toBeVisible();
    await approver.page.getByLabel('Signatory approval evidence').fill('E2E:SIGNATORY:APPROVE');
    expect((await waitForApi(
      approver.page,
      'POST',
      '/approve',
      ()=>approver.page.getByRole('button',{name:'Approve signatory'}).click()
    )).status()).toBe(200);
    await expect(approver.page.getByText('ACTIVE',{exact:true})).toBeVisible();

    await smoke.page.goto('/foundation-banking-authority');
    await expect(smoke.page.getByText('payroll.smoke',{exact:true})).toBeVisible();
    await expect(smoke.page.getByText('E2E_BANK_MAIN · E2E Funding Bank')).toBeVisible();
    await expect(smoke.page.getByText('****7890')).toBeVisible();
    await expect(smoke.page.getByText(accountNumber,{exact:true})).toHaveCount(0);
    await expect(smoke.page.getByText('E2E_SIGNATORY_MAIN · E2E Authorised Signatory')).toBeVisible();
    await expect(smoke.page.getByRole('button',{name:'Create bank account'})).toHaveCount(0);
    await expect(smoke.page.getByRole('button',{name:'Create signatory'})).toHaveCount(0);
    await expect(smoke.page.getByRole('button',{name:'Reveal account number'})).toHaveCount(0);
    await expect(smoke.page.getByLabel('Readiness owner')).not.toHaveValue('');

    const readinessResponse=await waitForApi(
      smoke.page,
      'GET',
      '/api/v1/banking-readiness',
      ()=>smoke.page.getByRole('button',{name:'Check banking readiness'}).click()
    );
    expect(readinessResponse.status()).toBe(200);
    expect(await readinessResponse.json()).toMatchObject({
      readinessScope:'BANKING_AND_SIGNATORY_ONLY',
      bankReady:true,
      signatoryReady:true,
      ready:true
    });
    await expect(
      smoke.page.getByText('Ready for banking and signatory authority')
    ).toBeVisible();

    await expectNoStoredTokens(admin.page);
    await expectNoStoredTokens(verifier.page);
    await expectNoStoredTokens(approver.page);
    await expectNoStoredTokens(smoke.page);
    admin.network.assertClean();
    verifier.network.assertClean();
    approver.network.assertClean();
    smoke.network.assertClean();
  }finally{
    await Promise.all([
      admin.context.close(),
      verifier.context.close(),
      approver.context.close(),
      smoke.context.close()
    ]);
  }
});
