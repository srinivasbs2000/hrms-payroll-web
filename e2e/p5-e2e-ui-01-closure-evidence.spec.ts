import {expect,test} from '@playwright/test';
import {expectNoStoredTokens} from './support/auth';
import {guardApi,waitForApi} from './support/network';

const PAY_GROUP_VERSION_V1='45100000-0000-0000-0000-000000000001';
const PSU_VERSION='42100000-0000-0000-0000-000000000001';
const CALENDAR_ID='44000000-0000-0000-0000-000000000001';
const FIXTURE_CALENDAR_CODE='E2E_MONTHLY_IN';
const FIXTURE_CALENDAR_NAME='Synthetic Monthly India';
const EMPLOYEE_NUMBER='E2E-EMP-001';
const ASSIGNMENT_NUMBER='E2E-ASN-001';
const CUTOVER='2026-09-01';
const FIXTURE_END='2027-01-01';

let tokenSequence=0;
function token(){
  tokenSequence+=1;
  return `${Date.now().toString().slice(-6)}${String(tokenSequence).padStart(2,'0')}`;
}

async function selectEmployeeAssignment(page:import('@playwright/test').Page){
  await page.goto('/employee-payroll');
  await expect(page.getByRole('heading',{name:'Employee payroll',exact:true})).toBeVisible();
  await page.getByRole('button',{name:new RegExp(EMPLOYEE_NUMBER)}).click();
  await expect(page.getByRole('heading',{name:'Payroll assignments',exact:true})).toBeVisible();
  await page.getByRole('button',{name:new RegExp(ASSIGNMENT_NUMBER)}).click();
  await expect(page.getByRole('heading',{name:'Pay-group assignments',exact:true})).toBeVisible();
}

