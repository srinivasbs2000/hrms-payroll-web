import {FormEvent,useCallback,useEffect,useMemo,useState} from 'react';
import {currentPermissions} from '../organisation/organisation-api';
import {
  httpSalaryStructureApi,
  SalaryStructureApi,
  SalaryStructureComponentOption,
  SalaryStructureLineView,
  SalaryStructureVersion,
  SalaryStructureWrite
} from './salary-structure-api';

type Props={api?:SalaryStructureApi;permissions?:Set<string>};
type TargetMode='FIXED'|'PERCENTAGE'|'RESIDUAL';
type DraftLine={
  key:string;
  componentVersionId:string;
  componentLabel:string;
  mode:TargetMode;
  value:string;
  percentageBaseCode:string;
};

const today=()=>new Date().toISOString().slice(0,10);
let lineKey=0;
const nextKey=()=>`salary-line-${++lineKey}`;
const emptyLine=():DraftLine=>({
  key:nextKey(),
  componentVersionId:'',
  componentLabel:'',
  mode:'FIXED',
  value:'',
  percentageBaseCode:''
});

export function SalaryStructurePage({api=httpSalaryStructureApi,permissions}:Props){
  const effectivePermissions=useMemo(()=>permissions??currentPermissions(),[permissions]);
  const [asOf,setAsOf]=useState(today);
  const [items,setItems]=useState<SalaryStructureVersion[]>([]);
  const [components,setComponents]=useState<SalaryStructureComponentOption[]>([]);
  const [history,setHistory]=useState<SalaryStructureVersion[]>([]);
  const [selected,setSelected]=useState<SalaryStructureVersion|null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const canRead=effectivePermissions.has('compensation.structure.read');
  const canConfigure=[
    'compensation.structure.create',
    'compensation.structure.version.create',
    'compensation.structure.version.correct'
  ].some(permission=>effectivePermissions.has(permission));

  const load=useCallback(async()=>{
    if(!canRead)return;
    setLoading(true);setError('');
    try{
      const [structures,availableComponents]=await Promise.all([
        api.list(asOf),
        canConfigure?api.listComponents(asOf):Promise.resolve([])
      ]);
      setItems(structures);setComponents(availableComponents);
    }catch(value){setError((value as Error).message)}
    finally{setLoading(false)}
  },[api,asOf,canConfigure,canRead]);

  useEffect(()=>{void load()},[load]);

  async function select(item:SalaryStructureVersion){
    setSelected(item);setError('');
    try{setHistory(await api.history(item.identityId))}
    catch(value){setError((value as Error).message)}
  }

  async function create(input:SalaryStructureWrite){
    setError('');
    try{await api.create(input);await load()}
    catch(value){setError((value as Error).message)}
  }

  async function approve(item:SalaryStructureVersion){
    setError('');
    try{const result=await api.approve(item.identityId,item.versionId);await select(result);await load()}
    catch(value){setError((value as Error).message)}
  }

  async function addVersion(item:SalaryStructureVersion,input:SalaryStructureWrite){
    setError('');
    try{const result=await api.addVersion(item.identityId,input);await select(result);await load()}
    catch(value){setError((value as Error).message)}
  }

  async function correct(item:SalaryStructureVersion,input:SalaryStructureWrite){
    setError('');
    try{const result=await api.correct(item.identityId,item.versionId,input);await select(result);await load()}
    catch(value){setError((value as Error).message)}
  }

  async function endDate(item:SalaryStructureVersion,effectiveTo:string){
    setError('');
    try{const result=await api.endDate(item.identityId,item.versionId,item.versionNo,effectiveTo);await select(result);await load()}
    catch(value){setError((value as Error).message)}
  }

  if(!canRead)return <section className="card" aria-labelledby="salary-structure-title">
    <h2 id="salary-structure-title">Salary-structure foundation</h2>
    <p role="alert">You do not have permission to view salary structures.</p>
  </section>;

  return <section aria-labelledby="salary-structure-title">
    <div className="page-heading">
      <div>
        <p className="eyebrow">Sprint 2 compensation</p>
        <h2 id="salary-structure-title">Salary structures</h2>
        <p>Immutable, effective-dated component compositions used for employee salary assignment.</p>
      </div>
      <label>Effective date<input aria-label="Salary-structure effective date" type="date" value={asOf} onChange={event=>setAsOf(event.target.value)}/></label>
    </div>
    {loading&&<p role="status">Loading salary structures...</p>}
    {error&&<p className="error" role="alert">{error}</p>}
    {!loading&&items.length===0&&<div className="card empty">
      <h3>No approved salary structures</h3>
      <p>Create a complete draft with at least one approved component version, then approve it.</p>
    </div>}
    {items.length>0&&<div className="card">
      <h3>Effective on {asOf}</h3>
      <div className="pay-group-list">
        {items.map(item=><button key={item.versionId} className="tree-item" onClick={()=>void select(item)}>
          <strong>{item.code}</strong>
          <span>{item.name}</span>
          <small>{item.lines.length} component{item.lines.length===1?'':'s'} - {item.currency}</small>
        </button>)}
      </div>
    </div>}
    {effectivePermissions.has('compensation.structure.create')
      ?<StructureEditor
          title="Create salary-structure identity"
          submitLabel="Create salary-structure draft"
          requireCode
          components={components}
          onSubmit={create}/>
      :<p className="permission-note">Create controls are hidden because <code>compensation.structure.create</code> is not granted.</p>}
    {selected&&<Timeline
      selected={selected}
      history={history}
      components={components}
      permissions={effectivePermissions}
      onApprove={approve}
      onAddVersion={addVersion}
      onCorrect={correct}
      onEndDate={endDate}/>}
  </section>;
}

