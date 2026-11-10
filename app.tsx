/* Fullhouse · Planificador v0.9 — prototipo local sin servicios externos.
   Interfaz React + TypeScript. Los datos se guardan en este navegador. */
type Page = 'hoy' | 'inicio' | 'metas' | 'rutinas' | 'horario' | 'calendario' | 'progreso' | 'ajustes';
type GoalMode = 'numeric' | 'qualitative' | 'milestones';
type GoalStatus = 'pending' | 'working' | 'improving' | 'consolidated' | 'achieved';
type Theme = 'aurora' | 'ocean' | 'sunset' | 'forest' | 'midnight';
type Milestone = { id: string; title: string; done: boolean };
type SelectOption = {value:string; label:string};
type Repeat = 'none' | 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'yearly' | 'custom' | 'every' | 'dates';
type LifeArea = 'mind' | 'physical' | 'purpose' | 'social' | 'other';
type ReviewPlan = { date:string; time:string; repeat:'none'|'weekly'|'monthly' };
type StepVariant = { id:string; title:string; desc:string; min:number; days:number[]; children?:Step[]; flexible?:boolean; flexWeight?:number; goalId?:string; requestEvidence?:boolean };
type Goal = { id: string; title: string; desc: string; parentId: string; color: string; area?:LifeArea; review?:ReviewPlan; startDate?: string; dueDate?: string; dependsOn?: string; current: number; target: number; unit: string; mode?: GoalMode; status?: GoalStatus; milestones?: Milestone[]; history: { date: string; value: number; note: string; status?: GoalStatus }[] };
type Step = { id: string; title: string; min: number; desc?: string; children?: Step[]; variants?:StepVariant[]; mode?:'always'|'selected'|'alternatives'; days?:number[]; chooseWhen?:'weekday'|'execute'; flexible?:boolean; flexWeight?:number; goalId?:string; requestEvidence?:boolean };
type Routine = { id: string; title: string; desc: string; steps: Step[]; color?:string; icon?:string; durationMode?:'steps'|'fixed'; durationMin?:number; requestEvidence?:boolean };
type EventItem = { id: string; title: string; date: string; endDate?: string; applyFrom?:string; time: string; minutes: number; goalId: string; routineId: string; repeat: Repeat; repeatDays?:number[]; everyDays?:number; specificDates?:string[]; kind?:'review'|'occasion'; allDay?:boolean; anchor?:'start'|'end'|'between'; endTime?:string; afterRoutineId?:string; beforeRoutineId?:string; overlapMode?:'keep'|'move'; note: string; requestEvidence?:boolean; overrides: Record<string, { time?: string; skip?: boolean }> };
type Evidence = {id:string;kind:'image';src:string;caption:string;stepId?:string;createdAt:string};
type DayReview = { note:string; closedAt:string };
type RecordLog = { evidences?:Evidence[]; completed: boolean; checkedSteps: string[]; note?: string; stepNotes?:Record<string,string>; choices?:Record<string,string> };
type Data = { version: number; goals: Goal[]; routines: Routine[]; events: EventItem[]; logs: Record<string, RecordLog>; dayReviews?:Record<string,DayReview> };
type GoalDraft = Omit<Goal,'history'>;
type RoutineDraft = Routine;
type EventDraft = EventItem;
type Modal = 'goal' | 'routine' | 'event' | 'execute' | 'progress' | 'detail' | 'help' | null;
type ConfirmDialog = {title:string; message:string; acceptLabel:string; danger:boolean};
type State = { clockMinutes:number; expandedTodayId:string; scheduleFocusId:string; sleepStart:string; sleepHours:number; soundsOn:boolean; dragOverCardId:string; confirmDialog:ConfirmDialog|null; durationDisplay:'hours'|'minutes'; returnToSchedule:boolean; scheduleContextNote:string; data: Data; page: Page; selectedDate: string; month: string; modal: Modal; goalDraft: GoalDraft; routineDraft: RoutineDraft; eventDraft: EventDraft; activeEventId: string; detailPath: string[]; progressValue: string; progressNote: string; progressStatus: GoalStatus; progressGoalId: string; toast: string; theme: Theme; modalLayout: 'vertical'|'horizontal'; guideOpen: boolean; guideStep: number; guideGoalId: string; guideEventId: string; helpTopic: string; helpOpen:boolean; areaFilter:LifeArea|'all'; goalView: 'cards'|'map'; mapGrouping: 'structure'|'time'; colorEditorOpen:boolean; hexDraft:string; draggedStepId:string; dragTargetId:string; draggedCardType:''|'goal'|'routine'; draggedCardId:string; datePickerMonth:string; calendarDetailOpen:boolean; advancedOpen:boolean; expandedGoalPick:string[]; helpX:number|null; helpY:number|null; reviewDraft:string; evidenceCaption:string };

