import {expect,test} from '@playwright/test';
import {expectNoStoredTokens} from './support/auth';
import {guardApi,waitForApi} from './support/network';

const FIXTURE_PAY_GROUP_VERSION='45100000-0000-0000-0000-000000000001';
const FIXTURE_PSU_VERSION='42100000-0000-0000-0000-000000000001';
const FIXTURE_ESTABLISHMENT_VERSION='43100000-0000-0000-0000-000000000001';
const FIXTURE_ASSIGNMENT_VERSION='49100000-0000-0000-0000-000000000001';

let sequence=0;
function token(){sequence+=1;return `${Date.now().toString().slice(-6)}${String(sequence).padStart(2,'0')}`}

test.describe('P5-E2E-UI-01-B02-G03 operator closure',()=>{
  test('operator configures five milestones and performs repeat holiday correction',async({page})=>{
    const network=guardApi(page);
    const code=`B02_WK_${token()}`;
    await page.goto('/payroll-calendars');
    const createForm=page.getByRole('form',{name:'Create payroll calendar'});
    await createForm.getByLabel('Calendar code').fill(code);
    await createForm.getByLabel('Calendar name').fill('B02 governed weekly calendar');
    await createForm.getByLabel('Frequency').selectOption('WEEKLY');
    const createResponse=await waitForApi(page,'POST','/api/v1/payroll-calendars',
      ()=>createForm.getByRole('button',{name:'Create calendar'}).click());
    expect(createResponse.status()).toBe(201);
    const created=await createResponse.json() as {id:string};

    const milestoneForm=page.getByRole('form',{name:'Configure calendar milestone rules'});
    await milestoneForm.getByLabel('PAYMENT offset days').fill('0');
    await milestoneForm.getByLabel('PAYMENT adjustment policy').selectOption('PREVIOUS_WORKING_DAY');
    const milestoneResponse=await waitForApi(page,'POST',
      `/api/v1/payroll-calendars/${created.id}/milestone-rules`,
      ()=>milestoneForm.getByRole('button',{name:'Save five milestone rules'}).click());
    expect(milestoneResponse.status()).toBe(200);
    const rules=await milestoneResponse.json() as {milestoneType:string;versionNo:number}[];
    expect(rules).toHaveLength(5);
    expect(new Set(rules.map(rule=>rule.milestoneType))).toEqual(new Set([
      'INPUT_CUTOFF','CALCULATION','APPROVAL','RELEASE','PAYMENT'
    ]));
    await expect(page.getByRole('table',{name:'Calendar milestone rules'})).toContainText('PAYMENT');

    const holidayForm=page.getByRole('form',{name:'Add or correct calendar holiday'});
    await holidayForm.getByLabel('Holiday date').fill('2026-12-25');
    await holidayForm.getByLabel('Holiday name').fill('Christmas Day');
    const firstHoliday=await waitForApi(page,'POST',
      `/api/v1/payroll-calendars/${created.id}/holidays`,
      ()=>holidayForm.getByRole('button',{name:'Save holiday'}).click());
    expect(firstHoliday.status()).toBe(200);
    const first=await firstHoliday.json() as {versionNo:number};

    await holidayForm.getByLabel('Holiday name').fill('Christmas Day observed');
    const correctionResponse=await waitForApi(page,'POST',
      `/api/v1/payroll-calendars/${created.id}/holidays`,
      ()=>holidayForm.getByRole('button',{name:'Save holiday'}).click());
    expect(correctionResponse.status()).toBe(200);
    const corrected=await correctionResponse.json() as {versionNo:number;holidayName:string};
    expect(corrected.versionNo).toBeGreaterThan(first.versionNo);
    expect(corrected.holidayName).toBe('Christmas Day observed');
    await expect(page.getByRole('table',{name:'Calendar holidays'})).toContainText('Christmas Day observed');
    await expect(page.getByText('Generation: READY',{exact:true})).toBeVisible();

    await expectNoStoredTokens(page);network.assertClean();
  });

  test('operator administers routing and inspects interval resolution evidence',async({page})=>{
    const network=guardApi(page);
    const priority=70000+sequence+1;
    await page.goto('/pay-groups');
    await expect(page.getByRole('heading',{name:'Pay groups',exact:true})).toBeVisible();
    const createRule=page.getByRole('form',{name:'Create pay-group routing rule'});
    await createRule.getByLabel('Pay group').selectOption(FIXTURE_PAY_GROUP_VERSION);
    await createRule.getByLabel('Routing payroll statutory unit version ID').fill(FIXTURE_PSU_VERSION);
    await createRule.getByLabel('Establishment version ID (optional)').fill(FIXTURE_ESTABLISHMENT_VERSION);
    await createRule.getByLabel('Priority').fill(String(priority));
    await createRule.getByLabel('Routing effective from').fill('2026-01-01');
    await createRule.getByLabel('Routing effective to').fill('2027-01-01');
    const createResponse=await waitForApi(page,'POST','/api/v1/pay-groups/routing-rules',
      ()=>createRule.getByRole('button',{name:'Create routing rule'}).click());
    expect(createResponse.status()).toBe(201);
    const rule=await createResponse.json() as {id:string;versionNo:number};

    const ruleRow=page.getByRole('row').filter({hasText:String(priority)});
    await expect(ruleRow).toContainText(FIXTURE_ESTABLISHMENT_VERSION);
    const endForm=ruleRow.getByRole('form',{name:`End-date routing rule ${rule.id}`});
    await endForm.getByLabel('End date').fill('2026-09-01');
    const endResponse=await waitForApi(page,'POST',
      `/api/v1/pay-groups/routing-rules/${rule.id}/end-date`,
      ()=>endForm.getByRole('button',{name:'End-date rule'}).click());
    expect(endResponse.status()).toBe(200);

    const readiness=page.getByRole('form',{name:'Inspect routing readiness'});
    await readiness.getByLabel('Payroll assignment version ID').fill(FIXTURE_ASSIGNMENT_VERSION);
    await readiness.getByLabel('Requested pay group').selectOption(FIXTURE_PAY_GROUP_VERSION);
    await readiness.getByLabel('Readiness effective from').fill('2026-07-01');
    await readiness.getByLabel('Readiness effective to').fill('2026-09-01');
    const readinessResponse=await waitForApi(page,'GET','/api/v1/pay-groups/routing-readiness',
      ()=>readiness.getByRole('button',{name:'Inspect routing readiness'}).click());
    expect(readinessResponse.status()).toBe(200);
    const evidence=await readinessResponse.json() as {ready:boolean;compatible:boolean;
      routingCoverageComplete:boolean;resolutionCheckpoints:unknown[]};
    expect(evidence).toMatchObject({ready:true,compatible:true,routingCoverageComplete:true});
    expect(evidence.resolutionCheckpoints.length).toBeGreaterThan(0);
    await expect(page.getByText('READY',{exact:true})).toBeVisible();
    await expect(page.getByRole('table',{name:'Routing resolution checkpoints'})).toBeVisible();

    await expectNoStoredTokens(page);network.assertClean();
  });
});