test.describe('P5-E2E-UI-01 closure evidence',()=>{
  test('pay-group draft remains operable through version cutover and employee routing',async({page})=>{
    const network=guardApi(page);
    const code='G05_CUTOVER_IN';
    const v1Name='G05 Cutover India';
    const v2Name='G05 Cutover India September';

    await page.goto('/pay-groups');
    await expect(page.getByRole('heading',{name:'Pay groups',exact:true})).toBeVisible();
    const createGroupButton=page.getByRole('button',{name:'Create pay-group draft',exact:true});
    const createGroupForm=page.locator('form').filter({has:createGroupButton});
    await createGroupForm.getByLabel('Code').fill(code);
    await createGroupForm.getByLabel('Name').fill(v1Name);
    await createGroupForm.getByLabel('Payroll statutory unit version ID').fill(PSU_VERSION);
    await createGroupForm.getByLabel('Calendar ID').fill(CALENDAR_ID);
    await createGroupForm.getByLabel('Effective from').fill('2026-01-01');
    await createGroupForm.getByLabel('Effective to').fill(FIXTURE_END);
    const createGroupResponse=await waitForApi(
      page,'POST','/api/v1/pay-groups',
      ()=>createGroupButton.click()
    );
    expect(createGroupResponse.status()).toBe(201);
    const v1=await createGroupResponse.json() as {
      identityId:string;versionId:string;versionSequence:number;approvalStatus:string
    };
    expect(v1.versionSequence).toBe(1);
    expect(v1.approvalStatus).toBe('DRAFT');

    await expect(page.getByRole('heading',{name:`${code} version timeline`,exact:true})).toBeVisible();
    const versionV1Draft=page.getByRole('listitem').filter({hasText:`Version 1: ${v1Name}`});
    await expect(versionV1Draft).toContainText('DRAFT');
    const approveV1Response=await waitForApi(
      page,'POST',`/api/v1/pay-groups/${v1.identityId}/versions/${v1.versionId}/approval`,
      ()=>versionV1Draft.getByRole('button',{name:'Approve',exact:true}).click()
    );
    expect(approveV1Response.status()).toBe(200);
    await expect(page.getByRole('listitem').filter({hasText:`Version 1: ${v1Name}`})).toContainText('APPROVED');

    const endVersionForm=page.getByRole('form',{name:'End-date pay-group version',exact:true});
    await endVersionForm.getByLabel('End date').fill(CUTOVER);
    const endVersionResponse=await waitForApi(
      page,'POST',`/api/v1/pay-groups/${v1.identityId}/versions/${v1.versionId}/end-date`,
      ()=>endVersionForm.getByRole('button',{name:'End-date pay-group version',exact:true}).click()
    );
    expect(endVersionResponse.status()).toBe(200);
    await expect(page.getByRole('listitem').filter({hasText:`Version 1: ${v1Name}`})).toContainText(CUTOVER);

    const lifecycle=page.getByRole('form',{name:'Pay-group version lifecycle',exact:true});
    await lifecycle.getByLabel('Version name').fill(v2Name);
    await lifecycle.getByLabel('Version PSU version ID').fill(PSU_VERSION);
    await lifecycle.getByLabel('Version calendar ID').fill(CALENDAR_ID);
    await lifecycle.getByLabel('Version effective from').fill(CUTOVER);
    await lifecycle.getByLabel('Version effective to').fill(FIXTURE_END);
    const addVersionResponse=await waitForApi(
      page,'POST',`/api/v1/pay-groups/${v1.identityId}/versions`,
      ()=>lifecycle.getByRole('button',{name:'Add version',exact:true}).click()
    );
    expect(addVersionResponse.status()).toBe(201);
    const v2=await addVersionResponse.json() as {
      versionId:string;versionSequence:number;approvalStatus:string
    };
    expect(v2.versionSequence).toBe(2);
    expect(v2.approvalStatus).toBe('DRAFT');

    const versionV2Row=page.getByRole('listitem').filter({hasText:`Version 2: ${v2Name}`});
    await expect(versionV2Row).toContainText('DRAFT');
    const approveVersionResponse=await waitForApi(
      page,'POST',`/api/v1/pay-groups/${v1.identityId}/versions/${v2.versionId}/approval`,
      ()=>versionV2Row.getByRole('button',{name:'Approve',exact:true}).click()
    );
    expect(approveVersionResponse.status()).toBe(200);
    await expect(page.getByRole('listitem').filter({hasText:`Version 2: ${v2Name}`})).toContainText('APPROVED');
    const versionV1Closed=page.getByRole('listitem').filter({hasText:`Version 1: ${v1Name}`});
    await expect(versionV1Closed).toContainText('APPROVED');
    await expect(versionV1Closed).toContainText(CUTOVER);
    await expect(versionV1Closed).not.toContainText('Superseded');

    await selectEmployeeAssignment(page);
    const assignmentV1=page.locator('article.configuration-item').filter({hasText:PAY_GROUP_VERSION_V1});
    await expect(assignmentV1).toBeVisible();
    const assignmentEndForm=assignmentV1.getByRole('form',{name:'End-date pay-group assignment',exact:true});
    await assignmentEndForm.getByLabel('End-date pay-group assignment date').fill(CUTOVER);
    const assignmentEndResponse=await waitForApi(
      page,'POST','/api/v1/pay-group-assignments/49200000-0000-0000-0000-000000000001/end-date',
      ()=>assignmentEndForm.getByRole('button',{name:'End-date',exact:true}).click()
    );
    expect(assignmentEndResponse.status()).toBe(200);

    const createAssignmentButton=page.getByRole('button',{name:'Create pay-group assignment draft',exact:true});
    const createAssignment=page.locator('form').filter({has:createAssignmentButton});
    await createAssignment.getByLabel('Pay-group version ID').fill(v2.versionId);
    await createAssignment.getByLabel('Effective from').fill(CUTOVER);
    await createAssignment.getByLabel('Effective to').fill(FIXTURE_END);
    const createAssignmentResponse=await waitForApi(
      page,'POST','/api/v1/pay-group-assignments',
      ()=>createAssignmentButton.click()
    );
    expect(createAssignmentResponse.status()).toBe(201);
    const assignmentV2=await createAssignmentResponse.json() as {
      id:string;payGroupVersionId:string;approvalStatus:string
    };
    expect(assignmentV2.payGroupVersionId).toBe(v2.versionId);
    expect(assignmentV2.approvalStatus).toBe('DRAFT');

    const assignmentV2Row=page.locator('article.configuration-item').filter({hasText:v2.versionId});
    await expect(assignmentV2Row).toContainText('DRAFT');
    const approveAssignmentResponse=await waitForApi(
      page,'POST',`/api/v1/pay-group-assignments/${assignmentV2.id}/approval`,
      ()=>assignmentV2Row.getByRole('button',{name:'Approve',exact:true}).click()
    );
    expect(approveAssignmentResponse.status()).toBe(200);
    await expect(page.locator('article.configuration-item').filter({hasText:v2.versionId})).toContainText('APPROVED');

    await expectNoStoredTokens(page);
    network.assertClean();
  });

  test('all supported calendar frequencies are creatable while governed blockers prevent generation and publication',async({page})=>{
    const network=guardApi(page);
    await page.goto('/payroll-calendars');
    await expect(page.getByRole('heading',{name:'Payroll calendars',exact:true})).toBeVisible();
    const createForm=page.getByRole('form',{name:'Create payroll calendar',exact:true});
    const frequencySelect=createForm.getByRole('combobox');

    const scenarios:[string,string,boolean,number|null][]=[
      ['MONTHLY','MN',false,null],
      ['FORTNIGHTLY','FN',false,null],
      ['WEEKLY','WK',false,null],
      ['DAILY','DY',false,null],
      ['CUSTOM','CU',true,10]
    ];

    for(const [frequency,prefix,authorised,customDays] of scenarios){
      const code=`E2E_${prefix}_${token()}`;
      await createForm.getByLabel('Calendar code').fill(code);
      await createForm.getByLabel('Calendar name').fill(`P5 closure ${frequency}`);
      await frequencySelect.selectOption(frequency);
      if(frequency==='CUSTOM'){
        await createForm.getByLabel('Custom period days').fill(String(customDays));
        const checkbox=createForm.getByLabel('Custom frequency explicitly authorised');
        if((await checkbox.isChecked())!==authorised)await checkbox.click();
      }
      const create=await waitForApi(
        page,'POST','/api/v1/payroll-calendars',
        ()=>createForm.getByRole('button',{name:'Create calendar',exact:true}).click()
      );
      expect(create.status()).toBe(201);
      const created=await create.json() as {id:string};
      expect(created.id).toMatch(/^[0-9a-f-]{36}$/i);
      await expect(page.getByRole('heading',{name:`${code} operational status`,exact:true})).toBeVisible();
      await expect(page.getByText(`Frequency: ${frequency}`,{exact:true})).toBeVisible();
      await expect(page.getByText('Milestone rules: 0/5',{exact:true})).toBeVisible();
      await expect(page.getByText(/Exactly five milestone rules are required/)).toBeVisible();
      await expect(page.getByRole('button',{name:'Generate periods',exact:true})).toBeDisabled();
      await expect(page.getByRole('button',{name:'Publish calendar',exact:true})).toBeDisabled();
      await expect(page.getByRole('listitem').filter({hasText:`Version 1: P5 closure ${frequency}`})).toBeVisible();

      if(frequency==='MONTHLY'){
        await expect(page.getByLabel('Schedule start')).toBeVisible();
        await expect(page.getByLabel('Payment day')).toHaveCount(0);
      }
    }

    const unauthorisedCode=`E2E_CX_${token()}`;
    await createForm.getByLabel('Calendar code').fill(unauthorisedCode);
    await createForm.getByLabel('Calendar name').fill('P5 closure custom unauthorised');
    await frequencySelect.selectOption('CUSTOM');
    await createForm.getByLabel('Custom period days').fill('7');
    const authorised=createForm.getByLabel('Custom frequency explicitly authorised');
    if(await authorised.isChecked())await authorised.click();
    expect(await authorised.evaluate(input=>(input as HTMLInputElement).required)).toBe(true);
    expect(await createForm.evaluate(form=>(form as HTMLFormElement).checkValidity())).toBe(false);

    await expectNoStoredTokens(page);
    network.assertClean();
  });

  test('operator can inspect contiguous legacy periods and the explicit read-only milestone evidence boundary',async({page})=>{
    const network=guardApi(page);
    await page.goto('/payroll-calendars');
    await expect(page.getByRole('heading',{name:'Payroll calendars',exact:true})).toBeVisible();
    await page.getByRole('button',{name:new RegExp(FIXTURE_CALENDAR_CODE)}).first().click();
    await expect(page.getByRole('heading',{name:`${FIXTURE_CALENDAR_CODE} operational status`,exact:true})).toBeVisible();
    await expect(page.getByText('Frequency: MONTHLY',{exact:true})).toBeVisible();

    const table=page.getByRole('table',{name:`${FIXTURE_CALENDAR_NAME} periods for 2026`,exact:true});
    await expect(table).toBeVisible();
    const july=table.getByRole('row').filter({hasText:'2026-07-01'});
    const august=table.getByRole('row').filter({hasText:'2026-08-01'});
    await expect(july).toContainText('2026-07-31');
    await expect(august).toContainText('2026-08-31');
    await expect(page.getByText('Legacy compatibility calendar; publication lifecycle is not required.')).toBeVisible();
    await expect(page.getByRole('button',{name:'Publish calendar',exact:true})).toHaveCount(0);
    await expect(page.getByLabel('Payment day')).toBeVisible();
    await expect(page.getByLabel('Schedule start')).toHaveCount(0);
    const evidenceHeading=page.getByRole('heading',{name:'Milestone & working-day adjustment evidence',exact:true});
    await expect(evidenceHeading).toBeVisible();
    const evidenceCard=evidenceHeading.locator('..');
    await expect(evidenceCard.getByText(/Original and adjusted dates are read from the backend operational evidence/)).toBeVisible();
    const evidenceRows=evidenceCard.locator('tbody tr');
    expect(await evidenceRows.count()).toBeGreaterThan(0);
    for(const periodCode of ['E2E-2026-07','E2E-2026-08']){
      const row=evidenceRows.filter({hasText:periodCode});
      await expect(row).toBeVisible();
      const cells=await row.locator('td').allTextContents();
      expect(cells[0]).toBe(periodCode);
      expect(cells.slice(1).map(value=>value.replace(/\s+/g,' ').trim()))
        .toEqual(Array(5).fill('— → —'));
    }

    await expectNoStoredTokens(page);
    network.assertClean();
  });
});
