import {expect,test,vi} from 'vitest';
import {
  initializePayrollKeycloak,
  keycloakConfiguration,
  keycloakInitializationOptions
} from './keycloak-client';
import type {PayrollKeycloakClient} from './keycloak-client';


test('uses the backend canonical local issuer hostname by default',()=>{
  expect(keycloakConfiguration()).toEqual({
    url:'http://localhost:8081',
    realm:'payroll',
    clientId:'payroll-web'
  });
});

test('uses authorization code flow with PKCE before router startup',async()=>{
  const init=vi.fn().mockResolvedValue(false);
  const client={
    init,
    login:vi.fn(),
    logout:vi.fn(),
    updateToken:vi.fn(),
    clearToken:vi.fn()
  } as unknown as PayrollKeycloakClient;

  await initializePayrollKeycloak(client,'http://localhost:5173');

  expect(init).toHaveBeenCalledWith({
    onLoad:'check-sso',
    flow:'standard',
    responseMode:'query',
    pkceMethod:'S256',
    checkLoginIframe:false,
    silentCheckSsoRedirectUri:
      'http://localhost:5173/silent-check-sso.html',
    silentCheckSsoFallback:true,
    enableLogging:false
  });
});

test('keeps the silent SSO callback on the current application origin',()=>{
  expect(
    keycloakInitializationOptions('https://payroll.example.com')
      .silentCheckSsoRedirectUri
  ).toBe('https://payroll.example.com/silent-check-sso.html');
});