function lineSummary(line:SalaryStructureLineView){
  if(line.targetAmount!==null)return `${line.componentCode}: fixed ${line.targetAmount}`;
  if(line.targetPercentage!==null)return `${line.componentCode}: ${line.targetPercentage}% of ${line.percentageBaseCode}`;
  return `${line.componentCode}: residual`;
}

function Timeline({
  selected,history,components,permissions,onApprove,onAddVersion,onCorrect,onEndDate
}:{
  selected:SalaryStructureVersion;
  history:SalaryStructureVersion[];
  components:SalaryStructureComponentOption[];
  permissions:Set<string>;
  onApprove:(item:SalaryStructureVersion)=>Promise<void>;
  onAddVersion:(item:SalaryStructureVersion,input:SalaryStructureWrite)=>Promise<void>;
  onCorrect:(item:SalaryStructureVersion,input:SalaryStructureWrite)=>Promise<void>;
  onEndDate:(item:SalaryStructureVersion,effectiveTo:string)=>Promise<void>;
}){
  const [endDateValue,setEndDateValue]=useState(selected.effectiveTo??'');
  useEffect(()=>setEndDateValue(selected.effectiveTo??''),[selected]);

  const actions:{label:string;run:(input:SalaryStructureWrite)=>Promise<void>}[]=[];
  if(permissions.has('compensation.structure.version.create')){
    actions.push({label:'Add version',run:input=>onAddVersion(selected,input)});
  }
  if(selected.approvalStatus==='DRAFT'&&permissions.has('compensation.structure.version.correct')){
    actions.push({label:'Correct future draft',run:input=>onCorrect(selected,input)});
  }

  return <section className="card" aria-labelledby="salary-structure-history-title">
    <div className="section-heading">
      <h3 id="salary-structure-history-title">{selected.code} version timeline</h3>
      <span className={`badge ${selected.approvalStatus.toLowerCase()}`}>{selected.approvalStatus}</span>
    </div>
    {history.length===0
      ?<p role="status">Loading salary-structure version history...</p>
      :<ol className="timeline">{history.map(item=><li key={item.versionId}>
          <strong>Version {item.versionSequence}: {item.name}</strong>
          <span>{item.effectiveFrom} to {item.effectiveTo??'open'}</span>
          <span>{item.superseded?'Superseded':item.approvalStatus}</span>
          <ul>{item.lines.map(line=><li key={line.id}>{lineSummary(line)}</li>)}</ul>
          {item.approvalStatus==='DRAFT'&&permissions.has('compensation.structure.approve')
            &&<button onClick={()=>void onApprove(item)}>Approve</button>}
        </li>)}</ol>}
    {actions.length>0&&<StructureEditor
      key={selected.versionId}
      title="Salary-structure version lifecycle"
      components={components}
      initial={selected}
      actions={actions}/>}
    {permissions.has('compensation.structure.version.end-date')&&<form
      className="form-grid lifecycle-form"
      aria-label="End-date salary-structure version"
      onSubmit={event=>{event.preventDefault();void onEndDate(selected,endDateValue)}}>
      <label>End date<input required type="date" value={endDateValue} onChange={event=>setEndDateValue(event.target.value)}/></label>
      <button type="submit">End-date salary-structure version</button>
    </form>}
  </section>;
}

type EditorProps={
  title:string;
  components:SalaryStructureComponentOption[];
  requireCode?:boolean;
  submitLabel?:string;
  onSubmit?:(input:SalaryStructureWrite)=>Promise<void>;
  initial?:SalaryStructureVersion;
  actions?:{label:string;run:(input:SalaryStructureWrite)=>Promise<void>}[];
};

