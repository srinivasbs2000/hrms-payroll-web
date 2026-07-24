import {NavLink,Route,Routes} from 'react-router-dom';
import {DraftPayslipPage} from './features/draft-payslip/DraftPayslipPage';
import {EmployeePayrollPage} from './features/employee-payroll/EmployeePayrollPage';
import {SetupPage} from './features/organisation/SetupPage';
import {PayGroupPage} from './features/pay-group/PayGroupPage';
import {PayComponentPage} from './features/pay-component/PayComponentPage';
import {SalaryStructurePage} from './features/salary-structure/SalaryStructurePage';
import {PayrollCalendarPage} from './features/payroll-calendar/PayrollCalendarPage';
import {PayrollExecutionPage} from './features/payroll-execution/PayrollExecutionPage';

export function App(){
  return <>
    <header>
      <p className="brand-kicker">HRMS</p>
      <h1>Payroll foundation</h1>
      <nav aria-label="Primary navigation">
        <NavLink to="/organisation">Organisation</NavLink>
        <NavLink to="/payroll-calendars">Payroll calendars</NavLink>
        <NavLink to="/pay-groups">Pay groups</NavLink>
        <NavLink to="/pay-components">Pay components</NavLink>
        <NavLink to="/salary-structures">Salary structures</NavLink>
        <NavLink to="/employee-payroll">Employee payroll</NavLink>
        <NavLink to="/payroll-execution">Payroll execution</NavLink>
        <NavLink to="/draft-payslip">Draft payslip</NavLink>
      </nav>
    </header>
    <main>
      <Routes>
        <Route path="*" element={<SetupPage/>}/>
        <Route path="/organisation" element={<SetupPage/>}/>
        <Route path="/payroll-calendars" element={<PayrollCalendarPage/>}/>
        <Route path="/pay-groups" element={<PayGroupPage/>}/>
        <Route path="/pay-components" element={<PayComponentPage/>}/>
        <Route path="/salary-structures" element={<SalaryStructurePage/>}/>
        <Route path="/employee-payroll" element={<EmployeePayrollPage/>}/>
        <Route path="/payroll-execution" element={<PayrollExecutionPage/>}/>
        <Route path="/draft-payslip" element={<DraftPayslipPage/>}/>
      </Routes>
    </main>
  </>;
}
