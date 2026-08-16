import type {
  SalaryTargetExecutionMode,SalaryTargetFrequency,SalaryTargetType
} from './salary-structure-api';

export interface SalaryTargetContractDefinition{
  type:SalaryTargetType;label:string;frequency:SalaryTargetFrequency;
  annualizationFactor:string|null;executionMode:SalaryTargetExecutionMode;
  requiresInclusiveBase:boolean;description:string;
}

export const salaryTargetContracts:readonly SalaryTargetContractDefinition[]=[
  {type:'ANNUAL_CTC',label:'Annual CTC',frequency:'ANNUAL',annualizationFactor:'1',
    executionMode:'STRUCTURAL',requiresInclusiveBase:false,
    description:'Annual structural CTC target resolved by the salary-structure design.'},
  {type:'ANNUAL_TOTAL_CTC',label:'Annual total CTC',frequency:'ANNUAL',annualizationFactor:'1',
    executionMode:'STRUCTURAL',requiresInclusiveBase:false,
    description:'Annual total CTC target resolved structurally.'},
  {type:'ANNUAL_FIXED_CTC',label:'Annual fixed CTC',frequency:'ANNUAL',annualizationFactor:'1',
    executionMode:'TARGET_RESOLVER_REQUIRED',requiresInclusiveBase:true,
    description:'Requires an approved inclusive payroll base to define fixed-CTC scope.'},
  {type:'ANNUAL_GROSS',label:'Annual gross',frequency:'ANNUAL',annualizationFactor:'1',
    executionMode:'STRUCTURAL',requiresInclusiveBase:false,
    description:'Annual gross target resolved structurally.'},
  {type:'MONTHLY_GROSS',label:'Monthly gross',frequency:'MONTHLY',annualizationFactor:'12',
    executionMode:'STRUCTURAL',requiresInclusiveBase:false,
    description:'Monthly source target; the backend normalizes it with the governed factor of 12.'},
  {type:'ANNUAL_BASIC',label:'Annual basic',frequency:'ANNUAL',annualizationFactor:'1',
    executionMode:'TARGET_RESOLVER_REQUIRED',requiresInclusiveBase:true,
    description:'Requires an approved inclusive payroll base that represents basic pay.'},
  {type:'HOURLY_RATE',label:'Hourly rate',frequency:'HOURLY',annualizationFactor:null,
    executionMode:'CALCULATION_ENGINE',requiresInclusiveBase:false,
    description:'Stored as a design contract. Annualization uses calculation-engine divisor policy.'},
  {type:'DAILY_RATE',label:'Daily rate',frequency:'DAILY',annualizationFactor:null,
    executionMode:'CALCULATION_ENGINE',requiresInclusiveBase:false,
    description:'Stored as a design contract. Annualization uses calculation-engine divisor policy.'},
  {type:'GRADE_MIDPOINT',label:'Grade midpoint',frequency:'ANNUAL',annualizationFactor:'1',
    executionMode:'TARGET_RESOLVER_REQUIRED',requiresInclusiveBase:true,
    description:'Requires an approved inclusive payroll base for the governed grade target scope.'},
  {type:'TOTAL_CASH_TARGET',label:'Total cash target',frequency:'ANNUAL',annualizationFactor:'1',
    executionMode:'TARGET_RESOLVER_REQUIRED',requiresInclusiveBase:true,
    description:'Requires an approved inclusive payroll base for total-cash scope.'},
  {type:'NET_PAY_TARGET',label:'Net pay target',frequency:'ANNUAL',annualizationFactor:'1',
    executionMode:'CALCULATION_ENGINE',requiresInclusiveBase:false,
    description:'Design contract only. Official gross-up, tax and convergence remain calculation-engine owned.'},
  {type:'EMPLOYER_COST_TARGET',label:'Employer cost target',frequency:'ANNUAL',annualizationFactor:'1',
    executionMode:'TARGET_RESOLVER_REQUIRED',requiresInclusiveBase:true,
    description:'Requires an approved inclusive payroll base for employer-cost scope.'}
];

export function salaryTargetContractFor(type:SalaryTargetType){
  const contract=salaryTargetContracts.find(item=>item.type===type);
  if(!contract)throw new Error(`Unsupported salary target type: ${type}`);
  return contract;
}

export function executionModeLabel(mode:SalaryTargetExecutionMode){
  if(mode==='TARGET_RESOLVER_REQUIRED')return 'Target resolver required';
  if(mode==='CALCULATION_ENGINE')return 'Calculation engine';
  return 'Structural';
}
