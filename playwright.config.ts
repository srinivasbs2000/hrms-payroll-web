import {defineConfig,devices} from '@playwright/test';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const directory=path.dirname(fileURLToPath(import.meta.url));
const authDirectory=path.join(directory,'e2e','.auth');

export default defineConfig({
  testDir:'./e2e',
  outputDir:'./test-results',
  fullyParallel:false,
  workers:1,
  retries:process.env.CI?1:0,
  timeout:120_000,
  expect:{timeout:15_000},
  reporter:[
    ['list'],
    ['html',{open:'never',outputFolder:'playwright-report'}]
  ],
  use:{
    baseURL:'http://localhost:5173',
    trace:'retain-on-failure',
    screenshot:'only-on-failure',
    video:'retain-on-failure',
    actionTimeout:15_000,
    navigationTimeout:30_000
  },
  webServer:[
    {
      command:'node e2e/start-backend.mjs',
      url:'http://localhost:8080/actuator/health',
      timeout:240_000,
      reuseExistingServer:false,
      stdout:'pipe',
      stderr:'pipe'
    },
    {
      command:'npm run dev -- --host localhost',
      url:'http://localhost:5173',
      timeout:120_000,
      reuseExistingServer:false,
      stdout:'pipe',
      stderr:'pipe'
    }
  ],
  projects:[
    {
      name:'setup-admin',
      testMatch:'admin.setup.ts'
    },
    {
      name:'setup-smoke',
      testMatch:'smoke.setup.ts'
    },
    {
      name:'admin-workflow',
      testMatch:'admin-payroll.spec.ts',
      dependencies:['setup-admin'],
      use:{
        ...devices['Desktop Chrome'],
        storageState:path.join(authDirectory,'admin.json')
      }
    },
    {
      name:'read-only',
      testMatch:'read-only.spec.ts',
      dependencies:['setup-smoke','admin-workflow'],
      use:{
        ...devices['Desktop Chrome'],
        storageState:path.join(authDirectory,'smoke.json')
      }
    }
  ]
});
