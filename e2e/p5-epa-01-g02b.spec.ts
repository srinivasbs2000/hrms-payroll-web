import {expect,test} from '@playwright/test';
import {expectNoStoredTokens} from './support/auth';
import {guardApi,waitForApi} from './support/network';

let sequence=0;
function token(){sequence+=1;return `${Date.now().toString().slice(-7)}${String(sequence).padStart(2,'0')}`}

test.describe('P5-EPA-01 G02B employee payroll binding UI',()=>{
  test('admin assesses a compensation change and inspects affected periods on the real backend',async({page})=>{
    const network=guardApi(page);
    await page.goto('/employee-payroll');
    await expect(page.getByRole('heading',{name:'Employee payroll',exact:true})).toBeVisible();

    const employee=page.getByRole('button',{name:/E2E-EMP-001/}).first();
    await expect(employee).toBeVisible();
    const assignmentsResponse=await waitForApi(
      page,'GET','/api/v1/payroll-assignments?payrollRelationshipId=',()=>employee.click());
    expect(assignmentsResponse.status()).toBe(200);
    const assignmentRows=await assignmentsResponse.json() as Array<{assignmentNumber?:string}>;
    expect(assignmentRows.some(item=>item.assignmentNumber==='E2E-ASN-001')).toBe(true);

    const assignmentSection=page.locator('section.card').filter({
      has:page.getByRole('heading',{name:'Payroll assignments',exact:true})
    });
    await expect(assignmentSection).toBeVisible();
    const assignmentButton=assignmentSection.getByRole('button',{name:/E2E-ASN-001/});
    await expect(assignmentButton).toBeVisible();
    await assignmentButton.click();

    await expect(page.getByRole('heading',{name:'Assignment, compensation & lifecycle evidence'})).toBeVisible();
    const reason=`P5-EPA G02B impact evidence ${token()}`;
    const createForm=page.getByRole('form',{name:'Create compensation change'});
    await createForm.getByLabel('Compensation event type').selectOption('CURRENT_PERIOD');
    await createForm.getByLabel('Compensation effective date').fill('2026-07-01');
    await createForm.getByLabel('Compensation change reason').fill(reason);
    const created=await waitForApi(page,'POST','/api/v1/compensation-changes',
      ()=>createForm.getByRole('button',{name:'Create compensation change draft'}).click());
    expect(created.status()).toBe(201);
    const change=await created.json() as {id:string;approvalStatus:string};
    expect(change.approvalStatus).toBe('DRAFT');

    const changeCard=page.locator('article.configuration-item').filter({hasText:reason});
    await expect(changeCard).toBeVisible();
    await expect(changeCard.getByRole('button',{name:'Approve'})).toHaveCount(0);
    await expect(changeCard.getByText('Impact assessment is required before approval.')).toBeVisible();
    const assessment=changeCard.getByRole('form',{name:'Assess compensation change'});
    await assessment.getByLabel('Assessment through').fill('2026-09-30');
    const assessed=await waitForApi(page,'POST',
      `/api/v1/compensation-changes/${change.id}/impact-assessment`,
      ()=>assessment.getByRole('button',{name:'Assess impact'}).click());
    expect(assessed.status()).toBe(200);
    await expect(changeCard.getByRole('button',{name:'Approve'})).toBeVisible();

    const impact=await waitForApi(page,'GET',`/api/v1/compensation-changes/${change.id}/impact`,
      ()=>changeCard.getByRole('button',{name:'View affected periods'}).click());
    expect(impact.status()).toBe(200);
    const periods=await impact.json() as unknown[];
    expect(periods.length).toBeGreaterThan(0);
    await expect(changeCard.getByRole('table',{name:'Affected pay periods'})).toBeVisible();

    const approved=await waitForApi(page,'POST',`/api/v1/compensation-changes/${change.id}/approval`,
      ()=>changeCard.getByRole('button',{name:'Approve'}).click());
    expect(approved.status()).toBe(200);

    const payGroupImpactButton=page.getByRole('button',{name:'Inspect affected periods'}).first();
    if(await payGroupImpactButton.count()){
      const response=await waitForApi(page,'GET','/api/v1/pay-group-assignments/',()=>payGroupImpactButton.click());
      expect(response.status()).toBe(200);
    }

    await expect(page.getByText(/does not calculate payroll, taxes, balances, payments or accounting entries/i)).toBeVisible();
    await expectNoStoredTokens(page);
    network.assertClean();
  });
});
