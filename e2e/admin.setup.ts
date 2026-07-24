import fs from 'node:fs';
import path from 'node:path';
import {test as setup} from '@playwright/test';
import {e2ePassword,login} from './support/auth';

const state=path.join(import.meta.dirname,'.auth','admin.json');

setup('authenticate payroll administrator',async({page})=>{
  fs.mkdirSync(path.dirname(state),{recursive:true});
  await login(
    page,
    'payroll.admin',
    e2ePassword('E2E_PAYROLL_ADMIN_PASSWORD')
  );
  await page.context().storageState({path:state});
});
