import {defineConfig,devices} from '@playwright/test';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import baseConfig from '../playwright.config';

const directory=path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot=path.resolve(directory,'..');
const authDirectory=path.join(directory,'.auth');

export default defineConfig({
  ...baseConfig,
  testDir:directory,
  webServer:[
    {
      command:'node e2e/start-backend.mjs',
      cwd:repositoryRoot,
      url:'http://localhost:8080/actuator/health',
      timeout:240_000,
      reuseExistingServer:false,
      env:{
        ...process.env,
        SERVER_MAX_HTTP_REQUEST_HEADER_SIZE:'16KB'
      },
      stdout:'pipe',
      stderr:'pipe'
    },
    {
      command:'node node_modules/vite/bin/vite.js --host localhost',
      cwd:repositoryRoot,
      url:'http://localhost:5173',
      timeout:120_000,
      reuseExistingServer:false,
      stdout:'pipe',
      stderr:'pipe'
    }
  ],
  projects:[
    {name:'setup-admin',testMatch:'admin.setup.ts'},
    {
      name:'p5-epa-01-g02b',
      testMatch:'p5-epa-01-g02b.spec.ts',
      dependencies:['setup-admin'],
      use:{...devices['Desktop Chrome'],storageState:path.join(authDirectory,'admin.json')}
    }
  ]
});
