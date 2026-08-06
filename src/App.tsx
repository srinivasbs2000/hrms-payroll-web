import {Navigate,NavLink,Route,Routes} from 'react-router-dom';
import {useAuth} from './auth/AuthProvider';
import {DraftPayslipPage} from './features/draft-payslip/DraftPayslipPage';
import {EmployeePayrollPage} from './features/employee-payroll/EmployeePayrollPage';
import {SetupPage} from './features/organisation/SetupPage';
import {PayGroupPage} from './features/pay-group/PayGroupPage';
import {PayComponentPage} from './features/pay-component/PayComponentPage';
import {PayrollBasePage} from './features/payroll-base/PayrollBasePage';
import {SalaryStructurePage} from './features/salary-structure/SalaryStructurePage';
import {PayrollCalendarPage} from './features/payroll-calendar/PayrollCalendarPage';
import {PayrollExecutionPage} from './features/payroll-execution/PayrollExecutionPage';
import {StatutoryWorkspacePage} from './features/statutory/StatutoryWorkspacePage';

const navigation=[
  {to:'/organisation',label:'Organisation',permission:'organisation.read'},
  {to:'/payroll-calendars',label:'Payroll calendars',permission:'calendar.read'},
  {to:'/pay-groups',label:'Pay groups',permission:'pay-group.read'},
  {to:'/pay-components',label:'Pay components',permission:'compensation.component.read'},
  {to:'/payroll-bases',label:'Payroll bases',permission:'compensation.base.read'},
  {to:'/salary-structures',label:'Compensation design',permission:'compensation.structure.read'},
  {to:'/employee-payroll',label:'Employee payroll',permission:'employee-payroll.relationship.read'},
  {to:'/payroll-execution',label:'Payroll execution',permission:'payroll-cycle.read'},
  {to:'/statutory',label:'Statutory',permission:'statutory-evaluation.read'},
  {to:'/draft-payslip',label:'Draft payslip',permission:'payroll-result.read'}
] as const;

export function App(){
  const auth=useAuth();
  if(auth.initializingError&&!auth.authenticated){
    return <AuthenticationFailure message={auth.initializingError} retry={auth.retryInitialization}/>;
  }
  if(!auth.authenticated)return <LoginPage busy={auth.busy} login={auth.login}/>;
  const available=navigation.filter(item=>auth.hasPermission(item.permission));
  const firstRoute=available[0]?.to??'/no-access';
  return <><header className="application-header"><div className="brand-block">
    <p className="brand-kicker">HRMS</p><h1>Payroll foundation</h1></div>
    <nav aria-label="Primary navigation">{available.map(item=><NavLink key={item.to}
      to={item.to}>{item.label}</NavLink>)}</nav><div className="session-summary"><span>
      <strong>{auth.displayName||auth.username}</strong><small>{auth.username}</small>
      <small>Tenant {auth.tenantId||'not supplied'}</small></span><button
      className="secondary-button" disabled={auth.busy} onClick={()=>void auth.logout()}>Sign out</button></div>
    </header><main><Routes><Route path="/" element={<Navigate to={firstRoute} replace/>}/>
      <Route path="*" element={<Navigate to={firstRoute} replace/>}/>
      <Route path="/no-access" element={<NoAccessPage/>}/>
      <Route path="/organisation" element={<SetupPage/>}/>
      <Route path="/payroll-calendars" element={<PayrollCalendarPage/>}/>
      <Route path="/pay-groups" element={<PayGroupPage/>}/>
      <Route path="/pay-components" element={<PayComponentPage/>}/>
      <Route path="/payroll-bases" element={<PayrollBasePage/>}/>
      <Route path="/salary-structures" element={<SalaryStructurePage/>}/>
      <Route path="/employee-payroll" element={<EmployeePayrollPage/>}/>
      <Route path="/payroll-execution" element={<PayrollExecutionPage/>}/>
      <Route path="/statutory" element={<StatutoryWorkspacePage/>}/>
      <Route path="/draft-payslip" element={<DraftPayslipPage/>}/>
    </Routes></main></>;
}
function LoginPage({busy,login}:{busy:boolean;login:()=>Promise<void>}){
  return <main className="authentication-page"><section className="authentication-card"
    aria-labelledby="login-title"><div><p className="brand-kicker">HRMS</p>
    <h1 id="login-title">Payroll foundation</h1><p>Sign in through the payroll identity
    provider to access tenant-scoped payroll data and permitted actions.</p></div>
    <div className="authentication-action"><button disabled={busy} onClick={()=>void login()}>
    {busy?'Opening sign in…':'Sign in with Keycloak'}</button><small>Access tokens remain in browser
    memory and are not stored locally.</small></div></section></main>;
}
function AuthenticationFailure({message,retry}:{message:string;retry:()=>void}){
  return <main className="authentication-page"><section className="authentication-card"
    aria-labelledby="auth-error-title"><div><p className="brand-kicker">HRMS</p>
    <h1 id="auth-error-title">Authentication unavailable</h1><p className="error"
    role="alert">{message}</p></div><div className="authentication-action"><button
    onClick={retry}>Retry authentication</button><small>Confirm that the local Keycloak service
    is running.</small></div></section></main>;
}
function NoAccessPage(){return <section className="card" aria-labelledby="no-access-title">
  <h2 id="no-access-title">No payroll access assigned</h2><p role="alert">Your authenticated
  account has no supported read permission. Contact a payroll administrator.</p></section>}
