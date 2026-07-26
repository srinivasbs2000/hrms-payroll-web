import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {expect,test,vi} from 'vitest';
import {App} from './App';
import {AuthProvider} from './auth/AuthProvider';
import type {PayrollKeycloakClient} from './auth/keycloak-client';

function client(authenticated:boolean):PayrollKeycloakClient{
  return {
    authenticated,
    token:authenticated?'token-1':undefined,
    tokenParsed:authenticated?{
      preferred_username:'payroll.admin',
      name:'Payroll Administrator',
      tenant_id:'tenant-1',
      permissions:[
        'payroll-cycle.read',
        'payroll-result.read',
        'statutory-evaluation.read'
      ]
    }:undefined,
    init:vi.fn().mockResolvedValue(authenticated),
    login:vi.fn().mockResolvedValue(undefined),
    logout:vi.fn().mockResolvedValue(undefined),
    updateToken:vi.fn().mockResolvedValue(false),
    clearToken:vi.fn()
  };
}

test('shows a real Keycloak sign-in boundary before payroll routes',async()=>{
  const authClient=client(false);
  render(
    <AuthProvider client={authClient} initialAuthenticated={false}>
      <MemoryRouter><App/></MemoryRouter>
    </AuthProvider>
  );

  expect(screen.getByRole('heading',{name:'Payroll foundation'}))
    .toBeInTheDocument();
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button',{name:'Sign in with Keycloak'}));
  await waitFor(()=>expect(authClient.login).toHaveBeenCalled());
});

test('renders only permitted navigation for an authenticated user',()=>{
  const authClient=client(true);
  render(
    <AuthProvider client={authClient} initialAuthenticated>
      <MemoryRouter initialEntries={['/draft-payslip']}><App/></MemoryRouter>
    </AuthProvider>
  );

  expect(screen.getByText('Payroll Administrator')).toBeInTheDocument();
  expect(screen.getByText('Tenant tenant-1')).toBeInTheDocument();
  expect(screen.getByRole('link',{name:'Payroll execution'}))
    .toBeInTheDocument();
  expect(screen.getByRole('link',{name:'Statutory'}))
    .toBeInTheDocument();
  expect(screen.getByRole('link',{name:'Draft payslip'}))
    .toBeInTheDocument();
  expect(screen.queryByRole('link',{name:'Organisation'}))
    .not.toBeInTheDocument();
});
