/* Fullhouse · Planificador v0.3 — prototipo local sin servicios externos.
   Interfaz React + TypeScript. Los datos se guardan en este navegador. */
type Page = 'inicio' | 'metas' | 'rutinas' | 'horario' | 'calendario' | 'progreso' | 'ajustes';
type GoalMode = 'numeric' | 'qualitative' | 'milestones';
type GoalStatus = 'pending' | 'working' | 'improving' | 'consolidated' | 'achieved';
type Theme = 'aurora' | 'ocean' | 'sunset' | 'forest' | 'midnight';
type Milestone = { id: string; title: string; done: boolean };
type SelectOption = {value:string; label:string};
type Repeat = 'none' | 'daily' | 'weekdays' | 'weekly';
type Goal = { id: string; title: string; desc: string; parentId: string; color: string; startDate?: string; dueDate?: string; dependsOn?: string; current: number; target: number; unit: string; mode?: GoalMode; status?: GoalStatus; milestones?: Milestone[]; history: { date: string; value: number; note: string; status?: GoalStatus }[] };
type Step = { id: string; title: string; min: number; desc?: string; children?: Step[] };
type Routine = { id: string; title: string; desc: string; steps: Step[] };
type EventItem = { id: string; title: string; date: string; endDate?: string; applyFrom?:string; time: string; minutes: number; goalId: string; routineId: string; repeat: Repeat; note: string; overrides: Record<string, { time?: string; skip?: boolean }> };
type RecordLog = { completed: boolean; checkedSteps: string[]; note?: string };
type Data = { version: number; goals: Goal[]; routines: Routine[]; events: EventItem[]; logs: Record<string, RecordLog> };
type GoalDraft = Omit<Goal,'history'>;
type RoutineDraft = Routine;
type EventDraft = EventItem;
type Modal = 'goal' | 'routine' | 'event' | 'execute' | 'progress' | 'detail' | 'help' | null;
type State = { data: Data; page: Page; selectedDate: string; month: string; modal: Modal; goalDraft: GoalDraft; routineDraft: RoutineDraft; eventDraft: EventDraft; activeEventId: string; detailPath: string[]; progressValue: string; progressNote: string; progressStatus: GoalStatus; progressGoalId: string; toast: string; theme: Theme; modalLayout: 'vertical'|'horizontal'; guideOpen: boolean; guideStep: number; guideGoalId: string; guideEventId: string; helpTopic: string; goalView: 'cards'|'map'; mapGrouping: 'structure'|'time'; colorEditorOpen:boolean; hexDraft:string; draggedStepId:string; dragTargetId:string };

