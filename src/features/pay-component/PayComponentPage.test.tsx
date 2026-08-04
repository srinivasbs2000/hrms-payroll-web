import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {expect,test,vi} from 'vitest';
import {PayComponentPage} from './PayComponentPage';
import {PayComponentApi,PayComponentVersion} from './pay-component-api';

const component:PayComponentVersion={
  identityId:'20000000-0000-0000-0000-000000000001',code:'BASIC',name:'Basic Pay',componentType:'EARNING',
  lifecycleStatus:'ACTIVE',ownershipScope:'TENANT',countryCode:null,protectedFlag:false,confidentialityLevel:'STANDARD',identityVersionNo:1,
  retirementEffectiveDate:null,retirementReason:null,retiredAt:null,retiredBy:null,
  versionId:'21000000-0000-0000-0000-000000000001',versionSequence:1,versionNo:1,catalogueSchemaVersion:1,classificationStatus:'COMPLETE',
  formulaType:'FIXED',formulaExpression:null,fixedAmount:50000,roundingScale:2,componentCategory:'CASH_EARNING',componentSubcategory:'BASIC_PAY',
  cashImpact:'INCREASE',payeeType:'EMPLOYEE',paymentChannel:'PAYROLL_BANK',settlementTiming:'CURRENT_PERIOD',payslipVisibility:'SHOW',
  zeroValueVisibility:'SUPPRESS',negativeValuePolicy:'PROHIBIT',frequency:'MONTHLY',valueNature:'FIXED',amountRepresentation:'MONTHLY_AMOUNT',
  taxTreatment:'DELEGATED',payrollTiming:'REGULAR',effectiveFrom:'2026-01-01',effectiveTo:null,approvalStatus:'APPROVED',supersedesVersionId:null,superseded:false
};
function fakeApi(overrides:Partial<PayComponentApi>={}):PayComponentApi{return {
  list:vi.fn().mockResolvedValue([]),history:vi.fn().mockResolvedValue([component]),create:vi.fn().mockResolvedValue(component),
  addVersion:vi.fn().mockResolvedValue({...component,versionSequence:2,approvalStatus:'DRAFT'}),correct:vi.fn().mockResolvedValue({...component,versionSequence:2,approvalStatus:'DRAFT'}),
  endDate:vi.fn().mockResolvedValue({...component,effectiveTo:'2027-01-01',versionNo:2}),approve:vi.fn().mockResolvedValue(component),retire:vi.fn().mockResolvedValue({...component,lifecycleStatus:'RETIRED'}),...overrides};}

test('rejects the screen when component read is absent',()=>{const api=fakeApi();render(<PayComponentPage api={api} permissions={new Set()}/>);expect(screen.getByRole('alert')).toHaveTextContent('do not have permission');expect(api.list).not.toHaveBeenCalled()});
test('renders complete classification and immutable history',async()=>{const api=fakeApi({list:vi.fn().mockResolvedValue([component])});render(<PayComponentPage api={api} permissions={new Set(['compensation.component.read'])}/>);fireEvent.click(await screen.findByRole('button',{name:/BASIC/}));expect(await screen.findByText('Version 1: fixed 50000')).toBeInTheDocument();expect(screen.getByText(/ACTIVE · COMPLETE/)).toBeInTheDocument()});
test('creates a nested complete component request',async()=>{const api=fakeApi();render(<PayComponentPage api={api} permissions={new Set(['compensation.component.read','compensation.component.create'])}/>);await screen.findByText('No approved pay components');fireEvent.change(screen.getByLabelText('Code'),{target:{value:'basic'}});fireEvent.change(screen.getByLabelText('Name'),{target:{value:'Basic Pay'}});fireEvent.change(screen.getByLabelText('Fixed amount'),{target:{value:'50000'}});fireEvent.click(screen.getByRole('button',{name:'Create complete component draft'}));await waitFor(()=>expect(api.create).toHaveBeenCalledWith(expect.objectContaining({code:'BASIC',componentType:'EARNING',version:expect.objectContaining({componentCategory:'CASH_EARNING',cashImpact:'INCREASE',fixedAmount:50000})})))});
test('keeps identity fields out of version requests',async()=>{const api=fakeApi({list:vi.fn().mockResolvedValue([component])});render(<PayComponentPage api={api} permissions={new Set(['compensation.component.read','compensation.component.version.create'])}/>);fireEvent.click(await screen.findByRole('button',{name:/BASIC/}));await screen.findByText('Version 1: fixed 50000');fireEvent.change(screen.getByLabelText('Version Fixed amount'),{target:{value:'55000'}});fireEvent.change(screen.getByLabelText('Version Effective from'),{target:{value:'2027-01-01'}});fireEvent.click(screen.getByRole('button',{name:'Add version'}));await waitFor(()=>expect(api.addVersion).toHaveBeenCalledWith(component.identityId,expect.not.objectContaining({code:'BASIC',name:'Basic Pay',componentType:'EARNING'})))});
test('surfaces API problem details accessibly',async()=>{const api=fakeApi({list:vi.fn().mockRejectedValue(new Error('Tenant context unavailable'))});render(<PayComponentPage api={api} permissions={new Set(['compensation.component.read'])}/>);expect(await screen.findByRole('alert')).toHaveTextContent('Tenant context unavailable')});
