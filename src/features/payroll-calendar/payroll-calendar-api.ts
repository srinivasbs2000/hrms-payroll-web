export type PayrollFrequency='MONTHLY'|'FORTNIGHTLY'|'WEEKLY'|'DAILY'|'CUSTOM';
export type CalendarLifecycleStatus='DRAFT'|'PUBLISHED'|'RETIRED';

export interface PayrollCalendar{
  id:string;
  calendarSeriesId:string;
  calendarVersion:number;
  supersedesCalendarId:string|null;
  code:string;
  name:string;
  frequency:PayrollFrequency;
  timezone:string;
}
export interface PayPeriod{
  id:string;calendarId:string;periodCode:string;periodStart:string;periodEnd:string;
  paymentDate:string;status:string;
}
export interface PayPeriodOperational extends PayPeriod{
  inputCutoffOriginalDate?:string|null;inputCutoffAdjustedDate?:string|null;
  calculationOriginalDate?:string|null;calculationAdjustedDate?:string|null;
  approvalOriginalDate?:string|null;approvalAdjustedDate?:string|null;
  releaseOriginalDate?:string|null;releaseAdjustedDate?:string|null;
  paymentOriginalDate?:string|null;paymentAdjustedDate?:string|null;
}
export interface CalendarOperational{
  id:string;calendarSeriesId:string;calendarVersion:number;supersedesCalendarId:string|null;
  code:string;name:string;frequency:PayrollFrequency;timezone:string;
  customPeriodDays:number|null;customFrequencyAuthorised:boolean;publicationRequired:boolean;
  lifecycleStatus:CalendarLifecycleStatus;latestLifecycleEventId:string|null;
  lifecycleChangedAt:string|null;lifecycleChangedBy:string|null;lifecycleReason:string|null;
  milestoneRuleCount:number;holidayCount:number;periodCount:number;
  firstPeriodStart:string|null;lastPeriodEnd:string|null;
}
export interface PayrollCalendarWrite{
  code:string;name:string;frequency?:PayrollFrequency;timezone?:string;
  customPeriodDays?:number|null;customFrequencyAuthorised?:boolean;weekendIsoDays?:number[];
}
export interface GeneratePeriods{
  year?:number;paymentDay?:number;startDate?:string;periodCount?:number;
}
export type CalendarMilestoneType='INPUT_CUTOFF'|'CALCULATION'|'APPROVAL'|'RELEASE'|'PAYMENT';
export type CalendarMilestoneAnchor='PERIOD_START'|'PERIOD_END';
export type CalendarAdjustmentPolicy='NONE'|'PREVIOUS_WORKING_DAY'|'NEXT_WORKING_DAY';
export interface CalendarMilestoneRuleWrite{
  milestoneType:CalendarMilestoneType;
  anchorType:CalendarMilestoneAnchor;
  offsetDays:number;
  adjustmentPolicy:CalendarAdjustmentPolicy;
}
export interface CalendarMilestoneRule extends CalendarMilestoneRuleWrite{
  id:string;calendarId:string;versionNo:number;
}
export interface CalendarHolidayWrite{holidayDate:string;holidayName:string}
export interface CalendarHoliday extends CalendarHolidayWrite{
  id:string;calendarId:string;versionNo:number;
}
export type CalendarReadinessBlocker='CALENDAR_NOT_DRAFT'|'MILESTONE_RULE_SET_INCOMPLETE'|
  'PAY_PERIODS_NOT_GENERATED'|'PERIOD_MILESTONE_EVIDENCE_INCOMPLETE';