function StructureEditor({
  title,components,requireCode=false,submitLabel,onSubmit,initial,actions=[]
}:EditorProps){
  const [code,setCode]=useState(initial?.code??'');
  const [name,setName]=useState(initial?.name??'');
  const [from,setFrom]=useState(initial?.effectiveFrom??today());
  const [to,setTo]=useState(initial?.effectiveTo??'');
  const [lines,setLines]=useState<DraftLine[]>(
    initial?.lines.map(toDraftLine)??[emptyLine()]
  );

  const availableComponents=mergeComponents(components,initial?.lines??[]);

  function updateLine(key:string,change:Partial<DraftLine>){
    setLines(current=>current.map(line=>line.key===key?{...line,...change}:line));
  }

  function removeLine(key:string){
    setLines(current=>current.length===1?current:current.filter(line=>line.key!==key));
  }

  function build():SalaryStructureWrite{
    return {
      code:requireCode?code:undefined,
      name,
      currency:'INR',
      effectiveFrom:from,
      effectiveTo:to||undefined,
      lines:lines.map((line,index)=>{
        const result={
          componentVersionId:line.componentVersionId,
          sequenceNo:index+1
        } as SalaryStructureWrite['lines'][number];
        if(line.mode==='FIXED')result.targetAmount=Number(line.value);
        if(line.mode==='PERCENTAGE'){
          result.targetPercentage=Number(line.value);
          result.percentageBaseCode=line.percentageBaseCode;
        }
        return result;
      })
    };
  }

  async function submit(event:FormEvent){
    event.preventDefault();
    if(onSubmit)await onSubmit(build());
  }

  return <form className="card form-grid" onSubmit={event=>void submit(event)}>
    <h3>{title}</h3>
    {requireCode&&<label>Code<input required pattern="[A-Z][A-Z0-9_]{1,39}" value={code} onChange={event=>setCode(event.target.value.toUpperCase())}/></label>}
    <label>Name<input required value={name} onChange={event=>setName(event.target.value)}/></label>
    <label>Currency<input value="INR" readOnly/></label>
    <label>Effective from<input required type="date" value={from} onChange={event=>setFrom(event.target.value)}/></label>
    <label>Effective to<input type="date" value={to} onChange={event=>setTo(event.target.value)}/></label>
    <fieldset>
      <legend>Component lines</legend>
      {lines.map((line,index)=><div className="form-grid lifecycle-form" key={line.key}>
        <label>Line {index+1} component<select
          required
          aria-label={`Line ${index+1} component`}
          value={line.componentVersionId}
          onChange={event=>{
            const option=availableComponents.find(component=>component.versionId===event.target.value);
            updateLine(line.key,{
              componentVersionId:event.target.value,
              componentLabel:option?`${option.code} - ${option.name}`:''
            });
          }}>
          <option value="">Select approved component version</option>
          {availableComponents.map(component=><option key={component.versionId} value={component.versionId}>
            {component.code} - {component.name} ({component.formulaType.toLowerCase().replaceAll('_',' ')})
          </option>)}
        </select></label>
        <label>Line {index+1} target type<select
          aria-label={`Line ${index+1} target type`}
          value={line.mode}
          onChange={event=>updateLine(line.key,{mode:event.target.value as TargetMode,value:'',percentageBaseCode:''})}>
          <option value="FIXED">Fixed amount</option>
          <option value="PERCENTAGE">Percentage of component</option>
          <option value="RESIDUAL">Residual</option>
        </select></label>
        {line.mode!=='RESIDUAL'&&<label>Line {index+1} {line.mode==='FIXED'?'amount':'percentage'}<input
          required
          aria-label={`Line ${index+1} ${line.mode==='FIXED'?'amount':'percentage'}`}
          type="number"
          min={line.mode==='FIXED'?'0':'0.000001'}
          max={line.mode==='PERCENTAGE'?'100':undefined}
          step={line.mode==='FIXED'?'0.0001':'0.000001'}
          value={line.value}
          onChange={event=>updateLine(line.key,{value:event.target.value})}/></label>}
        {line.mode==='PERCENTAGE'&&<label>Line {index+1} base component code<input
          required
          pattern="[A-Z][A-Z0-9_]{1,39}"
          value={line.percentageBaseCode}
          onChange={event=>updateLine(line.key,{percentageBaseCode:event.target.value.toUpperCase()})}/></label>}
        <button type="button" disabled={lines.length===1} onClick={()=>removeLine(line.key)}>Remove line {index+1}</button>
      </div>)}
      <button type="button" onClick={()=>setLines(current=>[...current,emptyLine()])}>Add component line</button>
    </fieldset>
    {submitLabel&&<button type="submit">{submitLabel}</button>}
    {actions.length>0&&<div className="button-row">
      {actions.map(action=><button key={action.label} type="button" onClick={()=>void action.run(build())}>{action.label}</button>)}
    </div>}
  </form>;
}

function toDraftLine(line:SalaryStructureLineView):DraftLine{
  const mode:TargetMode=line.targetAmount!==null?'FIXED':line.targetPercentage!==null?'PERCENTAGE':'RESIDUAL';
  return {
    key:nextKey(),
    componentVersionId:line.componentVersionId,
    componentLabel:`${line.componentCode} - ${line.componentName}`,
    mode,
    value:String(line.targetAmount??line.targetPercentage??''),
    percentageBaseCode:line.percentageBaseCode??''
  };
}

function mergeComponents(
  components:SalaryStructureComponentOption[],
  existing:SalaryStructureLineView[]
){
  const merged=[...components];
  for(const line of existing){
    if(!merged.some(component=>component.versionId===line.componentVersionId)){
      merged.push({
        versionId:line.componentVersionId,
        code:line.componentCode,
        name:line.componentName,
        componentType:line.componentType,
        formulaType:line.componentFormulaType
      });
    }
  }
  return merged;
}