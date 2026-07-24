import {expect,Page} from '@playwright/test';

export function e2ePassword(variable:string){
  const supplied=process.env[variable];
  if(supplied)return supplied;
  if(process.env.CI)throw new Error(`${variable} must be supplied in CI`);
  return 'change-me';
}

export async function login(
  page:Page,
  username:string,
  password:string
){
  await page.goto('/');
  await expect(
    page.getByRole('button',{name:'Sign in with Keycloak'})
  ).toBeVisible();
  await page.getByRole('button',{name:'Sign in with Keycloak'}).click();

  await expect(page).toHaveURL(/localhost:8081\/realms\/payroll/);
  await page.locator('#username').fill(username);
  await page.locator('#password').fill(password);
  await page.locator('#kc-login').click();

  if(page.url().includes('execution=VERIFY_PROFILE')){
    await expect(
      page.getByRole('heading',{name:'Update Account Information'})
    ).toBeVisible();

    const profile=username==='payroll.admin'
      ?{
          email:'payroll.admin@example.invalid',
          firstName:'Payroll',
          lastName:'Administrator'
        }
      :{
          email:`${username}@example.invalid`,
          firstName:'Payroll',
          lastName:'User'
        };

    await page.locator('#email').fill(profile.email);
    await page.locator('#firstName').fill(profile.firstName);
    await page.locator('#lastName').fill(profile.lastName);
    await page.locator(
      '#kc-update-profile-form input[type="submit"]'
    ).click();
  }

  await expect(page).toHaveURL(/^http:\/\/localhost:5173\//);
  await expect(page.getByText(username,{exact:true})).toBeVisible();
  await expect(
    page.getByText('Tenant 00000000-0000-0000-0000-000000000001')
  ).toBeVisible();
}

export async function expectNoStoredTokens(page:Page){
  const storage=await page.evaluate(()=>{
    const entries=[
      ...Object.entries(localStorage),
      ...Object.entries(sessionStorage)
    ];
    return entries.map(([key,value])=>`${key}=${value}`);
  });
  expect(storage.join('\n')).not.toMatch(/access[_-]?token|refresh[_-]?token|bearer/i);
}