const STORE = 'fullhouse-v01';
const SLEEP_START_STORE='fullhouse-sleep-start-v09';
const SLEEP_HOURS_STORE='fullhouse-sleep-hours-v09';
const SOUND_STORE='fullhouse-check-sound-v09';
function clockNow():number{const d=new Date();return d.getHours()*60+d.getMinutes();}
function sleepSections(start:number,length:number):{start:number;end:number}[]{const end=start+length;if(end<=1440)return [{start,end}];return [{start,end:1440},{start:0,end:end-1440}];}
function safeSleepHours(v:number):number{return [7,7.5,8,8.5,9].includes(v)?v:8;}
function taskProgress(data:Data,e:EventItem,date:string):{done:number;total:number}{const log=data.logs[key(e,date)];const r=data.routines.find(r=>r.id===e.routineId);if(!r)return {done:log?.completed?1:0,total:1};const leaves=leafSteps(activeSteps(r.steps,date,log?.choices||{}));return {done:log?.completed?Math.max(1,leaves.length):leaves.filter(s=>log?.checkedSteps?.includes(s.id)).length,total:Math.max(1,leaves.length)};}
function eventTint(data:Data,e:EventItem):string{return goalColor(data,e.goalId)||data.routines.find(r=>r.id===e.routineId)?.color||'#a26cf4';}
const LEGACY_STORE = 'botanica-planificador-v01';
const colorOptions = ['#a26cf4','#ed6dba','#f7a853','#39c8ab','#54a9f4','#ec6c73','#8579e8','#9bc55c','#be81f2','#d8a34c','#ff8e5b','#37b6cc','#ec6f93','#7e95e9','#40b67a','#ce7390','#a85fe0','#738c98'];
const ADVANCED_STORE='fullhouse-advanced-v08';
const DURATION_STORE='fullhouse-duration-display-v07';
const THEME_STORE = 'fullhouse-theme-v02';
const LAYOUT_STORE = 'fullhouse-modal-layout-v02';
const GUIDE_STORE = 'fullhouse-onboarding-v03'; // Mantener para no reiniciar guías ya finalizadas.
function getPreference(name:string):string{try{return localStorage.getItem(name)||'';}catch{return '';}}
function putPreference(name:string,value:string):void{try{localStorage.setItem(name,value);}catch(err){console.warn('No se pudo guardar preferencia',err);}}
const lifeAreas:{id:LifeArea;title:string;detail:string;color:string}[]=[
  {id:'mind',title:'Mente',detail:'Aprendizaje, experiencias, hábitos y crecimiento personal.',color:'#8d70ec'},
  {id:'physical',title:'Físico',detail:'Fuerza, salud, habilidades, movimiento y alimentación.',color:'#e77991'},
  {id:'purpose',title:'Propósito',detail:'Trabajo, deberes, proyectos, aspiraciones y sueños.',color:'#e9a35c'},
  {id:'social',title:'Social',detail:'Familia, amistades, relaciones y convivencia.',color:'#56b8ac'},
  {id:'other',title:'Otro ámbito',detail:'Objetivos que todavía no encajan en los demás.',color:'#7899d9'}
];
function areaInfo(id?:LifeArea){return lifeAreas.find(a=>a.id===id)||lifeAreas[2];}
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
  {page:'metas' as Page,title:'1. Crea tu primera meta',text:'Una meta señala una dirección. Escribe algo que de verdad quieras mejorar; puedes elegir su ámbito y cómo medir su avance. Si ya tienes una meta, también puedes seleccionarla.',action:'Crear una meta'},
  {page:'metas' as Page,title:'2. Divide para poder avanzar',text:'Una meta grande puede resultar abstracta. Dividirla en submetas pequeñas crea un camino concreto, permite saber qué sigue y evita que pierdas el rumbo. Añade ahora una primera submeta.',action:'Crear una submeta'},
  {page:'calendario' as Page,title:'3. Revisa tu rumbo',text:'Establecer una fecha de revisión te ayuda a comprobar si las acciones te están acercando a lo que deseas. Programa una revisión: es una fecha importante, no otra tarea diaria.',action:'Programar revisión'},
  {page:'rutinas' as Page,title:'4. Convierte la intención en acciones',text:'La constancia nace de acciones concretas. Una rutina define qué hacer y en qué orden, para que avanzar no dependa de improvisar cada día. Programa tu primera rutina.',action:'Programar una rutina'},
  {page:'horario' as Page,title:'5. Conecta las piezas de tu día',text:'El horario reserva tiempo real para tus planes. Abre el bloque que acabas de programar y explora sus pasos: de lo grande a lo pequeño, sin perderte.',action:'Abrir mi bloque'},
  {page:'horario' as Page,title:'¡Tu primer plan está conectado!',text:'Ya has recorrido meta → submeta → fecha de revisión → rutina → horario. Puedes seguir explorando y ajustando tu sistema.',action:'Entrar a Fullhouse'}
];
const weekdays = ['L','M','Mié','J','V','S','D'];
const weekdayNames=['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
const DAYS=[0,1,2,3,4,5,6];
const routineIcons=['checklist','sun','moon','target','spark','clock','calendar','chart','heart','book','dumbbell','coffee','star','briefcase','music'];
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
function gDraft():GoalDraft {return {id:'',title:'',desc:'',parentId:'',area:'purpose',dependsOn:'',startDate:'',dueDate:'',color:colorOptions[0],current:0,target:0,unit:'',mode:'qualitative',status:'pending',milestones:[]};}
function rDraft():RoutineDraft {return {id:'',title:'',desc:'',icon:'checklist',durationMode:'steps',durationMin:30,steps:[{id:uid(),title:'',min:5}]};}
function eDraft(date=today()):EventDraft {return {id:'',title:'',date,time:'08:00',minutes:30,goalId:'',routineId:'',repeat:'none',repeatDays:[],everyDays:2,specificDates:[],note:'',overrides:{}};}
function seed():Data {
  const d=today();
  const goal1='g-phys', goal2='g-strength', goal3='g-creative';
  return {version:1,
    goals:[
      {id:goal1,title:'Desarrollo físico',desc:'Construir hábitos sostenibles y mejorar mis capacidades.',parentId:'',area:'physical',color:colorOptions[0],current:0,target:0,unit:'',history:[]},
      {id:goal2,title:'Progreso en fuerza',desc:'Ejemplo de meta medible; cambia las cifras a tus propias referencias.',parentId:goal1,area:'physical',color:colorOptions[1],current:6,target:10,unit:'sesiones',history:[]},
      {id:goal3,title:'Proyectos personales',desc:'Reservar tiempo de concentración y registrar entregables.',parentId:'',area:'purpose',color:colorOptions[2],current:0,target:0,unit:'',history:[]}
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
  const earliest=e.date;
  if(date<earliest||(e.endDate&&date>e.endDate))return false;
  if(e.overrides?.[date]?.skip)return false;
  if(e.kind==='occasion'&&e.repeat==='none'&&e.endDate)return date<=e.endDate;
  if(e.repeat==='none')return e.date===date;
  const day=parseDay(date),start=parseDay(earliest);
  const weekday=day.getDay();
  if(e.repeat==='daily')return true;
  if(e.repeat==='weekdays')return weekday>=1&&weekday<=5;
  if(e.repeat==='weekly')return weekday===start.getDay();
  if(e.repeat==='custom')return (e.repeatDays||[]).includes(weekday);
  if(e.repeat==='every')return Math.round((day.getTime()-start.getTime())/86400000)%Math.max(1,e.everyDays||1)===0;
  if(e.repeat==='monthly')return day.getDate()===start.getDate();
  if(e.repeat==='yearly')return day.getDate()===start.getDate()&&day.getMonth()===start.getMonth();
  if(e.repeat==='dates')return (e.specificDates||[]).includes(date)||date===e.date;
  return false;
}
type ScheduleFrame={start:number;end:number;length:number};
function routineForDay(e:EventItem,date:string,data:Data):Step[]{const r=data.routines.find(r=>r.id===e.routineId);return r?activeSteps(r.steps,date,data.logs[key(e,date)]?.choices):[];}
function baseLength(e:EventItem,date:string,data:Data):number{const r=data.routines.find(x=>x.id===e.routineId);return r?Math.max(1,r.durationMode==='fixed'&&Number(r.durationMin)>0?Number(r.durationMin):routineForDay(e,date,data).reduce((n,s)=>n+stepMinutes(s),0)):Math.max(1,e.minutes);}
/* Las referencias se guardan por RUTINA; siguen válidas al dividir una programación para preservar su historial. */
function eventFrame(e:EventItem,date:string,data:Data,visited:Set<string>=new Set()):ScheduleFrame|null{
  if(visited.has(e.id))return null;
  if(e.allDay)return {start:0,end:1440,length:1440};
  if(e.anchor==='between'){
    if(!e.afterRoutineId||!e.beforeRoutineId||e.afterRoutineId===e.beforeRoutineId)return null;
    const nextVisited=new Set(visited);nextVisited.add(e.id);
    const find=(rid:string)=>data.events.find(x=>x.id!==e.id&&x.routineId===rid&&occurs(x,date));
    const after=find(e.afterRoutineId),before=find(e.beforeRoutineId);
    if(!after||!before)return null;
    const a=eventFrame(after,date,data,nextVisited),b=eventFrame(before,date,data,nextVisited);
    if(!a||!b||a.end>=b.start)return null;
    return {start:a.end,end:b.start,length:b.start-a.end};
  }
  const length=baseLength(e,date,data),at=e.overrides?.[date]?.time;
  const start=at?minutes(at):e.anchor==='end'&&e.endTime?minutes(e.endTime)-length:minutes(e.time);
  if(start<0||start+length>1440)return null;
  return {start,end:start+length,length};
}
function eventsOn(data:Data,date:string):EventItem[]{return data.events.filter(e=>occurs(e,date)&&(e.allDay||!!eventFrame(e,date,data))).sort((a,b)=>eventTime(a,date,data).localeCompare(eventTime(b,date,data)));}
function eventTime(e:EventItem,date:string,data?:Data):string {const frame=data?eventFrame(e,date,data):null;return frame?timeString(frame.start):e.overrides?.[date]?.time||e.time;}
function scheduleStart(e:EventItem,date:string,data:Data):number{return eventFrame(e,date,data)?.start??minutes(e.time);}

function sameScheduleActive(e:EventItem,cutoff:string):boolean{return !!e.routineId && (!e.endDate||e.endDate>=cutoff) && (e.repeat!=='none'||e.date>=cutoff);}
function reorderByIds<T extends {id:string}>(items:T[],from:string,to:string):T[]{const list=[...items],a=list.findIndex(i=>i.id===from),b=list.findIndex(i=>i.id===to);if(a<0||b<0||a===b)return items;const [m]=list.splice(a,1);list.splice(b,0,m);return list;}

function repeatCollision(a:EventItem,b:EventItem):boolean {
  if(!a.routineId||a.routineId!==b.routineId)return false;
  const start=a.date>b.date?a.date:b.date;
  const maxEnd=a.endDate&&b.endDate?(a.endDate<b.endDate?a.endDate:b.endDate):a.endDate||b.endDate||addDays(start,1462);
  const candidates=new Set<string>();
  for(let i=0;i<=1462&&addDays(start,i)<=maxEnd;i++)candidates.add(addDays(start,i));
  for(const d of [...(a.specificDates||[]),...(b.specificDates||[])])if(d>=start)candidates.add(d);
  return [...candidates].some(date=>occurs(a,date)&&occurs(b,date));
}
function reorderTree(steps:Step[],from:string,to:string):{steps:Step[];moved:boolean}{
  const a=steps.findIndex(x=>x.id===from),b=steps.findIndex(x=>x.id===to);
  if(a>=0&&b>=0&&a!==b){const next=[...steps];const [item]=next.splice(a,1);next.splice(b,0,item);return {steps:next,moved:true};}
  for(let i=0;i<steps.length;i++)if(steps[i].children){const changed=reorderTree(steps[i].children||[],from,to);if(changed.moved)return {steps:steps.map((s,j)=>i===j?{...s,children:changed.steps}:s),moved:true};}
  for(let i=0;i<steps.length;i++)for(const v of steps[i].variants||[])if(v.children){const changed=reorderTree(v.children,from,to);if(changed.moved)return {steps:steps.map((s,j)=>i===j?{...s,variants:s.variants?.map(item=>item.id===v.id?{...item,children:changed.steps}:item)}:s),moved:true};}
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
  if(grouping==='structure'&&gs.length){
    let nextLeaf=0;const seen=new Set<string>();const positions=new Map<string,number>();
    const place=(g:Goal):number=>{if(seen.has(g.id))return positions.get(g.id)??72;seen.add(g.id);const children=gs.filter(x=>x.parentId===g.id&&!seen.has(x.id));const y=children.length?children.map(place).reduce((a,b)=>a+b,0)/children.length:72+(nextLeaf++)*146;positions.set(g.id,y);return y;};
    gs.filter(g=>!g.parentId||!gs.some(x=>x.id===g.parentId)).forEach(place);gs.filter(g=>!seen.has(g.id)).forEach(place);
    nodes.forEach(n=>n.y=positions.get(n.goal.id)??72);
    return {nodes,edges,width:(last+1)*280+40,height:Math.max(340,nextLeaf*146+130),labels};
  }
  return {nodes,edges,width:(last+1)*280+40,height:largest*146+108,labels};
}

function key(e:EventItem,date:string):string{return `${e.id}@${date}`;}
function done(data:Data,e:EventItem,date:string):boolean {return !!data.logs[key(e,date)]?.completed;}
function durationText(value:number,format:'hours'|'minutes'='hours'):string {const total=Math.max(0,Math.round(value));if(format==='minutes')return total+' min';const h=Math.floor(total/60),m=total%60;return h?`${h} h${m?' '+m+' min':''}`:`${m} min`;}
function percent(current:number,target:number):number{return target>0?bound(Math.round((current/target)*100),0,100):0;}
function goalMode(g:Goal|GoalDraft):GoalMode{return g.mode||(g.target>0?'numeric':'qualitative');}
function goalStatus(g:Goal|GoalDraft):GoalStatus{return g.status||'pending';}
function statusLabel(s:GoalStatus):string{return goalStatuses.find(x=>x.id===s)?.label||'Por comenzar';}
function goalMilestones(g:Goal|GoalDraft):Milestone[]{return g.milestones||[];}
function stepMinutes(s:Step):number{return s.children&&s.children.length?s.children.reduce((a,c)=>a+stepMinutes(c),0):s.min;}
function activeStep(s:Step,date:string,choices:Record<string,string>={}):Step|null{
  const weekday=parseDay(date).getDay();
  if(s.mode==='selected' && !(s.days||[]).includes(weekday))return null;
  const mode=s.mode||((s.variants||[]).length?'alternatives':'always');
  const match=mode==='alternatives'?s.chooseWhen==='execute'?s.variants?.find(v=>v.id===choices[s.id]):s.variants?.find(v=>v.days.includes(weekday)):undefined;
  if(s.mode==='alternatives'&&s.chooseWhen!=='execute'&&!match){
    const baseDays=s.days||DAYS.filter(n=>!(s.variants||[]).some(v=>v.days.includes(n)));
    if(!baseDays.includes(weekday))return null;
  }
  const chosen=match?{...s,title:match.title||s.title,desc:match.desc||'',min:match.min,children:match.children||[],flexible:!!match.flexible,flexWeight:match.flexWeight||1,goalId:match.goalId||s.goalId,requestEvidence:match.requestEvidence??s.requestEvidence}:s;
  return {...chosen,children:chosen.children?.map(c=>activeStep(c,date,choices)).filter(Boolean) as Step[]};
}
function activeSteps(steps:Step[],date:string,choices:Record<string,string>={}):Step[]{return steps.map(s=>activeStep(s,date,choices)).filter(Boolean) as Step[];}
function routineMinutesOn(r:Routine,date:string):number{return r.durationMode==='fixed'&&Number(r.durationMin)>0?Math.round(Number(r.durationMin)):activeSteps(r.steps,date).reduce((total,s)=>total+stepMinutes(s),0);}
function durationOn(e:EventItem,date:string,data:Data):number{return eventFrame(e,date,data)?.length??baseLength(e,date,data);}
function leafAllocation(steps:Step[],available:number):Record<string,number>{
  const leaves=leafSteps(steps),fixed=leaves.filter(s=>!s.flexible).reduce((n,s)=>n+s.min,0);
  const flex=leaves.filter(s=>s.flexible),remaining=Math.max(0,Math.round(available-fixed)),result:Record<string,number>={};
  // Distribución proporcional por peso (ej. 90/10). El redondeo preserva exactamente los minutos disponibles.
  const total=flex.reduce((sum,s)=>sum+Math.max(1,s.flexWeight||1),0);
  const portions=flex.map(s=>({id:s.id,ideal:remaining*Math.max(1,s.flexWeight||1)/Math.max(1,total)}));
  let used=0;portions.forEach(p=>{result[p.id]=Math.floor(p.ideal);used+=result[p.id];});
  portions.map(p=>({...p,fraction:p.ideal-Math.floor(p.ideal)})).sort((a,b)=>b.fraction-a.fraction).slice(0,remaining-used).forEach(p=>result[p.id]++);
  return result;
}
function routineBalance(r:Routine,date:string,available?:number,choices:Record<string,string>={}):{fixed:number;flex:number;space:number;error:string}{
  const steps=activeSteps(r.steps,date,choices),fixed=fixedStepMinutes(steps),flex=leafSteps(steps).filter(s=>s.flexible).length;
  const space=available??routineMinutesOn(r,date);
  const error=fixed>space?`Faltan ${durationText(fixed-space)}: los pasos fijos exceden el tiempo disponible.`:flex===0&&fixed!==space?`Sobran ${durationText(space-fixed)}: añade un contenido flexible o ajusta los pasos.`:'';
  return {fixed,flex,space,error};
}
function goalColor(data:Data,goalId?:string):string|undefined{return data.goals.find(g=>g.id===goalId)?.color;}

function effectiveStepMinutes(s:Step,alloc:Record<string,number>):number{
  return s.children?.length?s.children.reduce((n,c)=>n+effectiveStepMinutes(c,alloc),0):s.flexible?(alloc[s.id]??s.min):s.min;
}
function fixedStepMinutes(steps:Step[]):number{return leafSteps(steps).filter(s=>!s.flexible).reduce((n,s)=>n+s.min,0);}
function unresolvedManual(steps:Step[],choices:Record<string,string>={}):Step[]{const result:Step[]=[];
  const walk=(items:Step[])=>items.forEach(s=>{if(s.mode==='alternatives'&&s.chooseWhen==='execute'&&!choices[s.id])result.push(s);walk(s.children||[]);});walk(steps);return result;
}
function upcomingNote(data:Data,e:EventItem,date:string,stepId?:string):string{
  /* Solo el siguiente día en el que realmente aparece este paso/bloque. */
  const refs=data.events.filter(item=>e.routineId?item.routineId===e.routineId:item.id===e.id);
  const candidates=Object.entries(data.logs).flatMap(([logKey,log])=>{
    const i=logKey.lastIndexOf('@'),id=logKey.slice(0,i),at=logKey.slice(i+1);
    const value=stepId?log.stepNotes?.[stepId]:log.note;
    return value&&at<date&&refs.some(item=>item.id===id)?[{at,value}]:[];
  }).sort((a,b)=>b.at.localeCompare(a.at));
  for(const item of candidates){
    let next=addDays(item.at,1);let count=0;
    while(next<=date&&count++<3660){
      const valid=refs.find(v=>occurs(v,next)&&!!eventFrame(v,next,data));
      const active=valid?(!stepId||routineForDay(valid,next,data).some(s=>stepPresent(s,stepId))):false;
      if(active)return next===date?item.value:'';
      next=addDays(next,1);
    }
  }
  return '';
}
function originalStepTitle(data:Data,routineId:string,id:string):string{
  const routine=data.routines.find(r=>r.id===routineId);if(!routine)return '';
  const find=(steps:Step[]):string=>{for(const s of steps){if(s.id===id)return s.title;const child=find(s.children||[]);if(child)return child;for(const v of s.variants||[]){const alt=find(v.children||[]);if(alt)return alt;}}return '';};
  return find(routine.steps);
}
function stepPresent(s:Step,id:string):boolean{return s.id===id||!!s.children?.some(c=>stepPresent(c,id));}

function readableOn(color:string):string{const rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)/255).map(x=>x<=.04045?x/12.92:Math.pow((x+.055)/1.055,2.4));return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722>.36?'#201b2e':'#fff';} 
function routineMinutes(r:Routine):number{return r.durationMode==='fixed'&&Number(r.durationMin)>0?Number(r.durationMin):r.steps.reduce((a,s)=>a+stepMinutes(s),0);}
function leafSteps(steps:Step[]):Step[]{return steps.flatMap(s=>s.children&&s.children.length?leafSteps(s.children):[s]);}
function editStepTree(steps:Step[],id:string,fn:(s:Step)=>Step):Step[]{return steps.map(s=>s.id===id?fn(s):{...s,children:s.children?editStepTree(s.children,id,fn):undefined,variants:s.variants?.map(v=>({...v,children:v.children?editStepTree(v.children,id,fn):undefined}))});}
function deleteStepTree(steps:Step[],id:string):Step[]{return steps.filter(s=>s.id!==id).map(s=>({...s,children:s.children?deleteStepTree(s.children,id):undefined,variants:s.variants?.map(v=>({...v,children:v.children?deleteStepTree(v.children,id):undefined}))}));}
function moveStepTree(steps:Step[],id:string,direction:number):Step[]{const arr=steps.map(s=>({...s,children:s.children?moveStepTree(s.children,id,direction):undefined,variants:s.variants?.map(v=>({...v,children:v.children?moveStepTree(v.children,id,direction):undefined}))}));const i=arr.findIndex(s=>s.id===id);const j=i+direction;if(i>=0&&j>=0&&j<arr.length){[arr[i],arr[j]]=[arr[j],arr[i]];}return arr;}
function getStepByPath(steps:Step[],path:string[]):Step|undefined{let list=steps,last:Step|undefined;for(const id of path){last=list.find(s=>s.id===id);if(!last)return undefined;list=last.children||[];}return last;}
function fitArea(el:HTMLTextAreaElement|null):void{if(!el)return;el.style.height='auto';el.style.height=Math.max(86,el.scrollHeight+2)+'px';}
class AutoTextarea extends React.Component<any>{
  el:HTMLTextAreaElement|null=null;
  assign=(node:HTMLTextAreaElement|null)=>{if(node!==this.el){this.el=node;if(node)fitArea(node);}};
  componentDidUpdate(prev:any){if(prev.value!==this.props.value)fitArea(this.el);}
  render(){const {onChange,...others}=this.props;return <textarea {...others} ref={this.assign} onChange={(e:any)=>{onChange(e);fitArea(e.currentTarget)}}/>;}
}
class NumberField extends React.Component<{value:number;min?:number;max?:number;onCommit:(v:number)=>void;ariaLabel?:string},{text:string;editing:boolean}>{
  constructor(p:any){super(p);this.state={text:String(p.value??''),editing:false};}
  componentDidUpdate(prev:any){if(!this.state.editing&&prev.value!==this.props.value)this.setState({text:String(this.props.value??'')});}
  commit=()=>{const raw=this.state.text.trim();const proposed=raw===''?this.props.min??0:Number(raw.replace(',','.'));const v=Number.isFinite(proposed)?bound(proposed,this.props.min??0,this.props.max??999999):this.props.min??0;this.setState({text:String(v),editing:false});this.props.onCommit(v);};
  render(){return <input type="text" inputMode="decimal" aria-label={this.props.ariaLabel||'Cantidad'} value={this.state.text} onFocus={()=>this.setState({editing:true})} onChange={(e:any)=>{if(/^\d*([.,]\d*)?$/.test(e.target.value))this.setState({text:e.target.value});}} onBlur={this.commit}/>;}
}

class NoteEditor extends React.Component<{value:string;carry?:string;label:string;onSave:(value:string)=>void},{text:string;open:boolean}>{
  constructor(props:any){super(props);this.state={text:props.value||'',open:false};}
  componentDidUpdate(prev:any){if(prev.value!==this.props.value)this.setState({text:this.props.value||''});}
  render():any{return <div className={'day-note-editor '+(this.state.open?'is-expanded':'is-collapsed')}>
    <div className='row spread'><div className='day-note-title'><Icon name='book' size={17}/><strong>{this.props.label}</strong></div><Btn tiny kind='secondary' onClick={()=>this.setState({open:!this.state.open,text:this.props.value||''})}>{this.state.open?'Cerrar':this.props.value?'Ver / editar nota':'Añadir nota'}</Btn></div>
    {!!this.props.value&&!this.state.open&&<p className='saved-note-excerpt'>✎ {this.props.value}</p>}
    {this.props.carry&&<div className='note-from-previous'><strong>✦ Nota de la ocasión anterior</strong><p>{this.props.carry}</p><small>Aparece solamente esta vez; no cambia las instrucciones permanentes.</small></div>}
    {this.state.open&&<><AutoTextarea value={this.state.text} onChange={(ev:any)=>this.setState({text:ev.target.value})} placeholder='¿Qué sucedió? ¿Qué mejorarías o recordarías la próxima vez?' maxLength={2000}/>
    <div className='row spread'><span className='caption'>Se conserva en esta fecha y aparecerá una vez en la próxima ocasión.</span><Btn tiny kind='secondary' disabled={this.state.text===(this.props.value||'')} onClick={()=>{this.props.onSave(this.state.text);this.setState({open:false})}}>Guardar nota</Btn></div></>}
  </div>}
}
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
class CalendarDateInput extends React.Component<{value:string;min?:string;label?:string;rangeStart?:string;onChange:(v:string)=>void},{open:boolean;month:string;style:any}> {
  root:HTMLElement|null=null;
  menu:HTMLElement|null=null;
  constructor(props:any){super(props);this.state={open:false,month:firstMonth(props.value||today()),style:{}};}
  componentDidMount(){document.addEventListener('pointerdown',this.outside);window.addEventListener('resize',this.position);document.addEventListener('scroll',this.position,true);}
  componentWillUnmount(){document.removeEventListener('pointerdown',this.outside);window.removeEventListener('resize',this.position);document.removeEventListener('scroll',this.position,true);}
  componentDidUpdate(prev:any){if(prev.value!==this.props.value&&this.props.value)this.setState({month:firstMonth(this.props.value)});}
  outside=(e:any)=>{if(this.state.open&&!this.root?.contains(e.target)&&!this.menu?.contains(e.target))this.setState({open:false});};
  position=()=>{if(this.state.open&&this.root){const r=this.root.getBoundingClientRect();const popupHeight=350;this.setState({style:{left:Math.min(Math.max(8,r.left),Math.max(8,innerWidth-326)),top:innerHeight-r.bottom>popupHeight+8?r.bottom+5:Math.max(8,r.top-popupHeight-5)}});}};
  toggle=()=>{if(this.state.open)this.setState({open:false});else{const r=this.root!.getBoundingClientRect();this.setState({open:true,month:firstMonth(this.props.value||today()),style:{left:Math.min(Math.max(8,r.left),Math.max(8,innerWidth-326)),top:innerHeight-r.bottom>358?r.bottom+5:Math.max(8,r.top-358)}});}};
  monthMove=(delta:number)=>{const d=parseDay(this.state.month);d.setMonth(d.getMonth()+delta);this.setState({month:firstMonth(ymd(d))});};
  render():any{const first=parseDay(this.state.month),offset=(first.getDay()+6)%7,cells=Array.from({length:42},(_,i)=>addDays(this.state.month,i-offset));
    const panel=this.state.open?<section className='date-popover' role='dialog' aria-label={'Elegir '+(this.props.label||'fecha')} style={this.state.style} ref={(node:any)=>this.menu=node}><div className='date-popover-head'><button className='icon-btn' title='Mes anterior' onClick={()=>this.monthMove(-1)}><Icon name='left' size={16}/></button><strong>{fmtMonth(this.state.month)}</strong><button className='icon-btn' title='Mes siguiente' onClick={()=>this.monthMove(1)}><Icon name='right' size={16}/></button></div><div className='date-popover-grid'>{['L','M','Mié','J','V','S','D'].map(x=><span className='date-weekday' key={x}>{x}</span>)}{cells.map(day=><button type='button' key={day} disabled={!!this.props.min&&day<this.props.min} aria-label={fmtDate(day)} aria-pressed={day===this.props.value} title={day} className={'date-popover-day '+(day.slice(0,7)===this.state.month.slice(0,7)?'':'outside ')+(day===this.props.value?'selected ':'')+(this.props.rangeStart&&day>=this.props.rangeStart&&day<=this.props.value?'in-range ':'')} onClick={()=>{this.props.onChange(day);this.setState({open:false});}}>{parseDay(day).getDate()}</button>)}</div><div className='date-popover-footer'><button type='button' onClick={()=>{this.props.onChange('');this.setState({open:false});}}>Quitar fecha</button><button type='button' onClick={()=>{if(!this.props.min||today()>=this.props.min)this.props.onChange(today());this.setState({open:false});}}>Hoy</button></div></section>:null;
    return <div className='date-input-wrap' ref={(e:any)=>this.root=e}><button type='button' className='date-field-button' onClick={this.toggle} aria-haspopup='dialog' aria-expanded={this.state.open}><Icon name='calendar' size={17}/><span>{this.props.value?fmtDate(this.props.value)+' de '+parseDay(this.props.value).getFullYear():'Elegir fecha'}</span><span>⌄</span></button>{panel&&ReactDOM.createPortal(panel,document.querySelector('.app-shell')||document.body)}</div>;
  }
}
function TimePicker({value,onChange}:{value:string;onChange:(x:string)=>void}):any{
 const [hour,minute]=(value||'08:00').split(':');
 const hours=Array.from({length:24},(_,i)=>String(i).padStart(2,'0')).map(v=>({value:v,label:v+' h'}));
 const mins=Array.from({length:60},(_,i)=>String(i).padStart(2,'0')).map(v=>({value:v,label:v+' min'}));
 return <div className='time-picker'><span className='time-icon'><Icon name='clock' size={18}/></span><FriendlySelect value={hour} ariaLabel='Seleccionar hora' options={hours} onChange={h=>onChange(h+':'+(minute||'00'))}/><span className='time-colon'>:</span><FriendlySelect value={minute} ariaLabel='Seleccionar minuto' options={mins} onChange={m=>onChange((hour||'08')+':'+m)}/></div>;
}
function Icon({name,size=19}:{name:string;size?:number}){return <span className="icon" style={{display:'inline-flex',alignItems:'center',justifyContent:'center'}}><svg style={{width:size,height:size,fill:'none',stroke:'currentColor',strokeWidth:1.8,strokeLinecap:'round',strokeLinejoin:'round'}}><use href={'#i-'+name}/></svg></span>}
function Btn({children,onClick,kind='',tiny=false,disabled=false,type='button',title}:{children?:any;onClick?:()=>void;kind?:string;tiny?:boolean;disabled?:boolean;type?:'button'|'submit';title?:string}){return <button className={`btn ${kind} ${tiny?'tiny':''}`} onClick={onClick} type={type} disabled={disabled} title={title}>{children}</button>}
class Planner extends React.Component<{},State> {
  clockTimer:any=null; audioCtx:any=null; toastTimer:any=null; backdropDown=false; initialDraft:string=''; confirmResolver:((accepted:boolean)=>void)|null=null; pendingSchedule:EventDraft|null=null;
  constructor(props:{}){
    super(props);
    const d=today();
    this.state={clockMinutes:clockNow(),expandedTodayId:'',scheduleFocusId:'',sleepStart:getPreference(SLEEP_START_STORE)||'23:00',sleepHours:safeSleepHours(Number(getPreference(SLEEP_HOURS_STORE))||8),soundsOn:getPreference(SOUND_STORE)!=='off',dragOverCardId:'',confirmDialog:null,durationDisplay:getPreference(DURATION_STORE)==='minutes'?'minutes':'hours',returnToSchedule:false,scheduleContextNote:'',data:load(),page:'inicio',selectedDate:d,month:firstMonth(d),modal:null,goalDraft:gDraft(),routineDraft:rDraft(),eventDraft:eDraft(d),activeEventId:'',detailPath:[],progressValue:'',progressNote:'',progressStatus:'pending',progressGoalId:'',toast:'',theme:(themeOptions.some(x=>x.id===getPreference(THEME_STORE))?getPreference(THEME_STORE):'aurora') as Theme,modalLayout:getPreference(LAYOUT_STORE)==='horizontal'?'horizontal':'vertical',guideOpen:getPreference(GUIDE_STORE)!=='yes',guideStep:0,guideGoalId:'',guideEventId:'',helpTopic:'',helpOpen:false,areaFilter:'all',goalView:'cards',mapGrouping:'structure',colorEditorOpen:false,hexDraft:colorOptions[0],draggedStepId:'',dragTargetId:'',draggedCardType:'',draggedCardId:'',datePickerMonth:firstMonth(d),calendarDetailOpen:false,advancedOpen:getPreference(ADVANCED_STORE)==='yes',expandedGoalPick:[],helpX:null,helpY:null,reviewDraft:'',evidenceCaption:''};
  }
  componentDidMount():void{this.syncModalState();document.addEventListener('keydown',this.globalKeydown);this.resizeTextareas();this.clockTimer=setInterval(()=>this.setState({clockMinutes:clockNow()}),30000);}
  componentDidUpdate(_:any,prev:State):void{
    this.syncModalState();
    if(prev.modal!==this.state.modal||prev.modalLayout!==this.state.modalLayout)this.resizeTextareas();
    if(prev.toast!==this.state.toast){if(this.toastTimer)clearTimeout(this.toastTimer);if(this.state.toast)this.toastTimer=setTimeout(()=>this.setState({toast:''}),3500);}
  }
  componentWillUnmount():void{if(this.clockTimer)clearInterval(this.clockTimer);if(this.audioCtx?.close)this.audioCtx.close();if(this.confirmResolver){this.confirmResolver(false);this.confirmResolver=null;}if(this.toastTimer)clearTimeout(this.toastTimer);document.body.style.overflow='';document.removeEventListener('keydown',this.globalKeydown);document.removeEventListener('mousemove',this.moveStepDrag,true);document.removeEventListener('mouseup',this.endStepDrag,true);}
  globalKeydown=(e:KeyboardEvent):void=>{if(e.key==='Escape'){if(this.state.confirmDialog){this.resolveConfirm(false);return;}if(this.state.helpOpen)this.setState({helpOpen:false});else if(this.state.modal)this.close();else if(this.state.guideOpen)this.finishGuide();}};
  syncModalState=():void=>{document.body.style.overflow=this.state.confirmDialog||this.state.modal||(this.state.guideOpen&&this.state.guideStep===0)?'hidden':'';};
  resizeTextareas=():void=>{document.querySelectorAll<HTMLTextAreaElement>('.modal-body textarea').forEach(fitArea);};
  setTheme=(theme:Theme):void=>{putPreference(THEME_STORE,theme);this.setState({theme});};
  changeDurationDisplay=(durationDisplay:'hours'|'minutes'):void=>{putPreference(DURATION_STORE,durationDisplay);this.setState({durationDisplay});};
  dur=(m:number):string=>durationText(m,this.state.durationDisplay);
  playCheckSound=():void=>{if(!this.state.soundsOn)return;try{const w=window as any,AC=w.AudioContext||w.webkitAudioContext;if(!AC)return;const ctx=this.audioCtx||new AC();this.audioCtx=ctx;if(ctx.state==='suspended')ctx.resume();const start=ctx.currentTime;[0,0.082].forEach((t,i)=>{const osc=ctx.createOscillator(),gain=ctx.createGain();osc.type='sine';osc.frequency.setValueAtTime(i?880:660,start+t);gain.gain.setValueAtTime(.0001,start+t);gain.gain.exponentialRampToValueAtTime(.07,start+t+.012);gain.gain.exponentialRampToValueAtTime(.0001,start+t+.11);osc.connect(gain);gain.connect(ctx.destination);osc.start(start+t);osc.stop(start+t+.115);});}catch(err){console.warn('Sonido no disponible',err);}};
  setSleep=(start:string,hours:number):void=>{const valid=safeSleepHours(hours);putPreference(SLEEP_START_STORE,start);putPreference(SLEEP_HOURS_STORE,String(valid));this.setState({sleepStart:start,sleepHours:valid});};
  setSounds=(on:boolean):void=>{putPreference(SOUND_STORE,on?'on':'off');this.setState({soundsOn:on});if(on)this.playCheckSound();};
  askConfirm=(title:string,message:string,acceptLabel='Confirmar',danger=false):Promise<boolean>=>new Promise(resolve=>{if(this.confirmResolver){this.confirmResolver(false);}this.confirmResolver=resolve;this.setState({confirmDialog:{title,message,acceptLabel,danger}});});
  resolveConfirm=(accept:boolean):void=>{const resolve=this.confirmResolver;this.confirmResolver=null;this.setState({confirmDialog:null});if(resolve)resolve(accept);};
  renderConfirm=():any=>{const dialog=this.state.confirmDialog;if(!dialog)return null;return <div className='confirmation-backdrop' onMouseDown={e=>{if(e.target===e.currentTarget)this.resolveConfirm(false)}}><section className='confirmation-dialog' role='alertdialog' aria-modal='true' aria-labelledby='confirm-title' aria-describedby='confirm-description'><div className={'confirmation-symbol '+(dialog.danger?'danger':'')}><Icon name={dialog.danger?'trash':'help'} size={24}/></div><div className='eyebrow'>FULLHOUSE · CONFIRMACIÓN</div><h2 id='confirm-title'>{dialog.title}</h2><p id='confirm-description'>{dialog.message}</p><div className='confirmation-actions'><Btn kind='secondary' onClick={()=>this.resolveConfirm(false)}>Cancelar</Btn><Btn kind={dialog.danger?'danger':''} onClick={()=>this.resolveConfirm(true)}>{dialog.acceptLabel}</Btn></div></section></div>};
  setLayout=(layout:'vertical'|'horizontal'):void=>{putPreference(LAYOUT_STORE,layout);this.setState({modalLayout:layout});};
  finishGuide=():void=>{putPreference(GUIDE_STORE,'yes');this.setState({guideOpen:false});};
  openGuide=():void=>this.setState({modal:null,guideOpen:true,guideStep:0,page:'inicio',guideGoalId:'',guideEventId:''});
  openHelp=(topic:string):void=>this.setState({helpOpen:true,helpTopic:topic});
  openDetail=(e:EventItem):void=>this.setState({modal:'detail',activeEventId:e.id,detailPath:[],...(this.state.guideOpen&&this.state.guideStep===5&&e.id===this.state.guideEventId?{guideStep:6}:{})});
  notice=(message:string):void=>this.setState({toast:message});
  save = (data:Data,message='Cambios guardados'):void=>{
    try{localStorage.setItem(STORE,JSON.stringify(data));this.setState({data});this.notice(message);}
    catch(err){this.setState({data});this.notice('No se pudo guardar: almacenamiento lleno o bloqueado. Exporta una copia.');}
  }
  route=(page:Page):void=>{if(this.state.guideOpen&&this.state.guideStep>0&&this.state.guideStep<6&&page!==guideSteps[this.state.guideStep].page){this.setState({toast:'Completa este paso de la guía o selecciona «Saltar tutorial».',page:guideSteps[this.state.guideStep].page});return;}this.setState({page,modal:null,...(page==='hoy'?{selectedDate:today(),reviewDraft:this.state.data.dayReviews?.[today()]?.note||''}:{})});window.scrollTo(0,0)};
  chooseDay=(s:string):void=>this.setState({selectedDate:s,month:firstMonth(s),calendarDetailOpen:this.state.page==='calendario'});
  openGoal=(goal?:Goal,parentId=''):void=>{
    const draft:GoalDraft=goal?{
      id:goal.id,title:goal.title,desc:goal.desc,parentId:goal.parentId,area:goal.area||'purpose',review:goal.review?{...goal.review}:undefined,dependsOn:goal.dependsOn||'',startDate:goal.startDate||'',dueDate:goal.dueDate||'',color:goal.color,current:goal.current,target:goal.target,unit:goal.unit,mode:goalMode(goal),status:goalStatus(goal),milestones:goalMilestones(goal).map(m=>({...m}))
    }:{...gDraft(),parentId,area:this.state.data.goals.find(g=>g.id===parentId)?.area||'purpose'};
    this.initialDraft=JSON.stringify(draft);
    this.setState({modal:'goal',colorEditorOpen:false,hexDraft:draft.color,goalDraft:draft});
  };
  openRoutine=(r?:Routine):void=>{const draft=r?JSON.parse(JSON.stringify(r)):rDraft();this.initialDraft=JSON.stringify(draft);this.setState({modal:'routine',routineDraft:draft});};
  openEvent=(e?:EventItem,kind?:'occasion'):void=>{if(e?.kind==='review'){const g=this.state.data.goals.find(x=>x.id===e.goalId);if(g){this.openGoal(g);return;}}const draft:EventDraft=e?JSON.parse(JSON.stringify(e)):{...eDraft(this.state.selectedDate),...(kind==='occasion'?{kind:'occasion' as const,allDay:true}: {})};
    if(e&&e.date<today())draft.applyFrom=today();
    this.initialDraft=JSON.stringify(draft);this.setState({modal:'event',eventDraft:draft,datePickerMonth:firstMonth(draft.date)});};
  openProgress=(g:Goal):void=>this.setState({modal:'progress',progressGoalId:g.id,progressValue:String(g.current),progressStatus:goalStatus(g),progressNote:''});
  openExecute=(e:EventItem):void=>this.setState({modal:'execute',activeEventId:e.id});
  close=(force:any=false):void=>{
    const m=this.state.modal,draft=m==='goal'?this.state.goalDraft:m==='routine'?this.state.routineDraft:m==='event'?this.state.eventDraft:null;
    const finish=()=>{if(this.state.returnToSchedule&&m==='routine'&&this.pendingSchedule){const restored=this.pendingSchedule;this.pendingSchedule=null;this.initialDraft=JSON.stringify(restored);this.setState({modal:'event',eventDraft:restored,returnToSchedule:false,scheduleContextNote:''});}else this.setState({modal:null,detailPath:[],helpOpen:false,returnToSchedule:false,scheduleContextNote:''});};
    if(force!==true&&draft&&JSON.stringify(draft)!==this.initialDraft){this.askConfirm('Salir sin guardar','Los cambios que has realizado en esta ventana se perderán.','Salir sin guardar',true).then(ok=>{if(ok)finish();});return;}
    finish();
  };
  editRoutineFromSchedule=(reason=''):void=>{
    const e=this.state.eventDraft,r=this.state.data.routines.find(r=>r.id===e.routineId);
    if(!r){this.notice('Selecciona una rutina antes de editar sus pasos.');return;}
    const advice=reason.includes('Faltan')||reason.includes('exceden')?'Reduce la duración de los pasos fijos o modifica los límites del horario.':reason.includes('Sobran')?'Puedes añadir uno o más contenidos flexibles, aumentar la duración de los pasos o cambiar los bloques límite.':'Puedes ajustar los minutos de los pasos y añadir contenidos flexibles para absorber el tiempo disponible.';
    this.pendingSchedule=JSON.parse(JSON.stringify(e));
    const draft:RoutineDraft=JSON.parse(JSON.stringify(r));this.initialDraft=JSON.stringify(draft);
    this.setState({modal:'routine',routineDraft:draft,returnToSchedule:true,scheduleContextNote:(reason?reason+'\n\n':'')+advice});
  };

  toggleAdvanced=():void=>{const advancedOpen=!this.state.advancedOpen;putPreference(ADVANCED_STORE,advancedOpen?'yes':'no');this.setState({advancedOpen});};
  goalPicker=(value:string,onChange:(id:string)=>void,empty='Sin meta vinculada'):any=>{
    const goals=this.state.data.goals,ancestors=new Set(this.state.expandedGoalPick);
    let selected=goals.find(g=>g.id===value);const traversed=new Set<string>();while(selected?.parentId&&!traversed.has(selected.id)){traversed.add(selected.id);ancestors.add(selected.parentId);selected=goals.find(g=>g.id===selected!.parentId);}
    const render=(parent:string,level:number,seen:Set<string>):any=>goals.filter(g=>g.parentId===parent).map(g=>{
      if(seen.has(g.id))return null;
      const childCount=goals.filter(x=>x.parentId===g.id).length,expanded=ancestors.has(g.id);
      return <div key={g.id} className='goal-picker-branch'><div className={'goal-picker-entry '+(value===g.id?'chosen':'')} style={{paddingLeft:(9+level*12)+'px','--goal-accent':g.color} as any}><button type='button' className='goal-picker-select' onClick={()=>{onChange(g.id);if(childCount)this.setState({expandedGoalPick:[...new Set([...ancestors,g.id])]});}}><span className='goal-picker-dot' style={{background:g.color}}/><span>{g.title}</span>{value===g.id&&<Icon name='check' size={15}/>}</button>{childCount>0&&<button type='button' className='goal-picker-expand' aria-label={expanded?'Contraer submetas':'Mostrar submetas'} onClick={()=>this.setState({expandedGoalPick:expanded?[...ancestors].filter(x=>x!==g.id):[...ancestors,g.id]})}>{expanded?'−':'+'} {childCount}</button>}</div>{expanded&&render(g.id,level+1,new Set([...seen,g.id]))}</div>;
    });
    return <div className='goal-picker-tree'><button type='button' className={'goal-picker-clear '+(!value?'chosen':'')} onClick={()=>onChange('')}>{empty}</button>{render('',0,new Set())}</div>;
  };
  helpDrag:{dx:number;dy:number}|null=null;
  updateHelpPosition=(x:number,y:number):void=>{const drag=this.helpDrag;if(!drag)return;const el=document.querySelector('.help-float') as HTMLElement|null;const width=el?.offsetWidth||340,height=el?.offsetHeight||250;this.setState({helpX:Math.max(4,Math.min(window.innerWidth-width-4,x-drag.dx)),helpY:Math.max(4,Math.min(window.innerHeight-height-4,y-drag.dy))});};
  beginHelpDrag=(e:any):void=>{if((e.target as HTMLElement).closest('button'))return;e.preventDefault();const el=(e.currentTarget as HTMLElement).closest('.help-float') as HTMLElement;if(!el)return;const rect=el.getBoundingClientRect();this.helpDrag={dx:e.clientX-rect.left,dy:e.clientY-rect.top};document.addEventListener('mousemove',this.moveHelpDragMouse);document.addEventListener('mouseup',this.endHelpDragMouse);};
  moveHelpDragMouse=(e:MouseEvent):void=>this.updateHelpPosition(e.clientX,e.clientY);
  endHelpDragMouse=():void=>{this.helpDrag=null;document.removeEventListener('mousemove',this.moveHelpDragMouse);document.removeEventListener('mouseup',this.endHelpDragMouse);};
  beginHelpTouch=(e:any):void=>{if((e.target as HTMLElement).closest('button'))return;const touch=e.touches?.[0];if(!touch)return;const el=(e.currentTarget as HTMLElement).closest('.help-float') as HTMLElement;if(!el)return;const rect=el.getBoundingClientRect();this.helpDrag={dx:touch.clientX-rect.left,dy:touch.clientY-rect.top};document.addEventListener('touchmove',this.moveHelpDragTouch,{passive:false});document.addEventListener('touchend',this.endHelpDragTouch);document.addEventListener('touchcancel',this.endHelpDragTouch);};
  moveHelpDragTouch=(e:TouchEvent):void=>{const t=e.touches[0];if(t){e.preventDefault();this.updateHelpPosition(t.clientX,t.clientY);}};
  endHelpDragTouch=():void=>{this.helpDrag=null;document.removeEventListener('touchmove',this.moveHelpDragTouch);document.removeEventListener('touchend',this.endHelpDragTouch);document.removeEventListener('touchcancel',this.endHelpDragTouch);};
  updateGoalDraft=(patch:Partial<GoalDraft>):void=>this.setState({goalDraft:{...this.state.goalDraft,...patch}});
  updateRoutineDraft=(patch:Partial<RoutineDraft>):void=>this.setState({routineDraft:{...this.state.routineDraft,...patch}});
  updateEventDraft=(patch:Partial<EventDraft>):void=>this.setState({eventDraft:{...this.state.eventDraft,...patch}});

  startCardDrag=(kind:'goal'|'routine',id:string,event:any):void=>{event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',kind+':'+id);this.setState({draggedCardType:kind,draggedCardId:id,dragOverCardId:''});};
  endCardDrag=():void=>this.setState({draggedCardType:'',draggedCardId:'',dragOverCardId:''});
  moveCard=(kind:'goal'|'routine',from:string,to:string):void=>{
    const d=this.state.data;
    if(kind==='goal'){
      const a=d.goals.find(g=>g.id===from),b=d.goals.find(g=>g.id===to);
      if(!a||!b||a.parentId!==b.parentId)return;
      this.save({...d,goals:reorderByIds(d.goals,from,to)},'Orden de metas actualizado');
    }else this.save({...d,routines:reorderByIds(d.routines,from,to)},'Orden de rutinas actualizado');
    this.endCardDrag();
  };
  moveCardKeyboard=(kind:'goal'|'routine',id:string,delta:number):void=>{
    const d=this.state.data;
    const relevant=kind==='goal'?d.goals.filter(g=>g.parentId===d.goals.find(x=>x.id===id)?.parentId):d.routines;
    const i=relevant.findIndex(x=>x.id===id),target=relevant[i+delta];if(target)this.moveCard(kind,id,target.id);
  };
  cardDrop=(kind:'goal'|'routine',id:string,event:any):void=>{event.preventDefault();event.stopPropagation();if(this.state.draggedCardType===kind&&this.state.draggedCardId)this.moveCard(kind,this.state.draggedCardId,id);};
  routineSchedule=(routineId:string):EventItem|undefined=>{const items=this.state.data.events.filter(e=>e.routineId===routineId);const upcoming=items.filter(e=>sameScheduleActive(e,today())).sort((a,b)=>a.date.localeCompare(b.date));return upcoming[0]||items.sort((a,b)=>b.date.localeCompare(a.date))[0];};
  chooseRoutineForSchedule=(r:Routine):void=>{const old=this.routineSchedule(r.id);if(old){this.openEvent(old);this.notice('Reprogramación: los días anteriores quedarán intactos.');}else this.openEventWithRoutine(r);};
  openEventWithRoutine=(r:Routine):void=>{const draft={...eDraft(this.state.selectedDate),title:r.title,routineId:r.id,minutes:routineMinutes(r)};this.initialDraft=JSON.stringify(draft);this.setState({modal:'event',eventDraft:draft,datePickerMonth:firstMonth(draft.date)});};
  updateStepDays=(id:string,variantId:string|undefined,weekday:number):void=>{
    const next=editStepTree(this.state.routineDraft.steps,id,s=>{
      const mode=(s.mode||'always')==='alternatives'?'alternatives':s.mode;
      if(mode==='selected')return {...s,days:(s.days||[]).includes(weekday)?(s.days||[]).filter(x=>x!==weekday):[...(s.days||[]),weekday]};
      if(mode!=='alternatives')return s;
      const prevBase=s.days||DAYS.filter(n=>!(s.variants||[]).some(v=>v.days.includes(n)));
      const isPicked=variantId?!!s.variants?.find(v=>v.id===variantId)?.days.includes(weekday):prevBase.includes(weekday);
      const base=prevBase.filter(n=>n!==weekday);
      const variants=(s.variants||[]).map(v=>({...v,days:v.days.filter(n=>n!==weekday)}));
      if(!isPicked){if(variantId){const v=variants.find(v=>v.id===variantId);if(v)v.days.push(weekday);}else base.push(weekday);}
      return {...s,days:base,variants};
    });
    this.updateRoutineDraft({steps:next});
  };

  saveGoal=():void=>{
    const x=this.state.goalDraft;if(!x.title.trim()){this.setState({toast:'Escribe un nombre para la meta'});return;}
    if(x.id && (x.parentId===x.id||x.dependsOn===x.id)){this.setState({toast:'Una meta no puede depender de sí misma'});return;}
    if(x.startDate&&x.dueDate&&x.dueDate<x.startDate){this.setState({toast:'La fecha objetivo debe ser posterior al inicio.'});return;}
    const data=this.state.data;const before=data.goals.find(g=>g.id===x.id);
    const next:Goal={...x,id:x.id||uid(),area:x.area||'purpose',title:x.title.trim(),target:Math.max(0,x.target),current:Math.max(0,x.current),mode:goalMode(x),status:goalStatus(x),milestones:goalMilestones(x).filter(m=>m.title.trim()).map(m=>({...m,title:m.title.trim()})),history:before?.history||[]};
    const reviewId='review-'+next.id;
    const reviews=data.events.filter(e=>e.id!==reviewId);
    if(next.review?.date){
      reviews.push({id:reviewId,kind:'review',title:'Revisión · '+next.title,date:next.review.date,time:next.review.time||'18:00',minutes:30,goalId:next.id,routineId:'',repeat:next.review.repeat||'none',note:'Revisa los avances de la meta, lo que aprendiste y qué conviene ajustar.',overrides:data.events.find(e=>e.id===reviewId)?.overrides||{}});
    }
    this.save({...data,goals:before?data.goals.map(g=>g.id===x.id?next:g):[...data.goals,next],events:reviews});this.close(true);if(this.state.guideOpen){if(this.state.guideStep===1&&!x.id)this.selectGuideGoal(next.id);else if(this.state.guideStep===2&&!x.id&&x.parentId===this.state.guideGoalId)this.setState({guideStep:3,page:'calendario',modal:null});}
  }
  schedulePreview=(draft:EventDraft):{date:string;label:string;start:string;end:string;length:number;issue:string;overlaps:string[];skipped?:boolean}[]=>{
    const r=this.state.data.routines.find(x=>x.id===draft.routineId);
    const prepared={...draft,id:draft.id||'__fh_preview__'};
    const data:Data={...this.state.data,events:[...this.state.data.events.filter(x=>x.id!==draft.id),prepared]};
    const result:{date:string;label:string;start:string;end:string;length:number;issue:string;overlaps:string[];skipped?:boolean}[]=[];
    const start=draft.id&&draft.applyFrom&&draft.applyFrom>draft.date?draft.applyFrom:draft.date;
    if(!start)return result;
    for(let i=0;i<=370&&result.length<9;i++){
      const day=addDays(start,i);if(!occurs(prepared,day))continue;
      if(result.length>=8)break;
      const frame=eventFrame(prepared,day,data);
      let issue='';let skipped=false;
      if(draft.anchor==='between'){
        const after=data.events.find(x=>x.id!==prepared.id&&x.routineId===draft.afterRoutineId&&occurs(x,day));
        const before=data.events.find(x=>x.id!==prepared.id&&x.routineId===draft.beforeRoutineId&&occurs(x,day));
        if(!after||!before){skipped=true;issue='Sin ambos límites programados este día; la rutina no aparecerá.';}
        else if(!frame)issue='No existe un intervalo válido entre los límites.';
      }else if(!frame)issue='La duración no cabe en este día o los horarios son inválidos.';
      if(frame&&r){const balance=routineBalance(r,day,frame.length,data.logs[key(prepared,day)]?.choices||{});if(balance.error)issue=balance.error;}
      const overlaps=frame?data.events.filter(item=>item.id!==prepared.id&&occurs(item,day)&&!item.allDay).filter(item=>{const f=eventFrame(item,day,data);return !!f&&f.start<frame.end&&f.end>frame.start;}).map(item=>item.title):[];
      result.push({date:day,label:fmtDate(day),start:frame?timeString(frame.start):'—',end:frame?timeString(frame.end):'—',length:frame?.length||0,issue,overlaps,skipped});
      if(draft.repeat==='none')break;
    }
    return result;
  };
  routineIssue=(r:Routine):string=>{
    const checkFlexible=(steps:Step[]):string=>{for(const s of steps){if(s.mode==='alternatives'&&s.flexible){if(s.children?.length&&!leafSteps(s.children).some(item=>item.flexible))return `La alternativa «${s.title||'sin nombre'}» necesita al menos un subpaso flexible.`;for(const v of s.variants||[]){if(v.children?.length&&!leafSteps(v.children).some(item=>item.flexible))return `La alternativa «${v.title||'sin nombre'}» necesita al menos un subpaso flexible.`;if(!v.children?.length&&!v.flexible)return `Todas las alternativas de «${s.title||'este paso'}» deben ser flexibles.`;}}
      const nested=checkFlexible(s.children||[]);if(nested)return nested;for(const v of s.variants||[]){const issue=checkFlexible(v.children||[]);if(issue)return issue;}}
      return '';};
    const flexIssue=checkFlexible(r.steps);if(flexIssue)return flexIssue;
    if(r.durationMode!=='fixed')return '';
    if(!Number.isFinite(r.durationMin)||Number(r.durationMin)<1)return 'Indica una duración fija válida para la rutina.';
    const dates=Array.from({length:7},(_,i)=>addDays(today(),i));
    for(const day of dates){
      const current=activeSteps(r.steps,day);if(!current.length)continue;
      const balance=routineBalance(r,day);if(balance.error)return `${weekdayNames[parseDay(day).getDay()]}: ${balance.error}`;
      // Las alternativas que se eligen al ejecutar también deben poder encajar en la duración fija.
      const check=(steps:Step[],choices:Record<string,string>={})=>{
        for(const step of steps){if(step.mode==='alternatives'&&step.chooseWhen==='execute'){
          for(const variant of [{id:'__base'},...(step.variants||[])]){
            const test=routineBalance(r,day,undefined,{...choices,[step.id]:variant.id});
            if(test.error)return `Alternativa de «${step.title}»: ${test.error}`;
          }
        }const nested=check(step.children||[],choices);if(nested)return nested;
        for(const v of step.variants||[]){const issue=check(v.children||[],choices);if(issue)return issue;}
        }return '';
      };
      const issue=check(r.steps);if(issue)return issue;
    }
    return '';
  };
  saveRoutine=():void=>{
    const x=this.state.routineDraft;if(!x.title.trim()){this.setState({toast:'Escribe un nombre para la rutina'});return;}
    if((function invalid(steps:Step[]):boolean{return steps.some(s=>!s.title.trim()||(s.children&&invalid(s.children))||((s.variants||[]).some(v=>!!v.title.trim()&&(s.chooseWhen==='execute'||!!v.days.length)&&v.children&&invalid(v.children))))})(x.steps)){this.setState({toast:'Todos los pasos necesitan un nombre'});return;}
    const issue=this.routineIssue(x);if(issue){this.notice('Corrige la distribución de tiempo: '+issue);return;}
    const data=this.state.data;const clean=(steps:Step[]):Step[]=>steps.map(s=>{const children=s.children?clean(s.children):undefined;return {...s,title:s.title.trim(),children,variants:s.variants?.filter(v=>v.title.trim()&&(s.chooseWhen==='execute'||v.days.length)).map(v=>({...v,title:v.title.trim(),days:[...new Set(v.days)],children:v.children?clean(v.children):undefined,min:Math.max(0,v.min)})),min:children&&children.length?children.reduce((a,c)=>a+stepMinutes(c),0):s.flexible?Math.max(5,s.min):Math.max(1,s.min),mode:s.mode||((s.variants||[]).length?'alternatives':'always')};});const result:Routine={...x,id:x.id||uid(),title:x.title.trim(),steps:clean(x.steps)};
    this.save({...data,routines:x.id?data.routines.map(r=>r.id===x.id?result:r):[...data.routines,result],events:data.events.map(e=>e.routineId===result.id?{...e,minutes:routineMinutes(result)}:e)});
    if(this.state.returnToSchedule&&this.pendingSchedule){
      const draft=this.pendingSchedule;this.pendingSchedule=null;this.initialDraft=JSON.stringify(draft);
      this.setState({modal:'event',eventDraft:draft,returnToSchedule:false,scheduleContextNote:''});
    }else this.close(true);
  }
  betweenDayIssue=(draft:EventDraft,weekday:number):string=>{
    if(draft.anchor!=='between'||!draft.afterRoutineId||!draft.beforeRoutineId)return '';
    const base=this.state.data;
    let date=draft.date>=today()?draft.date:today();let found=0;
    for(let i=0;i<60&&found<3;i++){const check=addDays(date,i);if(parseDay(check).getDay()!==weekday)continue;found++;
      const matching=(rid:string)=>base.events.find(ev=>ev.id!==draft.id&&ev.routineId===rid&&occurs(ev,check));
      const before=matching(draft.afterRoutineId),after=matching(draft.beforeRoutineId);
      if(!before||!after)return 'Las dos rutinas límite deben estar programadas ese día.';
      const a=eventFrame(before,check,base),b=eventFrame(after,check,base);
      if(!a||!b||a.end>=b.start)return 'Las dos rutinas deben estar en el orden correcto y dejar tiempo libre.';
      const routine=base.routines.find(r=>r.id===draft.routineId);
      if(routine&&routineBalance(routine,check,b.start-a.end).error)return 'El intervalo de ese día no permite realizar todos los pasos. Ajusta las rutinas o sus tiempos.';
    }
    return '';
  };
  saveEvent=async ():Promise<void>=>{
    const x=this.state.eventDraft;
    if(!x.title.trim()||!x.date||(!x.allDay&&!x.time)){this.notice('Completa el nombre, la fecha y la hora.');return;}
    if(x.kind==='occasion'&&x.endDate&&x.endDate<x.date){this.notice('La fecha final no puede ser anterior a la inicial.');return;}
    if(x.repeat==='custom'&&!(x.repeatDays||[]).length){this.notice('Selecciona los días en que quieres repetirlo.');return;}
    if(x.repeat==='dates'&&(x.specificDates||[]).some(day=>!day||day<x.date)){this.notice('Las fechas específicas deben ser posteriores al comienzo.');return;}
    const data=this.state.data;
    const previewRows=this.schedulePreview(x);
    const blocking=previewRows.filter(row=>row.issue&&(x.anchor==='between'||!row.skipped));
    if(x.routineId&&blocking.length){
      const details=blocking.slice(0,3).map(row=>`${row.label}: ${row.issue}`).join('\n');
      if(await this.askConfirm('La rutina necesita ajustes',`No se puede programar todavía.\n\n${details}\n\nPuedes editar sus tiempos y volver a esta programación sin perder lo que has rellenado.`,'Editar rutina'))this.editRoutineFromSchedule(details);
      return;
    }
    const original=data.events.find(e=>e.id===x.id);
    if(original?.kind==='review'){this.notice('Las revisiones se editan desde la meta.');return;}
    const scheduleChanged=!!original&&(original.time!==x.time||original.endTime!==x.endTime||original.anchor!==x.anchor||original.afterRoutineId!==x.afterRoutineId||original.beforeRoutineId!==x.beforeRoutineId||original.date!==x.date||original.endDate!==x.endDate||original.repeat!==x.repeat||JSON.stringify(original.repeatDays||[])!==JSON.stringify(x.repeatDays||[])||original.everyDays!==x.everyDays||JSON.stringify(original.specificDates||[])!==JSON.stringify(x.specificDates||[]));
    const impacted=original?.routineId?data.events.filter(item=>item.anchor==='between'&&(item.afterRoutineId===original.routineId||item.beforeRoutineId===original.routineId)&&sameScheduleActive(item,today())):[];
    if(original&&scheduleChanged&&!(await this.askConfirm('Reprogramar actividad','Se actualizarán las próximas fechas y el resto de hoy desde la fecha elegida, sin modificar los registros pasados.'+(impacted.length?'\n\n'+impacted.length+' bloque(s) dependiente(s) se reajustarán automáticamente.':''),'Reprogramar')))return;
    const startChange=original ? (x.applyFrom||today()) : x.date;
    if(original&&startChange<today()){this.notice('La reprogramación debe aplicarse desde hoy o una fecha posterior.');return;}
    const cut=!!original&&original.date<startChange&&original.date<today()&&(original.repeat!=='none'||original.endDate>=today());
    const result:EventItem={...x,id:x.id||uid(),title:x.title.trim(),minutes:Math.max(1,x.minutes),specificDates:[...new Set((x.specificDates||[]).filter(Boolean))],overrides:x.overrides||{}};
    if(result.anchor==='end'&&result.endTime){const duration=result.routineId?Math.max(1,routineMinutesOn(data.routines.find(r=>r.id===result.routineId)||{id:'',title:'',desc:'',steps:[]},result.date)):result.minutes;
      if(minutes(result.endTime)<duration){this.notice('La duración no cabe antes de la hora de término. Elige otra hora.');return;}result.time=timeString(minutes(result.endTime)-duration);
    }
    if(result.kind==='occasion'&&result.endDate&&result.endDate>result.date&&result.repeat!=='none'){
      this.notice('Los eventos de varios días se programan sin repetición. Puedes crear otro evento para un periodo diferente.');return;
    }
    const finalStart=cut?(x.date>startChange?x.date:startChange):x.date;
    const future:EventItem=cut?{...result,id:uid(),date:finalStart,overrides:Object.fromEntries(Object.entries(result.overrides||{}).filter(([day])=>day>=finalStart)),specificDates:(result.specificDates||[]).filter(day=>day>=finalStart)}:result;
    if(future.routineId){
      const conflict=data.events.find(other=>other.routineId===future.routineId&&other.id!==result.id&&other.id!==original?.id&&sameScheduleActive(other,today()));
      if(conflict){this.notice('Esta rutina ya tiene una programación futura. Utiliza Reprogramar desde la tarjeta de rutinas.');return;}
    }
    const cleanFuture={...future,applyFrom:undefined};
    if(cleanFuture.anchor==='between'){
      if(!cleanFuture.routineId||!cleanFuture.afterRoutineId||!cleanFuture.beforeRoutineId||cleanFuture.afterRoutineId===cleanFuture.beforeRoutineId||[cleanFuture.afterRoutineId,cleanFuture.beforeRoutineId].includes(cleanFuture.routineId)){
        this.notice('Elige una rutina para este bloque y dos rutinas límite diferentes.');return;
      }
      const hypothetical={...data,events:[...data.events.filter(e=>e.id!==original?.id&&e.id!==cleanFuture.id),cleanFuture]};
      if(!eventFrame(cleanFuture,cleanFuture.date,hypothetical)){
        this.notice('No hay un intervalo válido entre las dos rutinas en la fecha inicial. Revisa días, horarios y dependencias circulares.');return;
      }
      const steps=routineForDay(cleanFuture,cleanFuture.date,hypothetical),frame=eventFrame(cleanFuture,cleanFuture.date,hypothetical)!;
      if(routineBalance(data.routines.find(r=>r.id===cleanFuture.routineId)||{id:'',title:'',desc:'',steps:[]},cleanFuture.date,frame.length).error){this.notice('El intervalo no se ajusta a los pasos de esta rutina. Edita la duración o agrega contenidos flexibles.');return;}
    }
    const withOverlap=async (next:Data):Promise<Data|null>=>{
      const target=next.events.find(item=>item.id===cleanFuture.id);if(!target||target.overlapMode!=='move'||target.repeat!=='none'||target.allDay||target.anchor==='between')return next;
      const date=target.date,span=eventFrame(target,date,next);if(!span)return next;
      const clashes=eventsOn(next,date).filter(item=>item.id!==target.id&&!item.allDay&&!!eventFrame(item,date,next)&&eventFrame(item,date,next)!.start<span.end&&eventFrame(item,date,next)!.end>span.start);
      if(!clashes.length)return next;
      if(clashes.some(item=>item.anchor==='between')){this.notice('Un bloque flexible coincide con el evento. Elige mantener el solapamiento o cambia los límites.');return null;}
      if(!(await this.askConfirm('Posponer bloques de este día','Se moverán los bloques solapados del '+date+'. Su orden y duración se conservarán, y los demás días no cambiarán.','Posponer bloques')))return null;
      let cursor=span.end;
      let updated=next.events.map(item=>({...item,overrides:{...item.overrides}}));
      const others=eventsOn(next,date).filter(item=>item.id!==target.id&&!item.allDay&&item.anchor!=='between').sort((a,b)=>scheduleStart(a,date,next)-scheduleStart(b,date,next));
      for(const item of others){const f=eventFrame(item,date,{...next,events:updated});if(!f)continue;if(f.end<=span.start)continue;
        if(f.start<cursor){if(cursor+f.length>1440){this.notice('No es posible posponer los bloques sin salir del día. Mantén el solapamiento o elige otra hora.');return null;}
          updated=updated.map(x=>x.id===item.id?{...x,overrides:{...x.overrides,[date]:{...x.overrides[date],time:timeString(cursor)}}}:x);
          cursor+=f.length;
        }else cursor=f.end;
      }
      const adjusted={...next,events:updated};
      const broken=next.events.filter(item=>item.anchor==='between'&&occurs(item,date)&&!!eventFrame(item,date,next)&&!eventFrame(item,date,adjusted));
      if(broken.length){this.notice('El desplazamiento dejaría sin intervalo a «'+broken[0].title+'». Mantén el solapamiento o ajusta las rutinas límite.');return null;}
      return adjusted;
    };

    if(cut&&original){
      const endDate=addDays(finalStart,-1);
      const history:EventItem={...original,endDate:original.endDate&&original.endDate<endDate?original.endDate:endDate,overrides:Object.fromEntries(Object.entries(original.overrides||{}).filter(([day])=>day<finalStart))};
      const logs={...data.logs};
      Object.keys(logs).filter(k=>k.startsWith(original.id+'@')&&k.split('@')[1]>=finalStart).forEach(k=>{logs[cleanFuture.id+'@'+k.split('@')[1]]=logs[k];delete logs[k];});
      const nextData={...data,events:[...data.events.map(e=>e.id===original.id?history:e),cleanFuture],logs};
      const planned=await withOverlap(nextData);if(!planned)return;this.save(planned,'Programación actualizada desde '+finalStart);
    }else{
      if(future.routineId&&data.events.some(other=>other.id!==result.id&&other.routineId===future.routineId&&sameScheduleActive(other,today()))){this.notice('Esta rutina ya está programada. Reprograma la existente.');return;}
      const planned=await withOverlap({...data,events:x.id?data.events.map(e=>e.id===x.id?cleanFuture:e):[...data.events,cleanFuture]});if(!planned)return;this.save(planned,'Actividad guardada');
    }
    this.close(true);
    if(this.state.guideOpen){if(this.state.guideStep===3&&result.goalId===this.state.guideGoalId)this.setState({guideStep:4,page:'rutinas'});else if(this.state.guideStep===4&&result.routineId){this.setState({guideStep:5,page:'horario',selectedDate:result.date,month:firstMonth(result.date),guideEventId:cleanFuture.id});}}
  }
  deleteGoal=async (g:Goal):Promise<void>=>{
    if(!(await this.askConfirm('Eliminar meta',`¿Eliminar «${g.title}»? Las submetas pasarán a ser independientes.`, 'Eliminar meta', true)))return;
    const d=this.state.data;this.save({...d,goals:d.goals.filter(x=>x.id!==g.id).map(x=>x.parentId===g.id?{...x,parentId:''}:x),events:d.events.filter(e=>e.id!=='review-'+g.id).map(e=>e.goalId===g.id?{...e,goalId:''}:e)});
  }
  /* Eliminar una programación conserva el pasado y cancela los bloques que dependen de ella. */
  cancelFutureDependencies=(d:Data,routineId:string,from=today()):Data=>{
    const selected=new Set<string>([routineId]);let progress=true;
    while(progress){progress=false;d.events.forEach(e=>{if(e.routineId&&!selected.has(e.routineId)&&e.anchor==='between'&&(selected.has(e.afterRoutineId||'')||selected.has(e.beforeRoutineId||''))){selected.add(e.routineId);progress=true;}});}
    const remove=d.events.filter(e=>e.anchor==='between'&&e.routineId&&selected.has(e.routineId));
    const removes=new Set(remove.map(e=>e.id));
    const revised=d.events.flatMap(e=>{
      if(!removes.has(e.id))return [e];
      if(e.date>=from)return [];
      const end=addDays(from,-1);return [{...e,endDate:e.endDate&&e.endDate<end?e.endDate:end}];
    });
    return {...d,events:revised};
  };
  deleteRoutine=async (r:Routine):Promise<void>=>{
    const dependents=this.state.data.events.filter(e=>e.anchor==='between'&&(e.afterRoutineId===r.id||e.beforeRoutineId===r.id));
    if(!(await this.askConfirm('Eliminar rutina',`¿Eliminar «${r.title}»? Las actividades conservarán su nombre pero perderán sus pasos.${dependents.length?'\n\nSe cancelarán las programaciones futuras de '+dependents.length+' bloque(s) dependiente(s); se conserva el historial.':''}`,'Eliminar rutina',true)))return;
    const d=this.state.data;
    const next=this.cancelFutureDependencies({...d,routines:d.routines.filter(x=>x.id!==r.id),events:d.events.map(e=>e.routineId===r.id?{...e,routineId:''}:e)},r.id);
    this.save(next);this.close(true);
  }
  deleteEvent=async (e:EventItem):Promise<void>=>{
    const dependents=e.routineId?this.state.data.events.filter(x=>x.anchor==='between'&&(x.afterRoutineId===e.routineId||x.beforeRoutineId===e.routineId)):[];
    if(!(await this.askConfirm('Eliminar programación',(e.repeat==='none'?'¿Eliminar esta actividad?':'¿Eliminar esta programación y sus próximas apariciones?')+(dependents.length?'\n\nSe cancelarán '+dependents.length+' bloques dependientes futuros. Los registros pasados se conservarán.':''),'Eliminar',true)))return;
    const d=this.state.data,from=today();const logs={...d.logs};
    // Si hoy ya tiene un registro, conservar también esa ejecución en el historial.
    const cutoff=logs[key(e,from)]?addDays(from,1):from;
    const old=e.date<cutoff;
    const updated=d.events.flatMap(item=>item.id!==e.id?[item]:old?[{...item,endDate:addDays(cutoff,-1)}]:[]);
    const next=(e.routineId&&sameScheduleActive(e,from)?this.cancelFutureDependencies({...d,events:updated,goals:e.kind==='review'?d.goals.map(g=>g.id===e.goalId?{...g,review:undefined}:g):d.goals,logs},e.routineId,cutoff):{...d,events:updated,goals:e.kind==='review'?d.goals.map(g=>g.id===e.goalId?{...g,review:undefined}:g):d.goals,logs});
    this.save(next);this.close(true);
  }
  saveEvidence=async (e:EventItem,date:string,stepId:string,file:File):Promise<void>=>{
    if(!file||!file.type.startsWith('image/')){this.notice('Selecciona una imagen válida.');return;}
    if(file.size>12*1024*1024){this.notice('La imagen es demasiado grande. Prueba con una de menos de 12 MB.');return;}
    try{
      const src=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(new Error('Lectura fallida'));reader.onload=()=>{const img=new Image();img.onload=()=>{const ratio=Math.min(1,1100/Math.max(img.width,img.height));const canvas=document.createElement('canvas');canvas.width=Math.round(img.width*ratio);canvas.height=Math.round(img.height*ratio);const ctx=canvas.getContext('2d');if(!ctx){reject(new Error('Lienzo no disponible'));return;}ctx.drawImage(img,0,0,canvas.width,canvas.height);resolve(canvas.toDataURL('image/jpeg',.66));};img.onerror=()=>reject(new Error('Formato no compatible'));img.src=String(reader.result);};reader.readAsDataURL(file);});
      if(src.length>600000){this.notice('La fotografía ocupa mucho almacenamiento local. Prueba con una imagen más pequeña.');return;}
      const data=this.state.data,k=key(e,date),old=data.logs[k]||{completed:false,checkedSteps:[]};const evidence:Evidence={id:uid(),kind:'image',src,caption:'',stepId:stepId||undefined,createdAt:new Date().toISOString()};
      this.save({...data,logs:{...data.logs,[k]:{...old,evidences:[...(old.evidences||[]),evidence]}}},'Imagen añadida al registro');
    }catch(err){this.notice('No se pudo guardar la imagen. Revisa su formato o el espacio disponible.');}
  };
  deleteEvidence=async (e:EventItem,date:string,id:string):Promise<void>=>{if(!await this.askConfirm('Quitar evidencia','Se eliminará esta foto del registro local.','Quitar foto',true))return;const d=this.state.data,k=key(e,date),log=d.logs[k];if(!log)return;this.save({...d,logs:{...d.logs,[k]:{...log,evidences:(log.evidences||[]).filter(x=>x.id!==id)}}},'Foto eliminada');};
  evidenceSection=(e:EventItem,date:string,stepId=''):any=>{
    const items=(this.state.data.logs[key(e,date)]?.evidences||[]).filter(a=>(a.stepId||'')===stepId);
    return <div className='evidence-section'><label className='evidence-upload'><Icon name='plus' size={15}/><span>Adjuntar foto o recuerdo</span><input type='file' accept='image/*' onChange={ev=>{const f=ev.target.files?.[0];if(f)this.saveEvidence(e,date,stepId,f);ev.target.value='';}}/></label>{items.length>0&&<div className='evidence-gallery'>{items.map(pic=><div className='evidence-thumb' key={pic.id}><img src={pic.src} alt={pic.caption||'Fotografía del registro diario'} onClick={()=>window.open(pic.src,'_blank')}/><button title='Quitar fotografía' onClick={()=>this.deleteEvidence(e,date,pic.id)}>×</button></div>)}</div>}</div>;
  };
  saveDayReview=():void=>{const d=this.state.data,date=today();this.save({...d,dayReviews:{...d.dayReviews,[date]:{note:this.state.reviewDraft,closedAt:new Date().toISOString()}}},'Revisión del día guardada');};
  toggleEvent=(e:EventItem,date:string):void=>{
    const d=this.state.data,k=key(e,date),r=d.logs[k]||{completed:false,checkedSteps:[]};
    const original=d.routines.find(x=>x.id===e.routineId);
    if(!r.completed&&original&&unresolvedManual(activeSteps(original.steps,date,r.choices||{}),r.choices||{}).length){this.notice('Antes de completar la rutina, elige las alternativas al desglosar la rutina en Mi día.');return;}this.save({...d,logs:{...d.logs,[k]:{...r,completed:!r.completed}}},'Actividad actualizada');if(!r.completed)this.playCheckSound();
  }
  toggleStep=(e:EventItem,date:string,stepId:string):void=>{
    const d=this.state.data,k=key(e,date),r=d.logs[k]||{completed:false,checkedSteps:[]};const routine=d.routines.find(x=>x.id===e.routineId);
    const checked=r.checkedSteps.includes(stepId)?r.checkedSteps.filter(s=>s!==stepId):[...r.checkedSteps,stepId];
    const choices=r.choices||{};const leaves=routine?leafSteps(activeSteps(routine.steps,date,choices)):[];const pending=routine?unresolvedManual(activeSteps(routine.steps,date,choices),choices):[];const completed=leaves.length>0&&pending.length===0&&leaves.every(s=>checked.includes(s.id));
    this.save({...d,logs:{...d.logs,[k]:{...r,checkedSteps:checked,completed}}},'Paso actualizado');if(!r.checkedSteps.includes(stepId))this.playCheckSound();
  }
  saveOccurrenceNote=(e:EventItem,date:string,text:string,stepId?:string):void=>{
    const d=this.state.data,k=key(e,date),log=d.logs[k]||{completed:false,checkedSteps:[]};
    const value=text.trim();const updated:RecordLog=stepId?{...log,stepNotes:{...log.stepNotes,[stepId]:value}}:{...log,note:value};
    this.save({...d,logs:{...d.logs,[k]:updated}},'Nota guardada en el historial');
  };
  selectVariant=(e:EventItem,date:string,stepId:string,choice:string):void=>{
    const d=this.state.data,k=key(e,date),r=d.logs[k]||{completed:false,checkedSteps:[]};
    this.save({...d,logs:{...d.logs,[k]:{...r,choices:{...r.choices,[stepId]:choice},checkedSteps:[],completed:false}}},'Elección guardada solo para este día');
  };
  shiftEvent=(e:EventItem,date:string,delta:number):void=>{
    if(e.anchor==='between'){this.notice('Este bloque depende de dos rutinas. Para moverlo, reprograma alguna de sus rutinas límite.');return;}
    const d=this.state.data;const newTime=timeString(bound(minutes(eventTime(e,date,d))+delta,0,1439));const next={...e,overrides:{...e.overrides,[date]:{...e.overrides[date],time:newTime}}};
    const newData={...d,events:d.events.map(x=>x.id===e.id?next:x)};
    const affected=e.routineId?d.events.filter(x=>x.anchor==='between'&&(x.afterRoutineId===e.routineId||x.beforeRoutineId===e.routineId)&&occurs(x,date)):[];
    if(affected.some(x=>!!eventFrame(x,date,d)&&!eventFrame(x,date,newData))){this.notice('El cambio dejaría sin espacio a un bloque dependiente. Edita las horas de sus rutinas límite.');return;}
    this.save(newData,`Actividad movida a las ${newTime}`+(affected.length?' · Bloques dependientes ajustados':''));
  }
  saveProgress=():void=>{
    const d=this.state.data,g=d.goals.find(x=>x.id===this.state.progressGoalId);if(!g)return;
    const mode=goalMode(g),val=mode==='numeric'?Number(this.state.progressValue.replace(',','.')):g.current;if(mode==='numeric'&&(!Number.isFinite(val)||val<0)){this.setState({toast:'Registra un valor válido mayor o igual a cero'});return;}
    const next={...g,current:val,status:mode==='qualitative'?this.state.progressStatus:goalStatus(g),history:[...g.history,{date:today(),value:val,note:this.state.progressNote.trim(),status:mode==='qualitative'?this.state.progressStatus:undefined}]};
    this.save({...d,goals:d.goals.map(x=>x.id===g.id?next:x)},'Avance registrado');this.close();
  }
  toggleMilestone=(goalId:string,milestoneId:string):void=>{const d=this.state.data;const g=d.goals.find(x=>x.id===goalId);if(!g)return;const ms=goalMilestones(g).map(m=>m.id===milestoneId?{...m,done:!m.done}:m);const n=ms.filter(m=>m.done).length;const next={...g,milestones:ms,current:n,target:ms.length,history:[...g.history,{date:today(),value:n,note:'Hito actualizado'}]};this.save({...d,goals:d.goals.map(x=>x.id===goalId?next:x)},'Hito actualizado');};
  exportData=():void=>{
    const blob=new Blob([JSON.stringify(this.state.data,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download=`fullhouse-respaldo-${today()}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
    this.notice('Respaldo descargado. Guárdalo en un lugar seguro.');
  }
  importData=async (ev:any):Promise<void>=>{
    const f:File|undefined=ev.target.files?.[0];if(!f)return;
    if(!(await this.askConfirm('Restaurar respaldo','Esto sustituirá todos los datos actuales de este navegador. Exporta una copia antes de continuar.','Restaurar datos',true))){ev.target.value='';return;}
    const reader=new FileReader();reader.onload=()=>{
      try{const d=JSON.parse(String(reader.result));if(!validData(d))throw Error('Formato incompatible');
        this.save(d,'Respaldo restaurado');this.setState({page:'inicio',modal:null});
      }catch(err){this.setState({toast:'Archivo inválido o incompatible. No se modificó la información.'});}
    };reader.readAsText(f);ev.target.value='';
  }
  reset=async ():Promise<void>=>{
    if(!(await this.askConfirm('Restablecer ejemplos','Se perderán los datos actuales. Descarga un respaldo antes de continuar.','Restablecer',true)))return;
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
    if(step===1){this.setState({page:'metas'});this.openGoal();return;}
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
    const links:{id:Page;label:string;icon:string}[]=[{id:'hoy',label:'Mi día',icon:'checklist'},{id:'horario',label:'Horario',icon:'clock'},{id:'inicio',label:'Inicio',icon:'home'},{id:'metas',label:'Metas',icon:'target'},{id:'rutinas',label:'Rutinas',icon:'checklist'},{id:'calendario',label:'Calendario',icon:'calendar'},{id:'progreso',label:'Progreso',icon:'chart'},{id:'ajustes',label:'Ajustes',icon:'settings'}];
    return <>
      <aside className="sidebar">
        <div className="brand"><img className="brand-logo" src="logo.svg" alt="Logo Fullhouse"/><div><div className="brand-name">FULLHOUSE</div><div className="brand-sub">Tu espacio, completo</div></div></div>
        <div className='side-section'>Uso y seguimiento</div><nav>{links.slice(0,3).map(l=><button key={l.id} className={`nav-item ${this.state.page===l.id?'active':''}`} onClick={()=>this.route(l.id)}><Icon name={l.icon}/>{l.label}</button>)}</nav><div className='side-section'>Planificar y editar</div><nav>{links.slice(3,6).map(l=><button key={l.id} className={`nav-item ${this.state.page===l.id?'active':''}`} onClick={()=>this.route(l.id)}><Icon name={l.icon}/>{l.label}</button>)}</nav><div className='side-section'>Analizar y personalizar</div><nav>{links.slice(6).map(l=><button key={l.id} className={`nav-item ${this.state.page===l.id?'active':''}`} onClick={()=>this.route(l.id)}><Icon name={l.icon}/>{l.label}</button>)}</nav>
        <div className="sidebar-bottom"><button className="nav-item nav-help" onClick={this.openGuide}><Icon name="help"/> Guía paso a paso</button><div className="profile-mini"><div className="avatar">✦</div><div><div className="profile-name">Mi espacio privado</div><div className="profile-meta">Fullhouse · 0.9</div></div></div><small>Organiza · Actúa · Progresa. Los datos se guardan en este navegador.</small></div>
      </aside>
      <nav className="mobile-nav" aria-label="Navegación móvil">{links.filter(l=>l.id!=='ajustes'&&l.id!=='calendario'&&l.id!=='inicio').map(l=><button key={l.id} className={`mobile-item ${this.state.page===l.id?'active':''}`} onClick={()=>this.route(l.id)}><Icon name={l.icon}/>{l.label.replace('Mis ','')}</button>)}</nav>
    </>;
  }
  renderHeading(title:string,description:string, action?:any):any{return <div className="heading-row"><div><div className="eyebrow">FULLHOUSE / {this.state.page.toUpperCase()}</div><h1 className="page-title">{title} {this.hint(this.state.page)}</h1><p className="lead">{description}</p></div>{action}</div>}
  hint=(topic:string):any=><button type="button" className="hint-btn" title="¿Cómo funciona esta sección?" aria-label={'Ayuda de '+topic} onClick={()=>this.openHelp(topic)}>?</button>;
  renderStat(label:string,value:string|number,note:string,icon:string):any{return <div className="stat-card"><div className="stat-top"><span className="stat-icon"><Icon name={icon}/></span><span className="stat-deco">FULLHOUSE</span></div><div className="stat-label">{label}</div><div className="stat-value">{value}</div><div className="stat-note">{note}</div></div>}
  renderTodayList(date:string,compact=false):any{
    const d=this.state.data,es=eventsOn(d,date).filter(e=>!e.allDay);
    if(!es.length)return <div className="empty"><Icon name="calendar"/><strong>Un día por diseñar</strong><p>No hay actividades programadas todavía. Comienza agregando una.</p><Btn tiny kind="secondary" onClick={()=>this.openEvent()}><Icon name="plus" size={14}/> Nueva actividad</Btn></div>;
    return <div>{es.map(e=>{
      const isDone=done(d,e,date),routine=d.routines.find(r=>r.id===e.routineId),log=d.logs[key(e,date)];
      return compact?<div key={e.id} className={`agenda-item ${isDone?'is-done':''}`}><div className="agenda-time">{eventTime(e,date,d)}</div><div className="agenda-main"><div className="agenda-name">{e.title}</div><div className="agenda-sub">{this.dur(durationOn(e,date,d))} {routine?'· '+routine.steps.length+' pasos':''}</div></div><button className={`check-circle ${isDone?'checked':''}`} onClick={()=>this.toggleEvent(e,date)} aria-label={isDone?'Marcar pendiente':'Marcar completado'}>{isDone&&<Icon name="check" size={13}/>}</button></div>
      :<div key={e.id} className={`schedule-line ${isDone?'is-done':''}`}><div className="schedule-time">{eventTime(e,date,d)}</div><div className="schedule-body"><div className="schedule-name">{e.title}</div><div className="schedule-meta"><span>{this.dur(durationOn(e,date,d))}</span>{e.repeat!=='none'&&<span>↻ Recurrente</span>}{routine&&<span>{routine.steps.length} pasos</span>}</div>{e.note&&<div className="schedule-notes">{e.note}</div>}<div className="actions" style={{marginTop:9}}>{routine&&<Btn tiny kind="secondary" onClick={()=>this.setState({page:'hoy',expandedTodayId:e.id})}>Ver pasos en Mi día</Btn>}{e.anchor!=='between'&&<Btn tiny kind="ghost" title="Mover 15 minutos antes (solo este día)" onClick={()=>this.shiftEvent(e,date,-15)}>−15 min</Btn>}{e.anchor!=='between'&&<Btn tiny kind="ghost" title="Mover 15 minutos después (solo este día)" onClick={()=>this.shiftEvent(e,date,15)}>+15 min</Btn>}</div></div><div className="mini-actions"><button className={`check-circle ${isDone?'checked':''}`} onClick={()=>this.toggleEvent(e,date)} aria-label={isDone?'Marcar pendiente':'Marcar completado'}>{isDone&&<Icon name="check" size={13}/>}</button><Btn tiny kind="ghost" onClick={()=>this.openEvent(e)} title="Editar actividad"><Icon name="edit" size={14}/></Btn></div></div>
    })}</div>;
  }
  renderToday():any{
    const date=today(),data=this.state.data,items=eventsOn(data,date).filter(e=>!e.allDay);
    const totals=items.map(e=>taskProgress(data,e,date));const completedUnits=totals.reduce((n,p)=>n+p.done,0),allUnits=totals.reduce((n,p)=>n+p.total,0);
    const finished=items.filter(e=>done(data,e,date)).length,percentDone=allUnits?Math.round(completedUnits*100/allUnits):0;
    const logs=items.map(e=>({e,log:data.logs[key(e,date)]}));const photoCount=logs.reduce((sum,x)=>sum+(x.log?.evidences?.length||0),0);
    const byArea=lifeAreas.map(area=>{const group=items.filter(e=>data.goals.find(g=>g.id===e.goalId)?.area===area.id);return {...area,planned:group.length,done:group.filter(e=>done(data,e,date)).length};}).filter(x=>x.planned);
    const review=data.dayReviews?.[date],now=this.state.clockMinutes;
    const live=items.find(e=>{const f=eventFrame(e,date,data);return f&&f.start<=now&&now<f.end&&!done(data,e,date);});
    const next=items.find(e=>{const f=eventFrame(e,date,data);return f&&f.start>now&&!done(data,e,date);}),pending=items.find(e=>!done(data,e,date)),expanded=this.state.expandedTodayId==='__none__'?'':(this.state.expandedTodayId&&items.some(e=>e.id===this.state.expandedTodayId)?this.state.expandedTodayId:(live||pending)?.id)||'';
    const clockLabel=timeString(now);
    return <>{this.renderHeading('Mi día','Realiza tus pasos aquí, directamente en tu jornada.',<Btn onClick={()=>this.openEvent()}><Icon name='plus' size={17}/> Añadir actividad</Btn>)}
      <section className='today-hero'><div><div className='eyebrow'>JORNADA ACTUAL · {fmtDate(date).toUpperCase()}</div><h2>Una acción a la vez.</h2><p>Elige una actividad o sigue la que corresponde ahora; marca sus pasos, toma notas y conserva tus recuerdos.</p></div><div className='today-hero-right'><div className='today-live-clock'><Icon name='clock' size={20}/><strong>{clockLabel}</strong><small>Hora actual</small></div><div className='today-ring' style={{'--progress':percentDone+'%'} as any}><strong>{percentDone}%</strong><small>Realizado</small></div></div></section>
      <div className='today-progress-strip'><div className='row spread'><strong>{completedUnits} de {allUnits} acciones y pasos realizados</strong><span>{finished} de {items.length} bloques terminados</span></div><div className='today-progress-track'><span style={{width:percentDone+'%'}}/></div></div>
      <div className='today-layout'><section className='panel today-main'><div className='panel-head'><div><h2>Mi agenda activa</h2><p className='panel-sub'>La actividad que sucede ahora se abre automáticamente; también puedes escoger cualquier otra.</p></div><button className='link-btn' onClick={()=>this.route('horario')}>Ver horario <Icon name='arrow-right' size={14}/></button></div>
        {items.length>0&&!items.some(e=>{const f=eventFrame(e,date,data);return f&&f.start<=now&&f.end>now;})&&<div className='today-free-banner'><Icon name='sun' size={20}/><div><strong>Agenda libre por ahora</strong><span>Disfruta este espacio entre actividades. {next?'Tu siguiente bloque comienza a las '+eventTime(next,date,data)+'.':'Puedes preparar tu próxima actividad o descansar.'}</span></div></div>}
        {items.length?items.map(e=>{const r=data.routines.find(x=>x.id===e.routineId),log=data.logs[key(e,date)]||{completed:false,checkedSteps:[]},color=eventTint(data,e),progress=taskProgress(data,e,date),f=eventFrame(e,date,data),isCurrent=!!f&&f.start<=now&&now<f.end,selected=expanded===e.id;
          const active=r?activeSteps(r.steps,date,log.choices||{}):[],alloc=r?leafAllocation(active,durationOn(e,date,data)):{};
          return <article key={e.id} className={'today-task '+(log.completed?'finished ':'')+(selected?'today-task-expanded ':'')+(isCurrent?'now-playing':'')} style={{'--task-color':color} as any}>
            <div className='today-task-top'><button type='button' className={'today-task-check '+(log.completed?'checked':'')} onClick={()=>this.toggleEvent(e,date)} aria-label={'Marcar '+e.title}><Icon name={log.completed?'check':'checklist'} size={19}/></button>
              <span className='today-routine-icon' style={{color}}><Icon name={r?.icon||'calendar'} size={25}/></span>
              <div className='today-task-copy'><strong>{e.title}</strong><span>{eventTime(e,date,data)} · {this.dur(durationOn(e,date,data))}{r?' · '+progress.done+'/'+progress.total+' pasos':''}{log.evidences?.length?' · 📷 '+log.evidences.length:''}</span></div>
              {isCurrent&&<span className='today-now-tag'>Ahora</span>}
              <button className='today-task-open' type='button' aria-expanded={selected} onClick={()=>this.setState({expandedTodayId:selected?'__none__':e.id})}>{selected?'Contraer':'Desglosar'} <Icon name={selected?'left':'right'} size={15}/></button>
            </div>
            {r&&<div className='today-task-progress'><div style={{width:Math.round(progress.done/progress.total*100)+'%'}}/></div>}
            {selected&&<div className='today-inline-procedure'><div className='today-inline-heading'><h3><Icon name={r?.icon||'checklist'} size={20}/> {r?'Pasos de esta rutina':'Registro del bloque'}</h3><small>{r?`${progress.done}/${progress.total} pasos realizados`:'Actividad sin pasos'}</small></div>
              {r&&<div className='inline-steps'>{this.renderCheckSteps(active,e,date,log,alloc)}</div>}
              <details className='today-extra-notes' open={!r}><summary>Notas y fotografías de este bloque <Icon name='right' size={14}/></summary><NoteEditor key={'daily-'+e.id} label='Nota de esta actividad' value={log.note||''} carry={upcomingNote(data,e,date)} onSave={text=>this.saveOccurrenceNote(e,date,text)}/>{(e.requestEvidence||r?.requestEvidence)&&<p className='evidence-prompt'>Puedes dejar evidencia de este bloque, si lo deseas.</p>}{this.evidenceSection(e,date)}</details>
            </div>}
          </article>;}) : <div className='today-empty-state'><Icon name='sun' size={32}/><h3>Agenda libre por ahora</h3><p>Nada que ver por aquí. Puedes aprovechar este espacio o preparar tu próximo plan.</p><div className='actions'><Btn onClick={()=>this.openRoutine()}><Icon name='plus'/> Crear rutina</Btn><Btn kind='secondary' onClick={()=>this.openEvent(undefined,'occasion')}><Icon name='calendar'/> Añadir evento</Btn></div></div>}
        {items.length>0&&items.every(e=>done(data,e,date))&&<div className='today-empty-state'><Icon name='spark' size={28}/><h3>¡Todo al día!</h3><p>Has completado los bloques que programaste. Puedes revisar tus resultados o dejar espacio para descansar.</p><Btn kind='secondary' onClick={()=>this.openRoutine()}>Preparar otra rutina</Btn></div>}
      </section><aside className='today-side'><section className='panel'><h2>Avance por ámbitos</h2>{byArea.length?byArea.map(a=><div className='today-area-row' key={a.id}><i style={{background:a.color}}/><div><strong>{a.title}</strong><small>{a.done} de {a.planned} actividades</small></div><span>{Math.round(a.done/a.planned*100)}%</span></div>):<p className='caption'>Vincula metas a tus actividades para agruparlas por ámbito.</p>}</section><section className='panel'><h2>Recuerdos de hoy</h2><div className='today-gallery'>{logs.flatMap(({e,log})=>(log?.evidences||[]).map(pic=><figure key={pic.id}><img src={pic.src} alt={'Recuerdo de '+e.title}/><figcaption>{e.title}</figcaption></figure>))}</div>{photoCount===0&&<p className='caption'>Las fotos que adjuntes durante el día se reunirán aquí.</p>}</section></aside></div>
      <section className='panel daily-review'><div className='panel-head'><div><h2>Mi revisión al cerrar el día</h2><p className='panel-sub'>Un momento para recordar, aprender y prepararte para mañana.</p></div>{review&&<span className='small-tag'>Revisión guardada</span>}</div><div className='daily-review-stats'><span><strong>{completedUnits}/{allUnits}</strong> Pasos y actividades</span><span><strong>{photoCount}</strong> Fotos</span><span><strong>{byArea.length}</strong> Ámbitos atendidos</span></div><div className='field'><label>¿Qué logré, qué aprendí y qué haré diferente mañana?</label><AutoTextarea value={this.state.reviewDraft} onChange={(ev:any)=>this.setState({reviewDraft:ev.target.value})} placeholder='Hoy avancé en... Me gustaría mejorar... Mañana priorizaré...'/></div><div className='row spread'><span className='caption'>Puedes revisar el día aunque aún queden actividades pendientes. La información no se elimina.</span><Btn onClick={this.saveDayReview}><Icon name='check' size={16}/> {review?'Actualizar revisión':'Guardar revisión del día'}</Btn></div></section>
    </>;
  }
  renderHome():any{
    const d=this.state.data,date=this.state.selectedDate,es=eventsOn(d,date).filter(e=>!e.allDay),occasions=eventsOn(d,date).filter(e=>e.kind==='occasion'),n=es.filter(e=>done(d,e,date)).length;
    const tracked=d.goals,rate=es.length?Math.round(n/es.length*100):0;
    return <><section className="home-hero"><div className="hero-copy"><div className="hero-kicker">✦ TU ESPACIO PERSONAL</div><h2>Tu día, todas tus posibilidades.</h2><p>Transforma tus metas en acciones concretas y observa cómo avanzas, paso a paso.</p><div className="hero-actions"><Btn onClick={()=>this.route('hoy')}><Icon name='checklist'/> Comenzar mi día</Btn><Btn kind="secondary" onClick={this.openGuide}><Icon name="help"/> Conocer Fullhouse</Btn></div></div><div className="hero-symbol"><img src="logo.svg" alt=""/></div></section>{this.renderHeading('Tu espacio para avanzar','Una vista clara de lo que quieres conseguir, lo que harás hoy y lo que realmente has hecho.',<Btn onClick={()=>this.openEvent()}><Icon name="plus" size={16}/> Nueva actividad</Btn>)}
      <div className="notice">Este es un prototipo funcional con datos de ejemplo. Puedes editarlo todo. Los cambios se guardan automáticamente en este navegador.</div>
      <div className="cards">{this.renderStat('Metas activas',d.goals.length,'Incluye sub-metas','target')}{this.renderStat('Rutinas creadas',d.routines.length,'Procedimientos reutilizables','checklist')}{this.renderStat('Actividades del día',es.length,`${n} completadas`,'calendar')}{this.renderStat('Cumplimiento diario',rate+'%','De actividades planificadas','chart')}</div>
      {occasions.length>0&&<div className='home-special-events'><strong><Icon name='calendar' size={17}/> Acontecimientos de hoy</strong>{occasions.map(e=><button key={e.id} onClick={()=>{this.route('calendario');this.chooseDay(date);}}>{e.title} <span>{e.allDay?'Todo el día':eventTime(e,date,d)}</span></button>)}</div>}
      <div className="two-col"><section className="panel"><div className="panel-head"><div><h2>Agenda del día</h2><p className="panel-sub">{fmtDate(date)}</p></div><button className="link-btn" onClick={()=>this.route('horario')}>Ver horario <Icon name="arrow-right" size={15}/></button></div>{this.renderTodayList(date,true)}</section>
        <section className="panel"><div className="panel-head"><div><h2>Mis metas</h2><p className="panel-sub">Indicadores de resultados, no solo tareas</p></div><button className="link-btn" onClick={()=>this.route('metas')}>Ver todas <Icon name="arrow-right" size={15}/></button></div>
        {tracked.length?tracked.slice(0,5).map(g=><div key={g.id} className="goal-summary"><div className="goal-summary-top"><strong>{g.title}</strong><span>{goalMode(g)==='numeric'?percent(g.current,g.target)+'%':goalMode(g)==='milestones'?goalMilestones(g).filter(m=>m.done).length+'/'+goalMilestones(g).length+' hitos':statusLabel(goalStatus(g))}</span></div>{goalMode(g)!=='qualitative'?<div className="progress-track"><div className="progress-fill" style={{width:(goalMode(g)==='milestones'?percent(goalMilestones(g).filter(m=>m.done).length,goalMilestones(g).length):percent(g.current,g.target))+'%',background:g.color}}/></div>:<p className="caption">Meta cualitativa · registra cambios en tu relación o bienestar</p>}</div>):<div className="empty"><strong>Aún no tienes metas</strong><p>Comienza con un objetivo que sea importante para ti.</p></div>}
        </section></div>
      <div className="section-head"><h2 className="section-title">Acceso rápido</h2></div><div className="goal-grid"><button className="goal-card" style={{textAlign:'left',cursor:'pointer'}} onClick={()=>this.openEvent(undefined,'occasion')}><div className='row'><span className='routine-badge'><Icon name='calendar'/></span><div><div className='goal-name'>Nuevo evento</div><div className='goal-desc'>Viajes, citas, celebraciones o fechas especiales.</div></div></div><span className='link-btn'>Crear evento <Icon name='arrow-right' size={14}/></span></button><button className="goal-card" style={{textAlign:'left',cursor:'pointer'}} onClick={()=>this.openGoal()}><div className="row"><span className="routine-badge"><Icon name="target"/></span><div><div className="goal-name">Nueva meta</div><div className="goal-desc">Desglosa un objetivo y define cómo medirlo.</div></div></div><span className="link-btn">Crear meta <Icon name="arrow-right" size={14}/></span></button><button className="goal-card" style={{textAlign:'left',cursor:'pointer'}} onClick={()=>this.openRoutine()}><div className="row"><span className="routine-badge"><Icon name="checklist"/></span><div><div className="goal-name">Nueva rutina</div><div className="goal-desc">Diseña los pasos de un procedimiento.</div></div></div><span className="link-btn">Crear rutina <Icon name="arrow-right" size={14}/></span></button></div>
    </>;
  }
  renderGoalCard(g:Goal,depth=0):any{
    const d=this.state.data,children=d.goals.filter(x=>x.parentId===g.id),linked=d.events.filter(e=>e.goalId===g.id).length,mode=goalMode(g),ms=goalMilestones(g),doneCount=ms.filter(m=>m.done).length;
    return <div className="goal-card" key={g.id} style={{borderLeft:`5px solid ${g.color}`,'--goal-tint':g.color} as any}><div className="goal-card-title"><div className="goal-color" style={{background:g.color}}/><div className="flex"><div className="goal-level">{areaInfo(g.area).title.toUpperCase()} · {depth?'SUB-META · NIVEL '+(depth+1):'META PRINCIPAL'} · {mode==='numeric'?'NUMÉRICA':mode==='milestones'?'POR HITOS':'CUALITATIVA'}</div><h3 className="goal-name">{g.title}</h3><p className="goal-desc">{g.desc||'Sin descripción'}</p></div></div>
      {mode==='numeric'?<div><div className="goal-summary-top"><strong>{g.current} / {g.target} {g.unit}</strong><span>{percent(g.current,g.target)}%</span></div><div className="progress-track"><div className="progress-fill" style={{background:g.color,width:`${percent(g.current,g.target)}%`}}/></div></div>:mode==='milestones'?<div><div className="goal-summary-top"><strong>{doneCount} de {ms.length} hitos completados</strong><span>{ms.length?percent(doneCount,ms.length)+'%':'Sin hitos'}</span></div><div className="progress-track"><div className="progress-fill" style={{background:g.color,width:`${percent(doneCount,ms.length)}%`}}/></div><div className="milestone-list">{ms.map(m=><button key={m.id} className={'milestone-item '+(m.done?'is-complete':'')} onClick={()=>this.toggleMilestone(g.id,m.id)}><span className={'milestone-check '+(m.done?'active':'')}>{m.done?'✓':''}</span>{m.title}</button>)}</div></div>:<div className="qualitative-state"><span className="state-spark">✦</span><div><strong>{statusLabel(goalStatus(g))}</strong><p>Tu avance se registra por estados y reflexiones, no con números.</p></div></div>}
      <div className="goal-footer"><span>{children.length} sub-metas · {linked} actividades vinculadas</span><span className="small-tag">{g.history.length} registros</span></div>
      <div className="actions">{this.state.guideOpen&&this.state.guideStep===1&&<Btn kind="secondary" tiny onClick={()=>this.selectGuideGoal(g.id)}><Icon name="check" size={14}/> Elegir para la guía</Btn>}{mode!=='milestones'&&<Btn kind="secondary" tiny onClick={()=>this.openProgress(g)}><Icon name="chart" size={14}/> Registrar avance</Btn>}<Btn kind="ghost" tiny onClick={()=>this.openGoal(g)}><Icon name="edit" size={14}/> Editar</Btn><Btn kind="ghost" tiny onClick={()=>this.openGoal(undefined,g.id)} title="Añadir sub-meta"><Icon name="plus" size={14}/> Sub-meta</Btn><Btn kind="ghost" tiny onClick={()=>this.deleteGoal(g)} title="Eliminar"><Icon name="trash" size={14}/></Btn></div>
    </div>;
  }
  visibleGoals():Goal[]{
    const gs=this.state.data.goals;
    if(this.state.areaFilter==='all')return gs;
    const visible=new Set(gs.filter(g=>g.area===this.state.areaFilter).map(g=>g.id));
    let changed=true;while(changed){changed=false;for(const g of gs){if(visible.has(g.id)&&g.parentId&&!visible.has(g.parentId)){visible.add(g.parentId);changed=true;}}}
    return gs.filter(g=>visible.has(g.id));
  }
  renderGoalTree(g:Goal,all:Goal[],level=0):any{
    const children=all.filter(x=>x.parentId===g.id);
    return <div className={'goal-tree-node '+(level?'goal-tree-descendant':'')+(this.state.dragOverCardId===g.id?' card-drop-target':'')} key={g.id} onDragOver={e=>{if(this.state.draggedCardType==='goal'){e.preventDefault();e.stopPropagation();if(this.state.dragOverCardId!==g.id)this.setState({dragOverCardId:g.id});}}} onDrop={e=>this.cardDrop('goal',g.id,e)}>
      <div className='goal-tree-card'><button type='button' draggable={true} className='card-drag-handle' title='Arrastrar para cambiar el orden (solo dentro del mismo nivel)' aria-label={'Reordenar '+g.title} onDragStart={e=>this.startCardDrag('goal',g.id,e)} onDragEnd={this.endCardDrag} onKeyDown={e=>{if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();this.moveCardKeyboard('goal',g.id,e.key==='ArrowUp'?-1:1);}}}><Icon name='grip' size={17}/> Mover</button>{this.renderGoalCard(g,level)}</div>
      {children.length>0&&<div className='goal-tree-children'>{children.map(child=>this.renderGoalTree(child,all,level+1))}</div>}
    </div>;
  }
  renderGoals():any{
    const items=this.visibleGoals();const ids=new Set(items.map(g=>g.id));
    const roots=items.filter(g=>!g.parentId||!ids.has(g.parentId));
    const masonry:Goal[][]=[[],[]];const heights=[0,0];
    const estimate=(g:Goal):number=>{const children=items.filter(x=>x.parentId===g.id);const ms=goalMilestones(g).length;return 360+Math.min(120,(g.desc||'').length*.45)+ms*35+children.reduce((sum,x)=>sum+estimate(x)+22,0);};
    roots.forEach(g=>{const col=heights[0]<=heights[1]?0:1;masonry[col].push(g);heights[col]+=estimate(g)+18;});
    return <>{this.renderHeading('Mis metas','Metas conectadas con sus submetas, sus ámbitos de vida y sus fechas de revisión.',<Btn onClick={()=>this.openGoal()}><Icon name='plus'/> Crear meta</Btn>)}
      <div className='goal-view-toolbar'><span>Explorar como</span><div className='view-toggle'><button className={this.state.goalView==='cards'?'selected':''} onClick={()=>this.setState({goalView:'cards'})}><Icon name='checklist' size={16}/> Árbol de metas</button><button className={this.state.goalView==='map'?'selected':''} onClick={()=>this.setState({goalView:'map'})}><Icon name='network' size={16}/> Mapa de metas</button></div><div className='goal-area-filter'><span>Ámbito</span><FriendlySelect value={this.state.areaFilter} ariaLabel='Filtrar metas por ámbito' onChange={areaFilter=>this.setState({areaFilter:areaFilter as LifeArea|'all'})} options={[{value:'all',label:'Todos los ámbitos'},...lifeAreas.map(a=>({value:a.id,label:a.title}))]}/></div></div>
      <div className='notice'>Cada meta puede pertenecer a Mente, Físico, Propósito o Social. Las ramas muestran dónde nace cada submeta y el mapa permite explorar conexiones adicionales.</div>
      {items.length?(this.state.goalView==='map'?this.renderGoalMap():<div className='goal-forest'>{masonry.map((column,i)=><div className='goal-masonry-column' key={i}>{column.map(g=>this.renderGoalTree(g,items))}</div>)}</div>):<section className='panel' style={{marginTop:20}}><div className='empty'><Icon name='target'/><strong>No hay metas en este ámbito</strong><p>Crea una meta o cambia el filtro para ver otras ramas.</p><Btn onClick={()=>this.openGoal()}>Crear meta</Btn></div></section>}
    </>;
  }
  renderGoalMap():any{
    const layout=graphLayout({...this.state.data,goals:this.visibleGoals()},this.state.mapGrouping);const positions=new Map(layout.nodes.map(n=>[n.goal.id,n]));
    return <section className="goal-map-panel"><div className="map-topbar"><div><h2>Mapa de conexiones</h2><p>Las líneas continuas representan sub-metas; las discontinuas, procesos dependientes. Selecciona una tarjeta para editarla.</p></div><div className="view-toggle"><button className={this.state.mapGrouping==='structure'?'selected':''} onClick={()=>this.setState({mapGrouping:'structure'})}>Por procesos</button><button className={this.state.mapGrouping==='time'?'selected':''} onClick={()=>this.setState({mapGrouping:'time'})}>Por tiempo</button></div></div>
      <div className="goal-map-scroll"><div className="goal-map-surface" style={{width:layout.width,height:layout.height}}><svg className="goal-map-wires" width={layout.width} height={layout.height} aria-hidden="true"><defs><marker id="graph-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="currentColor"/></marker></defs>{layout.edges.map((e,i)=>{const a=positions.get(e.from),b=positions.get(e.to);if(!a||!b)return null;const x1=a.x+220,y1=a.y+53,x2=b.x,y2=b.y+53;const c=Math.max(44,Math.abs(x2-x1)*.46);return <path key={i} className={'graph-edge '+(e.kind==='depends'?'graph-dependency':'')} d={`M${x1},${y1} C${x1+c},${y1} ${x2-c},${y2} ${x2},${y2}`} />;})}</svg>{layout.labels.map((label,i)=><div className="goal-map-label" key={i} style={{left:label.x}}>{label.title}</div>)}{layout.nodes.map(({goal:g,x,y})=><button type="button" className="map-node" key={g.id} style={{left:x,top:y,borderTopColor:g.color}} onClick={()=>this.openGoal(g)}><span className="map-node-name">{g.title}</span><span className="map-node-tag">{goalMode(g)==='numeric'?'Numérica':goalMode(g)==='milestones'?'Por hitos':'Cualitativa'} {g.dueDate?'· '+g.dueDate:''}</span><span className="map-node-progress">{goalMode(g)==='numeric'?percent(g.current,g.target)+'%':goalMode(g)==='milestones'?goalMilestones(g).filter(m=>m.done).length+' hitos':statusLabel(goalStatus(g))}</span></button>)}</div></div><div className="map-legend"><span><i className="legend-line"/> Sub-meta</span><span><i className="legend-line dashed"/> Depende de</span><span><Icon name="help" size={14}/> Puedes asignar fechas y dependencias al editar cada meta</span></div></section>;
  }
  renderRoutines():any{
    const rs=this.state.data.routines;
    return <>{this.renderHeading('Rutinas y procedimientos','Diseña, ordena y programa procedimientos que se adapten a tus días.',<Btn onClick={()=>this.openRoutine()}><Icon name="plus"/> Nueva rutina</Btn>)}
      <div className="routine-grid">{rs.map(r=>{const scheduled=this.routineSchedule(r.id);return <div className={'routine-card routine-modern '+(this.state.dragOverCardId===r.id?'card-drop-target':'')} key={r.id} style={{'--routine-accent':r.color||'#a26cf4'} as any}
        onDragOver={e=>{if(this.state.draggedCardType==='routine'){e.preventDefault();if(this.state.dragOverCardId!==r.id)this.setState({dragOverCardId:r.id});}}}
        onDrop={e=>this.cardDrop('routine',r.id,e)}>
        <div className="routine-modern-top"><span className="routine-badge routine-icon" style={{'--routine-accent':r.color||'#a26cf4'} as any}><Icon name={routineIcons.includes(r.icon||'')?r.icon!:'checklist'} size={23}/></span><div className="flex"><h3 className="goal-name">{r.title}</h3><p className="goal-desc">{r.desc||'Sin descripción todavía'}</p></div><button className="card-drag-handle" draggable={true} title="Arrastra para reordenar" aria-label={'Reordenar '+r.title} onDragStart={e=>this.startCardDrag('routine',r.id,e)} onDragEnd={this.endCardDrag} onKeyDown={e=>{if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();this.moveCardKeyboard('routine',r.id,e.key==='ArrowUp'?-1:1);}}}><Icon name="grip" size={17}/></button></div>
        <div className="routine-metadata"><span><Icon name="clock" size={15}/> {this.dur(routineMinutes(r))} · {r.durationMode==='fixed'?'duración fija':'según pasos'}</span><span><Icon name="checklist" size={15}/> {r.steps.length} pasos principales</span></div>
        <div className="routine-step-preview new-step-preview">{r.steps.slice(0,4).map((s,i)=><div className="routine-preview-line" key={s.id}><span className="routine-preview-index">{i+1}</span><span className='routine-preview-name'>{s.title}{s.children?.length>0&&<small className='preview-children'>↳ {s.children.slice(0,3).map(c=>c.title).join(' · ')}{s.children.length>3?'…':''}</small>}{s.mode==='alternatives'&&!!s.variants?.length&&<small className='preview-children'>↔ {s.variants.map(v=>v.title).filter(Boolean).join(' / ')}</small>}</span><span className="routine-preview-time">{this.dur(stepMinutes(s))}</span></div>)}{r.steps.length>4&&<div className="routine-preview-more">+{r.steps.length-4} pasos adicionales</div>}</div>
        <div className="actions">{this.state.guideOpen&&this.state.guideStep===4&&<Btn tiny kind="secondary" onClick={()=>this.useRoutineForGuide(r)}>Usar en la guía</Btn>}
          <Btn tiny onClick={()=>this.chooseRoutineForSchedule(r)}><Icon name="calendar" size={14}/> {scheduled?'Reprogramar':'Programar'}</Btn>
          <Btn tiny kind="secondary" onClick={()=>this.openRoutine(r)}><Icon name="edit" size={14}/> Editar</Btn>
          <Btn tiny kind="ghost" onClick={()=>this.deleteRoutine(r)}><Icon name="trash" size={14}/></Btn></div>
      </div>;})}</div>
      {!rs.length&&<div className="panel"><div className="empty"><strong>Aún no tienes rutinas</strong><p>Crea un procedimiento, sus pasos y duración estimada.</p><Btn onClick={()=>this.openRoutine()}>Crear rutina</Btn></div></div>}
    </>;
  }
  monthDays():{day:string;inside:boolean}[]{
    const start=parseDay(this.state.month),offset=(start.getDay()+6)%7;const first=addDays(this.state.month,-offset);const result=[];
    for(let i=0;i<42;i++){const day=addDays(first,i);result.push({day,inside:day.slice(0,7)===this.state.month.slice(0,7)});}return result;
  }
  changeMonth=(offset:number):void=>{const d=parseDay(this.state.month);d.setMonth(d.getMonth()+offset);const newMonth=ymd(d);this.setState({month:newMonth,selectedDate:newMonth})}
  renderSchedule():any{
    const date=this.state.selectedDate,data=this.state.data,es=eventsOn(data,date).filter(e=>!e.allDay);
    const startHour=0,endHour=24,hourHeight=71,origin=0;
    type Placed={event:EventItem;start:number;end:number;lane:number;lanes:number};
    const placed:Placed[]=[],all=es.map(e=>({event:e,start:minutes(eventTime(e,date,data)),end:Math.min(1440,minutes(eventTime(e,date,data))+Math.max(10,durationOn(e,date,data)))})).sort((a,b)=>a.start-b.start);
    let group:Placed[]=[],groupEnd=-1;
    const finish=()=>{if(!group.length)return;const laneEnds:number[]=[];group.forEach(x=>{let j=laneEnds.findIndex(t=>t<=x.start);if(j<0){j=laneEnds.length;laneEnds.push(-1);}x.lane=j;laneEnds[j]=x.end;});group.forEach(x=>{x.lanes=laneEnds.length;placed.push(x);});group=[];};
    all.forEach(x=>{if(group.length&&x.start>=groupEnd)finish();group.push({...x,lane:0,lanes:1});groupEnd=Math.max(groupEnd,x.end);});finish();
    const sleep=sleepSections(minutes(this.state.sleepStart),this.state.sleepHours*60),focusing=es.find(e=>e.id===this.state.scheduleFocusId);
    return <>{this.renderHeading('Mi horario','Explora las 24 horas: acerca cada bloque para ver sus pasos y duraciones, sin ventanas emergentes.',<Btn onClick={()=>this.openEvent()}><Icon name='plus'/> Añadir bloque</Btn>)}
      <div className='schedule-banner'><div className='schedule-days schedule-days-stable'><button className='icon-btn' title='Día anterior' onClick={()=>this.chooseDay(addDays(date,-1))}><Icon name='left'/></button><div><strong>{fmtDate(date)}</strong><span>{es.length} bloques · {es.filter(e=>done(data,e,date)).length} completados</span></div><button className='icon-btn' title='Día siguiente' onClick={()=>this.chooseDay(addDays(date,1))}><Icon name='right'/></button><Btn tiny kind='secondary' onClick={()=>this.chooseDay(today())}>Hoy</Btn></div><div className='schedule-banner-actions'><span><Icon name='moon' size={15}/> Sueño visual: {this.state.sleepHours} h · configurable en Ajustes.</span>{date===today()&&<button className='schedule-jump-now' onClick={()=>document.querySelector('.timeline-now-line')?.scrollIntoView({behavior:'smooth',block:'center'})}><Icon name='clock' size={14}/> Ir a la hora actual</button>}</div></div>

      {focusing&&<section id='schedule-detail-view' className='panel schedule-zoom-panel' style={{'--zoom-color':eventTint(data,focusing)} as any}>{this.renderScheduleZoom(focusing,date)}</section>}
      <section className='timeline-panel'><div className='timeline-head'><div><Icon name='sun'/> Tus 24 horas</div><p>Selecciona cualquier bloque para acercarte a sus contenidos. La línea brillante marca la hora actual.</p></div>
        <div className='timeline-canvas' style={{height:(endHour-startHour)*hourHeight+24}}>
          {sleep.map((period,i)=><div key={'sleep-'+i} className='sleep-period' style={{top:period.start/60*hourHeight,height:(period.end-period.start)/60*hourHeight}}><Icon name='moon' size={16}/><span>Tiempo de sueño</span></div>)}
          {Array.from({length:endHour-startHour+1},(_,i)=>i+startHour).map(hour=><div key={hour} className='timeline-gridline' style={{top:(hour-startHour)*hourHeight}}><span>{String(hour).padStart(2,'0')}:00</span><div/></div>)}
          {date===today()&&<div className='timeline-now-line' style={{top:this.state.clockMinutes/60*hourHeight}}><span>{timeString(this.state.clockMinutes)} · Ahora</span></div>}
          <div className='timeline-events'>{placed.map(({event:e,start,end,lane,lanes})=>{const r=data.routines.find(x=>x.id===e.routineId),color=eventTint(data,e),isDone=done(data,e,date),duration=durationOn(e,date,data),height=Math.max(18,(end-start)/60*hourHeight-3),width=100/lanes,kind=height<40||width<24?'micro':height<85||width<44?'compact':'expanded';return <button type='button' key={e.id} className={'timeline-block '+kind+' '+(isDone?'completed ':'')+(this.state.scheduleFocusId===e.id?'timeline-focused':'')} onClick={()=>{const next=this.state.scheduleFocusId===e.id?'':e.id;this.setState({scheduleFocusId:next,detailPath:[]});if(next)requestAnimationFrame(()=>document.getElementById('schedule-detail-view')?.scrollIntoView({behavior:'smooth',block:'start'}));}} style={{top:start/60*hourHeight,height,left:(lane/lanes*100)+'%',width:width+'%','--block-bg':color} as any} title={`${e.title} · ${eventTime(e,date,data)} · ${this.dur(duration)}`} aria-label={`Acercar ${e.title}`}><div className='timeline-block-header'><span className='timeline-event-name'>{r&&<Icon name={r.icon||'checklist'} size={kind==='micro'?12:15}/>} {e.title}</span>{isDone&&<span className='timeline-done'>✓</span>}</div>{kind!=='micro'&&<div className='timeline-time'>{eventTime(e,date,data)} · {this.dur(duration)}</div>}{kind==='expanded'&&<div className='timeline-mini-steps'>{r&&activeSteps(r.steps,date,data.logs[key(e,date)]?.choices||{}).slice(0,3).map(x=><span key={x.id}>{x.title}</span>)}</div>}</button>})}</div>
        </div>{!es.length&&<div className='timeline-empty'><Icon name='calendar'/><p>Agenda libre: no hay bloques programados en esta fecha.</p><Btn onClick={()=>this.openEvent()}>Agregar bloque</Btn></div>}
      </section>

    </>;
  }
  renderScheduleZoom(e:EventItem,date:string):any{
    const data=this.state.data,log=data.logs[key(e,date)]||{completed:false,checkedSteps:[]},r=data.routines.find(x=>x.id===e.routineId);
    const steps=r?activeSteps(r.steps,date,log.choices||{}):[],allocation=leafAllocation(steps,durationOn(e,date,data));
    const get=(list:Step[],path:string[])=>{let items=list;for(const id of path){const node=items.find(s=>s.id===id);if(!node)return [];items=node.children||[];}return items;};
    const path=this.state.detailPath,view=get(steps,path),frame=eventFrame(e,date,data),base=frame?.start||0;
    const blocks=view.map(s=>({s,minutes:effectiveStepMinutes(s,allocation)}));const total=blocks.reduce((n,x)=>n+x.minutes,0),color=eventTint(data,e);
    return <div className='schedule-zoom' style={{'--zoom-color':color} as any}>
      <div className='row spread'><div><div className='eyebrow'>ACERCAMIENTO · {eventTime(e,date,data)} – {timeString(Math.min(1439,base+durationOn(e,date,data)))}</div><h2><Icon name={r?.icon||'calendar'} size={24}/> {e.title}</h2><p className='caption'>{r?.desc||e.note||'Observa la duración de este bloque y su distribución.'}</p></div><button className='icon-btn' aria-label='Cerrar acercamiento' onClick={()=>this.setState({scheduleFocusId:'',detailPath:[]})}><Icon name='close'/></button></div>
      {path.length>0&&<div className='schedule-zoom-crumb'><button onClick={()=>this.setState({detailPath:[]})}>{e.title}</button>{path.map((id,i)=><span key={id}> / <button onClick={()=>this.setState({detailPath:path.slice(0,i+1)})}>{getStepByPath(steps,path.slice(0,i+1))?.title||'Paso'}</button></span>)}</div>}
      {blocks.length?<div className='schedule-zoom-blocks'>{blocks.map(({s,minutes:m})=><button className='schedule-zoom-block' key={s.id} type='button' onClick={()=>s.children?.length?this.setState({detailPath:[...path,s.id]}):this.notice(s.desc||'Este paso no tiene más subpasos.')} style={{'--zoom-step-color':goalColor(data,s.goalId)||color,flexGrow:Math.max(1,m)} as any}><strong>{s.title}</strong><small>{this.dur(m)} {s.children?.length?'· Acercar':'· '+(s.desc||'Sin más detalles')}</small></button>)}</div>:<div className='today-empty-state'>Este bloque no tiene subpasos. {e.note||''}</div>}
      <div className='row spread schedule-zoom-footer'><span className='caption'>Tiempo distribuido: {this.dur(total)} {r?'· '+steps.length+' pasos principales':''}</span><div className='actions'>{path.length>0&&<Btn kind='secondary' onClick={()=>this.setState({detailPath:path.slice(0,-1)})}><Icon name='left' size={14}/> Alejar</Btn>}<Btn kind='secondary' onClick={()=>this.openEvent(e)}><Icon name='edit' size={14}/> Editar bloque</Btn>{date===today()&&<Btn onClick={()=>this.setState({page:'hoy',expandedTodayId:e.id})}>Realizar en Mi día</Btn>}</div></div>
    </div>;
  }
  renderDetail():any{
    const date=this.state.selectedDate,d=this.state.data,e=d.events.find(x=>x.id===this.state.activeEventId);if(!e)return <p>No se encontró el bloque seleccionado.</p>;
    const r0=d.routines.find(x=>x.id===e.routineId),r=r0?{...r0,steps:activeSteps(r0.steps,date,d.logs[key(e,date)]?.choices||{})}:undefined,g=d.goals.find(x=>x.id===e.goalId),path=this.state.detailPath,current=r?getStepByPath(r.steps,path):undefined;
    const choices=current?(current.children||[]):r?.steps||[];
    const log=d.logs[key(e,date)]||{completed:false,checkedSteps:[]};
    const allocation=leafAllocation(r?.steps||[],durationOn(e,date,d));
    return <div className="detail-zoom"><div className="detail-crumbs"><button onClick={()=>this.setState({detailPath:[]})}>{e.title}</button>{path.map((id,i)=><span key={id}> / <button onClick={()=>this.setState({detailPath:path.slice(0,i+1)})}>{getStepByPath(r?.steps||[],path.slice(0,i+1))?.title||'Paso'}</button></span>)}</div>
      {path.length===0?<><div className="detail-spotlight"><span className="detail-time"><Icon name="clock"/> {fmtDate(date)} · {eventTime(e,date,d)} · {this.dur(durationOn(e,date,d))}</span><h3>{e.title}</h3><p>{e.note||r?.desc||'Sin descripción adicional para este bloque.'}</p><div className="detail-tags">{g&&<span style={{borderColor:g.color}}><span className="circle-tint" style={{background:g.color}}/>{g.title}</span>}{e.repeat!=='none'&&<span>↻ Recurrente</span>}</div></div><div className="detail-actions"><Btn kind="secondary" onClick={()=>this.openEvent(e)}><Icon name="edit"/> Editar bloque</Btn>{r&&<Btn onClick={()=>this.openExecute(e)}><Icon name="checklist"/> Ejecutar rutina</Btn>}<Btn kind="secondary" onClick={()=>this.toggleEvent(e,date)}>{done(d,e,date)?'Marcar pendiente':'Marcar completada'}</Btn></div></>:<div className="detail-spotlight"><div className="detail-time"><Icon name="clock"/> {this.dur(current?effectiveStepMinutes(current,allocation):0)} previstos</div><h3>{current?.title||'Paso'}</h3><p>{current?.desc||'No hay instrucciones adicionales para este paso.'}</p>{current&&!current.children?.length&&<Btn kind="secondary" onClick={()=>this.toggleStep(e,date,current.id)}>{log.checkedSteps.includes(current.id)?'✓ Completado · Desmarcar':'Marcar paso completado'}</Btn>}</div>}
      {choices.length>0&&<><h3 className="detail-section-title">{path.length?'Elementos de '+stepLevelName(path.length-1).toLowerCase():'Dentro de este bloque'}</h3><div className="zoom-children">{choices.map((s,i)=><button key={s.id} className="zoom-child" onClick={()=>this.setState({detailPath:[...path,s.id]})}><span className="zoom-index" style={goalColor(d,s.goalId)?{background:goalColor(d,s.goalId),color:readableOn(goalColor(d,s.goalId)!)}:{}}>{i+1}</span><div className="flex"><strong>{s.title}</strong><div className="caption">{this.dur(effectiveStepMinutes(s,allocation))} · {s.children?.length?s.children.length+' elementos':'Ver instrucciones'}</div></div><Icon name="right" size={18}/></button>)}</div></>}
      {this.evidenceSection(e,date,current?.id||'')}<NoteEditor key={e.id+'-'+date+'-'+(current?.id||'block')} value={current?log.stepNotes?.[current.id]||'':log.note||''} carry={upcomingNote(d,e,date,current?.id)} label={current?'Nota de este paso':'Nota de esta actividad o rutina'} onSave={text=>this.saveOccurrenceNote(e,date,text,current?.id)}/>
      {!r&&<div className="notice">Para desglosar este bloque en pasos, asígnale una rutina desde «Editar bloque».</div>}
      {path.length>0&&<Btn kind="ghost" onClick={()=>this.setState({detailPath:path.slice(0,-1)})}><Icon name="left"/> Volver al nivel anterior</Btn>}</div>;
  }
  renderGuide():any{
    if(!this.state.guideOpen)return null;const i=this.state.guideStep,step=guideSteps[i];const dock=i>0;const goal=this.state.data.goals.find(g=>g.id===this.state.guideGoalId);
    const buttonLabel=i===0?'¡Vamos!':i===1?'Crear mi primera meta':i===2?'Añadir submeta':i===3?'Programar revisión':i===4?'Programar rutina':i===5?'Ver mi horario':'Finalizar recorrido';
    return <div className={'guide-backdrop '+(dock?'guide-docked':'guide-welcome')} role="presentation"><div className="guide-panel" role="dialog" aria-modal={!dock} aria-label="Tutorial interactivo"><div className="guide-top"><span className="guide-tag"><Icon name="spark"/> TUTORIAL INTERACTIVO</span><button className="icon-btn" onClick={this.finishGuide} aria-label="Saltar el tutorial" title="Saltar tutorial"><Icon name="close"/></button></div><div className="guide-progress">{guideSteps.map((s,j)=><span className={'guide-dot '+(j<=i?'active':'')} key={j}/>)}</div><div className="guide-section-label">APRENDE HACIENDO · Paso {i+1} de {guideSteps.length}</div><h2>{step.title}</h2><p>{step.text}</p><div className="guide-why"><Icon name="spark" size={17}/><span><strong>¿Por qué hacemos esto?</strong> {i===1?'Elegir un rumbo claro facilita decidir qué merece tu tiempo.':i===2?'Los pasos pequeños convierten una ambición enorme en avances que puedes reconocer.':i===3?'Una revisión periódica te permite ajustar el plan sin perder perspectiva.':i===4?'Repetir una acción reduce la necesidad de organizarla de nuevo cada mañana.':i===5?'Reservar un espacio de tiempo hace que los objetivos tengan un lugar real en tu día.':'Fullhouse reúne intención, ejecución y seguimiento en un mismo lugar.'}</span></div>{goal&&i>1&&i<6&&<div className="guide-selected-goal"><Icon name="target" size={16}/> Trabajando en: <strong>{goal.title}</strong></div>}{i===1&&<div className="guide-tip">Te recomendamos crear una meta nueva para practicar. Si prefieres, usa «Elegir para la guía» en una meta existente.</div>}{i===5&&<div className="guide-tip">Busca el bloque que programaste: estará en la fecha que elegiste.</div>}<div className="guide-buttons"><button className="guide-skip" onClick={this.finishGuide}>Saltar tutorial</button><Btn onClick={this.guideAction}>{buttonLabel} <Icon name="arrow-right" size={16}/></Btn></div></div></div>;
  }
  helpBody():any{
    const content:Record<string,[string,string[]]>={
      hoy:['Mi día y revisión',['Aquí ejecutas las actividades de la jornada y marcas los pasos que completas.','Puedes adjuntar fotos y notas opcionales a cada bloque o paso.','Antes de dormir revisa tus avances, los ámbitos atendidos y deja una reflexión para mañana.','Tus fotografías se comprimen y permanecen en el almacenamiento de este navegador. Exporta respaldos con frecuencia.']],
      inicio:['Inicio y resumen',['Tu panel reúne las metas, rutinas y actividades del día.','El porcentaje de cumplimiento refleja actividades realizadas, no resultados obtenidos.','Usa los accesos rápidos para crear metas, rutinas o programar eventos.']],
      metas:['Metas y tipos de seguimiento',['Numérica: registra un resultado concreto y una cantidad objetivo.','Cualitativa: elige estados de avance y deja reflexiones; es ideal para relaciones, bienestar o aprendizaje.','Por hitos: divide una meta en logros verificables y marca los que completas.','Clasifica tus objetivos por ámbito (Mente, Físico, Propósito, Social), vincula fechas de revisión y explora sus conexiones.']],
      rutinas:['Rutinas y procedimientos',['Las rutinas son plantillas reutilizables. Arrastra el tirador de cada paso para reordenarlo.','Cada paso puede realizarse siempre, aparecer solo ciertos días o presentar opciones distintas según el día, cada una con sus propias instrucciones.','Cada rutina tiene una programación vigente: usa «Reprogramar» para modificar el futuro sin afectar el historial.']],
      horario:['Horario de mañana a noche',['Cada bloque representa una actividad o rutina programada. Su diseño se adapta a la duración disponible.','Haz clic en un bloque para acercarte a su contenido, sus pasos y sus detalles.','Si algo cambia, puedes editar el bloque o moverlo ±15 minutos desde el calendario.']],
      calendario:['Calendario independiente',['Selecciona un día para consultar su agenda.','Los eventos pueden ocurrir una sola vez o repetirse por días, intervalos o fechas concretas, con un último día de repetición.','Los movimientos de ±15 minutos aplican solo a ese día, incluso en una rutina recurrente.']],
      progreso:['Progreso y resultados',['Puedes comparar lo planeado con lo realizado durante los últimos siete días.','Las metas numéricas, los hitos y las cualitativas se muestran de forma diferente.','Registrar una actividad completada no modifica automáticamente un resultado personal.']],
      ajustes:['Apariencia, respaldos y ayuda',['Selecciona una paleta y la interfaz se adaptará al instante.','Desde cualquier ventana emergente puedes alternar entre disposición vertical u horizontal.','Exporta un respaldo JSON antes de limpiar los datos del navegador.','Puedes volver a abrir la guía en cualquier momento.']]
    };
    const [title,lines]=content[this.state.helpTopic]||content.inicio;
    return <div className="help-content"><h3>{title}</h3>{lines.map((line,i)=><div className="help-line" key={i}><span>{i+1}</span><p>{line}</p></div>)}<Btn onClick={()=>{this.setState({helpOpen:false});this.openGuide()}} kind="secondary"><Icon name="help"/> Abrir guía completa</Btn></div>;
  }
  renderHelpPanel():any{if(!this.state.helpOpen)return null;return <aside className={'help-float '+(this.state.modal?'in-modal':'')} role='complementary' aria-label='Ayuda contextual' style={this.state.helpX!==null&&this.state.helpY!==null?{left:this.state.helpX,top:this.state.helpY,right:'auto',bottom:'auto'}:undefined}><div className='help-float-head' onMouseDown={this.beginHelpDrag} onTouchStart={this.beginHelpTouch} title='Arrastra para mover esta ayuda'><strong><Icon name='help' size={18}/> Ayuda contextual</strong><button className='icon-btn' onClick={()=>this.setState({helpOpen:false})} title='Cerrar ayuda' aria-label='Cerrar ayuda'><Icon name='close' size={16}/></button></div>{this.helpBody()}</aside>;}
  isCalendarImportant(e:EventItem):boolean{return e.kind==='review'||e.kind==='occasion'||(!e.routineId&&['none','monthly','yearly','dates'].includes(e.repeat));}
  renderCalendarAgenda(date:string):any{
    const d=this.state.data,all=eventsOn(d,date),important=all.filter(e=>this.isCalendarImportant(e));
    const routines=all.filter(e=>!!e.routineId&&e.repeat!=='none');
    return <><div className='calendar-agenda-entries'>{important.length?important.map(e=><div className='calendar-agenda-entry' key={e.id}><span className='calendar-agenda-when'>{e.allDay?'Todo el día':eventTime(e,date,d)}</span><div className='flex'><strong>{e.title}</strong><small>{e.kind==='review'?'Revisión de meta':e.kind==='occasion'?'Evento':'Fecha importante'}{e.endDate&&e.kind==='occasion'?' · Hasta '+e.endDate:e.allDay?' · Día completo':' · '+this.dur(durationOn(e,date,d))}</small>{e.note&&<p>{e.note}</p>}</div><button className='icon-btn' onClick={()=>this.openEvent(e)} title='Editar'><Icon name='edit' size={16}/></button></div>):<div className='empty'><strong>Sin fechas especiales</strong><p>Las tareas diarias se mantienen en Horario. Aquí aparecerán viajes, citas, fechas importantes y revisiones.</p></div>}</div><div className='calendar-routine-summary'><strong><Icon name='checklist' size={16}/> Rutinas de este día</strong><span>{routines.length?`${routines.length} programada${routines.length===1?'':'s'}`:'Sin rutinas recurrentes'}</span><div className='calendar-routine-chips'>{routines.map(e=><span key={e.id} className='calendar-routine-chip'><i style={{background:d.goals.find(g=>g.id===e.goalId)?.color||areaInfo('other').color}}/>{e.title}</span>)}</div></div></>;
  }
  renderCalendar():any{
    const date=this.state.selectedDate,d=this.state.data;
    return <>{this.renderHeading('Calendario','Fechas importantes, compromisos y revisiones. Las rutinas se muestran como puntos de referencia.',<Btn onClick={()=>this.openEvent(undefined,'occasion')}><Icon name='plus'/> Nuevo evento</Btn>)}
      <div className='calendar-shortcut'><span><Icon name='spark'/> Las fechas también cuentan tu historia</span><span className='calendar-shortcut-note'>Tus rutinas aparecen como puntos de color; en el calendario destacamos los acontecimientos importantes.</span></div>
      <div className='calendar-layout calendar-layout-full'><section className='panel calendar-main-panel'><div className='calendar-toolbar'><div className='month-name'>{fmtMonth(this.state.month)}</div><div className='calendar-nav'><button className='calendar-agenda-button' onClick={()=>this.setState({calendarDetailOpen:!this.state.calendarDetailOpen})}>{this.state.calendarDetailOpen?'Ocultar detalle':'Ver día seleccionado'}</button><button className='icon-btn' onClick={()=>this.changeMonth(-1)} title='Mes anterior'><Icon name='left'/></button><button className='icon-btn' onClick={()=>this.chooseDay(today())} title='Volver a hoy'><Icon name='sun'/></button><button className='icon-btn' onClick={()=>this.changeMonth(1)} title='Mes siguiente'><Icon name='right'/></button></div></div>
        <div className='weekday-grid'>{weekdays.map((w,i)=><div className='weekday' key={i}>{w}</div>)}</div>
        <div className='month-grid'>{this.monthDays().map(c=>{const all=eventsOn(d,c.day),important=all.filter(e=>this.isCalendarImportant(e)),repeated=all.filter(e=>!!e.routineId&&e.repeat!=='none');return <button key={c.day} className={`day-cell ${c.inside?'':'outside'} ${c.day===date?'selected':''} ${c.day===today()?'today':''}`} onClick={()=>this.chooseDay(c.day)} aria-label={fmtDate(c.day)+', '+important.length+' fechas importantes, '+repeated.length+' rutinas'}><div className='day-number'>{parseDay(c.day).getDate()}</div>{important.slice(0,2).map(e=><span key={e.id} className='calendar-important-label' style={{'--event-color':goalColor(d,e.goalId)||'#a26cf4'} as any} title={e.title}>{e.kind==='review'?'✦ ':e.kind==='occasion'?'◆ ':''}{e.title}</span>)}{important.length>2&&<small className='calendar-more'>+{important.length-2} más</small>}{repeated.length>0&&<div className='day-dots' aria-label='Rutinas recurrentes'>{repeated.slice(0,5).map(e=><span key={e.id} className='day-dot' style={{background:d.goals.find(g=>g.id===e.goalId)?.color||areaInfo('other').color}}/>)}</div>}</button>})}</div></section>
        {this.state.calendarDetailOpen&&<><div className='calendar-inspector-shade' onClick={()=>this.setState({calendarDetailOpen:false})}></div><section className='panel calendar-inspector' role='dialog' aria-label='Eventos de la fecha seleccionada'><button type='button' className='calendar-inspector-close icon-btn' aria-label='Cerrar detalle' onClick={()=>this.setState({calendarDetailOpen:false})}><Icon name='close' size={18}/></button><div className='panel-head'><div><div className='eyebrow' style={{marginBottom:5}}>FECHAS IMPORTANTES</div><h2 className='selected-date'>{fmtDate(date)}</h2></div><Btn tiny kind='secondary' onClick={()=>this.openEvent(undefined,'occasion')}><Icon name='plus' size={15}/></Btn></div>{this.renderCalendarAgenda(date)}</section></>}</div>
    </>;
  }
  renderProgress():any{
    const d=this.state.data;const start=addDays(today(),-6);const days=Array.from({length:7},(_,i)=>addDays(start,i));
    let weekPlanned=0,weekDone=0;for(const day of days){for(const e of eventsOn(d,day).filter(e=>!e.allDay)){weekPlanned++;if(done(d,e,day))weekDone++;}}
    return <>{this.renderHeading('Mi progreso','Comprende la diferencia entre tu constancia diaria y los resultados que estás consiguiendo.')}
      <div className="cards progress-stats">{this.renderStat('Últimos 7 días',weekPlanned,'Actividades programadas','calendar')}{this.renderStat('Completadas',weekDone,'Registros de ejecución','checklist')}{this.renderStat('Cumplimiento',weekPlanned?Math.round(weekDone/weekPlanned*100)+'%':'—','Últimos 7 días','chart')}{this.renderStat('Metas con medida',d.goals.filter(g=>g.target>0).length,'Objetivos cuantificados','target')}</div>
      
      <div className="two-col"><section className="panel"><div className="panel-head"><div><h2>Actividad de la semana</h2><p className="panel-sub">Porcentaje diario de actividades completadas</p></div></div><div className="week-chart">{days.map(day=>{const a=eventsOn(d,day).filter(e=>!e.allDay),c=a.filter(e=>done(d,e,day)).length,p=a.length?Math.round(c/a.length*100):0;return <div key={day} className="bar-wrap"><div className="bar-value">{a.length?p+'%':'—'}</div><div className="bar" style={{height:(5+p*.85)+'%',background:day===today()?'#407d5d':'#b7d0b4'}} title={`${c}/${a.length}`}/><div className="bar-label">{longDays[parseDay(day).getDay()].slice(0,3)}</div></div>})}</div></section>
        <section className="panel"><div className="panel-head"><div><h2>Resultados medibles</h2><p className="panel-sub">Actualizados manualmente con su historial</p></div></div>{d.goals.filter(g=>g.target>0).length?d.goals.filter(g=>g.target>0).map(g=><div key={g.id} className="goal-summary"><div className="goal-summary-top"><strong>{g.title}</strong><span>{g.current}/{g.target} {g.unit}</span></div><div className="progress-track"><div className="progress-fill" style={{width:percent(g.current,g.target)+'%',background:g.color}}/></div><div className="actions" style={{marginTop:9}}><Btn kind="ghost" tiny onClick={()=>this.openProgress(g)}>Actualizar resultado</Btn></div></div>):<div className="empty"><strong>No hay indicadores configurados</strong><p>Asigna una cantidad objetivo a una meta para verla aquí.</p></div>}</section></div>
      <div className="section-head"><h2 className="section-title">Metas cualitativas y por hitos</h2>{this.hint('metas')}</div><section className="panel"><div className="qual-list">{d.goals.filter(g=>goalMode(g)!=='numeric').map(g=><div key={g.id} className="qual-row"><span className="goal-color" style={{background:g.color}}/><div className="flex"><strong>{g.title}</strong><div className="caption">{goalMode(g)==='qualitative'?statusLabel(goalStatus(g)):goalMilestones(g).filter(m=>m.done).length+' de '+goalMilestones(g).length+' hitos'}</div></div>{goalMode(g)==='qualitative'&&<Btn tiny kind="secondary" onClick={()=>this.openProgress(g)}>Actualizar</Btn>}</div>)}{!d.goals.some(g=>goalMode(g)!=='numeric')&&<div className="caption">Aún no hay metas de este tipo.</div>}</div></section><div className='section-head'><h2 className='section-title'>Mi diario y recuerdos</h2><span className='caption'>Tus revisiones de cierre y fotografías forman un historial.</span></div><section className='panel journal-archive'>{Object.entries(d.dayReviews||{}).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,10).map(([date,review])=><div key={date} className='journal-entry'><button type='button' onClick={()=>this.setState({page:'horario',selectedDate:date,month:firstMonth(date)})}><strong>{fmtDate(date)}</strong><Icon name='right' size={15}/></button><p>{review.note||'Día revisado sin observaciones escritas.'}</p><small>{eventsOn(d,date).filter(e=>done(d,e,date)).length} actividades completadas</small></div>)}{!Object.keys(d.dayReviews||{}).length&&<p className='caption'>Tus reflexiones aparecerán aquí cuando guardes la revisión desde «Mi día».</p>}<div className='journal-photos'>{Object.entries(d.logs).flatMap(([k,log])=>(log.evidences||[]).map(pic=>({pic,key:k}))).sort((a,b)=>b.pic.createdAt.localeCompare(a.pic.createdAt)).slice(0,18).map(({pic,key})=><figure key={pic.id} className='journal-photo'><img src={pic.src} alt={'Recuerdo del '+key.split('@')[1]}/><figcaption>{key.split('@')[1]}</figcaption></figure>)}</div></section>
      <div className="section-head"><h2 className="section-title">Últimos registros de resultados</h2></div><section className="panel">{d.goals.flatMap(g=>g.history.map(h=>({...h,goal:g.title,unit:g.unit}))).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,12).map((h,i)=><div className="agenda-item" key={i}><div className="agenda-time">{h.date.slice(5)}</div><div className="agenda-main"><div className="agenda-name">{h.goal} · {h.status?statusLabel(h.status):h.value+' '+h.unit}</div>{h.note&&<div className="agenda-sub">{h.note}</div>}</div></div>)}{!d.goals.some(g=>g.history.length>0)&&<div className="empty"><strong>Aún no hay resultados registrados</strong><p>Desde una meta, pulsa «Registrar avance» para iniciar tu historial.</p></div>}</section>
    </>;
  }
  renderSettings():any{return <>{this.renderHeading('Apariencia, ayuda y ajustes','Todo permanece bajo tu control. Realiza copias de seguridad para conservar tus datos incluso si cambias de dispositivo o navegador.')}
    <div className="settings-box"><div className="row spread"><h2>Paletas de colores</h2>{this.hint('ajustes')}</div><p>Elige la atmósfera que más te guste. La paleta «Aurora» es la predeterminada.</p><div className="theme-grid">{themeOptions.map(t=><button key={t.id} className={'theme-tile '+(this.state.theme===t.id?'chosen':'')} onClick={()=>this.setTheme(t.id)}><div className="theme-bubbles">{t.colors.map((c,i)=><span key={i} style={{background:c}}/>)}</div><strong>{t.name}</strong><span>{t.hint}</span>{this.state.theme===t.id&&<i>✓</i>}</button>)}</div></div>
    <div className='settings-box'><h2>Formato de duración</h2><p>Elige cómo mostrar los tiempos en rutinas, horario y pasos. El formato predeterminado es horas y minutos.</p><div className='time-anchor-choice'><button className={this.state.durationDisplay==='hours'?'active':''} onClick={()=>this.changeDurationDisplay('hours')}>Horas y minutos · 1 h 32 min</button><button className={this.state.durationDisplay==='minutes'?'active':''} onClick={()=>this.changeDurationDisplay('minutes')}>Solo minutos · 92 min</button></div></div>
    <div className='settings-box sleep-settings'><h2><Icon name='moon'/> Tiempo de sueño</h2><p>Reserva visualmente de 7 a 9 horas de sueño, todos los días a la misma hora. Este espacio no impide añadir actividades.</p><div className='field-grid'><div className='field'><label>Hora habitual de acostarme</label><TimePicker value={this.state.sleepStart} onChange={start=>this.setSleep(start,this.state.sleepHours)}/></div><div className='field'><label>Duración del sueño (de 7 a 9 horas)</label><FriendlySelect value={String(this.state.sleepHours)} ariaLabel='Duración del sueño' onChange={v=>this.setSleep(this.state.sleepStart,Number(v))} options={[7,7.5,8,8.5,9].map(x=>({value:String(x),label:durationText(x*60)}))}/></div></div><p className='caption'>Tu horario seguirá permitiendo rutinas o eventos durante este período.</p></div>
    <div className='settings-box'><h2><Icon name='checklist'/> Sonido al completar</h2><p>Una señal breve y discreta al marcar pasos o actividades. Puedes silenciarla cuando quieras.</p><div className='time-anchor-choice'><button className={this.state.soundsOn?'active':''} onClick={()=>this.setSounds(true)}>Sonido activado</button><button className={!this.state.soundsOn?'active':''} onClick={()=>this.setSounds(false)}>Silencio</button></div></div>
    <div className='settings-box'><h2>Guía interactiva</h2><p>Vuelve a recorrer los pasos para conocer el funcionamiento de Fullhouse.</p><Btn kind="secondary" onClick={this.openGuide}><Icon name="help"/> Iniciar la guía</Btn></div>
    <div className="settings-box"><h2>Disposición de las ventanas</h2><p>Puedes cambiar entre modo vertical y horizontal desde la parte superior de cualquier ventana emergente.</p><div className="row"><Btn kind={this.state.modalLayout==='vertical'?'':'secondary'} onClick={()=>this.setLayout('vertical')}><Icon name="vertical"/> Vertical</Btn><Btn kind={this.state.modalLayout==='horizontal'?'':'secondary'} onClick={()=>this.setLayout('horizontal')}><Icon name="horizontal"/> Horizontal</Btn></div></div>
    <div className="settings-box"><h2>Exportar mis datos</h2><p>Descarga un archivo JSON con todas tus metas, rutinas, actividades, fechas, pasos completados y registros. Guárdalo en un lugar seguro.</p><Btn onClick={this.exportData}><Icon name="download" size={16}/> Descargar respaldo</Btn></div>
    <div className="settings-box"><h2>Restaurar un respaldo</h2><p>Importa un archivo JSON exportado anteriormente. <strong>Esto reemplazará los datos actuales</strong> de este navegador. Te pediremos confirmación.</p><label className="btn secondary" style={{display:'inline-flex',cursor:'pointer',marginBottom:0}}><Icon name="upload" size={16}/> Elegir archivo JSON<input className="hide" type="file" accept=".json,application/json" onChange={this.importData}/></label></div>
    <div className="settings-box"><h2>Restablecer datos de ejemplo</h2><p>Vuelve al contenido inicial para hacer nuevas pruebas. Primero descarga un respaldo si hay algo que quieras conservar.</p><Btn kind="danger" onClick={this.reset}><Icon name="trash" size={15}/> Restablecer ejemplos</Btn></div>
    <div className="notice"><strong>Importante:</strong> los datos se almacenan con localStorage, solo en este navegador y perfil. Si limpias los datos del sitio, usas modo privado o cambias de dispositivo, podrías perderlos. Este prototipo no cifra la información ni hace respaldos automáticos. Para datos importantes o privados, usa una copia de seguridad y una futura versión con almacenamiento más robusto.</div>
    </>}
  renderModal():any{
    const modal=this.state.modal;if(!modal)return null;
    let title='';if(modal==='goal')title=(this.state.goalDraft.id?'Editar ':'Crear ')+(this.state.goalDraft.parentId?'submeta':'meta');if(modal==='routine')title=this.state.routineDraft.id?'Editar rutina':'Nueva rutina';if(modal==='event')title=this.state.eventDraft.routineId?(this.state.eventDraft.id?'Reprogramar rutina':'Programar rutina'):this.state.eventDraft.kind==='occasion'?(this.state.eventDraft.id?'Editar evento':'Crear evento'):(this.state.eventDraft.id?'Editar actividad':'Programar actividad');if(modal==='execute')title='Ejecutar procedimiento';if(modal==='progress')title='Registrar avance';if(modal==='detail')title='Dentro de mi horario';if(modal==='help')title='¿Cómo funciona?';
    return <div className='modal-backdrop' onPointerDown={ev=>{this.backdropDown=ev.target===ev.currentTarget}} onPointerCancel={()=>{this.backdropDown=false}} onClick={ev=>{if(this.backdropDown&&ev.target===ev.currentTarget)this.close();this.backdropDown=false;}}><div className={'modal '+(this.state.modalLayout==='horizontal'?'wide':'vertical')} role="dialog" aria-modal="true" aria-label={title}><div className="modal-header"><div><div className="eyebrow">FULLHOUSE · DETALLES</div><h2 className="modal-title">{title}</h2></div><div className="modal-header-actions">{['goal','routine','event'].includes(modal)&&<button type='button' className={'advanced-toggle '+(this.state.advancedOpen?'active':'')} onClick={this.toggleAdvanced} title='Mostrar u ocultar opciones avanzadas'>{this.state.advancedOpen?'− Avanzado':'+ Avanzado'}</button>}<button className='icon-btn' title='Ayuda sobre esta ventana' aria-label='Ayuda sobre esta ventana' onClick={()=>this.openHelp(modal==='goal'?'metas':modal==='routine'?'rutinas':modal==='event'?'calendario':'horario')}><Icon name='help' size={18}/></button><div className="layout-switch"><button className={this.state.modalLayout==='vertical'?'active':''} title="Ventana vertical" aria-label="Vista vertical" onClick={()=>this.setLayout('vertical')}><Icon name="vertical" size={16}/></button><button className={this.state.modalLayout==='horizontal'?'active':''} title="Ventana horizontal" aria-label="Vista horizontal" onClick={()=>this.setLayout('horizontal')}><Icon name="horizontal" size={16}/></button></div><button className="icon-btn" onClick={this.close} aria-label="Cerrar"><Icon name="close"/></button></div></div>
      <div className="modal-body" tabIndex={-1}>{modal==='goal'?this.goalForm():modal==='routine'?this.routineForm():modal==='event'?this.eventForm():modal==='progress'?this.progressForm():modal==='detail'?this.renderDetail():modal==='help'?this.helpBody():this.executeForm()}</div>
      <div className="modal-footer"><Btn kind="secondary" onClick={this.close}>Cerrar</Btn>{modal==='goal'&&<Btn onClick={this.saveGoal}>Guardar meta</Btn>}{modal==='routine'&&<Btn onClick={this.saveRoutine} disabled={!!this.routineIssue(this.state.routineDraft)}>Guardar rutina</Btn>}{modal==='event'&&<Btn onClick={this.saveEvent}>{this.state.eventDraft.routineId?'Guardar programación':this.state.eventDraft.kind==='occasion'?'Guardar evento':'Guardar actividad'}</Btn>}{modal==='progress'&&<Btn onClick={this.saveProgress}>Registrar avance</Btn>}</div>
    </div></div>;
  }
  goalForm():any{
    const x=this.state.goalDraft,notAllowed=x.id?[x.id,...this.descendants(x.id)]:[],mode=goalMode(x);
    return <><div className="field"><label>Nombre de la meta *</label><input maxLength={90} value={x.title} onChange={e=>this.updateGoalDraft({title:e.target.value})} placeholder="Ej. Mejorar mi relación con mi familia"/></div>
      <div className="field"><label>Descripción o propósito {this.hint('metas')}</label><AutoTextarea maxLength={1500} value={x.desc} onChange={(e:any)=>this.updateGoalDraft({desc:e.target.value})} placeholder="¿Qué quiero conseguir? ¿Por qué me importa?"/></div>
      <div className='field'><label>¿A qué ámbito de tu vida pertenece? {this.hint('metas')}</label><div className='area-options'>{lifeAreas.map(a=><button type='button' key={a.id} className={'area-option '+(x.area===a.id?'active':'')} onClick={()=>this.updateGoalDraft({area:a.id})} style={{'--area-color':a.color} as any}><span className='area-option-dot'/><strong>{a.title}</strong><small>{a.detail}</small></button>)}</div></div>
      <div className="field"><label>Meta superior (opcional)</label>{this.goalPicker(x.parentId,value=>!notAllowed.includes(value)&&this.updateGoalDraft({parentId:value}),'Ninguna · Meta principal')}</div>
      <div className="field-grid"><div className="field"><label>Fecha de inicio (opcional)</label><input type="date" value={x.startDate||''} onChange={e=>this.updateGoalDraft({startDate:e.target.value})}/></div><div className="field"><label>Fecha objetivo (opcional)</label><input type="date" value={x.dueDate||''} onChange={e=>this.updateGoalDraft({dueDate:e.target.value})}/></div></div>
      <div className='field goal-review'><div className='row spread'><label>Fecha de revisión de avances {this.hint('calendario')}</label><span className='caption'>Se mostrará en el calendario</span></div><div className='field-grid'><div className='field'><label>Primera revisión</label><input type='date' value={x.review?.date||''} onChange={e=>this.updateGoalDraft({review:e.target.value?{date:e.target.value,time:x.review?.time||'18:00',repeat:x.review?.repeat||'none'}:undefined})}/></div><div className='field'><label>Repetir revisión</label><FriendlySelect value={x.review?.repeat||'none'} ariaLabel='Periodicidad de revisión' onChange={repeat=>this.updateGoalDraft({review:x.review?{...x.review,repeat:repeat as 'none'|'weekly'|'monthly'}:undefined})} options={[{value:'none',label:'Una sola vez'},{value:'weekly',label:'Cada semana'},{value:'monthly',label:'Cada mes'}]}/></div></div>{x.review?.date&&<div className='field' style={{marginTop:10,maxWidth:250}}><label>Hora de revisión</label><TimePicker value={x.review.time||'18:00'} onChange={time=>this.updateGoalDraft({review:{...x.review!,time}})}/></div>}<p className='caption'>Una revisión sirve para evaluar resultados y replantear acciones; no se cuenta como rutina diaria.</p></div>
      {this.state.advancedOpen&&<div className='field'><label>Depende de otra meta (opcional)</label><FriendlySelect ariaLabel="Meta previa necesaria" value={x.dependsOn||''} onChange={dependsOn=>this.updateGoalDraft({dependsOn})} options={[{value:'',label:'Ninguna · Puede avanzar de forma independiente'},...this.state.data.goals.filter(g=>!notAllowed.includes(g.id)).map(g=>({value:g.id,label:'Después de: '+g.title}))]}/><p className="caption">Esta conexión se dibuja con una línea discontinua en el mapa de metas.</p></div>}
      <div className="field"><label>¿Cómo quieres medir el avance? {this.hint('metas')}</label><div className="goal-mode-grid">{([{id:'numeric',label:'Numérica',icon:'chart',desc:'Cantidades y objetivos'},{id:'qualitative',label:'Cualitativa',icon:'spark',desc:'Estados y reflexiones'},{id:'milestones',label:'Por hitos',icon:'checklist',desc:'Logros verificables'}] as {id:GoalMode;label:string;icon:string;desc:string}[]).map(m=><button key={m.id} className={'goal-mode '+(mode===m.id?'active':'')} onClick={()=>this.updateGoalDraft({mode:m.id})}><Icon name={m.icon}/><strong>{m.label}</strong><small>{m.desc}</small></button>)}</div></div>
      {mode==='numeric'&&<><div className="field-grid"><div className="field"><label>Resultado actual</label><NumberField value={x.current} min={0} onCommit={current=>this.updateGoalDraft({current})}/></div><div className="field"><label>Resultado objetivo</label><NumberField value={x.target} min={0} onCommit={target=>this.updateGoalDraft({target})}/></div></div><div className="field"><label>Unidad de medida</label><input maxLength={40} placeholder="Ej. km, sesiones, capítulos, kg" value={x.unit} onChange={e=>this.updateGoalDraft({unit:e.target.value})}/></div></>}
      {mode==='qualitative'&&<div className="field"><label>Estado actual de tu meta</label><FriendlySelect value={goalStatus(x)} ariaLabel="Estado de meta" onChange={value=>this.updateGoalDraft({status:value as GoalStatus})} options={goalStatuses.map(s=>({value:s.id,label:s.label+' · '+s.desc}))}/><p className="caption">Este tipo no necesita números. Podrás guardar reflexiones y cambios en tu progreso.</p></div>}
      {mode==='milestones'&&<div className="field"><div className="row spread"><label>Hitos o logros parciales</label><span className="caption">{goalMilestones(x).length} definidos</span></div>{goalMilestones(x).map(m=><div className="milestone-editor" key={m.id}><input value={m.title} onChange={e=>this.updateGoalDraft({milestones:goalMilestones(x).map(k=>k.id===m.id?{...k,title:e.target.value}:k)})} placeholder="Describe un logro concreto"/><button className="icon-btn" aria-label="Quitar hito" onClick={()=>this.updateGoalDraft({milestones:goalMilestones(x).filter(k=>k.id!==m.id)})}><Icon name="trash" size={16}/></button></div>)}<Btn tiny kind="secondary" onClick={()=>this.updateGoalDraft({milestones:[...goalMilestones(x),{id:uid(),title:'',done:false}]})}><Icon name="plus" size={14}/> Agregar hito</Btn><p className="caption">Después podrás marcar cada hito como logrado desde la tarjeta de la meta.</p></div>}
      <div className="field"><label>Color de identificación</label><div className="color-picker">{colorOptions.map(c=><button type="button" key={c} className={'color-dot '+(x.color===c?'active':'')} onClick={()=>{this.updateGoalDraft({color:c});this.setState({hexDraft:c});}} aria-label={'Color '+c} title={c} style={{background:c}}/>)}<button type="button" className={'custom-color '+(this.state.colorEditorOpen?'active':'')} onClick={()=>this.setState({colorEditorOpen:!this.state.colorEditorOpen})}><Icon name="palette" size={18}/> Personalizar</button></div>{this.state.colorEditorOpen&&<div className="custom-color-editor"><div className="custom-color-preview"><span style={{background:x.color}}/><div><strong>Crea tu propio tono</strong><small>{x.color.toUpperCase()}</small></div></div>{(['Tono','Saturación','Luminosidad'] as string[]).map((label,i)=>{const hsl=hexToHsl(x.color);return <div key={label} className="color-slider-row"><label>{label}</label><input type="range" min={0} max={i===0?359:100} value={hsl[i]} className={i===0?'hue-range':'color-range'} onChange={e=>{const values: [number,number,number]=[...hsl] as [number,number,number];values[i]=Number(e.target.value);this.updateGoalDraft({color:hslToHex(values[0],values[1],values[2])});this.setState({hexDraft:hslToHex(values[0],values[1],values[2])});}}/></div>})}<div className="custom-color-actions"><label>Hexadecimal <input value={this.state.hexDraft} maxLength={7} onChange={e=>{const v=e.target.value;this.setState({hexDraft:v});if(/^#[a-fA-F0-9]{6}$/.test(v))this.updateGoalDraft({color:v})}} onBlur={()=>this.setState({hexDraft:this.state.goalDraft.color})} aria-label="Color hexadecimal"/></label><Btn tiny kind="secondary" onClick={()=>this.setState({colorEditorOpen:false})}>Listo</Btn></div></div>}</div>
    </>;
  }
  weekdayPicker=(days:number[],select:(day:number)=>void):any=><div className='weekday-options'>{weekdayNames.map((day,n)=><button type='button' key={n} className={'weekday-pill '+(days.includes(n)?'active':'')} aria-pressed={days.includes(n)} title={longDays[n]} onClick={()=>select(n)}>{day}</button>)}</div>;
  renderStepEditor=(steps:Step[],level=0):any=>{
    const update=(id:string,patch:Partial<Step>)=>this.updateRoutineDraft({steps:editStepTree(this.state.routineDraft.steps,id,s=>({...s,...patch}))});
    return <div className={'step-editor-list '+(level?'nested':'')}>{steps.map((s,i)=>{
      const hasChildren=!!s.children?.length;
      const mode=s.mode||((s.variants||[]).length?'alternatives':'always');
      const baseDays=s.days||DAYS.filter(d=>!(s.variants||[]).some(v=>v.days.includes(d)));
      const tint=goalColor(this.state.data,s.goalId);
      return <div className={'step-editor-card '+(this.state.dragTargetId===s.id&&this.state.draggedStepId!==s.id?'drop-target':'')} style={tint?{'--linked-goal-color':tint} as any:{}} data-step-id={s.id} key={s.id}>
      <div className='step-edit-head'><span className='step-type-tag'>{mode==='alternatives'?'Alternativa 1':stepLevelName(level)+' '+(i+1)}</span><span className='step-duration-summary'><Icon name='clock' size={14}/> {s.flexible?'Tiempo variable':this.dur(stepMinutes(s))} {hasChildren?'· calculados':''}</span><button className='drag-handle' title='Arrastra para reordenar' aria-label={'Arrastrar '+stepLevelName(level)+' '+(i+1)} onMouseDown={e=>this.startStepDrag(s.id,e)} onTouchStart={e=>this.startStepDrag(s.id,e)} onKeyDown={e=>{if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();this.moveStepDragKeyboard(s.id,e.key==='ArrowUp'?-1:1);}}}><Icon name='grip' size={18}/></button><button className='icon-btn remove-step' title='Eliminar este elemento' onClick={()=>this.updateRoutineDraft({steps:deleteStepTree(this.state.routineDraft.steps,s.id)})}><Icon name='trash' size={15}/></button></div>
      <div className='step-mode-choices'>
        <button className={mode==='always'?'active':''} onClick={()=>update(s.id,{mode:'always'})}><strong>Siempre</strong><small>Se hace cada vez</small></button>
        <button className={mode==='selected'?'active':''} onClick={()=>update(s.id,{mode:'selected',days:s.days||[1,3,5]})}><strong>Solo ciertos días</strong><small>Aparece cuando corresponde</small></button>
        <button className={mode==='alternatives'?'active':''} onClick={()=>update(s.id,{mode:'alternatives',days:s.days||DAYS.filter(n=>!(s.variants||[]).some(v=>v.days.includes(n))),variants:s.flexible?(s.variants||[]).map(v=>({...v,flexible:!v.children?.length||v.flexible})):s.variants})}><strong>Alternativas</strong><small>Según el día o al ejecutar</small></button>
      </div>
      {mode==='selected'&&<div className='step-conditional'><label>Días en los que se realiza</label>{this.weekdayPicker(s.days||[],day=>this.updateStepDays(s.id,undefined,day))}</div>}
      {mode==='alternatives'&&<div className='step-conditional'><div className='alternative-frequency'><strong>¿Cómo se elige la alternativa?</strong><div className='time-anchor-choice'><button type='button' className={s.chooseWhen!=='execute'?'active':''} onClick={()=>update(s.id,{chooseWhen:'weekday'})}>Por día de semana</button><button type='button' className={s.chooseWhen==='execute'?'active':''} onClick={()=>update(s.id,{chooseWhen:'execute'})}>Al ejecutar la rutina</button></div></div>{s.chooseWhen!=='execute'&&<><div className='step-base-label'><strong>Alternativa 1 · {s.title||'sin nombre'}</strong><small>Es una opción más, con el mismo valor que las demás.</small></div>{this.weekdayPicker(baseDays,day=>this.updateStepDays(s.id,undefined,day))}</>}</div>}
      <div className='step-edit-fields'><input aria-label={'Nombre de '+stepLevelName(level).toLowerCase()+' '+(i+1)} value={s.title} onChange={e=>update(s.id,{title:e.target.value})} placeholder={mode==='alternatives'?'Nombre de la alternativa 1':level===0?'Nombre del paso':'Nombre del '+stepLevelName(level).toLowerCase()}/>{hasChildren?<span className='step-readonly-time' title='La duración se calcula sumando los elementos hijos'>Σ {this.dur(stepMinutes(s))}</span>:s.flexible?<span className='step-readonly-time'>↔ Reparto variable</span>:<label className='step-time-field'>min <NumberField value={s.min} min={1} max={1440} ariaLabel='Duración en minutos' onCommit={min=>update(s.id,{min})}/></label>}</div>
      {(!hasChildren||mode==='alternatives')&&<label className='step-flex-toggle'><input type='checkbox' checked={!!s.flexible} onChange={e=>update(s.id,{flexible:e.target.checked,min:e.target.checked?30:Math.max(5,s.min),variants:mode==='alternatives'?(s.variants||[]).map(v=>({...v,flexible:e.target.checked&&!v.children?.length?true:v.flexible})):s.variants})}/><span><strong>Tiempo flexible</strong><small>Este paso ocupa el tiempo libre del bloque (ideal para tareas de duración variable entre dos rutinas).</small></span></label>}
      {s.flexible&&!hasChildren&&<div className='flex-weight-line'><span><strong>Parte del tiempo disponible</strong><small>Arrastra la escala para distribuir el tiempo disponible.</small></span><div className='flex-slider'><input type='range' min={1} max={100} step={1} aria-label='Proporción de tiempo flexible' value={s.flexWeight||1} onChange={ev=>update(s.id,{flexWeight:Number(ev.target.value)})}/><strong>{(()=>{const active=activeSteps(this.state.routineDraft.steps,this.state.selectedDate),leaves=leafSteps(active).filter(x=>x.flexible),w=Math.max(1,s.flexWeight||1),total=leaves.reduce((a,x)=>a+Math.max(1,x.flexWeight||1),0);return `${Math.round(w/Math.max(w,total)*100)}% · ${this.dur(leafAllocation(active,routineMinutes(this.state.routineDraft))[s.id]||0)}`;})()}</strong></div></div>}
      <details className={'step-advanced '+(s.goalId?'has-goal':'')}><summary><Icon name='target' size={15}/> {s.goalId?'Meta vinculada: '+(this.state.data.goals.find(g=>g.id===s.goalId)?.title||'Meta'):'Relaciones y evidencias (opcional)'}</summary><label className='evidence-preference'><input type='checkbox' checked={!!s.requestEvidence} onChange={ev=>update(s.id,{requestEvidence:ev.target.checked})}/> Sugerir evidencia al realizar este paso</label><div className='field'><label>Este elemento contribuye a</label>{this.goalPicker(s.goalId||'',goalId=>update(s.id,{goalId}))}</div></details><details className='legacy-hidden'><summary><Icon name='target' size={15}/> {s.goalId?'Meta vinculada: '+(this.state.data.goals.find(g=>g.id===s.goalId)?.title||'Meta'):'Vincular a una meta (opcional)'}</summary><div className='field'><label>Este elemento contribuye a</label><FriendlySelect value={s.goalId||''} ariaLabel='Vincular paso a meta' onChange={goalId=>update(s.id,{goalId})} options={[{value:'',label:'Sin meta vinculada'},...this.state.data.goals.map(g=>({value:g.id,label:g.title}))]}/><p className='caption'>El paso tomará el color de esta meta tanto aquí como al ejecutarlo.</p></div></details>
      <div className='step-description'><AutoTextarea maxLength={1000} value={s.desc||''} onChange={(e:any)=>update(s.id,{desc:e.target.value})} placeholder='Instrucciones de este paso u opción...'/></div>
      {hasChildren&&this.renderStepEditor(s.children||[],level+1)}
      <div className='step-subaction'><Btn tiny kind='secondary' onClick={()=>update(s.id,{children:[...(s.children||[]),{id:uid(),title:'',min:5,desc:''}]})}><Icon name='plus' size={14}/> Añadir {nextStepLevelName(level)} a esta opción</Btn></div>
      {mode==='alternatives'&&<div className='step-variants'><div className='step-variants-title'>Más alternativas <span>Todas tienen la misma importancia. Cada ocasión puede usar solo una.</span></div>{(s.variants||[]).map((v,vi)=><div className='step-variant' key={v.id} style={goalColor(this.state.data,v.goalId)?{'--linked-goal-color':goalColor(this.state.data,v.goalId)} as any:{}}>
        <div className='row spread'><strong>Alternativa {vi+2} · {v.title||'sin nombre'}</strong><button type='button' className='icon-btn' title='Eliminar opción' aria-label='Eliminar opción' onClick={()=>update(s.id,{variants:(s.variants||[]).filter(a=>a.id!==v.id)})}><Icon name='trash' size={15}/></button></div>
        <div className='field-grid'><div className='field'><label>Nombre de la opción</label><input value={v.title} placeholder='Ej. Preparar equipaje, estudiar, descansar' onChange={e=>update(s.id,{variants:(s.variants||[]).map(a=>a.id===v.id?{...a,title:e.target.value}:a)})}/></div><div className='field'><label>Tiempo estimado</label>{v.children?.length?<div className='variant-duration'>Σ {this.dur(v.children.reduce((sum,c)=>sum+stepMinutes(c),0))} de sus detalles</div>:v.flexible?<div className='calculated-duration'>Tiempo flexible</div>:<NumberField value={v.min} min={1} max={1440} ariaLabel={'Minutos de opción '+(vi+2)} onCommit={min=>update(s.id,{variants:(s.variants||[]).map(a=>a.id===v.id?{...a,min}:a)})}/>}</div></div>
        {!v.children?.length&&<label className='step-flex-toggle'><input type='checkbox' checked={!!v.flexible} onChange={ev=>{const flexible=ev.target.checked;update(s.id,{flexible,variants:(s.variants||[]).map(a=>({...a,flexible:a.children?.length?!!a.flexible:flexible,flexWeight:a.flexWeight||1}))});if(flexible&&(s.variants||[]).some(a=>a.children?.length))this.notice('Añade al menos un subpaso flexible en cada alternativa que contiene detalles.');}}/><span><strong>Esta alternativa puede usar tiempo flexible</strong><small>Participa en el reparto solo cuando sea la opción utilizada.</small></span></label>}
        <label className='evidence-preference'><input type='checkbox' checked={!!v.requestEvidence} onChange={ev=>update(s.id,{variants:(s.variants||[]).map(a=>a.id===v.id?{...a,requestEvidence:ev.target.checked}:a)})}/> Sugerir evidencia en esta alternativa (opcional)</label>{v.flexible&&!v.children?.length&&<div className='flex-weight-line'><span>Parte proporcional del tiempo libre</span><div className='flex-slider'><input type='range' min={1} max={100} step={1} aria-label='Porcentaje de la alternativa' value={v.flexWeight||1} onChange={ev=>update(s.id,{variants:(s.variants||[]).map(a=>a.id===v.id?{...a,flexWeight:Number(ev.target.value)}:a)})}/><strong>{(()=>{const current=activeSteps(this.state.routineDraft.steps,this.state.selectedDate),leaves=leafSteps(current),other=leaves.filter(x=>x.flexible&&x.id!==s.id),w=Math.max(1,v.flexWeight||1),total=w+other.reduce((a,x)=>a+Math.max(1,x.flexWeight||1),0),free=Math.max(0,routineMinutes(this.state.routineDraft)-fixedStepMinutes(current)),share=w/Math.max(1,total);return `${Math.round(share*100)} % · aprox. ${this.dur(Math.round(free*share))}`;})()}</strong><small>Estimación si eliges esta opción; al ejecutarla se recalcula.</small></div></div>}
        <details className={'step-advanced '+(v.goalId?'has-goal':'')}><summary><Icon name='target' size={15}/>{v.goalId?'Meta: '+(this.state.data.goals.find(g=>g.id===v.goalId)?.title||'Meta'):'Vincular alternativa a meta'}</summary><div className='field'><label>Meta de esta alternativa</label>{this.goalPicker(v.goalId||'',goalId=>update(s.id,{variants:(s.variants||[]).map(a=>a.id===v.id?{...a,goalId}:a)}),'Heredar color del paso')}</div></details>
        {s.chooseWhen!=='execute'&&<div className='field'><label>Días en los que se utiliza</label>{this.weekdayPicker(v.days,day=>this.updateStepDays(s.id,v.id,day))}</div>}
        <div className='field'><label>Instrucciones particulares</label><AutoTextarea value={v.desc||''} onChange={(e:any)=>update(s.id,{variants:(s.variants||[]).map(a=>a.id===v.id?{...a,desc:e.target.value}:a)})} placeholder='¿Cómo se realiza esta opción?'/></div>
        {!!v.children?.length&&<div className='variant-children'>{s.flexible&&<div className='manual-warning'>Esta alternativa contiene subpasos. Marca al menos uno de ellos como flexible para que pueda repartirse el tiempo.</div>}{this.renderStepEditor(v.children||[],level+1)}</div>}
        <Btn tiny kind='secondary' onClick={()=>update(s.id,{variants:(s.variants||[]).map(a=>a.id===v.id?{...a,children:[...(a.children||[]),{id:uid(),title:'',desc:'',min:5}]}:a)})}><Icon name='plus' size={14}/> Añadir {nextStepLevelName(level)} a esta opción</Btn>
        </div>)}
        <div className='step-alt-action'><Btn kind='ghost' tiny onClick={()=>update(s.id,{variants:[...(s.variants||[]),{id:uid(),title:'',desc:'',min:Math.max(1,s.min),days:[],flexible:!!s.flexible,flexWeight:1}]})}><Icon name='plus' size={14}/> Añadir otra opción</Btn></div>
      </div>}
      </div>;
    })}</div>;
  }
  routineForm():any{
    const r=this.state.routineDraft,mode=r.durationMode||'steps',active=activeSteps(r.steps,this.state.selectedDate),balance=routineBalance(r,this.state.selectedDate),issue=this.routineIssue(r);
    const allocations=leafAllocation(active,routineMinutes(r)),flexLeaves=leafSteps(active).filter(x=>x.flexible),free=Math.max(0,routineMinutes(r)-fixedStepMinutes(active));
    return <div className='routine-form-v07' style={{'--routine-accent':r.color||'#a26cf4'} as any}>
      {this.state.returnToSchedule&&<div className='routine-context-alert'><Icon name='clock' size={22}/><div><strong>Actualizando rutina para programarla entre bloques</strong><p>{this.state.scheduleContextNote}</p><small>Al guardar regresarás a la programación, con las horas ya actualizadas.</small></div></div>}
      <section className='routine-edit-section'><div className='editor-section-title'><span>01</span><div><h3>Identidad</h3><p>Nombre, icono y propósito de la rutina</p></div></div>
        <div className='field'><label>Nombre de la rutina *</label><input maxLength={90} value={r.title} onChange={ev=>this.updateRoutineDraft({title:ev.target.value})} placeholder='Ej. Trabajo concentrado'/></div>
        <div className='field'><label>Ícono de la rutina</label><div className='routine-icon-grid'>{routineIcons.map(ic=><button type='button' key={ic} title={ic} aria-label={'Ícono '+ic} aria-pressed={(r.icon||'checklist')===ic} className={'routine-icon-choice '+((r.icon||'checklist')===ic?'active':'')} onClick={()=>this.updateRoutineDraft({icon:ic})}><Icon name={ic} size={21}/></button>)}</div></div>
        <div className='field'><label>Color de la rutina</label><div className='routine-color-choices'>{colorOptions.map(color=><button key={color} type='button' className={(r.color||'#a26cf4')===color?'active':''} style={{background:color}} aria-label={'Usar color '+color} aria-pressed={(r.color||'#a26cf4')===color} onClick={()=>this.updateRoutineDraft({color})}>{(r.color||'#a26cf4')===color?'✓':''}</button>)}</div><p className='caption'>La rutina y sus pasos comparten este color, salvo cuando un elemento está vinculado a una meta.</p></div>
        <div className='field'><label className='evidence-preference'><input type='checkbox' checked={!!r.requestEvidence} onChange={e=>this.updateRoutineDraft({requestEvidence:e.target.checked})}/> Sugerir adjuntar evidencia al terminar la rutina (opcional)</label></div><div className='field'><label>Descripción {this.hint('rutinas')}</label><AutoTextarea maxLength={1500} value={r.desc} onChange={(ev:any)=>this.updateRoutineDraft({desc:ev.target.value})} placeholder='¿Qué se pretende conseguir con este procedimiento?'/></div>
      </section>
      <section className='routine-edit-section'><div className='editor-section-title'><span>02</span><div><h3>Cómo se calcula la duración</h3><p>Elige si estableces primero el tiempo o dejas que lo calculen los pasos</p></div></div>
        <div className='duration-mode-grid'><button className={mode==='steps'?'active':''} onClick={()=>this.updateRoutineDraft({durationMode:'steps'})}><Icon name='checklist' size={22}/><strong>Según mis pasos</strong><small>La duración es la suma de los elementos que se realizan cada día.</small></button><button className={mode==='fixed'?'active':''} onClick={()=>this.updateRoutineDraft({durationMode:'fixed',durationMin:r.durationMin||routineMinutes(r)})}><Icon name='clock' size={22}/><strong>Tiempo fijo</strong><small>Primero decido cuánto dura la rutina y reparto el tiempo entre sus pasos.</small></button></div>
        {mode==='fixed'&&<div className='duration-budget'><div className='field'><label>Tiempo total de la rutina (minutos)</label><NumberField value={r.durationMin||0} min={1} max={1440} onCommit={durationMin=>this.updateRoutineDraft({durationMin})}/></div><div className='duration-budget-numbers'><span>Pasos fijos: <strong>{this.dur(balance.fixed)}</strong></span><span>Disponible: <strong>{this.dur(r.durationMin||0)}</strong></span><span>Contenido flexible: <strong>{balance.flex}</strong></span></div><div className='duration-bar' aria-label='Uso del presupuesto de tiempo'><div style={{width:(r.durationMin?Math.min(100,balance.fixed/r.durationMin*100):100)+'%'}}/></div>{issue?<div className='routine-validation-error' role='alert'><Icon name='help' size={18}/><span>{issue} No se podrá guardar hasta resolverlo.</span></div>:<div className='routine-validation-ok'>✓ El reparto cabe en la duración que has elegido.</div>}</div>}
        {mode==='steps'&&<div className='notice'>Duración estimada: <strong>{this.dur(routineMinutes(r))}</strong>. Puedes utilizar pasos flexibles si programas esta rutina entre otras dos.</div>}
      </section>
      {mode==='fixed'&&<div className={'routine-budget-sticky '+(issue?'is-warning':'')} role='status'><div className='row spread'><strong>Tiempo asignado: {this.dur(balance.fixed)} / {this.dur(r.durationMin||0)}</strong><span>{issue?'⚠ Revisa el reparto':balance.flex?'↔ Sobrante para flexibles':'✓ Distribución correcta'}</span></div><div className='duration-bar'><span style={{display:'block',width:(r.durationMin?Math.min(100,balance.fixed/r.durationMin*100):100)+'%'}}/></div>{issue&&<small>{issue}</small>}</div>}
      <section className='routine-edit-section'><div className='editor-section-title'><span>03</span><div><h3>Pasos y alternativas</h3><p>Construye el procedimiento. Puedes anidar detalles, asignar metas y repartir minutos.</p></div></div>
        <div className='routine-steps-intro'><strong>{r.steps.length} pasos principales</strong><span>Arrastra los tiradores para ordenarlos. Las opciones avanzadas se despliegan solo cuando las necesitas.</span></div>
        {this.renderStepEditor(r.steps)}
        <div className='routine-add-step'><Btn kind='secondary' onClick={()=>this.updateRoutineDraft({steps:[...r.steps,{id:uid(),title:'',min:5,desc:''}]})}><Icon name='plus' size={15}/> Agregar paso</Btn></div>
      </section>
      <section className='routine-edit-section'><div className='editor-section-title'><span>04</span><div><h3>Resumen y distribución</h3><p>Comprueba el tiempo antes de guardar</p></div></div>
        <div className='routine-distribution'><div className='row spread'><strong>Duración prevista</strong><strong>{this.dur(routineMinutes(r))}</strong></div>{flexLeaves.length>0?<><p className='caption'>Tiempo que sobra: {this.dur(free)}. Se distribuye según el peso de cada contenido flexible (9/1 equivale a 90/10).</p>{flexLeaves.map(s=><div className='distribution-item' key={s.id}><span>{s.title||'Sin título'}</span><strong>{this.dur(allocations[s.id]||0)} · {Math.round(100*Math.max(1,s.flexWeight||1)/Math.max(1,flexLeaves.reduce((sum,item)=>sum+Math.max(1,item.flexWeight||1),0)))}%</strong></div>)}</>:<p className='caption'>Sin pasos flexibles. {mode==='fixed'?'La suma fija debe coincidir exactamente con la duración.':'El tiempo varía con la suma de pasos y alternativas.'}</p>}</div>
        {mode==='fixed'&&issue&&<div className='routine-validation-error'>⚠ {issue}</div>}
      </section>
    </div>;
  }
  eventForm():any{
    const e=this.state.eventDraft,rs=this.state.data.routines,gs=this.state.data.goals;
    const isOccasion=e.kind==='occasion';
    const repeatGroup=e.repeat==='none'?'none':e.repeat==='custom'||e.repeat==='daily'||e.repeat==='weekdays'?'days':e.repeat==='weekly'||e.repeat==='monthly'||e.repeat==='yearly'||e.repeat==='every'?'period':'dates';
    const scheduled=e.routineId?this.routineSchedule(e.routineId):undefined;
    const changeRepeatGroup=(group:string)=>{
      if(group==='none')this.updateEventDraft({repeat:'none',repeatDays:[],specificDates:[]});
      if(group==='days')this.updateEventDraft({repeat:'custom',repeatDays:e.anchor==='between'?[]:[1,2,3,4,5]});
      if(group==='period')this.updateEventDraft({repeat:'weekly',repeatDays:[]});
      if(group==='dates')this.updateEventDraft({repeat:'dates',repeatDays:[],specificDates:[]});
    };
    const minDate=parseDay(this.state.datePickerMonth);
    const monthOffset=(minDate.getDay()+6)%7;
    const visibleDays=Array.from({length:42},(_,i)=>addDays(this.state.datePickerMonth,i-monthOffset));
    const totalMinutes=e.routineId?Math.max(1,routineMinutesOn(rs.find(x=>x.id===e.routineId)||{id:'',title:'',desc:'',steps:[]},e.date)):e.minutes;
    const endTime=e.endTime||timeString(minutes(e.time)+totalMinutes);
    const anchors=this.state.data.events.filter(item=>item.routineId&&item.routineId!==e.routineId&&sameScheduleActive(item,e.date));
    const preview=e.anchor==='between'?eventFrame(e,e.date,{...this.state.data,events:[...this.state.data.events.filter(item=>item.id!==e.id),e]}):null;
    const avail=preview?.length||0;
    const estimate=e.routineId?fixedStepMinutes(activeSteps(rs.find(r=>r.id===e.routineId)?.steps||[],e.date)):0;
    const rows=e.routineId?this.schedulePreview(e):[], problems=rows.filter(x=>x.issue&&!x.skipped);
    const currentRoutine=rs.find(r=>r.id===e.routineId);
    const needsFlexible=preview&&currentRoutine?routineBalance(currentRoutine,e.date,preview.length).error:'';
    return <div className='event-form-v06'>
      <section className='event-editor-section'><div className='event-section-heading'><span>01</span><div><strong>Identidad del bloque</strong><small>Qué es y cuándo debe aparecer</small></div></div>
      <div className='event-identity-banner'><Icon name={isOccasion?'calendar':e.routineId?'checklist':'clock'} size={19}/><div><strong>{isOccasion?'Evento o fecha especial':e.routineId?'Programación de rutina':'Actividad puntual'}</strong><small>{isOccasion?'Viajes, encuentros y fechas importantes.':e.routineId?'Se programa únicamente como rutina, sin convertirla en evento.':'Un bloque puntual sin procedimiento asociado.'}</small></div></div>
      <div className='field'><label>{isOccasion?'Nombre del evento *':'Nombre de la actividad *'}</label><input maxLength={100} value={e.title} onChange={v=>this.updateEventDraft({title:v.target.value})} placeholder={isOccasion?'Ej. Viaje de graduación':'Ej. Preparación matutina'}/></div>
      <div className='field-grid'><div className='field'><label>Primera fecha *</label><CalendarDateInput label='fecha inicial' value={e.date} onChange={date=>{this.updateEventDraft({date,endDate:undefined,specificDates:[]});if(date)this.setState({datePickerMonth:firstMonth(date)});}}/></div>
        {(isOccasion||e.repeat!=='none')&&<div className='field'><label>{e.repeat==='none'?'Fecha final (opcional)':'Dejar de repetir después del día (opcional)'}</label><CalendarDateInput label='fecha de finalización' min={e.date} rangeStart={isOccasion&&e.repeat==='none'?e.date:undefined} value={e.endDate||''} onChange={endDate=>this.updateEventDraft({endDate:endDate||undefined})}/><span className='caption'>{e.repeat==='none'?'Úsala para eventos que duran varios días.':'Las repeticiones terminarán en esta fecha.'}</span></div>}
      </div>
      </section>
      <section className='event-editor-section'><div className='event-section-heading'><span>02</span><div><strong>Tiempo y duración</strong><small>Fija una hora o haz que la calculen otros bloques</small></div></div>
      {isOccasion&&<label className='event-allday-toggle'><input type='checkbox' checked={!!e.allDay} onChange={v=>this.updateEventDraft({allDay:v.target.checked})}/> Ocurre durante todo el día (no ocupa un bloque con hora fija)</label>}
      {!e.allDay&&<><div className='field'><label>¿Con qué hora quieres acomodarla?</label><div className='time-anchor-choice'>
        <button className={(e.anchor||'start')==='start'?'active':''} onClick={()=>this.updateEventDraft({anchor:'start'})}><Icon name='clock' size={16}/> Hora de inicio</button>
        <button className={e.anchor==='end'?'active':''} onClick={()=>this.updateEventDraft({anchor:'end',endTime})}><Icon name='clock' size={16}/> Hora de término</button>
        {!isOccasion&&<button className={e.anchor==='between'?'active':''} onClick={()=>this.updateEventDraft({anchor:'between'})}><Icon name='calendar' size={16}/> Entre dos rutinas</button>}
      </div></div>
      {e.anchor!=='between'&&<div className='field-grid'><div className='field'><label>{e.anchor==='end'?'Termina a las':'Comienza a las'} *</label><TimePicker value={e.anchor==='end'?endTime:e.time} onChange={time=>e.anchor==='end'?this.updateEventDraft({endTime:time,time:timeString(Math.max(0,minutes(time)-totalMinutes))}):this.updateEventDraft({time})}/></div>
        <div className='field'><label>Duración estimada (min)</label>{e.routineId?<div className='calculated-duration'>Σ {this.dur(totalMinutes)} · duración de la rutina</div>:<NumberField value={e.minutes} min={1} max={1440} onCommit={val=>this.updateEventDraft({minutes:val, ...(e.anchor==='end'?{time:timeString(Math.max(0,minutes(endTime)-val))}:{})})}/>}</div></div>}
      {e.anchor==='between'&&<div className='between-editor'><p>Fullhouse calcula automáticamente el espacio entre el <strong>final</strong> de una rutina y el <strong>inicio</strong> de otra. Cuando una cambie, este bloque también cambiará.</p><div className='field-grid'><div className='field'><label>Después de finalizar…</label><FriendlySelect value={e.afterRoutineId||''} ariaLabel='Rutina límite anterior' onChange={afterRoutineId=>this.updateEventDraft({afterRoutineId})} options={[{value:'',label:'Selecciona una rutina'},...anchors.map(x=>({value:x.routineId,label:x.title}))]}/></div><div className='field'><label>Antes de comenzar…</label><FriendlySelect value={e.beforeRoutineId||''} ariaLabel='Rutina límite posterior' onChange={beforeRoutineId=>this.updateEventDraft({beforeRoutineId})} options={[{value:'',label:'Selecciona una rutina'},...anchors.map(x=>({value:x.routineId,label:x.title}))]}/></div></div>{preview?<div className={'calculated-duration '+(needsFlexible?'time-warning':'')}>↔ {timeString(preview.start)} – {timeString(preview.end)} · {this.dur(avail)} disponibles. Pasos fijos: {this.dur(estimate)} · tiempo libre: {this.dur(Math.max(0,avail-estimate))}.{needsFlexible&&<div className='preview-day-message'>⚠ {needsFlexible} <button className='inline-link' type='button' onClick={()=>this.editRoutineFromSchedule(needsFlexible)}>Modificar pasos</button></div>}</div>:<div className='notice'>Selecciona dos rutinas que ocurran ese día y no se superpongan. El bloque aparecerá solo cuando ambas estén programadas y haya espacio entre ellas.</div>}</div>}
      {e.anchor==='end'&&<p className='caption anchor-note'>La hora inicial se calcula restando la duración. Si una variante cambia la duración, la hora de finalización seguirá siendo la elegida.</p>}</>}
      </section><section className='event-editor-section'><div className='event-section-heading'><span>03</span><div><strong>Repetición</strong><small>Define los días o fechas en que aparecerá</small></div></div>
      <div className='field'><label>Cómo se repite</label><div className='repeat-group-choice'>
        {[{id:'none',title:'Una sola ocasión',desc:'No se repite automáticamente'},{id:'days',title:'Días de semana',desc:'Lunes, martes, etc.'},{id:'period',title:'Por período',desc:'Semanas, meses o años'},{id:'dates',title:'Fechas concretas',desc:'Una o varias fechas'}].map(option=><button type='button' key={option.id} className={repeatGroup===option.id?'active':''} onClick={()=>changeRepeatGroup(option.id)}><strong>{option.title}</strong><small>{option.desc}</small></button>)}
      </div></div>
      {repeatGroup==='none'&&<div className='repeat-detail one-time-preview'><div className='row spread'><strong>{isOccasion&&e.endDate?'Un acontecimiento de varios días':'Una sola ocasión'}</strong><small>{isOccasion&&e.endDate?e.date+' — '+e.endDate:'Sin repetición'}</small></div><p className='caption'>Este evento no se repetirá automáticamente. Para un viaje o acontecimiento de varios días, selecciona una fecha final arriba.</p>{isOccasion&&e.endDate&&<><div className='mini-calendar-head'><button type='button' className='icon-btn' aria-label='Mes anterior' onClick={()=>{const d=parseDay(this.state.datePickerMonth);d.setMonth(d.getMonth()-1);this.setState({datePickerMonth:firstMonth(ymd(d))});}}><Icon name='left' size={15}/></button><strong>{fmtMonth(this.state.datePickerMonth)}</strong><button type='button' className='icon-btn' aria-label='Mes siguiente' onClick={()=>{const d=parseDay(this.state.datePickerMonth);d.setMonth(d.getMonth()+1);this.setState({datePickerMonth:firstMonth(ymd(d))});}}><Icon name='right' size={15}/></button></div><div className='mini-calendar-grid'>{weekdays.map(w=><span className='mini-calendar-weekday' key={w}>{w}</span>)}{visibleDays.map(day=><span key={day} title={day} className={'mini-calendar-day event-range-preview '+(day>=e.date&&day<=e.endDate!?'active ':'')+(day.slice(0,7)!==this.state.datePickerMonth.slice(0,7)?'outside':'')}>{parseDay(day).getDate()}</span>)}</div></>}</div>}
      {repeatGroup==='days'&&<div className='field repeat-detail'><label>Selecciona los días habituales</label><div className='weekday-options'>{weekdayNames.map((day,n)=><button type='button' key={n} className={'weekday-pill '+((e.repeat==='daily'||(e.repeat==='weekdays'&&n>=1&&n<=5)||(e.repeat==='custom'&&(e.repeatDays||[]).includes(n)))?'active':'')+(this.betweenDayIssue(e,n)?' unavailable-day':'')} aria-pressed={(e.repeatDays||[]).includes(n)} title={longDays[n]} onClick={()=>{const old=e.repeat==='daily'?DAYS:e.repeat==='weekdays'?[1,2,3,4,5]:e.repeatDays||[];if(!old.includes(n)){const reason=this.betweenDayIssue(e,n);if(reason){this.notice(reason);return;}}const next=old.includes(n)?old.filter(x=>x!==n):[...old,n];this.updateEventDraft({repeat:'custom',repeatDays:next});}}>{day}</button>)}</div><p className='caption'>Los días seleccionados permanecen marcados. La primera fecha establece desde cuándo se aplican.</p></div>}
      {repeatGroup==='period'&&<div className='field repeat-detail'><label>Intervalo de repetición</label><FriendlySelect value={e.repeat} ariaLabel='Periodicidad' onChange={value=>this.updateEventDraft({repeat:value as Repeat})} options={[{value:'weekly',label:'Cada semana, el mismo día'},{value:'monthly',label:'Cada mes, la misma fecha'},{value:'yearly',label:'Cada año'},{value:'every',label:'Cada cierto número de días'}]}/>{e.repeat==='every'&&<div className='field' style={{marginTop:12,maxWidth:210}}><label>Intervalo en días</label><NumberField value={e.everyDays||2} min={1} max={365} onCommit={everyDays=>this.updateEventDraft({everyDays})}/></div>}</div>}
      {repeatGroup==='dates'&&<div className='field repeat-detail'><div className='row spread'><label>Elige las fechas en el calendario</label><span className='caption'>{1+(e.specificDates||[]).filter(d=>d!==e.date).length} seleccionada(s)</span></div><div className='mini-calendar-head'><button className='icon-btn' aria-label='Mes anterior' onClick={()=>this.setState({datePickerMonth:firstMonth(addDays(this.state.datePickerMonth,-1))})}><Icon name='left' size={15}/></button><strong>{fmtMonth(this.state.datePickerMonth)}</strong><button className='icon-btn' aria-label='Mes siguiente' onClick={()=>{const m=parseDay(this.state.datePickerMonth);m.setMonth(m.getMonth()+1);this.setState({datePickerMonth:ymd(m)});}}><Icon name='right' size={15}/></button></div><div className='mini-calendar-grid'>{['L','M','Mié','J','V','S','D'].map((name,i)=><span className='mini-calendar-weekday' key={i}>{name}</span>)}{visibleDays.map((date,i)=>{const selected=date===e.date||(e.specificDates||[]).includes(date)||(!!isOccasion&&e.repeat==='none'&&!!e.endDate&&date>=e.date&&date<=e.endDate),outside=date.slice(0,7)!==this.state.datePickerMonth.slice(0,7),disabled=date<e.date;return <button type='button' key={i} disabled={disabled} className={'mini-calendar-day '+(selected?'active ':'')+(outside?'outside':'')} title={date} onClick={()=>{if(date===e.date)return;const next=(e.specificDates||[]).includes(date)?(e.specificDates||[]).filter(d=>d!==date):[...(e.specificDates||[]),date];this.updateEventDraft({specificDates:next,repeat:next.length?'dates':'none'});}}>{parseDay(date).getDate()}</button>;})}</div><p className='caption'>La fecha inicial siempre está incluida. Puedes añadir o quitar fechas posteriores.</p></div>}
      </section><section className={'event-editor-section '+(!this.state.advancedOpen?'advanced-collapsed':'')}><div className='event-section-heading'><span>04</span><div><strong>Detalles y relaciones</strong><small>Rutina, meta e información adicional</small></div></div>
      {currentRoutine&&<div className='linked-routine-card'><Icon name={currentRoutine.icon||'checklist'} size={24}/><div><strong>{currentRoutine.title}</strong><small>Plantilla vinculada · {this.dur(routineMinutes(currentRoutine))}</small></div><Btn kind='secondary' tiny onClick={()=>this.editRoutineFromSchedule()}>Editar rutina</Btn></div>}
      <div className='field'><label>Meta vinculada (opcional)</label>{this.goalPicker(e.goalId,goalId=>this.updateEventDraft({goalId}))}</div>
      <div className='field'><label className='evidence-preference'><input type='checkbox' checked={!!e.requestEvidence} onChange={v=>this.updateEventDraft({requestEvidence:v.target.checked})}/> Recordar que puedo adjuntar una foto o evidencia al realizar esta actividad (siempre opcional)</label></div><div className='field'><label>Descripción e instrucciones</label><AutoTextarea value={e.note} onChange={(v:any)=>this.updateEventDraft({note:v.target.value})} maxLength={1500} placeholder={isOccasion?'Lugar, notas del viaje, recuerdos o preparativos':'Detalles que quieras recordar'}/></div>
      {this.state.advancedOpen&&!e.allDay&&e.repeat==='none'&&e.anchor!=='between'&&<div className='overlap-editor'><strong>Si este bloque se solapa con otro, ¿qué hacemos?</strong><div className='time-anchor-choice'><button type='button' className={(e.overlapMode||'keep')==='keep'?'active':''} onClick={()=>this.updateEventDraft({overlapMode:'keep'})}>Mantener solapamiento</button><button type='button' className={e.overlapMode==='move'?'active':''} onClick={()=>this.updateEventDraft({overlapMode:'move'})}>Posponer bloques ese día</button></div><p className='caption'>Al posponer, Fullhouse pide confirmación y aplica desplazamientos únicamente en esta fecha. Las rutinas entre dos límites conservan sus dependencias.</p></div>}
      {e.routineId&&<div className='notice'>Una rutina mantiene una única programación vigente. Si ya existe, utiliza «Reprogramar»: no se crearán copias que compitan entre sí.</div>}
      {e.id&&this.state.advancedOpen&&<div className='field'><label>Aplicar la reprogramación desde</label><input type='date' min={today()} value={e.applyFrom||today()} onChange={v=>this.updateEventDraft({applyFrom:v.target.value})}/><p className='caption'>Cambia este día y los siguientes; conserva los días anteriores y los registros ya hechos. Antes de guardar verás una confirmación.</p></div>}
      {e.id&&<div className='row spread' style={{marginTop:16}}><span className='caption'>Editar la programación puede cambiar horas y repeticiones desde la fecha indicada.</span><Btn kind='danger' tiny onClick={()=>this.deleteEvent(e)}><Icon name='trash' size={14}/> Eliminar</Btn></div>}
      </section>
      {e.routineId&&<section className='event-editor-section schedule-preview-section'><div className='event-section-heading'><span>05</span><div><strong>Vista previa del horario</strong><small>Comprueba las próximas apariciones y posibles solapamientos</small></div></div>
      <div className='row spread schedule-preview-top'><span className='caption'>Hasta ocho fechas próximas · sin modificar todavía el calendario</span><Btn kind='secondary' tiny onClick={()=>this.editRoutineFromSchedule(problems.length?problems[0].issue:'Ajusta los pasos o la duración y vuelve a revisar esta previsión.')}><Icon name='edit' size={15}/> Modificar rutina</Btn></div>
      {rows.length?<div className='preview-day-list'>{rows.map(item=><div className={'preview-day '+(item.issue?(item.skipped?'preview-skipped':'preview-error'):item.overlaps.length?'preview-overlap':'preview-ok')} key={item.date}><div className='preview-day-main'><strong>{item.label}</strong><span>{item.skipped?'Sin bloque':`${item.start}–${item.end} · ${this.dur(item.length)}`}</span></div>{item.length>0&&<div className='preview-timebar' title={'Bloque: '+item.start+'–'+item.end}><span style={{left:(Math.max(0,minutes(item.start)-360)/960*100)+'%',width:(Math.min(960,Math.max(0,item.length))/960*100)+'%'}}/></div>}{item.issue&&<div className='preview-day-message'>{item.skipped?'ℹ':'⚠'} {item.issue}</div>}{!item.issue&&item.overlaps.length>0&&<div className='preview-day-message'>Coincide con: {item.overlaps.join(', ')}</div>}{!item.issue&&!item.overlaps.length&&<small>✓ Sin solapamientos</small>}</div>)}</div>:<div className='notice'>Selecciona una fecha y un patrón de repetición para ver la previsión.</div>}
      {problems.length>0&&<div className='routine-validation-error'><span>Hay {problems.length} fecha(s) que requieren ajustes. Puedes editar la rutina; al guardar volverás aquí.</span><Btn tiny onClick={()=>this.editRoutineFromSchedule(problems[0].issue)}>Ir a corregir rutina</Btn></div>}
      </section>}
      </div>;
  }
  progressForm():any{
    const g=this.state.data.goals.find(x=>x.id===this.state.progressGoalId);if(!g)return null;const mode=goalMode(g);
    return <><div className="notice"><strong>{g.title}</strong> · {mode==='qualitative'?'Avance por estados y reflexiones':'Valor actual: '+g.current+' '+g.unit+(g.target>0?' · Objetivo: '+g.target+' '+g.unit:'')}</div>
      {mode==='qualitative'?<div className="field" style={{marginTop:18}}><label>¿En qué estado se encuentra esta meta?</label><FriendlySelect value={this.state.progressStatus} ariaLabel="Estado del progreso" onChange={status=>this.setState({progressStatus:status as GoalStatus})} options={goalStatuses.map(s=>({value:s.id,label:s.label+' · '+s.desc}))}/></div>:<div className="field" style={{marginTop:18}}><label>Nuevo resultado</label><input type='text' inputMode='decimal' value={this.state.progressValue} onChange={e=>this.setState({progressValue:e.target.value})}/></div>}
      <div className="field"><label>{mode==='qualitative'?'¿Qué cambió? Describe tus avances':'Nota del registro (opcional)'}</label><AutoTextarea value={this.state.progressNote} onChange={(e:any)=>this.setState({progressNote:e.target.value})} placeholder="Reflexiones, aprendizajes o cambios desde el registro anterior"/></div><p className="caption">El resultado se guarda en el historial de la meta con la fecha de hoy.</p></>;
  }
  renderCheckSteps=(steps:Step[],e:EventItem,date:string,log:RecordLog,allocation:Record<string,number>,level=0):any=><div className={level?'check-child-steps':''}>{steps.map((s,i)=>{
    const manual=s.mode==='alternatives'&&s.chooseWhen==='execute';const chosen=log.choices?.[s.id]||'';
    return <div className={'execution-step '+(s.goalId?'goal-linked-step':'')} key={s.id} style={{'--linked-goal-color':goalColor(this.state.data,s.goalId)||eventTint(this.state.data,e)} as any}><div className="routine-step"><button className={'check-circle '+(log.checkedSteps.includes(s.id)?'checked':'')} onClick={()=>this.toggleStep(e,date,s.id)} aria-label={'Marcar '+s.title} disabled={!!(s.children&&s.children.length)||(manual&&!chosen)}>{log.checkedSteps.includes(s.id)&&<Icon name="check" size={13}/>}</button><div className="flex"><div className="agenda-name">{i+1}. {manual&&!chosen?'Elige una alternativa':s.title}</div>{s.desc&&<div className="agenda-sub">{s.desc}</div>}<div className="agenda-sub">{this.dur(effectiveStepMinutes(s,allocation))} {s.flexible?'· flexible':''} · {s.children?.length?'Incluye '+s.children.length+' elementos':'Paso individual'}</div></div></div>
    {manual&&<div className='execution-choice'><strong>¿Qué opción realizarás hoy?</strong><div className='execution-options'>{[{id:'__base',title:originalStepTitle(this.state.data,e.routineId,s.id)||s.title},...(s.variants||[]).map(v=>({id:v.id,title:v.title}))].map(v=><button key={v.id} className={chosen===v.id?'active':''} type='button' onClick={()=>this.selectVariant(e,date,s.id,v.id)}>{v.title}</button>)}</div>{!chosen&&<p className='caption'>Selecciona una alternativa antes de marcar este paso.</p>}</div>}
    {(!manual||!!chosen)&&<details className='step-extras'><summary><Icon name='book' size={14}/> Notas y evidencias de este paso</summary>{(s.requestEvidence||this.state.data.routines.find(r=>r.id===e.routineId)?.requestEvidence)&&<div className='evidence-prompt'>Puedes adjuntar un recuerdo de este paso.</div>}{this.evidenceSection(e,date,s.id)}<NoteEditor key={e.id+'-'+date+'-'+s.id} label={'Nota de '+(s.title||'este paso')} value={log.stepNotes?.[s.id]||''} carry={upcomingNote(this.state.data,e,date,s.id)} onSave={text=>this.saveOccurrenceNote(e,date,text,s.id)}/></details>}
    {s.children&&s.children.length>0&&(!manual||!!chosen)&&this.renderCheckSteps(s.children,e,date,log,allocation,level+1)}
    </div>})}</div>;
  executeForm():any{
    const date=this.state.selectedDate,e=this.state.data.events.find(x=>x.id===this.state.activeEventId);if(!e)return null;
    const original=this.state.data.routines.find(x=>x.id===e.routineId);if(!original)return <p>La rutina ya no está disponible.</p>;
    const log=this.state.data.logs[key(e,date)]||{completed:false,checkedSteps:[]};
    const r={...original,steps:activeSteps(original.steps,date,log.choices||{})};
    const allocation=leafAllocation(r.steps,durationOn(e,date,this.state.data));
    const missing=unresolvedManual(r.steps,log.choices||{});
    return <><div className="notice"><strong>{e.title}</strong> · {fmtDate(date)} a las {eventTime(e,date,this.state.data)}. Las alternativas, notas y pasos marcados se guardan solo para este día.</div>{missing.length>0&&<div className='manual-warning'>✦ Hay {missing.length} paso(s) con alternativas pendientes de elegir.</div>}
      {(e.requestEvidence||original.requestEvidence)&&<div className='evidence-prompt'>Si quieres, deja una fotografía de lo que realizaste.</div>}{this.evidenceSection(e,date)}<NoteEditor key={e.id+'-'+date+'-routine'} label='Nota general de esta ejecución' value={log.note||''} carry={upcomingNote(this.state.data,e,date)} onSave={text=>this.saveOccurrenceNote(e,date,text)}/>
      <div style={{marginTop:15}}>{this.renderCheckSteps(r.steps,e,date,log,allocation)}</div><div className="divider"/><div className="row spread"><span className="caption">{leafSteps(r.steps).filter(s=>log.checkedSteps.includes(s.id)).length} / {leafSteps(r.steps).length} pasos completados</span>{log.completed&&<span className="small-tag">Actividad completada</span>}</div></>;
  }
  render():any{
    const title:{[K in Page]:string}={hoy:'Mi día',inicio:'Inicio',metas:'Metas',rutinas:'Rutinas',horario:'Horario',calendario:'Calendario',progreso:'Progreso',ajustes:'Ajustes'};
    return <div className="app-shell" data-theme={this.state.theme}>{this.renderSidebar()}<main className="main"><header className="topbar"><div className="crumb"><Icon name="home" size={16}/><span>Mi espacio</span><span>/</span><strong>{title[this.state.page]}</strong></div><div className="top-right"><span className="pill"><span className="dot"/> Datos locales</span><button className="icon-btn guide-top-button" onClick={this.openGuide} title="Guía de inicio" aria-label="Abrir guía de inicio"><Icon name="help"/></button></div></header>
      <div className="content">{this.state.page==='hoy'?this.renderToday():this.state.page==='inicio'?this.renderHome():this.state.page==='metas'?this.renderGoals():this.state.page==='rutinas'?this.renderRoutines():this.state.page==='horario'?this.renderSchedule():this.state.page==='calendario'?this.renderCalendar():this.state.page==='progreso'?this.renderProgress():this.renderSettings()}</div></main>{this.renderModal()}{this.renderConfirm()}{this.renderGuide()}{this.renderHelpPanel()}{this.state.toast&&<div className="toast" role="status"><span>{this.state.toast}</span><button aria-label="Cerrar aviso" onClick={()=>{if(this.toastTimer)clearTimeout(this.toastTimer);this.setState({toast:''});}}>×</button></div>}</div>;
  }
}
ReactDOM.render(<Planner/>,document.getElementById('app'));