export interface CalendarReadiness{
  calendarId:string;frequency:PayrollFrequency;timezone:string;
  lifecycleStatus:CalendarLifecycleStatus;milestoneRuleCount:number;holidayCount:number;
  periodCount:number;incompletePeriodCount:number;generationReady:boolean;
  publicationReady:boolean;blockers:CalendarReadinessBlocker[];
}
export interface PayrollCalendarApi{
  list():Promise<PayrollCalendar[]>;
  create(input:PayrollCalendarWrite):Promise<PayrollCalendar>;
  periods(calendarId:string,year?:number):Promise<PayPeriod[]>;
  generate(calendarId:string,input:GeneratePeriods):Promise<PayPeriod[]>;
  operations(calendarId:string):Promise<CalendarOperational>;
  periodOperations(calendarId:string,year?:number):Promise<PayPeriodOperational[]>;
  publish(calendarId:string,reason?:string):Promise<CalendarOperational>;
  amend(calendarId:string):Promise<PayrollCalendar>;
  retire(calendarId:string,reason:string):Promise<CalendarOperational>;
  milestoneRules(calendarId:string):Promise<CalendarMilestoneRule[]>;
  configureMilestoneRules(calendarId:string,rules:CalendarMilestoneRuleWrite[]):Promise<CalendarMilestoneRule[]>;
  holidays(calendarId:string):Promise<CalendarHoliday[]>;
  configureHoliday(calendarId:string,input:CalendarHolidayWrite):Promise<CalendarHoliday>;
  readiness(calendarId:string):Promise<CalendarReadiness>;
}

async function request<T>(path:string,init:RequestInit={}):Promise<T>{
  const headers=new Headers(init.headers);
  headers.set('X-Correlation-ID',crypto.randomUUID());
  if(init.method&&init.method!=='GET')headers.set('Idempotency-Key',crypto.randomUUID());
  if(init.body)headers.set('Content-Type','application/json');
  const token=window.payrollSession?.accessToken;
  if(token)headers.set('Authorization',`Bearer ${token}`);
  const response=await fetch(`/api/v1${path}`,{...init,headers});
  if(!response.ok){
    let detail=`Request failed (${response.status})`;
    try{detail=(await response.json() as {detail?:string}).detail??detail}catch{/* non-JSON */}
    throw new Error(detail);
  }
  return response.json() as Promise<T>;
}
export const httpPayrollCalendarApi:PayrollCalendarApi={
  list:()=>request('/payroll-calendars'),
  create:input=>request('/payroll-calendars',{method:'POST',body:JSON.stringify(input)}),
  periods:(calendarId,year)=>request(`/payroll-calendars/${calendarId}/periods${year===undefined?'':`?year=${encodeURIComponent(year)}`}`),
  generate:(calendarId,input)=>request(`/payroll-calendars/${calendarId}/periods`,{method:'POST',body:JSON.stringify(input)}),
  operations:calendarId=>request(`/payroll-calendars/${calendarId}/operations`),
  periodOperations:(calendarId,year)=>request(`/payroll-calendars/${calendarId}/period-operations${year===undefined?'':`?year=${encodeURIComponent(year)}`}`),
  publish:(calendarId,reason)=>request(`/payroll-calendars/${calendarId}/publication`,{method:'POST',body:JSON.stringify({reason:reason||null})}),
  amend:calendarId=>request(`/payroll-calendars/${calendarId}/amendments`,{method:'POST'}),
  retire:(calendarId,reason)=>request(`/payroll-calendars/${calendarId}/retirement`,{method:'POST',body:JSON.stringify({reason})}),
  milestoneRules:calendarId=>request(`/payroll-calendars/${calendarId}/milestone-rules`),
  configureMilestoneRules:(calendarId,rules)=>request(`/payroll-calendars/${calendarId}/milestone-rules`,{
    method:'POST',body:JSON.stringify({rules})
  }),
  holidays:calendarId=>request(`/payroll-calendars/${calendarId}/holidays`),
  configureHoliday:(calendarId,input)=>request(`/payroll-calendars/${calendarId}/holidays`,{
    method:'POST',body:JSON.stringify(input)
  }),
  readiness:calendarId=>request(`/payroll-calendars/${calendarId}/readiness`)
};
