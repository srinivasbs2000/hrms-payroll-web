import {NavLink,Route,Routes} from 'react-router-dom';
import {DraftPayslipPage} from './features/draft-payslip/DraftPayslipPage';
import {SetupPage} from './features/organisation/SetupPage';
import {PayGroupPage} from './features/pay-group/PayGroupPage';

export function App(){
  return <>
    <header>
      <p className="brand-kicker">HRMS</p>
      <h1>Payroll foundation</h1>
      <nav aria-label="Primary navigation">
        <NavLink to="/organisation">Organisation</NavLink>
        <NavLink to="/pay-groups">Pay groups</NavLink>
        <NavLink to="/draft-payslip">Draft payslip</NavLink>
      </nav>
    </header>
    <main>
      <Routes>
        <Route path="*" element={<SetupPage/>}/>
        <Route path="/organisation" element={<SetupPage/>}/>
        <Route path="/pay-groups" element={<PayGroupPage/>}/>
        <Route path="/draft-payslip" element={<DraftPayslipPage/>}/>
      </Routes>
    </main>
  </>;
}