const STORE = 'fullhouse-v01';
const LEGACY_STORE = 'botanica-planificador-v01';
const colorOptions = ['#a26cf4','#ed6dba','#f7a853','#39c8ab','#54a9f4','#ec6c73','#8579e8','#9bc55c','#be81f2','#d8a34c','#ff8e5b','#37b6cc','#ec6f93','#7e95e9','#40b67a','#ce7390','#a85fe0','#738c98'];
const THEME_STORE = 'fullhouse-theme-v02';
const LAYOUT_STORE = 'fullhouse-modal-layout-v02';
const GUIDE_STORE = 'fullhouse-onboarding-v03';
function getPreference(name:string):string{try{return localStorage.getItem(name)||'';}catch{return '';}}
function putPreference(name:string,value:string):void{try{localStorage.setItem(name,value);}catch(err){console.warn('No se pudo guardar preferencia',err);}}
const themeOptions:{id:Theme;name:string;hint:string;colors:string[]}[] = [
  {id:'aurora',name:'Aurora',hint:'Violeta, rosa y destellos cálidos',colors:['#7b59e8','#ec77be','#ffa75c']},
  {id:'ocean',name:'Océano',hint:'Azules luminosos y turquesa',colors:['#196de0','#23c7bd','#82a6fb']},
  {id:'sunset',name:'Atardecer',hint:'Coral, durazno y dorado',colors:['#df586e','#ef9c52','#f5c66d']},
  {id:'forest',name:'Bosque',hint:'Verdes naturales y menta',colors:['#247760','#68c99c','#c5dd84']},
  {id:'midnight',name:'Medianoche',hint:'Azul profundo y violeta',colors:['#343f8f','#8856d5','#dd7cb0']}
];
const goalStatuses:{id:GoalStatus;label:string;desc:string}[]=[
  {id:'pending',label:'Por comenzar',desc:'Aún no he comenzado a trabajarla'},
  {id:'working',label:'En proceso',desc:'Estoy dedicándole tiempo y atención'},
  {id:'improving',label:'Avanzando',desc:'Percibo mejoras y cambios positivos'},
  {id:'consolidated',label:'Consolidando',desc:'He construido una base estable'},
  {id:'achieved',label:'Conseguida',desc:'Alcancé el resultado que buscaba'}
];
const guideSteps=[
  {page:'inicio' as Page,title:'Tu recorrido empieza aquí',text:'Vas a construir un pequeño plan de verdad. Te acompañaré desde una meta hasta tu horario. Puedes salir del tutorial cuando quieras.',action:'Comenzar recorrido'},
  {page:'metas' as Page,title:'1. Elige una meta',text:'Selecciona una de tus metas desde la tarjeta «Elegir para la guía», o crea una nueva. Trabajaremos alrededor de ella.',action:'Seleccionar una meta'},
  {page:'metas' as Page,title:'2. Divide tu objetivo',text:'Añade una submeta real a tu objetivo elegido: una fase, proceso o resultado más concreto. Se guardará como parte de tu plan.',action:'Crear una submeta'},
  {page:'calendario' as Page,title:'3. Señala una fecha de revisión',text:'Programa en tu calendario una revisión de los avances de esta meta. Elige la fecha y hora; guardaremos tu primer hito en la agenda.',action:'Programar revisión'},
  {page:'rutinas' as Page,title:'4. Lleva la meta a tu día',text:'Programa una rutina de ejemplo o una creada por ti. Así verás cómo se transforma en un bloque repetible de tu horario.',action:'Programar una rutina'},
  {page:'horario' as Page,title:'5. Explora el bloque',text:'Ahora abre en el horario la rutina que acabas de programar. Dentro encontrarás cada paso, sus detalles y tiempos.',action:'Abrir mi bloque'},
  {page:'horario' as Page,title:'¡Tu primer plan está conectado!',text:'Ya has recorrido meta → submeta → fecha de revisión → rutina → horario. Puedes seguir explorando y ajustando tu sistema.',action:'Entrar a Fullhouse'}
];
const weekdays = ['L','M','M','J','V','S','D'];
const longDays = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
const months = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
function uid(): string { return Date.now().toString(36) + Math.random().toString(36).slice(2,8); }
function ymd(date: Date): string { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
function parseDay(s: string): Date { const [y,m,d] = s.split('-').map(Number); return new Date(y,m-1,d); }
function addDays(s: string, n: number): string { const d=parseDay(s); d.setDate(d.getDate()+n); return ymd(d); }
function firstMonth(date: string): string { return date.slice(0,7)+'-01'; }
function today(): string { return ymd(new Date()); }
function fmtDate(s: string): string { const d=parseDay(s); return `${longDays[d.getDay()]} ${d.getDate()} de ${months[d.getMonth()]}`; }
function fmtMonth(s: string): string { const d=parseDay(s); return `${months[d.getMonth()]} ${d.getFullYear()}`; }
function asInt(v: string | number, fallback=0): number { const x=Number(v); return Number.isFinite(x)?x:fallback; }
function bound(num:number,a:number,b:number):number {return Math.min(b,Math.max(a,num));}
function minutes(time:string):number {const x=time.split(':').map(Number);return (x[0]||0)*60+(x[1]||0);}
function timeString(m:number):string {m=((m%1440)+1440)%1440;return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');}
function gDraft():GoalDraft {return {id:'',title:'',desc:'',parentId:'',dependsOn:'',startDate:'',dueDate:'',color:colorOptions[0],current:0,target:0,unit:'',mode:'qualitative',status:'pending',milestones:[]};}
function rDraft():RoutineDraft {return {id:'',title:'',desc:'',steps:[{id:uid(),title:'',min:5}]};}
function eDraft(date=today()):EventDraft {return {id:'',title:'',date,time:'08:00',minutes:30,goalId:'',routineId:'',repeat:'none',note:'',overrides:{}};}
function seed():Data {
  const d=today();
  const goal1='g-phys', goal2='g-strength', goal3='g-creative';
  return {version:1,
    goals:[
      {id:goal1,title:'Desarrollo físico',desc:'Construir hábitos sostenibles y mejorar mis capacidades.',parentId:'',color:colorOptions[0],current:0,target:0,unit:'',history:[]},
      {id:goal2,title:'Progreso en fuerza',desc:'Ejemplo de meta medible; cambia las cifras a tus propias referencias.',parentId:goal1,color:colorOptions[1],current:6,target:10,unit:'sesiones',history:[]},
      {id:goal3,title:'Proyectos personales',desc:'Reservar tiempo de concentración y registrar entregables.',parentId:'',color:colorOptions[2],current:0,target:0,unit:'',history:[]}
    ],
    routines:[
      {id:'r-morning',title:'Preparación matutina',desc:'Ejemplo de rutina editable para comenzar el día.',steps:[{id:'s-1',title:'Registrar mi peso',min:2},{id:'s-2',title:'Tender la cama',min:3},{id:'s-3',title:'Preparar mochila y ropa',min:8},{id:'s-4',title:'Baño y aseo personal',min:15}]},
      {id:'r-focus',title:'Bloque de concentración',desc:'Un procedimiento sencillo para trabajar sin distracciones.',steps:[{id:'s-5',title:'Definir el resultado esperado',min:5},{id:'s-6',title:'Trabajar en la tarea principal',min:45},{id:'s-7',title:'Guardar avances y registrar próximos pasos',min:10}]}
    ],
    events:[
      {id:'e-morning',title:'Preparación matutina',date:d,time:'07:00',minutes:28,goalId:goal1,routineId:'r-morning',repeat:'daily',note:'La duración es estimada.',overrides:{}},
      {id:'e-work',title:'Trabajo en proyectos',date:d,time:'09:00',minutes:60,goalId:goal3,routineId:'r-focus',repeat:'weekdays',note:'Priorizar un resultado concreto.',overrides:{}},
      {id:'e-walk',title:'Actividad física',date:d,time:'18:00',minutes:40,goalId:goal1,routineId:'',repeat:'none',note:'Actividad de ejemplo; ajusta a tu plan.',overrides:{}}
    ],logs:{}}
}
function load():Data {
  try {
    const current = localStorage.getItem(STORE);
    if (current) {
      const parsed = JSON.parse(current);
      if (validData(parsed)) return parsed;
    }
    // Migración sin pérdida cuando el prototipo anterior se abrió en el mismo origen.
    const legacy = localStorage.getItem(LEGACY_STORE);
    if (legacy) {
      const parsed = JSON.parse(legacy);
      if (validData(parsed)) {
        localStorage.setItem(STORE, legacy);
        return parsed;
      }
    }
  } catch (err) { console.warn('No se pudo leer el almacenamiento',err); }
  return seed();
}
function validData(v:any):v is Data {return !!v && v.version===1 && Array.isArray(v.goals) && Array.isArray(v.routines) && Array.isArray(v.events) && !!v.logs && typeof v.logs==='object' && !Array.isArray(v.logs);}
function occurs(e:EventItem,date:string):boolean {
  if(date<e.date || (e.endDate && date>e.endDate))return false;
  if(e.overrides&&e.overrides[date]?.skip)return false;
  if(e.repeat==='none')return e.date===date;
  const dw=parseDay(date).getDay(),sw=parseDay(e.date).getDay();
  if(e.repeat==='daily')return true;
  if(e.repeat==='weekdays')return dw>=1&&dw<=5;
  if(e.repeat==='weekly')return dw===sw;
  return false;
}
function eventsOn(data:Data,date:string):EventItem[]{return data.events.filter(e=>occurs(e,date)).sort((a,b)=>(a.overrides?.[date]?.time||a.time).localeCompare(b.overrides?.[date]?.time||b.time));}
function eventTime(e:EventItem,date:string):string {return e.overrides?.[date]?.time||e.time;}

function repeatCollision(a:EventItem,b:EventItem):boolean {
  if(!a.routineId || a.routineId!==b.routineId)return false;
  const start=a.date>b.date?a.date:b.date;
  // La periodicidad máxima es de siete días; 14 días cubren todos los patrones combinados.
  for(let i=0;i<15;i++){const date=addDays(start,i);if(occurs(a,date)&&occurs(b,date))return true;}
  return false;
}
function reorderTree(steps:Step[],from:string,to:string):{steps:Step[];moved:boolean}{
  const a=steps.findIndex(x=>x.id===from),b=steps.findIndex(x=>x.id===to);
  if(a>=0&&b>=0&&a!==b){const next=[...steps];const [item]=next.splice(a,1);next.splice(b,0,item);return {steps:next,moved:true};}
  for(let i=0;i<steps.length;i++)if(steps[i].children){const changed=reorderTree(steps[i].children||[],from,to);if(changed.moved)return {steps:steps.map((s,j)=>i===j?{...s,children:changed.steps}:s),moved:true};}
  return {steps,moved:false};
}
function stepLevelName(level:number):string{return ['Paso','Subpaso','Detalle','Subdetalle'][level]||`Nivel ${level+1}`;}
function nextStepLevelName(level:number):string{return ['subpaso','detalle','subdetalle'][level]||`nivel ${level+2}`;}
function hexToHsl(hex:string):[number,number,number]{
  const c=/^#[0-9a-fA-F]{6}$/.test(hex)?hex:'#a26cf4';const rgb=[1,3,5].map(i=>parseInt(c.slice(i,i+2),16)/255);const max=Math.max(...rgb),min=Math.min(...rgb),d=max-min;let h=0,s=0;const l=(max+min)/2;
  if(d){s=d/(1-Math.abs(2*l-1));switch(max){case rgb[0]:h=((rgb[1]-rgb[2])/d)%6;break;case rgb[1]:h=(rgb[2]-rgb[0])/d+2;break;default:h=(rgb[0]-rgb[1])/d+4;}}return [Math.round((h*60+360)%360),Math.round(s*100),Math.round(l*100)];
}
function hslToHex(h:number,s:number,l:number):string{
  s/=100;l/=100;const a=s*Math.min(l,1-l);const f=(n:number)=>{const k=(n+h/30)%12;return Math.round(255*(l-a*Math.max(-1,Math.min(k-3,9-k,1)))).toString(16).padStart(2,'0');};return '#'+f(0)+f(8)+f(4);
}
function graphLayout(data:Data, grouping:'structure'|'time'):{nodes:{goal:Goal;x:number;y:number}[];edges:{from:string;to:string;kind:string}[];width:number;height:number;labels:{title:string;x:number}[]}{
  const gs=data.goals;const edges:{from:string;to:string;kind:string}[]=[];
  gs.forEach(g=>{if(gs.some(x=>x.id===g.parentId))edges.push({from:g.parentId,to:g.id,kind:'parent'});if(g.dependsOn&&gs.some(x=>x.id===g.dependsOn))edges.push({from:g.dependsOn,to:g.id,kind:'depends'});});
  const columns=new Map<string,Goal[]>();const labels:{title:string;x:number}[]=[];
  if(grouping==='structure'){
    const depth=(g:Goal,seen=new Set<string>()):number=>{if(!g.parentId||seen.has(g.id))return 0;const parent=gs.find(x=>x.id===g.parentId);if(!parent)return 0;seen.add(g.id);return Math.min(5,1+depth(parent,seen));};
    gs.forEach(g=>{const k=String(depth(g));columns.set(k,[...(columns.get(k)||[]),g]);});
    [...columns.keys()].sort((a,b)=>Number(a)-Number(b)).forEach(k=>labels.push({title:Number(k)?`NIVEL ${Number(k)+1}`:'METAS PRINCIPALES',x:25+Number(k)*280}));
  }else{
    const now=today(),soon=addDays(now,30);
    gs.forEach(g=>{const dates=[g.dueDate,...data.events.filter(e=>e.goalId===g.id).map(e=>e.date)].filter(Boolean) as string[];const date=dates.sort()[0];const k=!date?'3':date<now?'0':date<=soon?'1':'2';columns.set(k,[...(columns.get(k)||[]),g]);});
    ['ATRASADAS','PRÓXIMOS 30 DÍAS','MÁS ADELANTE','SIN FECHA'].forEach((title,i)=>labels.push({title,x:25+i*280}));
  }
  const nodes:{goal:Goal;x:number;y:number}[]=[];let largest=1;let last=grouping==='structure'?Math.max(0,...[...columns.keys()].map(Number)):3;
  for(let k=0;k<=last;k++){const goals=columns.get(String(k))||[];largest=Math.max(largest,goals.length);goals.forEach((goal,i)=>nodes.push({goal,x:24+k*280,y:72+i*146}));}
  return {nodes,edges,width:(last+1)*280+40,height:largest*146+108,labels};
}

function key(e:EventItem,date:string):string{return `${e.id}@${date}`;}
function done(data:Data,e:EventItem,date:string):boolean {return !!data.logs[key(e,date)]?.completed;}
function percent(current:number,target:number):number{return target>0?bound(Math.round((current/target)*100),0,100):0;}
function goalMode(g:Goal|GoalDraft):GoalMode{return g.mode||(g.target>0?'numeric':'qualitative');}
function goalStatus(g:Goal|GoalDraft):GoalStatus{return g.status||'pending';}
function statusLabel(s:GoalStatus):string{return goalStatuses.find(x=>x.id===s)?.label||'Por comenzar';}
function goalMilestones(g:Goal|GoalDraft):Milestone[]{return g.milestones||[];}
function stepMinutes(s:Step):number{return s.children&&s.children.length?s.children.reduce((a,c)=>a+stepMinutes(c),0):s.min;}
function routineMinutes(r:Routine):number{return r.steps.reduce((a,s)=>a+stepMinutes(s),0);}
function leafSteps(steps:Step[]):Step[]{return steps.flatMap(s=>s.children&&s.children.length?leafSteps(s.children):[s]);}
function editStepTree(steps:Step[],id:string,fn:(s:Step)=>Step):Step[]{return steps.map(s=>s.id===id?fn(s):{...s,children:s.children?editStepTree(s.children,id,fn):undefined});}
function deleteStepTree(steps:Step[],id:string):Step[]{return steps.filter(s=>s.id!==id).map(s=>({...s,children:s.children?deleteStepTree(s.children,id):undefined}));}
function moveStepTree(steps:Step[],id:string,direction:number):Step[]{const arr=steps.map(s=>({...s,children:s.children?moveStepTree(s.children,id,direction):undefined}));const i=arr.findIndex(s=>s.id===id);const j=i+direction;if(i>=0&&j>=0&&j<arr.length){[arr[i],arr[j]]=[arr[j],arr[i]];}return arr;}
function getStepByPath(steps:Step[],path:string[]):Step|undefined{let list=steps,last:Step|undefined;for(const id of path){last=list.find(s=>s.id===id);if(!last)return undefined;list=last.children||[];}return last;}
function fitArea(el:HTMLTextAreaElement|null):void{if(!el)return;el.style.height='auto';el.style.height=Math.max(86,el.scrollHeight+2)+'px';}
function AutoTextarea(props:any):any{const {onChange,...others}=props;return <textarea {...others} ref={(node:any)=>fitArea(node)} onChange={(e:any)=>{onChange(e);fitArea(e.currentTarget)}}/>;}
class FriendlySelect extends React.Component<{value:string;options:SelectOption[];onChange:(value:string)=>void;ariaLabel?:string},{open:boolean;index:number;style:any}>{
 root:HTMLElement|null=null;menuEl:HTMLElement|null=null;
 constructor(props:any){super(props);this.state={open:false,index:0,style:{}};}
 componentDidMount(){document.addEventListener('pointerdown',this.outside);window.addEventListener('resize',this.reposition);document.addEventListener('scroll',this.reposition,true);}
 componentWillUnmount(){document.removeEventListener('pointerdown',this.outside);window.removeEventListener('resize',this.reposition);document.removeEventListener('scroll',this.reposition,true);}
 outside=(e:any)=>{if(this.root&&!this.root.contains(e.target)&&!(this.menuEl&&this.menuEl.contains(e.target))&&this.state.open)this.setState({open:false});};
 reposition=()=>{if(!this.root||!this.state.open)return;this.setState({style:this.getPosition()});};
 getPosition=():any=>{const rect=this.root?.getBoundingClientRect();if(!rect)return {};const available=window.innerHeight-rect.bottom-12,above=rect.top-12;const up=available<195&&above>available;const h=Math.min(280,Math.max(115,up?above:available));return {left:rect.left,top:up?Math.max(8,rect.top-h-6):rect.bottom+6,width:rect.width,maxHeight:h};};
 show=()=>this.setState({open:true,index:Math.max(0,this.props.options.findIndex(x=>x.value===this.props.value)),style:this.getPosition()});
 keydown=(e:any)=>{if(e.key==='Escape'){this.setState({open:false});return;}if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();const current=this.state.open?this.state.index:Math.max(0,this.props.options.findIndex(x=>x.value===this.props.value));this.setState({open:true,index:bound(current+(e.key==='ArrowDown'?1:-1),0,this.props.options.length-1),style:this.getPosition()});}if(e.key==='Enter'&&this.state.open){e.preventDefault();const opt=this.props.options[this.state.index];if(opt){this.props.onChange(opt.value);this.setState({open:false});}}};
 render():any{const choice=this.props.options.find(x=>x.value===this.props.value);const popup=this.state.open?<div className='friendly-menu friendly-portal' style={this.state.style} ref={(node:any)=>this.menuEl=node} role='listbox' aria-label={this.props.ariaLabel||'Opciones disponibles'}>{this.props.options.map((o,i)=><button type='button' key={o.value} role='option' aria-selected={o.value===this.props.value} className={'friendly-option '+(i===this.state.index?'focused ':'')+(o.value===this.props.value?'selected':'')} onMouseEnter={()=>this.setState({index:i})} onClick={()=>{this.props.onChange(o.value);this.setState({open:false})}}><span>{o.label}</span>{o.value===this.props.value&&<Icon name='check' size={15}/>}</button>)}</div>:null;return <div className={'friendly-select '+(this.state.open?'is-open':'')} ref={(e:any)=>this.root=e} onKeyDown={this.keydown}><button type='button' className='friendly-trigger' aria-haspopup='listbox' aria-expanded={this.state.open} aria-label={this.props.ariaLabel||'Seleccionar opción'} onClick={()=>this.state.open?this.setState({open:false}):this.show()}><span>{choice?.label||'Selecciona una opción'}</span><span className='select-caret'>⌄</span></button>{popup&&ReactDOM.createPortal(popup,document.querySelector('.app-shell')||document.body)}</div>;}}
function TimePicker({value,onChange}:{value:string;onChange:(x:string)=>void}):any{
 const [hour,minute]=(value||'08:00').split(':');
 const hours=Array.from({length:24},(_,i)=>String(i).padStart(2,'0')).map(v=>({value:v,label:v+' h'}));
 const mins=Array.from({length:60},(_,i)=>String(i).padStart(2,'0')).map(v=>({value:v,label:v+' min'}));
 return <div className='time-picker'><span className='time-icon'><Icon name='clock' size={18}/></span><FriendlySelect value={hour} ariaLabel='Seleccionar hora' options={hours} onChange={h=>onChange(h+':'+(minute||'00'))}/><span className='time-colon'>:</span><FriendlySelect value={minute} ariaLabel='Seleccionar minuto' options={mins} onChange={m=>onChange((hour||'08')+':'+m)}/></div>;
}
function Icon({name,size=19}:{name:string;size?:number}){return <span className="icon" style={{display:'inline-flex',alignItems:'center',justifyContent:'center'}}><svg style={{width:size,height:size,fill:'none',stroke:'currentColor',strokeWidth:1.8,strokeLinecap:'round',strokeLinejoin:'round'}}><use href={'#i-'+name}/></svg></span>}
function Btn({children,onClick,kind='',tiny=false,disabled=false,type='button',title}:{children?:any;onClick?:()=>void;kind?:string;tiny?:boolean;disabled?:boolean;type?:'button'|'submit';title?:string}){return <button className={`btn ${kind} ${tiny?'tiny':''}`} onClick={onClick} type={type} disabled={disabled} title={title}>{children}</button>}
class Planner extends React.Component<{},State> {
  constructor(props:{}){
    super(props);
    const d=today();
    this.state={data:load(),page:'inicio',selectedDate:d,month:firstMonth(d),modal:null,goalDraft:gDraft(),routineDraft:rDraft(),eventDraft:eDraft(d),activeEventId:'',detailPath:[],progressValue:'',progressNote:'',progressStatus:'pending',progressGoalId:'',toast:'',theme:(themeOptions.some(x=>x.id===getPreference(THEME_STORE))?getPreference(THEME_STORE):'aurora') as Theme,modalLayout:getPreference(LAYOUT_STORE)==='horizontal'?'horizontal':'vertical',guideOpen:getPreference(GUIDE_STORE)!=='yes',guideStep:0,guideGoalId:'',guideEventId:'',helpTopic:'',goalView:'cards',mapGrouping:'structure',colorEditorOpen:false,hexDraft:colorOptions[0],draggedStepId:'',dragTargetId:''};
  }
  componentDidMount():void{this.syncModalState();document.addEventListener('keydown',this.globalKeydown);this.resizeTextareas();}
  componentDidUpdate():void{this.syncModalState();this.resizeTextareas();}
  componentWillUnmount():void{document.body.style.overflow='';document.removeEventListener('keydown',this.globalKeydown);document.removeEventListener('mousemove',this.moveStepDrag,true);document.removeEventListener('mouseup',this.endStepDrag,true);}
  globalKeydown=(e:KeyboardEvent):void=>{if(e.key==='Escape'){if(this.state.modal)this.close();else if(this.state.guideOpen)this.finishGuide();}};
  syncModalState=():void=>{document.body.style.overflow=this.state.modal||(this.state.guideOpen&&this.state.guideStep===0)?'hidden':'';};
  resizeTextareas=():void=>{document.querySelectorAll<HTMLTextAreaElement>('.modal-body textarea').forEach(fitArea);};
  setTheme=(theme:Theme):void=>{putPreference(THEME_STORE,theme);this.setState({theme});};
  setLayout=(layout:'vertical'|'horizontal'):void=>{putPreference(LAYOUT_STORE,layout);this.setState({modalLayout:layout});};
  finishGuide=():void=>{putPreference(GUIDE_STORE,'yes');this.setState({guideOpen:false});};
  openGuide=():void=>this.setState({modal:null,guideOpen:true,guideStep:0,page:'inicio',guideGoalId:'',guideEventId:''});
  openHelp=(topic:string):void=>this.setState({modal:'help',helpTopic:topic});
  openDetail=(e:EventItem):void=>this.setState({modal:'detail',activeEventId:e.id,detailPath:[],...(this.state.guideOpen&&this.state.guideStep===5&&e.id===this.state.guideEventId?{guideStep:6}:{})});
  save = (data:Data,message='Cambios guardados'):void=>{
    try{localStorage.setItem(STORE,JSON.stringify(data));this.setState({data,toast:message});}catch(err){this.setState({data,toast:'No se pudo guardar: almacenamiento lleno o bloqueado. Exporta una copia.'});}
  }
  route=(page:Page):void=>{if(this.state.guideOpen&&this.state.guideStep>0&&this.state.guideStep<6&&page!==guideSteps[this.state.guideStep].page){this.setState({toast:'Completa este paso de la guía o selecciona «Saltar tutorial».',page:guideSteps[this.state.guideStep].page});return;}this.setState({page,modal:null});window.scrollTo(0,0)};
  chooseDay=(s:string):void=>this.setState({selectedDate:s,month:firstMonth(s)});
  openGoal=(goal?:Goal,parentId=''):void=>this.setState({modal:'goal',colorEditorOpen:false,hexDraft:goal?.color||colorOptions[0],goalDraft:goal?{id:goal.id,title:goal.title,desc:goal.desc,parentId:goal.parentId,dependsOn:goal.dependsOn||'',startDate:goal.startDate||'',dueDate:goal.dueDate||'',color:goal.color,current:goal.current,target:goal.target,unit:goal.unit,mode:goalMode(goal),status:goalStatus(goal),milestones:goalMilestones(goal).map(x=>({...x}))}:{...gDraft(),parentId}});
  openRoutine=(r?:Routine):void=>this.setState({modal:'routine',routineDraft:r?JSON.parse(JSON.stringify(r)):rDraft()});
  openEvent=(e?:EventItem):void=>this.setState({modal:'event',eventDraft:e?JSON.parse(JSON.stringify(e)):eDraft(this.state.selectedDate)});
  openProgress=(g:Goal):void=>this.setState({modal:'progress',progressGoalId:g.id,progressValue:String(g.current),progressStatus:goalStatus(g),progressNote:''});
  openExecute=(e:EventItem):void=>this.setState({modal:'execute',activeEventId:e.id});
  close=():void=>this.setState({modal:null,detailPath:[]});
  updateGoalDraft=(patch:Partial<GoalDraft>):void=>this.setState({goalDraft:{...this.state.goalDraft,...patch}});
  updateRoutineDraft=(patch:Partial<RoutineDraft>):void=>this.setState({routineDraft:{...this.state.routineDraft,...patch}});
  updateEventDraft=(patch:Partial<EventDraft>):void=>this.setState({eventDraft:{...this.state.eventDraft,...patch}});
  saveGoal=():void=>{
    const x=this.state.goalDraft;if(!x.title.trim()){this.setState({toast:'Escribe un nombre para la meta'});return;}
    if(x.id && (x.parentId===x.id||x.dependsOn===x.id)){this.setState({toast:'Una meta no puede depender de sí misma'});return;}
    if(x.startDate&&x.dueDate&&x.dueDate<x.startDate){this.setState({toast:'La fecha objetivo debe ser posterior al inicio.'});return;}
    const data=this.state.data;const before=data.goals.find(g=>g.id===x.id);
    const next:Goal={...x,id:x.id||uid(),title:x.title.trim(),target:Math.max(0,x.target),current:Math.max(0,x.current),mode:goalMode(x),status:goalStatus(x),milestones:goalMilestones(x).filter(m=>m.title.trim()).map(m=>({...m,title:m.title.trim()})),history:before?.history||[]};
    this.save({...data,goals:before?data.goals.map(g=>g.id===x.id?next:g):[...data.goals,next]});this.close();if(this.state.guideOpen){if(this.state.guideStep===1&&!x.id)this.selectGuideGoal(next.id);else if(this.state.guideStep===2&&!x.id&&x.parentId===this.state.guideGoalId)this.setState({guideStep:3,page:'calendario',modal:null});}
  }
  saveRoutine=():void=>{
    const x=this.state.routineDraft;if(!x.title.trim()){this.setState({toast:'Escribe un nombre para la rutina'});return;}
    if((function invalid(steps:Step[]):boolean{return steps.some(s=>!s.title.trim()||(s.children&&invalid(s.children)))})(x.steps)){this.setState({toast:'Todos los pasos necesitan un nombre'});return;}
    const data=this.state.data;const clean=(steps:Step[]):Step[]=>steps.map(s=>{const children=s.children?clean(s.children):undefined;return {...s,title:s.title.trim(),children,min:children&&children.length?children.reduce((a,c)=>a+stepMinutes(c),0):Math.max(1,s.min)};});const result:Routine={...x,id:x.id||uid(),title:x.title.trim(),steps:clean(x.steps)};
    this.save({...data,routines:x.id?data.routines.map(r=>r.id===x.id?result:r):[...data.routines,result],events:data.events.map(e=>e.routineId===result.id?{...e,minutes:routineMinutes(result)}:e)});this.close();
  }
  saveEvent=():void=>{
    const x=this.state.eventDraft;if(!x.title.trim()||!x.date||!x.time){this.setState({toast:'Completa el título, la fecha y la hora'});return;}
    const data=this.state.data;const result:EventItem={...x,id:x.id||uid(),title:x.title.trim(),minutes:Math.max(1,x.minutes),overrides:x.overrides||{}};
    const original=data.events.find(e=>e.id===x.id);const split=!!original&&original.repeat!=='none'&&!!x.applyFrom&&x.applyFrom>original.date;
    const future=split?{...result,id:uid(),date:x.applyFrom||result.date,overrides:Object.fromEntries(Object.entries(result.overrides||{}).filter(([d])=>d>=(x.applyFrom||result.date))),endDate:original?.endDate}:result;
    if(split&&original?.endDate&&future.date>original.endDate){this.setState({toast:'La fecha elegida está fuera de la programación original.'});return;}
    if(future.routineId&&data.events.some(other=>other.id!==result.id&&repeatCollision(future,other))){this.setState({toast:'Esta rutina ya aparece en alguno de esos días. Edita su programación existente en vez de duplicarla.'});return;}
    if(split&&original){const cut=addDays(future.date,-1);const old={...original,endDate:cut,overrides:Object.fromEntries(Object.entries(original.overrides||{}).filter(([d])=>d<future.date))};const logs={...data.logs};Object.keys(logs).filter(k=>k.startsWith(original.id+'@')&&k.split('@')[1]>=future.date).forEach(k=>{logs[future.id+'@'+k.split('@')[1]]=logs[k];delete logs[k];});const next={...future,applyFrom:undefined};this.save({...data,events:[...data.events.map(e=>e.id===old.id?old:e),next],logs},'Nuevo horario aplicado desde '+future.date);}
    else{const next={...result,applyFrom:undefined};this.save({...data,events:x.id?data.events.map(e=>e.id===x.id?next:e):[...data.events,next]});}
    this.close();
    if(this.state.guideOpen){if(this.state.guideStep===3&&result.goalId===this.state.guideGoalId)this.setState({guideStep:4,page:'rutinas'});else if(this.state.guideStep===4&&result.routineId){this.setState({guideStep:5,page:'horario',selectedDate:result.date,month:firstMonth(result.date),guideEventId:result.id});}}
  }
  deleteGoal=(g:Goal):void=>{
    if(!confirm(`¿Eliminar la meta «${g.title}»? Las sub-metas pasarán a ser independientes.`))return;
    const d=this.state.data;this.save({...d,goals:d.goals.filter(x=>x.id!==g.id).map(x=>x.parentId===g.id?{...x,parentId:''}:x),events:d.events.map(e=>e.goalId===g.id?{...e,goalId:''}:e)});
  }
  deleteRoutine=(r:Routine):void=>{
    if(!confirm(`¿Eliminar «${r.title}»? Las actividades programadas conservarán su nombre, pero perderán sus pasos.`))return;
    const d=this.state.data;this.save({...d,routines:d.routines.filter(x=>x.id!==r.id),events:d.events.map(e=>e.routineId===r.id?{...e,routineId:''}:e)});
  }
  deleteEvent=(e:EventItem):void=>{
    if(!confirm(e.repeat==='none'?'¿Eliminar esta actividad?':'¿Eliminar esta actividad recurrente y todas sus próximas apariciones?'))return;
    const d=this.state.data;const logs={...d.logs};Object.keys(logs).filter(k=>k.startsWith(e.id+'@')).forEach(k=>delete logs[k]);
    this.save({...d,events:d.events.filter(x=>x.id!==e.id),logs});this.close();
  }
  toggleEvent=(e:EventItem,date:string):void=>{
    const d=this.state.data,k=key(e,date),r=d.logs[k]||{completed:false,checkedSteps:[]};this.save({...d,logs:{...d.logs,[k]:{...r,completed:!r.completed}}},'Actividad actualizada');
  }
  toggleStep=(e:EventItem,date:string,stepId:string):void=>{
    const d=this.state.data,k=key(e,date),r=d.logs[k]||{completed:false,checkedSteps:[]};const routine=d.routines.find(x=>x.id===e.routineId);
    const checked=r.checkedSteps.includes(stepId)?r.checkedSteps.filter(s=>s!==stepId):[...r.checkedSteps,stepId];
    const leaves=routine?leafSteps(routine.steps):[];const completed=leaves.length>0&&leaves.every(s=>checked.includes(s.id));
    this.save({...d,logs:{...d.logs,[k]:{...r,checkedSteps:checked,completed}}},'Paso actualizado');
  }
  shiftEvent=(e:EventItem,date:string,delta:number):void=>{
    const d=this.state.data;const newTime=timeString(bound(minutes(eventTime(e,date))+delta,0,1439));const next={...e,overrides:{...e.overrides,[date]:{...e.overrides[date],time:newTime}}};
    this.save({...d,events:d.events.map(x=>x.id===e.id?next:x)},`Actividad movida a las ${newTime}`);
  }
  saveProgress=():void=>{
    const d=this.state.data,g=d.goals.find(x=>x.id===this.state.progressGoalId);if(!g)return;
    const mode=goalMode(g),val=mode==='numeric'?Number(this.state.progressValue):g.current;if(mode==='numeric'&&(!Number.isFinite(val)||val<0)){this.setState({toast:'Registra un valor válido mayor o igual a cero'});return;}
    const next={...g,current:val,status:mode==='qualitative'?this.state.progressStatus:goalStatus(g),history:[...g.history,{date:today(),value:val,note:this.state.progressNote.trim(),status:mode==='qualitative'?this.state.progressStatus:undefined}]};
    this.save({...d,goals:d.goals.map(x=>x.id===g.id?next:x)},'Avance registrado');this.close();
  }
  toggleMilestone=(goalId:string,milestoneId:string):void=>{const d=this.state.data;const g=d.goals.find(x=>x.id===goalId);if(!g)return;const ms=goalMilestones(g).map(m=>m.id===milestoneId?{...m,done:!m.done}:m);const n=ms.filter(m=>m.done).length;const next={...g,milestones:ms,current:n,target:ms.length,history:[...g.history,{date:today(),value:n,note:'Hito actualizado'}]};this.save({...d,goals:d.goals.map(x=>x.id===goalId?next:x)},'Hito actualizado');};
  exportData=():void=>{
    const blob=new Blob([JSON.stringify(this.state.data,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download=`fullhouse-respaldo-${today()}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
    this.setState({toast:'Respaldo descargado. Guárdalo en un lugar seguro.'});
  }
  importData=(ev:any):void=>{
    const f:File|undefined=ev.target.files?.[0];if(!f)return;
    if(!confirm('¿Restaurar este respaldo? Sustituirá todos los datos actuales en este navegador.')){ev.target.value='';return;}
    const reader=new FileReader();reader.onload=()=>{
      try{const d=JSON.parse(String(reader.result));if(!validData(d))throw Error('Formato incompatible');
        this.save(d,'Respaldo restaurado');this.setState({page:'inicio',modal:null});
      }catch(err){this.setState({toast:'Archivo inválido o incompatible. No se modificó la información.'});}
    };reader.readAsText(f);ev.target.value='';
  }
  reset=():void=>{
    if(!confirm('¿Volver a los ejemplos iniciales? Se perderán los datos actuales. Exporta un respaldo antes de continuar.'))return;
    this.save(seed(),'Ejemplos restablecidos');this.setState({page:'inicio',selectedDate:today(),month:firstMonth(today())});
  }
  childrenOf=(id:string):Goal[]=>this.state.data.goals.filter(g=>g.parentId===id);
  descendants=(id:string):string[]=>{
    const all:string[]=[];const go=(x:string)=>this.state.data.goals.filter(g=>g.parentId===x).forEach(g=>{if(!all.includes(g.id)){all.push(g.id);go(g.id)}});go(id);return all;
  }
  selectGuideGoal=(id:string):void=>{if(this.state.guideOpen&&this.state.guideStep===1)this.setState({guideGoalId:id,guideStep:2,page:'metas'});};
  guideAction=():void=>{
    const step=this.state.guideStep,goal=this.state.data.goals.find(g=>g.id===this.state.guideGoalId);
    if(step===0){this.setState({guideStep:1,page:'metas'});return;}
    if(step===1){this.setState({page:'metas',toast:'Selecciona «Elegir para la guía» en una meta, o crea una nueva.'});return;}
    if(step===2){this.openGoal(undefined,this.state.guideGoalId);return;}
    if(step===3){this.setState({page:'calendario',modal:'event',eventDraft:{...eDraft(addDays(today(),7)),title:'Revisión de avance: '+(goal?.title||'mi meta'),goalId:this.state.guideGoalId,time:'19:00',minutes:30}});return;}
    if(step===4){const r=this.state.data.routines[0];if(!r){this.openRoutine();this.setState({toast:'Crea una rutina antes de programarla.'});return;}this.useRoutineForGuide(r);return;}
    if(step===5){this.setState({page:'horario',selectedDate:this.state.data.events.find(e=>e.id===this.state.guideEventId)?.date||today(),modal:null});return;}
    this.finishGuide();
  };
  useRoutineForGuide=(r:Routine):void=>{
    const existing=this.state.data.events.find(e=>e.routineId===r.id&&occurs(e,today()));
    if(existing){this.setState({guideEventId:existing.id,guideStep:5,page:'horario',selectedDate:today(),month:firstMonth(today()),modal:null,toast:'Esta rutina ya estaba programada. Ábrela en el horario.'});return;}
    this.setState({modal:'event',eventDraft:{...eDraft(today()),title:r.title,goalId:this.state.guideGoalId,routineId:r.id,minutes:routineMinutes(r),repeat:'daily',time:'08:00'}});
  };
  startStepDrag=(id:string,e:any):void=>{e.preventDefault();document.addEventListener('mousemove',this.moveStepDrag,true);document.addEventListener('mouseup',this.endStepDrag,true);document.addEventListener('touchmove',this.moveStepDrag,{capture:true,passive:false});document.addEventListener('touchend',this.endStepDrag,true);this.setState({draggedStepId:id,dragTargetId:id});};
  moveStepDrag=(e:any):void=>{if(!this.state.draggedStepId)return;const point=e.touches?.[0]||e.changedTouches?.[0]||e;const t=document.elementFromPoint(point.clientX,point.clientY)?.closest('[data-step-id]') as HTMLElement|null;if(t?.dataset.stepId&&t.dataset.stepId!==this.state.dragTargetId)this.setState({dragTargetId:t.dataset.stepId});};
  endStepDrag=():void=>{document.removeEventListener('mousemove',this.moveStepDrag,true);document.removeEventListener('mouseup',this.endStepDrag,true);document.removeEventListener('touchmove',this.moveStepDrag,true);document.removeEventListener('touchend',this.endStepDrag,true);const {draggedStepId,dragTargetId}=this.state;if(draggedStepId&&dragTargetId&&draggedStepId!==dragTargetId){const r=reorderTree(this.state.routineDraft.steps,draggedStepId,dragTargetId);if(r.moved)this.updateRoutineDraft({steps:r.steps});}this.setState({draggedStepId:'',dragTargetId:''});};
  moveStepDragKeyboard=(id:string,delta:number):void=>this.updateRoutineDraft({steps:moveStepTree(this.state.routineDraft.steps,id,delta)});
  renderSidebar():any{
    const links:{id:Page;label:string;icon:string}[]=[{id:'inicio',label:'Inicio',icon:'home'},{id:'metas',label:'Mis metas',icon:'target'},{id:'rutinas',label:'Rutinas',icon:'checklist'},{id:'horario',label:'Horario',icon:'clock'},{id:'calendario',label:'Calendario',icon:'calendar'},{id:'progreso',label:'Progreso',icon:'chart'},{id:'ajustes',label:'Respaldo y ajustes',icon:'settings'}];
    return <>
      <aside className="sidebar">
        <div className="brand"><img className="brand-logo" src="logo.svg" alt="Logo Fullhouse"/><div><div className="brand-name">FULLHOUSE</div><div className="brand-sub">Tu espacio, completo</div></div></div>
        <div className="side-section">Mi espacio</div>
        <nav>{links.map(l=><button key={l.id} className={`nav-item ${this.state.page===l.id?'active':''}`} onClick={()=>this.route(l.id)}><Icon name={l.icon}/>{l.label}</button>)}</nav>
        <div className="sidebar-bottom"><button className="nav-item nav-help" onClick={this.openGuide}><Icon name="help"/> Guía paso a paso</button><div className="profile-mini"><div className="avatar">✦</div><div><div className="profile-name">Mi espacio privado</div><div className="profile-meta">Fullhouse · 0.3</div></div></div><small>Organiza · Actúa · Progresa. Los datos se guardan en este navegador.</small></div>
      </aside>
      <nav className="mobile-nav" aria-label="Navegación móvil">{links.filter(l=>l.id!=='ajustes'&&l.id!=='calendario').map(l=><button key={l.id} className={`mobile-item ${this.state.page===l.id?'active':''}`} onClick={()=>this.route(l.id)}><Icon name={l.icon}/>{l.label.replace('Mis ','')}</button>)}</nav>
    </>;
  }
  renderHeading(title:string,description:string, action?:any):any{return <div className="heading-row"><div><div className="eyebrow">FULLHOUSE / {this.state.page.toUpperCase()}</div><h1 className="page-title">{title} {this.hint(this.state.page)}</h1><p className="lead">{description}</p></div>{action}</div>}
  hint=(topic:string):any=><button type="button" className="hint-btn" title="¿Cómo funciona esta sección?" aria-label={'Ayuda de '+topic} onClick={()=>this.openHelp(topic)}>?</button>;
  renderStat(label:string,value:string|number,note:string,icon:string):any{return <div className="stat-card"><div className="stat-top"><span className="stat-icon"><Icon name={icon}/></span><span className="stat-deco">FULLHOUSE</span></div><div className="stat-label">{label}</div><div className="stat-value">{value}</div><div className="stat-note">{note}</div></div>}
  renderTodayList(date:string,compact=false):any{
    const d=this.state.data,es=eventsOn(d,date);
    if(!es.length)return <div className="empty"><Icon name="calendar"/><strong>Un día por diseñar</strong><p>No hay actividades programadas todavía. Comienza agregando una.</p><Btn tiny kind="secondary" onClick={()=>this.openEvent()}><Icon name="plus" size={14}/> Nueva actividad</Btn></div>;
    return <div>{es.map(e=>{
      const isDone=done(d,e,date),routine=d.routines.find(r=>r.id===e.routineId),log=d.logs[key(e,date)];
      return compact?<div key={e.id} className={`agenda-item ${isDone?'is-done':''}`}><div className="agenda-time">{eventTime(e,date)}</div><div className="agenda-main"><div className="agenda-name">{e.title}</div><div className="agenda-sub">{e.minutes} min {routine?'· '+routine.steps.length+' pasos':''}</div></div><button className={`check-circle ${isDone?'checked':''}`} onClick={()=>this.toggleEvent(e,date)} aria-label={isDone?'Marcar pendiente':'Marcar completado'}>{isDone&&<Icon name="check" size={13}/>}</button></div>
      :<div key={e.id} className={`schedule-line ${isDone?'is-done':''}`}><div className="schedule-time">{eventTime(e,date)}</div><div className="schedule-body"><div className="schedule-name">{e.title}</div><div className="schedule-meta"><span>{e.minutes} min</span>{e.repeat!=='none'&&<span>↻ Recurrente</span>}{routine&&<span>{routine.steps.length} pasos</span>}</div>{e.note&&<div className="schedule-notes">{e.note}</div>}<div className="actions" style={{marginTop:9}}>{routine&&<Btn tiny kind="secondary" onClick={()=>this.openExecute(e)}>Abrir pasos</Btn>}<Btn tiny kind="ghost" title="Mover 15 minutos antes (solo este día)" onClick={()=>this.shiftEvent(e,date,-15)}>−15 min</Btn><Btn tiny kind="ghost" title="Mover 15 minutos después (solo este día)" onClick={()=>this.shiftEvent(e,date,15)}>+15 min</Btn></div></div><div className="mini-actions"><button className={`check-circle ${isDone?'checked':''}`} onClick={()=>this.toggleEvent(e,date)} aria-label={isDone?'Marcar pendiente':'Marcar completado'}>{isDone&&<Icon name="check" size={13}/>}</button><Btn tiny kind="ghost" onClick={()=>this.openEvent(e)} title="Editar actividad"><Icon name="edit" size={14}/></Btn></div></div>
    })}</div>;
  }
  renderHome():any{
    const d=this.state.data,date=this.state.selectedDate,es=eventsOn(d,date),n=es.filter(e=>done(d,e,date)).length;
    const tracked=d.goals,rate=es.length?Math.round(n/es.length*100):0;
    return <><section className="home-hero"><div className="hero-copy"><div className="hero-kicker">✦ TU ESPACIO PERSONAL</div><h2>Tu día, todas tus posibilidades.</h2><p>Transforma tus metas en acciones concretas y observa cómo avanzas, paso a paso.</p><div className="hero-actions"><Btn onClick={()=>this.route('horario')}><Icon name="clock"/> Abrir mi horario</Btn><Btn kind="secondary" onClick={this.openGuide}><Icon name="help"/> Conocer Fullhouse</Btn></div></div><div className="hero-symbol"><img src="logo.svg" alt=""/></div></section>{this.renderHeading('Tu espacio para avanzar','Una vista clara de lo que quieres conseguir, lo que harás hoy y lo que realmente has hecho.',<Btn onClick={()=>this.openEvent()}><Icon name="plus" size={16}/> Nueva actividad</Btn>)}
      <div className="notice">Este es un prototipo funcional con datos de ejemplo. Puedes editarlo todo. Los cambios se guardan automáticamente en este navegador.</div>
      <div className="cards">{this.renderStat('Metas activas',d.goals.length,'Incluye sub-metas','target')}{this.renderStat('Rutinas creadas',d.routines.length,'Procedimientos reutilizables','checklist')}{this.renderStat('Actividades del día',es.length,`${n} completadas`,'calendar')}{this.renderStat('Cumplimiento diario',rate+'%','De actividades planificadas','chart')}</div>
      <div className="two-col"><section className="panel"><div className="panel-head"><div><h2>Agenda del día</h2><p className="panel-sub">{fmtDate(date)}</p></div><button className="link-btn" onClick={()=>this.route('horario')}>Ver horario <Icon name="arrow-right" size={15}/></button></div>{this.renderTodayList(date,true)}</section>
        <section className="panel"><div className="panel-head"><div><h2>Mis metas</h2><p className="panel-sub">Indicadores de resultados, no solo tareas</p></div><button className="link-btn" onClick={()=>this.route('metas')}>Ver todas <Icon name="arrow-right" size={15}/></button></div>
        {tracked.length?tracked.slice(0,5).map(g=><div key={g.id} className="goal-summary"><div className="goal-summary-top"><strong>{g.title}</strong><span>{goalMode(g)==='numeric'?percent(g.current,g.target)+'%':goalMode(g)==='milestones'?goalMilestones(g).filter(m=>m.done).length+'/'+goalMilestones(g).length+' hitos':statusLabel(goalStatus(g))}</span></div>{goalMode(g)!=='qualitative'?<div className="progress-track"><div className="progress-fill" style={{width:(goalMode(g)==='milestones'?percent(goalMilestones(g).filter(m=>m.done).length,goalMilestones(g).length):percent(g.current,g.target))+'%',background:g.color}}/></div>:<p className="caption">Meta cualitativa · registra cambios en tu relación o bienestar</p>}</div>):<div className="empty"><strong>Aún no tienes metas</strong><p>Comienza con un objetivo que sea importante para ti.</p></div>}
        </section></div>
      <div className="section-head"><h2 className="section-title">Acceso rápido</h2></div><div className="goal-grid"><button className="goal-card" style={{textAlign:'left',cursor:'pointer'}} onClick={()=>this.openGoal()}><div className="row"><span className="routine-badge"><Icon name="target"/></span><div><div className="goal-name">Nueva meta</div><div className="goal-desc">Desglosa un objetivo y define cómo medirlo.</div></div></div><span className="link-btn">Crear meta <Icon name="arrow-right" size={14}/></span></button><button className="goal-card" style={{textAlign:'left',cursor:'pointer'}} onClick={()=>this.openRoutine()}><div className="row"><span className="routine-badge"><Icon name="checklist"/></span><div><div className="goal-name">Nueva rutina</div><div className="goal-desc">Diseña los pasos de un procedimiento.</div></div></div><span className="link-btn">Crear rutina <Icon name="arrow-right" size={14}/></span></button></div>
    </>;
  }
  renderGoalCard(g:Goal,depth=0):any{
    const d=this.state.data,children=d.goals.filter(x=>x.parentId===g.id),linked=d.events.filter(e=>e.goalId===g.id).length,mode=goalMode(g),ms=goalMilestones(g),doneCount=ms.filter(m=>m.done).length;
    return <div className="goal-card" key={g.id} style={{borderLeft:`5px solid ${g.color}`}}><div className="goal-card-title"><div className="goal-color" style={{background:g.color}}/><div className="flex"><div className="goal-level">{depth?'SUB-META · NIVEL '+(depth+1):'META PRINCIPAL'} · {mode==='numeric'?'NUMÉRICA':mode==='milestones'?'POR HITOS':'CUALITATIVA'}</div><h3 className="goal-name">{g.title}</h3><p className="goal-desc">{g.desc||'Sin descripción'}</p></div></div>
      {mode==='numeric'?<div><div className="goal-summary-top"><strong>{g.current} / {g.target} {g.unit}</strong><span>{percent(g.current,g.target)}%</span></div><div className="progress-track"><div className="progress-fill" style={{background:g.color,width:`${percent(g.current,g.target)}%`}}/></div></div>:mode==='milestones'?<div><div className="goal-summary-top"><strong>{doneCount} de {ms.length} hitos completados</strong><span>{ms.length?percent(doneCount,ms.length)+'%':'Sin hitos'}</span></div><div className="progress-track"><div className="progress-fill" style={{background:g.color,width:`${percent(doneCount,ms.length)}%`}}/></div><div className="milestone-list">{ms.map(m=><button key={m.id} className={'milestone-item '+(m.done?'is-complete':'')} onClick={()=>this.toggleMilestone(g.id,m.id)}><span className={'milestone-check '+(m.done?'active':'')}>{m.done?'✓':''}</span>{m.title}</button>)}</div></div>:<div className="qualitative-state"><span className="state-spark">✦</span><div><strong>{statusLabel(goalStatus(g))}</strong><p>Tu avance se registra por estados y reflexiones, no con números.</p></div></div>}
      <div className="goal-footer"><span>{children.length} sub-metas · {linked} actividades vinculadas</span><span className="small-tag">{g.history.length} registros</span></div>
      <div className="actions">{this.state.guideOpen&&this.state.guideStep===1&&<Btn kind="secondary" tiny onClick={()=>this.selectGuideGoal(g.id)}><Icon name="check" size={14}/> Elegir para la guía</Btn>}{mode!=='milestones'&&<Btn kind="secondary" tiny onClick={()=>this.openProgress(g)}><Icon name="chart" size={14}/> Registrar avance</Btn>}<Btn kind="ghost" tiny onClick={()=>this.openGoal(g)}><Icon name="edit" size={14}/> Editar</Btn><Btn kind="ghost" tiny onClick={()=>this.openGoal(undefined,g.id)} title="Añadir sub-meta"><Icon name="plus" size={14}/> Sub-meta</Btn><Btn kind="ghost" tiny onClick={()=>this.deleteGoal(g)} title="Eliminar"><Icon name="trash" size={14}/></Btn></div>
    </div>;
  }
  renderGoals():any{
    const gs=this.state.data.goals;
    const items:{goal:Goal;depth:number}[]=[];
    const seen=new Set<string>();
    const visit=(g:Goal,depth:number)=>{if(seen.has(g.id))return;seen.add(g.id);items.push({goal:g,depth});gs.filter(x=>x.parentId===g.id).forEach(c=>visit(c,depth+1));};
    gs.filter(g=>!g.parentId||!gs.some(x=>x.id===g.parentId)).forEach(g=>visit(g,0));gs.forEach(g=>visit(g,0));
    return <>{this.renderHeading('Mis metas','De una visión amplia a objetivos concretos. Crea sub-metas, vincula actividades y registra resultados.',<Btn onClick={()=>this.openGoal()}><Icon name="plus"/> Crear meta</Btn>)}
      <div className="goal-view-toolbar"><span>Explorar las metas como</span><div className="view-toggle"><button className={this.state.goalView==='cards'?'selected':''} onClick={()=>this.setState({goalView:'cards'})}><Icon name="checklist" size={16}/> Tarjetas</button><button className={this.state.goalView==='map'?'selected':''} onClick={()=>this.setState({goalView:'map'})}><Icon name="network" size={16}/> Mapa de metas</button></div></div>
      <div className="notice">Cada meta puede medirse por resultados numéricos, hitos o estados cualitativos. Completar actividades no equivale automáticamente a conseguir un resultado.</div>
      {items.length?(this.state.goalView==='map'?this.renderGoalMap():<div className="goal-grid" style={{marginTop:20}}>{items.map(x=><div key={x.goal.id} style={{paddingLeft:Math.min(x.depth,3)*12}}>{this.renderGoalCard(x.goal,x.depth)}</div>)}</div>):<div className="panel" style={{marginTop:20}}><div className="empty"><Icon name="target"/><strong>Tu primera meta empieza aquí</strong><p>Define algo que quieras conseguir y desglósalo en pasos.</p><Btn onClick={()=>this.openGoal()}>Crear meta</Btn></div></div>}
    </>;
  }
  renderGoalMap():any{
    const layout=graphLayout(this.state.data,this.state.mapGrouping);const positions=new Map(layout.nodes.map(n=>[n.goal.id,n]));
    return <section className="goal-map-panel"><div className="map-topbar"><div><h2>Mapa de conexiones</h2><p>Las líneas continuas representan sub-metas; las discontinuas, procesos dependientes. Selecciona una tarjeta para editarla.</p></div><div className="view-toggle"><button className={this.state.mapGrouping==='structure'?'selected':''} onClick={()=>this.setState({mapGrouping:'structure'})}>Por procesos</button><button className={this.state.mapGrouping==='time'?'selected':''} onClick={()=>this.setState({mapGrouping:'time'})}>Por tiempo</button></div></div>
      <div className="goal-map-scroll"><div className="goal-map-surface" style={{width:layout.width,height:layout.height}}><svg className="goal-map-wires" width={layout.width} height={layout.height} aria-hidden="true"><defs><marker id="graph-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="currentColor"/></marker></defs>{layout.edges.map((e,i)=>{const a=positions.get(e.from),b=positions.get(e.to);if(!a||!b)return null;const x1=a.x+220,y1=a.y+53,x2=b.x,y2=b.y+53;const c=Math.max(44,Math.abs(x2-x1)*.46);return <path key={i} className={'graph-edge '+(e.kind==='depends'?'graph-dependency':'')} d={`M${x1},${y1} C${x1+c},${y1} ${x2-c},${y2} ${x2},${y2}`} />;})}</svg>{layout.labels.map((label,i)=><div className="goal-map-label" key={i} style={{left:label.x}}>{label.title}</div>)}{layout.nodes.map(({goal:g,x,y})=><button type="button" className="map-node" key={g.id} style={{left:x,top:y,borderTopColor:g.color}} onClick={()=>this.openGoal(g)}><span className="map-node-name">{g.title}</span><span className="map-node-tag">{goalMode(g)==='numeric'?'Numérica':goalMode(g)==='milestones'?'Por hitos':'Cualitativa'} {g.dueDate?'· '+g.dueDate:''}</span><span className="map-node-progress">{goalMode(g)==='numeric'?percent(g.current,g.target)+'%':goalMode(g)==='milestones'?goalMilestones(g).filter(m=>m.done).length+' hitos':statusLabel(goalStatus(g))}</span></button>)}</div></div><div className="map-legend"><span><i className="legend-line"/> Sub-meta</span><span><i className="legend-line dashed"/> Depende de</span><span><Icon name="help" size={14}/> Puedes asignar fechas y dependencias al editar cada meta</span></div></section>;
  }
  renderRoutines():any{
    const rs=this.state.data.routines;
    return <>{this.renderHeading('Rutinas y procedimientos','Convierte actividades complejas en pasos claros, reutilizables y fáciles de ejecutar.',<Btn onClick={()=>this.openRoutine()}><Icon name="plus"/> Nueva rutina</Btn>)}
      <div className="routine-grid">{rs.map(r=><div className="routine-card" key={r.id}><div className="row"><span className="routine-badge"><Icon name="checklist" size={21}/></span><div className="flex"><h3 className="goal-name">{r.title}</h3><p className="goal-desc">{r.desc||'Procedimiento sin descripción'}</p></div></div>
        <div className="routine-steps"><Icon name="clock" size={15}/>{leafSteps(r.steps).length} pasos · {routineMinutes(r)} min estimados</div><div className="routine-step-preview">{r.steps.slice(0,3).map((s,i)=><div key={s.id}>{i+1}. {s.title} <span className="muted">· {stepMinutes(s)} min</span></div>)}{r.steps.length>3&&<div>+{r.steps.length-3} pasos más</div>}</div>
        <div className="actions">{this.state.guideOpen&&this.state.guideStep===4&&<Btn tiny kind="secondary" onClick={()=>this.useRoutineForGuide(r)}>Usar en la guía</Btn>}<Btn tiny onClick={()=>{const existing=this.state.data.events.find(e=>e.routineId===r.id&&occurs(e,this.state.selectedDate));existing?this.openEvent(existing):this.setState({modal:'event',eventDraft:{...eDraft(this.state.selectedDate),title:r.title,routineId:r.id,minutes:routineMinutes(r)}});}}><Icon name="calendar" size={14}/> {this.state.data.events.some(e=>e.routineId===r.id&&occurs(e,this.state.selectedDate))?'Ajustar horario':'Programar'}</Btn><Btn tiny kind="secondary" onClick={()=>this.openRoutine(r)}><Icon name="edit" size={14}/> Editar</Btn><Btn tiny kind="ghost" onClick={()=>this.deleteRoutine(r)}><Icon name="trash" size={14}/></Btn></div></div>)}
      </div>{!rs.length&&<div className="panel"><div className="empty"><strong>Aún no tienes rutinas</strong><p>Crea un procedimiento, sus pasos y duración estimada.</p><Btn onClick={()=>this.openRoutine()}>Crear rutina</Btn></div></div>}
    </>;
  }
  monthDays():{day:string;inside:boolean}[]{
    const start=parseDay(this.state.month),offset=(start.getDay()+6)%7;const first=addDays(this.state.month,-offset);const result=[];
    for(let i=0;i<42;i++){const day=addDays(first,i);result.push({day,inside:day.slice(0,7)===this.state.month.slice(0,7)});}return result;
  }
  changeMonth=(offset:number):void=>{const d=parseDay(this.state.month);d.setMonth(d.getMonth()+offset);const newMonth=ymd(d);this.setState({month:newMonth,selectedDate:newMonth})}
  renderSchedule():any{
    const date=this.state.selectedDate,data=this.state.data,es=eventsOn(data,date);
    const minStart=es.length?Math.min(...es.map(e=>minutes(eventTime(e,date)))):360;
    const maxEnd=es.length?Math.max(...es.map(e=>minutes(eventTime(e,date))+e.minutes)):1320;
    const startHour=Math.max(0,Math.min(6,Math.floor(minStart/60)));
    const endHour=Math.min(24,Math.max(22,Math.ceil(maxEnd/60)));
    const hourHeight=82,origin=startHour*60;
    type Placed={event:EventItem;start:number;end:number;lane:number;lanes:number};
    const placed:Placed[]=[],all=es.map(e=>({event:e,start:minutes(eventTime(e,date)),end:Math.min(1440,minutes(eventTime(e,date))+Math.max(20,e.minutes))})).sort((a,b)=>a.start-b.start);
    let group:Placed[]=[],groupEnd=-1;
    const finish=()=>{if(!group.length)return;const laneEnds:number[]=[];group.forEach(x=>{let j=laneEnds.findIndex(t=>t<=x.start);if(j<0){j=laneEnds.length;laneEnds.push(-1);}x.lane=j;laneEnds[j]=x.end;});group.forEach(x=>{x.lanes=laneEnds.length;placed.push(x);});group=[];};
    all.forEach(x=>{if(group.length&&x.start>=groupEnd)finish();group.push({...x,lane:0,lanes:1});groupEnd=Math.max(groupEnd,x.end);});finish();
    return <>{this.renderHeading('Mi horario','Una vista continua de tu día: de la mañana a la noche. Abre cualquier bloque para descubrir sus rutinas, instrucciones y subpasos.',<Btn onClick={()=>this.openEvent()}><Icon name="plus"/> Añadir bloque</Btn>)}
      <div className="schedule-banner"><div className="schedule-days"><button className="icon-btn" title="Día anterior" onClick={()=>this.chooseDay(addDays(date,-1))}><Icon name="left"/></button><div><strong>{fmtDate(date)}</strong><span>{es.length} bloques · {es.filter(e=>done(data,e,date)).length} completados</span></div><button className="icon-btn" title="Día siguiente" onClick={()=>this.chooseDay(addDays(date,1))}><Icon name="right"/></button><Btn tiny kind="secondary" onClick={()=>this.chooseDay(today())}>Hoy</Btn></div><div className="schedule-banner-actions"><span>Selecciona un bloque para verlo en detalle.</span><span className="schedule-tip">Cada bloque puede revelar más detalles al abrirlo.</span></div></div>
      <section className="timeline-panel"><div className="timeline-head"><div><Icon name="sun"/> Tu jornada</div><p>Desplázate por el horario y abre los bloques para consultar sus pasos e instrucciones.</p></div>
      <div className="timeline-canvas" style={{height:(endHour-startHour)*hourHeight+24}}>
        {Array.from({length:endHour-startHour+1},(_,i)=>i+startHour).map(hour=><div key={hour} className="timeline-gridline" style={{top:(hour-startHour)*hourHeight}}><span>{String(hour).padStart(2,'0')}:00</span><div/></div>)}
        <div className="timeline-events">{placed.map(({event:e,start,end,lane,lanes})=>{const goal=data.goals.find(g=>g.id===e.goalId),routine=data.routines.find(r=>r.id===e.routineId),isDone=done(data,e,date),color=goal?.color||'#a477ec';const style=e.minutes<=20?'micro':e.minutes<=44?'compact':'expanded';return <button key={e.id} className={'timeline-block '+style+' '+(isDone?'completed':'')} title={`${e.title} · ${eventTime(e,date)} · ${e.minutes} minutos${e.note?' · '+e.note:''}`} aria-label={`Abrir ${e.title}, ${eventTime(e,date)}, ${e.minutes} minutos`} onClick={()=>this.openDetail(e)} style={{top:((start-origin)/60)*hourHeight,height:Math.max(26,((end-start)/60)*hourHeight-4),left:(lane/lanes*100)+'%',width:(100/lanes)+'%',borderLeftColor:color}}><div className="timeline-block-header"><span className="timeline-event-name">{e.title}</span>{isDone&&<span className="timeline-done">✓</span>}</div>{style!=='micro'&&<div className="timeline-time">{eventTime(e,date)} · {e.minutes} min {style==='expanded'&&routine?'· '+leafSteps(routine.steps).length+' pasos':''}</div>}{style==='expanded'&&e.note&&<div className="timeline-description">{e.note}</div>}</button>;})}</div>
      </div>{!es.length&&<div className="timeline-empty"><Icon name="calendar"/><p>Este día todavía no tiene actividades. Empieza creando tu primer bloque.</p><Btn onClick={()=>this.openEvent()}>Añadir bloque</Btn></div>}</section>
      <div className="notice">Los bloques se pueden abrir para consultar cada nivel de detalle. Para cambiar horas, utiliza la edición de la actividad o los controles de ±15 minutos.</div>
    </>;
  }
  renderDetail():any{
    const date=this.state.selectedDate,d=this.state.data,e=d.events.find(x=>x.id===this.state.activeEventId);if(!e)return <p>No se encontró el bloque seleccionado.</p>;
    const r=d.routines.find(x=>x.id===e.routineId),g=d.goals.find(x=>x.id===e.goalId),path=this.state.detailPath,current=r?getStepByPath(r.steps,path):undefined;
    const choices=current?(current.children||[]):r?.steps||[];
    const log=d.logs[key(e,date)]||{completed:false,checkedSteps:[]};
    return <div className="detail-zoom"><div className="detail-crumbs"><button onClick={()=>this.setState({detailPath:[]})}>{e.title}</button>{path.map((id,i)=><span key={id}> / <button onClick={()=>this.setState({detailPath:path.slice(0,i+1)})}>{getStepByPath(r?.steps||[],path.slice(0,i+1))?.title||'Paso'}</button></span>)}</div>
      {path.length===0?<><div className="detail-spotlight"><span className="detail-time"><Icon name="clock"/> {fmtDate(date)} · {eventTime(e,date)} · {e.minutes} min</span><h3>{e.title}</h3><p>{e.note||r?.desc||'Sin descripción adicional para este bloque.'}</p><div className="detail-tags">{g&&<span style={{borderColor:g.color}}><span className="circle-tint" style={{background:g.color}}/>{g.title}</span>}{e.repeat!=='none'&&<span>↻ Recurrente</span>}</div></div><div className="detail-actions"><Btn kind="secondary" onClick={()=>this.openEvent(e)}><Icon name="edit"/> Editar bloque</Btn>{r&&<Btn onClick={()=>this.openExecute(e)}><Icon name="checklist"/> Ejecutar rutina</Btn>}<Btn kind="secondary" onClick={()=>this.toggleEvent(e,date)}>{done(d,e,date)?'Marcar pendiente':'Marcar completada'}</Btn></div></>:<div className="detail-spotlight"><div className="detail-time"><Icon name="clock"/> {current?stepMinutes(current):0} min previstos</div><h3>{current?.title||'Paso'}</h3><p>{current?.desc||'No hay instrucciones adicionales para este paso.'}</p>{current&&!current.children?.length&&<Btn kind="secondary" onClick={()=>this.toggleStep(e,date,current.id)}>{log.checkedSteps.includes(current.id)?'✓ Completado · Desmarcar':'Marcar paso completado'}</Btn>}</div>}
      {choices.length>0&&<><h3 className="detail-section-title">{path.length?'Elementos de '+stepLevelName(path.length-1).toLowerCase():'Dentro de este bloque'}</h3><div className="zoom-children">{choices.map((s,i)=><button key={s.id} className="zoom-child" onClick={()=>this.setState({detailPath:[...path,s.id]})}><span className="zoom-index">{i+1}</span><div className="flex"><strong>{s.title}</strong><div className="caption">{stepMinutes(s)} min · {s.children?.length?s.children.length+' elementos':'Ver instrucciones'}</div></div><Icon name="right" size={18}/></button>)}</div></>}
      {!r&&<div className="notice">Para desglosar este bloque en pasos, asígnale una rutina desde «Editar bloque».</div>}
      {path.length>0&&<Btn kind="ghost" onClick={()=>this.setState({detailPath:path.slice(0,-1)})}><Icon name="left"/> Volver al nivel anterior</Btn>}</div>;
  }
  renderGuide():any{
    if(!this.state.guideOpen)return null;const i=this.state.guideStep,step=guideSteps[i];const dock=i>0;const goal=this.state.data.goals.find(g=>g.id===this.state.guideGoalId);
    const buttonLabel=i===0?'¡Vamos!':i===1?'Ver mis metas':i===2?'Añadir submeta':i===3?'Programar revisión':i===4?'Programar rutina':i===5?'Ver mi horario':'Finalizar recorrido';
    return <div className={'guide-backdrop '+(dock?'guide-docked':'guide-welcome')} role="presentation"><div className="guide-panel" role="dialog" aria-modal={!dock} aria-label="Tutorial interactivo"><div className="guide-top"><span className="guide-tag"><Icon name="spark"/> TUTORIAL INTERACTIVO</span><button className="icon-btn" onClick={this.finishGuide} aria-label="Saltar el tutorial" title="Saltar tutorial"><Icon name="close"/></button></div><div className="guide-progress">{guideSteps.map((s,j)=><span className={'guide-dot '+(j<=i?'active':'')} key={j}/>)}</div><div className="guide-section-label">Paso {i+1} de {guideSteps.length}</div><h2>{step.title}</h2><p>{step.text}</p>{goal&&i>1&&i<6&&<div className="guide-selected-goal"><Icon name="target" size={16}/> Trabajando en: <strong>{goal.title}</strong></div>}{i===1&&<div className="guide-tip">Busca el botón «Elegir para la guía» en alguna meta de la página.</div>}{i===5&&<div className="guide-tip">Busca el bloque que programaste: estará en la fecha que elegiste.</div>}<div className="guide-buttons"><button className="guide-skip" onClick={this.finishGuide}>Saltar tutorial</button><Btn onClick={this.guideAction}>{buttonLabel} <Icon name="arrow-right" size={16}/></Btn></div></div></div>;
  }
  helpBody():any{
    const content:Record<string,[string,string[]]>={
      inicio:['Inicio y resumen',['Tu panel reúne las metas, rutinas y actividades del día.','El porcentaje de cumplimiento refleja actividades realizadas, no resultados obtenidos.','Usa los accesos rápidos para crear metas, rutinas o programar eventos.']],
      metas:['Metas y tipos de seguimiento',['Numérica: registra un resultado concreto y una cantidad objetivo.','Cualitativa: elige estados de avance y deja reflexiones; es ideal para relaciones, bienestar o aprendizaje.','Por hitos: divide una meta en logros verificables y marca los que completas.','Puedes crear sub-metas, indicar fechas y dependencias, y explorar sus conexiones desde el mapa.']],
      rutinas:['Rutinas y procedimientos',['Las rutinas son plantillas reutilizables. Arrastra el tirador de cada paso para reordenarlo.','Puedes incluir subpasos y entrar progresivamente a cada nivel desde los bloques del horario.','Para usar una rutina en tu jornada, pulsa «Programar».']],
      horario:['Horario de mañana a noche',['Cada bloque representa una actividad o rutina programada. Su diseño se adapta a la duración disponible.','Haz clic en un bloque para acercarte a su contenido, sus pasos y sus detalles.','Si algo cambia, puedes editar el bloque o moverlo ±15 minutos desde el calendario.']],
      calendario:['Calendario independiente',['Selecciona un día para consultar su agenda.','Las actividades pueden repetirse diariamente, entre semana o cada semana.','Los movimientos de ±15 minutos aplican solo a ese día, incluso en una rutina recurrente.']],
      progreso:['Progreso y resultados',['Puedes comparar lo planeado con lo realizado durante los últimos siete días.','Las metas numéricas, los hitos y las cualitativas se muestran de forma diferente.','Registrar una actividad completada no modifica automáticamente un resultado personal.']],
      ajustes:['Apariencia, respaldos y ayuda',['Selecciona una paleta y la interfaz se adaptará al instante.','Desde cualquier ventana emergente puedes alternar entre disposición vertical u horizontal.','Exporta un respaldo JSON antes de limpiar los datos del navegador.','Puedes volver a abrir la guía en cualquier momento.']]
    };
    const [title,lines]=content[this.state.helpTopic]||content.inicio;
    return <div className="help-content"><h3>{title}</h3>{lines.map((line,i)=><div className="help-line" key={i}><span>{i+1}</span><p>{line}</p></div>)}<Btn onClick={()=>{this.close();this.openGuide()}} kind="secondary"><Icon name="help"/> Abrir guía completa</Btn></div>;
  }
  renderCalendar():any{
    const date=this.state.selectedDate,d=this.state.data;
    return <>{this.renderHeading('Calendario','Tu agenda propia. Organiza fechas, repeticiones y prioridades sin conectar servicios externos.',<Btn onClick={()=>this.openEvent()}><Icon name="plus"/> Programar actividad</Btn>)}
      <div className="calendar-shortcut"><span><Icon name="spark"/> Las fechas también cuentan tu historia</span><span className="calendar-shortcut-note">Anota revisiones, compromisos y momentos importantes. Tu calendario y tu horario están disponibles por separado desde el menú.</span></div><div className="calendar-layout"><section className="panel"><div className="calendar-toolbar"><div className="month-name">{fmtMonth(this.state.month)}</div><div className="calendar-nav"><button className="icon-btn" onClick={()=>this.changeMonth(-1)} title="Mes anterior"><Icon name="left"/></button><button className="icon-btn" onClick={()=>this.chooseDay(today())} title="Volver a hoy"><Icon name="sun"/></button><button className="icon-btn" onClick={()=>this.changeMonth(1)} title="Mes siguiente"><Icon name="right"/></button></div></div>
        <div className="weekday-grid">{weekdays.map((w,i)=><div className="weekday" key={i}>{w}</div>)}</div>
        <div className="month-grid">{this.monthDays().map(c=>{const events=eventsOn(d,c.day);return <button key={c.day} className={`day-cell ${c.inside?'':'outside'} ${c.day===date?'selected':''} ${c.day===today()?'today':''}`} onClick={()=>this.chooseDay(c.day)} aria-label={fmtDate(c.day)+', '+events.length+' actividades'}><div className="day-number">{parseDay(c.day).getDate()}</div>{events.length>0&&<><div className="day-dots">{events.slice(0,4).map(e=><span key={e.id} className="day-dot" style={{background:done(d,e,c.day)?'#bacbb8':'#76aa86'}}/>)}</div><span className="day-count">{events.length} actividad{events.length===1?'':'es'}</span></>}</button>})}</div></section>
        <section className="panel"><div className="panel-head"><div><div className="eyebrow" style={{marginBottom:5}}>AGENDA DEL DÍA</div><h2 className="selected-date">{fmtDate(date)}</h2></div><Btn tiny kind="secondary" onClick={()=>this.openEvent()}><Icon name="plus" size={15}/></Btn></div>
          {this.renderTodayList(date)}<div className="divider"/><div className="caption">Los botones ±15 min modifican solo el día seleccionado, incluso en actividades recurrentes.</div></section></div>
    </>;
  }
  renderProgress():any{
    const d=this.state.data;const start=addDays(today(),-6);const days=Array.from({length:7},(_,i)=>addDays(start,i));
    let weekPlanned=0,weekDone=0;for(const day of days){for(const e of eventsOn(d,day)){weekPlanned++;if(done(d,e,day))weekDone++;}}
    return <>{this.renderHeading('Mi progreso','Comprende la diferencia entre tu constancia diaria y los resultados que estás consiguiendo.')}
      <div className="cards progress-stats">{this.renderStat('Últimos 7 días',weekPlanned,'Actividades programadas','calendar')}{this.renderStat('Completadas',weekDone,'Registros de ejecución','checklist')}{this.renderStat('Cumplimiento',weekPlanned?Math.round(weekDone/weekPlanned*100)+'%':'—','Últimos 7 días','chart')}{this.renderStat('Metas con medida',d.goals.filter(g=>g.target>0).length,'Objetivos cuantificados','target')}</div>
      <div className="two-col"><section className="panel"><div className="panel-head"><div><h2>Actividad de la semana</h2><p className="panel-sub">Porcentaje diario de actividades completadas</p></div></div><div className="week-chart">{days.map(day=>{const a=eventsOn(d,day),c=a.filter(e=>done(d,e,day)).length,p=a.length?Math.round(c/a.length*100):0;return <div key={day} className="bar-wrap"><div className="bar-value">{a.length?p+'%':'—'}</div><div className="bar" style={{height:(5+p*.85)+'%',background:day===today()?'#407d5d':'#b7d0b4'}} title={`${c}/${a.length}`}/><div className="bar-label">{longDays[parseDay(day).getDay()].slice(0,3)}</div></div>})}</div></section>
        <section className="panel"><div className="panel-head"><div><h2>Resultados medibles</h2><p className="panel-sub">Actualizados manualmente con su historial</p></div></div>{d.goals.filter(g=>g.target>0).length?d.goals.filter(g=>g.target>0).map(g=><div key={g.id} className="goal-summary"><div className="goal-summary-top"><strong>{g.title}</strong><span>{g.current}/{g.target} {g.unit}</span></div><div className="progress-track"><div className="progress-fill" style={{width:percent(g.current,g.target)+'%',background:g.color}}/></div><div className="actions" style={{marginTop:9}}><Btn kind="ghost" tiny onClick={()=>this.openProgress(g)}>Actualizar resultado</Btn></div></div>):<div className="empty"><strong>No hay indicadores configurados</strong><p>Asigna una cantidad objetivo a una meta para verla aquí.</p></div>}</section></div>
      <div className="section-head"><h2 className="section-title">Metas cualitativas y por hitos</h2>{this.hint('metas')}</div><section className="panel"><div className="qual-list">{d.goals.filter(g=>goalMode(g)!=='numeric').map(g=><div key={g.id} className="qual-row"><span className="goal-color" style={{background:g.color}}/><div className="flex"><strong>{g.title}</strong><div className="caption">{goalMode(g)==='qualitative'?statusLabel(goalStatus(g)):goalMilestones(g).filter(m=>m.done).length+' de '+goalMilestones(g).length+' hitos'}</div></div>{goalMode(g)==='qualitative'&&<Btn tiny kind="secondary" onClick={()=>this.openProgress(g)}>Actualizar</Btn>}</div>)}{!d.goals.some(g=>goalMode(g)!=='numeric')&&<div className="caption">Aún no hay metas de este tipo.</div>}</div></section><div className="section-head"><h2 className="section-title">Últimos registros de resultados</h2></div><section className="panel">{d.goals.flatMap(g=>g.history.map(h=>({...h,goal:g.title,unit:g.unit}))).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,12).map((h,i)=><div className="agenda-item" key={i}><div className="agenda-time">{h.date.slice(5)}</div><div className="agenda-main"><div className="agenda-name">{h.goal} · {h.status?statusLabel(h.status):h.value+' '+h.unit}</div>{h.note&&<div className="agenda-sub">{h.note}</div>}</div></div>)}{!d.goals.some(g=>g.history.length>0)&&<div className="empty"><strong>Aún no hay resultados registrados</strong><p>Desde una meta, pulsa «Registrar avance» para iniciar tu historial.</p></div>}</section>
    </>;
  }
  renderSettings():any{return <>{this.renderHeading('Apariencia, ayuda y ajustes','Todo permanece bajo tu control. Realiza copias de seguridad para conservar tus datos incluso si cambias de dispositivo o navegador.')}
    <div className="settings-box"><div className="row spread"><h2>Paletas de colores</h2>{this.hint('ajustes')}</div><p>Elige la atmósfera que más te guste. La paleta «Aurora» es la predeterminada.</p><div className="theme-grid">{themeOptions.map(t=><button key={t.id} className={'theme-tile '+(this.state.theme===t.id?'chosen':'')} onClick={()=>this.setTheme(t.id)}><div className="theme-bubbles">{t.colors.map((c,i)=><span key={i} style={{background:c}}/>)}</div><strong>{t.name}</strong><span>{t.hint}</span>{this.state.theme===t.id&&<i>✓</i>}</button>)}</div></div>
    <div className="settings-box"><h2>Guía interactiva</h2><p>Vuelve a recorrer los pasos para conocer el funcionamiento de Fullhouse.</p><Btn kind="secondary" onClick={this.openGuide}><Icon name="help"/> Iniciar la guía</Btn></div>
    <div className="settings-box"><h2>Disposición de las ventanas</h2><p>Puedes cambiar entre modo vertical y horizontal desde la parte superior de cualquier ventana emergente.</p><div className="row"><Btn kind={this.state.modalLayout==='vertical'?'':'secondary'} onClick={()=>this.setLayout('vertical')}><Icon name="vertical"/> Vertical</Btn><Btn kind={this.state.modalLayout==='horizontal'?'':'secondary'} onClick={()=>this.setLayout('horizontal')}><Icon name="horizontal"/> Horizontal</Btn></div></div>
    <div className="settings-box"><h2>Exportar mis datos</h2><p>Descarga un archivo JSON con todas tus metas, rutinas, actividades, fechas, pasos completados y registros. Guárdalo en un lugar seguro.</p><Btn onClick={this.exportData}><Icon name="download" size={16}/> Descargar respaldo</Btn></div>
    <div className="settings-box"><h2>Restaurar un respaldo</h2><p>Importa un archivo JSON exportado anteriormente. <strong>Esto reemplazará los datos actuales</strong> de este navegador. Te pediremos confirmación.</p><label className="btn secondary" style={{display:'inline-flex',cursor:'pointer',marginBottom:0}}><Icon name="upload" size={16}/> Elegir archivo JSON<input className="hide" type="file" accept=".json,application/json" onChange={this.importData}/></label></div>
    <div className="settings-box"><h2>Restablecer datos de ejemplo</h2><p>Vuelve al contenido inicial para hacer nuevas pruebas. Primero descarga un respaldo si hay algo que quieras conservar.</p><Btn kind="danger" onClick={this.reset}><Icon name="trash" size={15}/> Restablecer ejemplos</Btn></div>
    <div className="notice"><strong>Importante:</strong> los datos se almacenan con localStorage, solo en este navegador y perfil. Si limpias los datos del sitio, usas modo privado o cambias de dispositivo, podrías perderlos. Este prototipo no cifra la información ni hace respaldos automáticos. Para datos importantes o privados, usa una copia de seguridad y una futura versión con almacenamiento más robusto.</div>
    </>}
  renderModal():any{
    const modal=this.state.modal;if(!modal)return null;
    let title='';if(modal==='goal')title=this.state.goalDraft.id?'Editar meta':'Crear meta';if(modal==='routine')title=this.state.routineDraft.id?'Editar rutina':'Nueva rutina';if(modal==='event')title=this.state.eventDraft.id?'Editar actividad':'Programar actividad';if(modal==='execute')title='Ejecutar procedimiento';if(modal==='progress')title='Registrar avance';if(modal==='detail')title='Dentro de mi horario';if(modal==='help')title='¿Cómo funciona?';
    return <div className="modal-backdrop" onClick={(ev:any)=>{if(ev.target===ev.currentTarget)this.close()}}><div className={'modal '+(this.state.modalLayout==='horizontal'?'wide':'vertical')} role="dialog" aria-modal="true" aria-label={title}><div className="modal-header"><div><div className="eyebrow">FULLHOUSE · DETALLES</div><h2 className="modal-title">{title}</h2></div><div className="modal-header-actions"><div className="layout-switch"><button className={this.state.modalLayout==='vertical'?'active':''} title="Ventana vertical" aria-label="Vista vertical" onClick={()=>this.setLayout('vertical')}><Icon name="vertical" size={16}/></button><button className={this.state.modalLayout==='horizontal'?'active':''} title="Ventana horizontal" aria-label="Vista horizontal" onClick={()=>this.setLayout('horizontal')}><Icon name="horizontal" size={16}/></button></div><button className="icon-btn" onClick={this.close} aria-label="Cerrar"><Icon name="close"/></button></div></div>
      <div className="modal-body" tabIndex={-1}>{modal==='goal'?this.goalForm():modal==='routine'?this.routineForm():modal==='event'?this.eventForm():modal==='progress'?this.progressForm():modal==='detail'?this.renderDetail():modal==='help'?this.helpBody():this.executeForm()}</div>
      <div className="modal-footer"><Btn kind="secondary" onClick={this.close}>Cerrar</Btn>{modal==='goal'&&<Btn onClick={this.saveGoal}>Guardar meta</Btn>}{modal==='routine'&&<Btn onClick={this.saveRoutine}>Guardar rutina</Btn>}{modal==='event'&&<Btn onClick={this.saveEvent}>Guardar actividad</Btn>}{modal==='progress'&&<Btn onClick={this.saveProgress}>Registrar avance</Btn>}</div>
    </div></div>;
  }
  goalForm():any{
    const x=this.state.goalDraft,notAllowed=x.id?[x.id,...this.descendants(x.id)]:[],mode=goalMode(x);
    return <><div className="field"><label>Nombre de la meta *</label><input maxLength={90} value={x.title} onChange={e=>this.updateGoalDraft({title:e.target.value})} placeholder="Ej. Mejorar mi relación con mi familia"/></div>
      <div className="field"><label>Descripción o propósito {this.hint('metas')}</label><AutoTextarea maxLength={1500} value={x.desc} onChange={(e:any)=>this.updateGoalDraft({desc:e.target.value})} placeholder="¿Qué quiero conseguir? ¿Por qué me importa?"/></div>
      <div className="field"><label>Meta superior (opcional)</label><FriendlySelect ariaLabel="Elegir meta superior" value={x.parentId} onChange={value=>this.updateGoalDraft({parentId:value})} options={[{value:'',label:'Ninguna · Meta principal'},...this.state.data.goals.filter(g=>!notAllowed.includes(g.id)).map(g=>({value:g.id,label:g.title}))]}/></div>
      <div className="field-grid"><div className="field"><label>Fecha de inicio (opcional)</label><input type="date" value={x.startDate||''} onChange={e=>this.updateGoalDraft({startDate:e.target.value})}/></div><div className="field"><label>Fecha objetivo (opcional)</label><input type="date" value={x.dueDate||''} onChange={e=>this.updateGoalDraft({dueDate:e.target.value})}/></div></div>
      <div className="field"><label>Depende de otra meta (opcional)</label><FriendlySelect ariaLabel="Meta previa necesaria" value={x.dependsOn||''} onChange={dependsOn=>this.updateGoalDraft({dependsOn})} options={[{value:'',label:'Ninguna · Puede avanzar de forma independiente'},...this.state.data.goals.filter(g=>!notAllowed.includes(g.id)).map(g=>({value:g.id,label:'Después de: '+g.title}))]}/><p className="caption">Esta conexión se dibuja con una línea discontinua en el mapa de metas.</p></div>
      <div className="field"><label>¿Cómo quieres medir el avance? {this.hint('metas')}</label><div className="goal-mode-grid">{([{id:'numeric',label:'Numérica',icon:'chart',desc:'Cantidades y objetivos'},{id:'qualitative',label:'Cualitativa',icon:'spark',desc:'Estados y reflexiones'},{id:'milestones',label:'Por hitos',icon:'checklist',desc:'Logros verificables'}] as {id:GoalMode;label:string;icon:string;desc:string}[]).map(m=><button key={m.id} className={'goal-mode '+(mode===m.id?'active':'')} onClick={()=>this.updateGoalDraft({mode:m.id})}><Icon name={m.icon}/><strong>{m.label}</strong><small>{m.desc}</small></button>)}</div></div>
      {mode==='numeric'&&<><div className="field-grid"><div className="field"><label>Resultado actual</label><input type="number" min="0" step="any" value={x.current} onChange={e=>this.updateGoalDraft({current:asInt(e.target.value)})}/></div><div className="field"><label>Resultado objetivo</label><input type="number" min="0" step="any" value={x.target} onChange={e=>this.updateGoalDraft({target:asInt(e.target.value)})}/></div></div><div className="field"><label>Unidad de medida</label><input maxLength={40} placeholder="Ej. km, sesiones, capítulos, kg" value={x.unit} onChange={e=>this.updateGoalDraft({unit:e.target.value})}/></div></>}
      {mode==='qualitative'&&<div className="field"><label>Estado actual de tu meta</label><FriendlySelect value={goalStatus(x)} ariaLabel="Estado de meta" onChange={value=>this.updateGoalDraft({status:value as GoalStatus})} options={goalStatuses.map(s=>({value:s.id,label:s.label+' · '+s.desc}))}/><p className="caption">Este tipo no necesita números. Podrás guardar reflexiones y cambios en tu progreso.</p></div>}
      {mode==='milestones'&&<div className="field"><div className="row spread"><label>Hitos o logros parciales</label><span className="caption">{goalMilestones(x).length} definidos</span></div>{goalMilestones(x).map(m=><div className="milestone-editor" key={m.id}><input value={m.title} onChange={e=>this.updateGoalDraft({milestones:goalMilestones(x).map(k=>k.id===m.id?{...k,title:e.target.value}:k)})} placeholder="Describe un logro concreto"/><button className="icon-btn" aria-label="Quitar hito" onClick={()=>this.updateGoalDraft({milestones:goalMilestones(x).filter(k=>k.id!==m.id)})}><Icon name="trash" size={16}/></button></div>)}<Btn tiny kind="secondary" onClick={()=>this.updateGoalDraft({milestones:[...goalMilestones(x),{id:uid(),title:'',done:false}]})}><Icon name="plus" size={14}/> Agregar hito</Btn><p className="caption">Después podrás marcar cada hito como logrado desde la tarjeta de la meta.</p></div>}
      <div className="field"><label>Color de identificación</label><div className="color-picker">{colorOptions.map(c=><button type="button" key={c} className={'color-dot '+(x.color===c?'active':'')} onClick={()=>{this.updateGoalDraft({color:c});this.setState({hexDraft:c});}} aria-label={'Color '+c} title={c} style={{background:c}}/>)}<button type="button" className={'custom-color '+(this.state.colorEditorOpen?'active':'')} onClick={()=>this.setState({colorEditorOpen:!this.state.colorEditorOpen})}><Icon name="palette" size={18}/> Personalizar</button></div>{this.state.colorEditorOpen&&<div className="custom-color-editor"><div className="custom-color-preview"><span style={{background:x.color}}/><div><strong>Crea tu propio tono</strong><small>{x.color.toUpperCase()}</small></div></div>{(['Tono','Saturación','Luminosidad'] as string[]).map((label,i)=>{const hsl=hexToHsl(x.color);return <div key={label} className="color-slider-row"><label>{label}</label><input type="range" min={0} max={i===0?359:100} value={hsl[i]} className={i===0?'hue-range':'color-range'} onChange={e=>{const values: [number,number,number]=[...hsl] as [number,number,number];values[i]=Number(e.target.value);this.updateGoalDraft({color:hslToHex(values[0],values[1],values[2])});this.setState({hexDraft:hslToHex(values[0],values[1],values[2])});}}/></div>})}<div className="custom-color-actions"><label>Hexadecimal <input value={this.state.hexDraft} maxLength={7} onChange={e=>{const v=e.target.value;this.setState({hexDraft:v});if(/^#[a-fA-F0-9]{6}$/.test(v))this.updateGoalDraft({color:v})}} onBlur={()=>this.setState({hexDraft:this.state.goalDraft.color})} aria-label="Color hexadecimal"/></label><Btn tiny kind="secondary" onClick={()=>this.setState({colorEditorOpen:false})}>Listo</Btn></div></div>}</div>
    </>;
  }
  renderStepEditor=(steps:Step[],level=0):any=>{
    const update=(id:string,patch:Partial<Step>)=>this.updateRoutineDraft({steps:editStepTree(this.state.routineDraft.steps,id,s=>({...s,...patch}))});
    return <div className={'step-editor-list '+(level?'nested':'')}>{steps.map((s,i)=>{const hasChildren=!!s.children?.length;return <div className={'step-editor-card '+(this.state.dragTargetId===s.id&&this.state.draggedStepId!==s.id?'drop-target':'')} data-step-id={s.id} key={s.id}>
      <div className="step-edit-head"><span className="step-type-tag">{stepLevelName(level)} {i+1}</span><span className="step-duration-summary"><Icon name="clock" size={14}/> {stepMinutes(s)} min {hasChildren?'(suma automática)':''}</span><button className="drag-handle" title="Arrastra para reordenar en este nivel. Con el teclado usa las flechas." aria-label={'Arrastrar '+stepLevelName(level)+' '+(i+1)} onMouseDown={e=>this.startStepDrag(s.id,e)} onTouchStart={e=>this.startStepDrag(s.id,e)} onKeyDown={e=>{if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();this.moveStepDragKeyboard(s.id,e.key==='ArrowUp'?-1:1);}}}><Icon name="grip" size={18}/></button><button className="icon-btn remove-step" title="Eliminar este elemento" onClick={()=>this.updateRoutineDraft({steps:deleteStepTree(this.state.routineDraft.steps,s.id)})}><Icon name="trash" size={15}/></button></div>
      <div className="step-edit-fields"><input aria-label={'Nombre del '+stepLevelName(level).toLowerCase()+' '+(i+1)} value={s.title} onChange={e=>update(s.id,{title:e.target.value})} placeholder={level===0?'Nombre del paso':'Nombre del '+stepLevelName(level).toLowerCase()}/>{hasChildren?<span className="step-readonly-time" title="La duración se calcula sumando todos los elementos hijos">Σ {stepMinutes(s)} min</span>:<label className="step-time-field">min <input className="step-min" title="Minutos previstos" aria-label="Duración en minutos" type="number" min="1" inputMode="numeric" value={s.min} onWheel={e=>(e.currentTarget as HTMLInputElement).blur()} onKeyDown={e=>{if(e.key==='ArrowUp'||e.key==='ArrowDown')e.preventDefault();}} onChange={e=>update(s.id,{min:asInt(e.target.value,1)})}/></label>}</div>
      <div className="step-description"><AutoTextarea maxLength={1000} value={s.desc||''} onChange={(e:any)=>update(s.id,{desc:e.target.value})} placeholder="Instrucciones y detalles de este elemento..."/></div>
      {hasChildren&&this.renderStepEditor(s.children||[],level+1)}<div className="step-subaction"><Btn tiny kind="secondary" onClick={()=>update(s.id,{children:[...(s.children||[]),{id:uid(),title:'',min:5,desc:''}]})}><Icon name="plus" size={14}/> Añadir {nextStepLevelName(level)}</Btn></div>
    </div>;})}</div>;
  }
  routineForm():any{
    const r=this.state.routineDraft;
    return <><div className="field"><label>Nombre de la rutina *</label><input maxLength={90} value={r.title} onChange={e=>this.updateRoutineDraft({title:e.target.value})} placeholder="Ej. Preparación para el gimnasio"/></div>
      <div className="field"><label>Descripción {this.hint('rutinas')}</label><AutoTextarea maxLength={1500} value={r.desc} onChange={(e:any)=>this.updateRoutineDraft({desc:e.target.value})} placeholder="¿Qué necesitas lograr al terminar esta rutina?"/></div>
      <div className="field"><div className="row spread"><label style={{margin:0}}>Pasos del procedimiento</label><span className="caption">{routineMinutes(r)} minutos en total</span></div></div>
      {this.renderStepEditor(r.steps)}
      <div style={{marginTop:13}}><Btn kind="secondary" tiny onClick={()=>this.updateRoutineDraft({steps:[...r.steps,{id:uid(),title:'',min:5,desc:''}]})}><Icon name="plus" size={14}/> Agregar paso</Btn></div>
      <div className="notice" style={{marginTop:18}}>Puedes añadir instrucciones y subpasos ilimitados. Cuando un paso contiene subpasos, su duración se calcula sumando los hijos. Al editar una rutina, sus actividades vinculadas utilizan la plantilla actual.</div>
    </>;
  }
  eventForm():any{
    const e=this.state.eventDraft,rs=this.state.data.routines,gs=this.state.data.goals;
    return <><div className="field"><label>Título de la actividad *</label><input maxLength={100} value={e.title} onChange={v=>this.updateEventDraft({title:v.target.value})} placeholder="Ej. Entrenamiento de fuerza"/></div>
      <div className="field-grid"><div className="field"><label>Fecha de inicio *</label><input type="date" value={e.date} onChange={v=>this.updateEventDraft({date:v.target.value})}/></div><div className="field"><label>Hora *</label><TimePicker value={e.time} onChange={time=>this.updateEventDraft({time})}/></div></div>
      <div className="field-grid"><div className="field"><label>Duración estimada (min)</label><input type="number" min="1" max="1440" onWheel={v=>(v.currentTarget as HTMLInputElement).blur()} value={e.minutes} onChange={v=>this.updateEventDraft({minutes:asInt(v.target.value,30)})}/></div><div className="field"><label>Repetición</label><FriendlySelect value={e.repeat} ariaLabel="Repetición" onChange={value=>this.updateEventDraft({repeat:value as Repeat})} options={[{value:'none',label:'Solo esta fecha'},{value:'daily',label:'Todos los días'},{value:'weekdays',label:'Lunes a viernes'},{value:'weekly',label:'Cada semana'}]}/></div></div>
      <div className="field"><label>Rutina o procedimiento (opcional) {this.hint('rutinas')}</label><FriendlySelect value={e.routineId} ariaLabel="Rutina vinculada" onChange={id=>{const r=rs.find(x=>x.id===id);this.updateEventDraft({routineId:id,...(r?{title:r.title,minutes:routineMinutes(r)}:{})})}} options={[{value:'',label:'Actividad sencilla'},...rs.map(r=>({value:r.id,label:r.title}))]}/></div>
      <div className="field"><label>Meta vinculada (opcional)</label><FriendlySelect value={e.goalId} ariaLabel="Meta vinculada" onChange={goalId=>this.updateEventDraft({goalId})} options={[{value:'',label:'Sin meta asociada'},...gs.map(g=>({value:g.id,label:g.title}))]}/></div>
      <div className="field"><label>Notas e instrucciones</label><AutoTextarea value={e.note} onChange={(v:any)=>this.updateEventDraft({note:v.target.value})} maxLength={1500} placeholder="Detalles que quieras recordar"/></div>
      {e.routineId&&<p className="caption">Cada rutina solo puede aparecer una vez por día. Para cambiar su horario, edita esta programación.</p>}
      {e.id&&e.repeat!=='none'&&<div className="field"><label>Aplicar cambios solo desde esta fecha (opcional)</label><input type="date" min={e.date} value={e.applyFrom||''} onChange={v=>this.updateEventDraft({applyFrom:v.target.value})}/><p className="caption">Vacío: cambia toda la serie. Con fecha: conserva el historial anterior y crea una nueva programación desde el día elegido.</p></div>}
      {e.id&&<div className="row spread" style={{marginTop:16}}><div className="caption">Editar una actividad recurrente modifica su programación general. Los cambios de ±15 min en el calendario afectan solo al día elegido.</div><Btn kind="danger" tiny onClick={()=>this.deleteEvent(e)}><Icon name="trash" size={14}/> Eliminar</Btn></div>}
    </>;
  }
  progressForm():any{
    const g=this.state.data.goals.find(x=>x.id===this.state.progressGoalId);if(!g)return null;const mode=goalMode(g);
    return <><div className="notice"><strong>{g.title}</strong> · {mode==='qualitative'?'Avance por estados y reflexiones':'Valor actual: '+g.current+' '+g.unit+(g.target>0?' · Objetivo: '+g.target+' '+g.unit:'')}</div>
      {mode==='qualitative'?<div className="field" style={{marginTop:18}}><label>¿En qué estado se encuentra esta meta?</label><FriendlySelect value={this.state.progressStatus} ariaLabel="Estado del progreso" onChange={status=>this.setState({progressStatus:status as GoalStatus})} options={goalStatuses.map(s=>({value:s.id,label:s.label+' · '+s.desc}))}/></div>:<div className="field" style={{marginTop:18}}><label>Nuevo resultado</label><input type="number" step="any" min="0" value={this.state.progressValue} onChange={e=>this.setState({progressValue:e.target.value})}/></div>}
      <div className="field"><label>{mode==='qualitative'?'¿Qué cambió? Describe tus avances':'Nota del registro (opcional)'}</label><AutoTextarea value={this.state.progressNote} onChange={(e:any)=>this.setState({progressNote:e.target.value})} placeholder="Reflexiones, aprendizajes o cambios desde el registro anterior"/></div><p className="caption">El resultado se guarda en el historial de la meta con la fecha de hoy.</p></>;
  }
  renderCheckSteps=(steps:Step[],e:EventItem,date:string,log:RecordLog,level=0):any=><div className={level?'check-child-steps':''}>{steps.map((s,i)=><div key={s.id}><div className="routine-step"><button className={'check-circle '+(log.checkedSteps.includes(s.id)?'checked':'')} onClick={()=>this.toggleStep(e,date,s.id)} aria-label={'Marcar '+s.title} disabled={!!(s.children&&s.children.length)}>{log.checkedSteps.includes(s.id)&&<Icon name="check" size={13}/>}</button><div className="flex"><div className="agenda-name">{i+1}. {s.title}</div>{s.desc&&<div className="agenda-sub">{s.desc}</div>}<div className="agenda-sub">{stepMinutes(s)} min · {s.children?.length?'Incluye '+s.children.length+' elementos':'Paso individual'}</div></div></div>{s.children&&s.children.length>0&&this.renderCheckSteps(s.children,e,date,log,level+1)}</div>)}</div>;
  executeForm():any{
    const date=this.state.selectedDate,e=this.state.data.events.find(x=>x.id===this.state.activeEventId);if(!e)return null;
    const r=this.state.data.routines.find(x=>x.id===e.routineId);if(!r)return <p>La rutina ya no está disponible.</p>;
    const log=this.state.data.logs[key(e,date)]||{completed:false,checkedSteps:[]};
    return <><div className="notice"><strong>{e.title}</strong> · {fmtDate(date)} a las {eventTime(e,date)}. Cada paso marcado se guarda únicamente para esta ejecución.</div><div style={{marginTop:15}}>{this.renderCheckSteps(r.steps,e,date,log)}</div><div className="divider"/><div className="row spread"><span className="caption">{leafSteps(r.steps).filter(s=>log.checkedSteps.includes(s.id)).length} / {leafSteps(r.steps).length} pasos completados</span>{log.completed&&<span className="small-tag">Actividad completada</span>}</div></>;
  }
  render():any{
    const title:{[K in Page]:string}={inicio:'Inicio',metas:'Metas',rutinas:'Rutinas',horario:'Horario',calendario:'Calendario',progreso:'Progreso',ajustes:'Ajustes'};
    return <div className="app-shell" data-theme={this.state.theme}>{this.renderSidebar()}<main className="main"><header className="topbar"><div className="crumb"><Icon name="home" size={16}/><span>Mi espacio</span><span>/</span><strong>{title[this.state.page]}</strong></div><div className="top-right"><span className="pill"><span className="dot"/> Datos locales</span><button className="icon-btn guide-top-button" onClick={this.openGuide} title="Guía de inicio" aria-label="Abrir guía de inicio"><Icon name="help"/></button><button className="icon-btn palette-mini" onClick={()=>this.route('ajustes')} title="Paletas y ajustes"><Icon name="palette"/></button></div></header>
      <div className="content">{this.state.page==='inicio'?this.renderHome():this.state.page==='metas'?this.renderGoals():this.state.page==='rutinas'?this.renderRoutines():this.state.page==='horario'?this.renderSchedule():this.state.page==='calendario'?this.renderCalendar():this.state.page==='progreso'?this.renderProgress():this.renderSettings()}</div></main>{this.renderModal()}{this.renderGuide()}{this.state.toast&&<div className="toast" role="status" onClick={()=>this.setState({toast:''})}>{this.state.toast} <span style={{marginLeft:9,opacity:.65,cursor:'pointer'}}>×</span></div>}</div>;
  }
}
ReactDOM.render(<Planner/>,document.getElementById('app'));