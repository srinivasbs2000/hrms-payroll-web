export interface PayrollCalendar {
  id:string;
  code:string;
  name:string;
  frequency:'MONTHLY';
  timezone:string;
}

export interface PayPeriod {
  id:string;
  calendarId:string;
  periodCode:string;
  periodStart:string;
  periodEnd:string;
  paymentDate:string;
  status:'OPEN'|'CLOSED';
}

export interface PayrollCalendarWrite {
  code:string;
  name:string;
  frequency?:'MONTHLY';
  timezone?:string;
}

export interface GeneratePeriods {
  year:number;
  paymentDay?:number;
}

export interface PayrollCalendarApi {
  list():Promise<PayrollCalendar[]>;
  create(input:PayrollCalendarWrite):Promise<PayrollCalendar>;
  periods(calendarId:string,year?:number):Promise<PayPeriod[]>;
  generate(calendarId:string,input:GeneratePeriods):Promise<PayPeriod[]>;
}

async function request<T>(path:string,init:RequestInit={}):Promise<T>{
  const headers=new Headers(init.headers);
  headers.set('X-Correlation-ID',crypto.randomUUID());
  if(init.method&&init.method!=='GET'){
    headers.set('Idempotency-Key',crypto.randomUUID());
  }
  if(init.body)headers.set('Content-Type','application/json');
  const token=window.payrollSession?.accessToken;
  if(token)headers.set('Authorization',`Bearer ${token}`);

  const response=await fetch(`/api/v1${path}`,{...init,headers});
  if(!response.ok){
    let detail=`Request failed (${response.status})`;
    try{
      const problem=await response.json() as {detail?:string};
      detail=problem.detail??detail;
    }catch{/* empty or non-JSON response */}
    const error=new Error(detail) as Error&{status?:number};
    error.status=response.status;
    throw error;
  }

  return response.json() as Promise<T>;
}

export const httpPayrollCalendarApi:PayrollCalendarApi={
  list:()=>request('/payroll-calendars'),
  create:input=>request('/payroll-calendars',{
    method:'POST',
    body:JSON.stringify(input)
  }),
  periods:(calendarId,year)=>{
    const query=year===undefined?'':`?year=${encodeURIComponent(year)}`;
    return request(`/payroll-calendars/${calendarId}/periods${query}`);
  },
  generate:(calendarId,input)=>request(
    `/payroll-calendars/${calendarId}/periods`,
    {
      method:'POST',
      body:JSON.stringify(input)
    })
};
