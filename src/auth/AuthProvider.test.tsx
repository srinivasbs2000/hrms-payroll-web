import {act,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {ReactNode,useState} from 'react';
import {beforeEach,expect,test,vi} from 'vitest';
import {AuthProvider,useAuth} from './AuthProvider';
import type {PayrollKeycloakClient} from './keycloak-client';

function client(
  overrides:Partial<PayrollKeycloakClient>={}
):PayrollKeycloakClient{
  return {
    authenticated:true,
    token:'token-1',
    tokenParsed:{
      preferred_username:'payroll.admin',
      name:'Payroll Administrator',
      tenant_id:'00000000-0000-0000-0000-000000000001',
      permissions:['payroll-cycle.read','payroll-calculation.execute']
    },
    init:vi.fn().mockResolvedValue(true),
    login:vi.fn().mockResolvedValue(undefined),
    logout:vi.fn().mockResolvedValue(undefined),
    updateToken:vi.fn().mockResolvedValue(false),
    clearToken:vi.fn(),
    ...overrides
  };
}

function Harness({
  authClient,
  authenticated=true,
  children
}:{
  authClient:PayrollKeycloakClient;
  authenticated?:boolean;
  children:ReactNode;
}){
  return <AuthProvider
    client={authClient}
    initialAuthenticated={authenticated}
  >{children}</AuthProvider>;
}


function FirstRenderPermissionProbe(){
  const [allowed]=useState(
    ()=>window.payrollSession?.permissions?.includes('payroll-cycle.read')??false
  );
  return <p>{allowed?'initial-cycle-read':'initial-no-cycle-read'}</p>;
}

function Probe(){
  const auth=useAuth();
  return <>
    <p>{auth.authenticated?'authenticated':'anonymous'}</p>
    <p>{auth.username}</p>
    <p>{auth.tenantId}</p>
    <p>{auth.hasPermission('payroll-cycle.read')?'cycle-read':'no-cycle-read'}</p>
    <button onClick={()=>void auth.logout()}>Logout</button>
  </>;
}

beforeEach(()=>{
  delete window.payrollSession;
  window.localStorage.clear();
  window.sessionStorage.clear();
});


test('publishes a restored session before protected children first render',()=>{
  const authClient=client();

  render(
    <Harness authClient={authClient}>
      <FirstRenderPermissionProbe/>
    </Harness>
  );

  expect(screen.getByText('initial-cycle-read')).toBeInTheDocument();
});

test('publishes authenticated token and permissions only in memory',()=>{
  const authClient=client();
  render(<Harness authClient={authClient}><Probe/></Harness>);

  expect(screen.getByText('authenticated')).toBeInTheDocument();
  expect(screen.getByText('payroll.admin')).toBeInTheDocument();
  expect(screen.getByText('cycle-read')).toBeInTheDocument();
  expect(window.payrollSession).toEqual({
    accessToken:'token-1',
    permissions:['payroll-calculation.execute','payroll-cycle.read']
  });
  expect(window.localStorage).toHaveLength(0);
  expect(window.sessionStorage).toHaveLength(0);
});

test('refreshes an expired token and updates the shared session',async()=>{
  const authClient=client();
  authClient.updateToken=vi.fn().mockImplementation(async()=>{
    authClient.token='token-2';
    return true;
  });

  render(<Harness authClient={authClient}><Probe/></Harness>);

  await act(async()=>{
    await authClient.onTokenExpired?.();
  });

  await waitFor(()=>{
    expect(window.payrollSession?.accessToken).toBe('token-2');
  });
  expect(authClient.updateToken).toHaveBeenCalledWith(45);
});

test('clears the in-memory session before Keycloak logout',async()=>{
  const authClient=client();
  render(<Harness authClient={authClient}><Probe/></Harness>);

  fireEvent.click(screen.getByRole('button',{name:'Logout'}));

  await waitFor(()=>{
    expect(authClient.logout).toHaveBeenCalled();
  });
  expect(authClient.clearToken).toHaveBeenCalled();
  expect(window.payrollSession).toBeUndefined();
});
