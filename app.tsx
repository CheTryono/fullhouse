/* Fullhouse · Planificador v0.1 — prototipo local sin servicios externos.
   Interfaz React + TypeScript. Los datos se guardan en este navegador. */
type Page = 'inicio' | 'metas' | 'rutinas' | 'calendario' | 'progreso' | 'ajustes';
type Repeat = 'none' | 'daily' | 'weekdays' | 'weekly';
type Goal = { id: string; title: string; desc: string; parentId: string; color: string; current: number; target: number; unit: string; history: { date: string; value: number; note: string }[] };
type Step = { id: string; title: string; min: number };
type Routine = { id: string; title: string; desc: string; steps: Step[] };
type EventItem = { id: string; title: string; date: string; time: string; minutes: number; goalId: string; routineId: string; repeat: Repeat; note: string; overrides: Record<string, { time?: string; skip?: boolean }> };
type RecordLog = { completed: boolean; checkedSteps: string[]; note?: string };
type Data = { version: number; goals: Goal[]; routines: Routine[]; events: EventItem[]; logs: Record<string, RecordLog> };
type GoalDraft = Omit<Goal,'history'>;
type RoutineDraft = Routine;
type EventDraft = EventItem;
type Modal = 'goal' | 'routine' | 'event' | 'execute' | 'progress' | null;
type State = { data: Data; page: Page; selectedDate: string; month: string; modal: Modal; goalDraft: GoalDraft; routineDraft: RoutineDraft; eventDraft: EventDraft; activeEventId: string; progressValue: string; progressNote: string; progressGoalId: string; toast: string };
const STORE = 'fullhouse-v01';
const LEGACY_STORE = 'botanica-planificador-v01';
const colorOptions = ['#4b8665','#c39960','#8683b3','#b87f75','#5485a3'];
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
function gDraft():GoalDraft {return {id:'',title:'',desc:'',parentId:'',color:colorOptions[0],current:0,target:0,unit:''};}
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
  if(date<e.date)return false;
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
function key(e:EventItem,date:string):string{return `${e.id}@${date}`;}
function done(data:Data,e:EventItem,date:string):boolean {return !!data.logs[key(e,date)]?.completed;}
function percent(current:number,target:number):number{return target>0?bound(Math.round((current/target)*100),0,100):0;}
function Icon({name,size=19}:{name:string;size?:number}){return <span className="icon" style={{display:'inline-flex',alignItems:'center',justifyContent:'center'}}><svg style={{width:size,height:size,fill:'none',stroke:'currentColor',strokeWidth:1.8,strokeLinecap:'round',strokeLinejoin:'round'}}><use href={'#i-'+name}/></svg></span>}
function Btn({children,onClick,kind='',tiny=false,disabled=false,type='button',title}:{children?:any;onClick?:()=>void;kind?:string;tiny?:boolean;disabled?:boolean;type?:'button'|'submit';title?:string}){return <button className={`btn ${kind} ${tiny?'tiny':''}`} onClick={onClick} type={type} disabled={disabled} title={title}>{children}</button>}
class Planner extends React.Component<{},State> {
  constructor(props:{}){
    super(props);
    const d=today();
    this.state={data:load(),page:'inicio',selectedDate:d,month:firstMonth(d),modal:null,goalDraft:gDraft(),routineDraft:rDraft(),eventDraft:eDraft(d),activeEventId:'',progressValue:'',progressNote:'',progressGoalId:'',toast:''};
  }
  save = (data:Data,message='Cambios guardados'):void=>{
    try{localStorage.setItem(STORE,JSON.stringify(data));this.setState({data,toast:message});}catch(err){this.setState({data,toast:'No se pudo guardar: almacenamiento lleno o bloqueado. Exporta una copia.'});}
  }
  route=(page:Page):void=>{this.setState({page,modal:null});window.scrollTo(0,0)};
  chooseDay=(s:string):void=>this.setState({selectedDate:s,month:firstMonth(s)});
  openGoal=(goal?:Goal,parentId=''):void=>this.setState({modal:'goal',goalDraft:goal?{id:goal.id,title:goal.title,desc:goal.desc,parentId:goal.parentId,color:goal.color,current:goal.current,target:goal.target,unit:goal.unit}:{...gDraft(),parentId}});
  openRoutine=(r?:Routine):void=>this.setState({modal:'routine',routineDraft:r?JSON.parse(JSON.stringify(r)):rDraft()});
  openEvent=(e?:EventItem):void=>this.setState({modal:'event',eventDraft:e?JSON.parse(JSON.stringify(e)):eDraft(this.state.selectedDate)});
  openProgress=(g:Goal):void=>this.setState({modal:'progress',progressGoalId:g.id,progressValue:String(g.current),progressNote:''});
  openExecute=(e:EventItem):void=>this.setState({modal:'execute',activeEventId:e.id});
  close=():void=>this.setState({modal:null});
  updateGoalDraft=(patch:Partial<GoalDraft>):void=>this.setState({goalDraft:{...this.state.goalDraft,...patch}});
  updateRoutineDraft=(patch:Partial<RoutineDraft>):void=>this.setState({routineDraft:{...this.state.routineDraft,...patch}});
  updateEventDraft=(patch:Partial<EventDraft>):void=>this.setState({eventDraft:{...this.state.eventDraft,...patch}});
  saveGoal=():void=>{
    const x=this.state.goalDraft;if(!x.title.trim()){this.setState({toast:'Escribe un nombre para la meta'});return;}
    if(x.id && x.parentId===x.id){this.setState({toast:'Una meta no puede depender de sí misma'});return;}
    const data=this.state.data;const before=data.goals.find(g=>g.id===x.id);
    const next:Goal={...x,id:x.id||uid(),title:x.title.trim(),target:Math.max(0,x.target),current:Math.max(0,x.current),history:before?.history||[]};
    this.save({...data,goals:before?data.goals.map(g=>g.id===x.id?next:g):[...data.goals,next]});this.close();
  }
  saveRoutine=():void=>{
    const x=this.state.routineDraft;if(!x.title.trim()){this.setState({toast:'Escribe un nombre para la rutina'});return;}
    if(x.steps.some(s=>!s.title.trim())){this.setState({toast:'Todos los pasos necesitan un nombre'});return;}
    const data=this.state.data;const result:Routine={...x,id:x.id||uid(),title:x.title.trim(),steps:x.steps.map(s=>({...s,title:s.title.trim(),min:Math.max(1,s.min)}))};
    this.save({...data,routines:x.id?data.routines.map(r=>r.id===x.id?result:r):[...data.routines,result]});this.close();
  }
  saveEvent=():void=>{
    const x=this.state.eventDraft;if(!x.title.trim()||!x.date||!x.time){this.setState({toast:'Completa el título, la fecha y la hora'});return;}
    const data=this.state.data;const result:EventItem={...x,id:x.id||uid(),title:x.title.trim(),minutes:Math.max(1,x.minutes),overrides:x.overrides||{}};
    this.save({...data,events:x.id?data.events.map(e=>e.id===x.id?result:e):[...data.events,result]});this.close();
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
    const completed=!!routine&&routine.steps.length>0&&routine.steps.every(s=>checked.includes(s.id));
    this.save({...d,logs:{...d.logs,[k]:{...r,checkedSteps:checked,completed}}},'Paso actualizado');
  }
  shiftEvent=(e:EventItem,date:string,delta:number):void=>{
    const d=this.state.data;const newTime=timeString(bound(minutes(eventTime(e,date))+delta,0,1439));const next={...e,overrides:{...e.overrides,[date]:{...e.overrides[date],time:newTime}}};
    this.save({...d,events:d.events.map(x=>x.id===e.id?next:x)},`Actividad movida a las ${newTime}`);
  }
  saveProgress=():void=>{
    const d=this.state.data,g=d.goals.find(x=>x.id===this.state.progressGoalId);if(!g)return;
    const val=Number(this.state.progressValue);if(!Number.isFinite(val)||val<0){this.setState({toast:'Registra un valor válido mayor o igual a cero'});return;}
    const next={...g,current:val,history:[...g.history,{date:today(),value:val,note:this.state.progressNote.trim()}]};
    this.save({...d,goals:d.goals.map(x=>x.id===g.id?next:x)},'Avance registrado');this.close();
  }
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
  renderSidebar():any{
    const links:{id:Page;label:string;icon:string}[]=[{id:'inicio',label:'Inicio',icon:'home'},{id:'metas',label:'Mis metas',icon:'target'},{id:'rutinas',label:'Rutinas',icon:'checklist'},{id:'calendario',label:'Calendario',icon:'calendar'},{id:'progreso',label:'Progreso',icon:'chart'},{id:'ajustes',label:'Respaldo y ajustes',icon:'settings'}];
    return <>
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark"><Icon name="home" size={24}/></div><div><div className="brand-name">FULLHOUSE</div><div className="brand-sub">Tu sistema integral</div></div></div>
        <div className="side-section">Mi espacio</div>
        <nav>{links.map(l=><button key={l.id} className={`nav-item ${this.state.page===l.id?'active':''}`} onClick={()=>this.route(l.id)}><Icon name={l.icon}/>{l.label}</button>)}</nav>
        <div className="sidebar-bottom"><div className="profile-mini"><div className="avatar">✳</div><div><div className="profile-name">Mi espacio privado</div><div className="profile-meta">Prototipo web · 0.1</div></div></div><small>Sin cuentas, sin sincronización externa. Los datos permanecen en este navegador.</small></div>
      </aside>
      <nav className="mobile-nav" aria-label="Navegación móvil">{links.slice(0,5).map(l=><button key={l.id} className={`mobile-item ${this.state.page===l.id?'active':''}`} onClick={()=>this.route(l.id)}><Icon name={l.icon}/>{l.label.replace('Mis ','')}</button>)}</nav>
    </>;
  }
  renderHeading(title:string,description:string, action?:any):any{return <div className="heading-row"><div><div className="eyebrow">MI SISTEMA / {this.state.page}</div><h1 className="page-title">{title}</h1><p className="lead">{description}</p></div>{action}</div>}
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
    const tracked=d.goals.filter(g=>g.target>0),rate=es.length?Math.round(n/es.length*100):0;
    return <>{this.renderHeading('Tu espacio para avanzar','Una vista clara de lo que quieres conseguir, lo que harás hoy y lo que realmente has hecho.',<Btn onClick={()=>this.openEvent()}><Icon name="plus" size={16}/> Nueva actividad</Btn>)}
      <div className="notice">Este es un prototipo funcional con datos de ejemplo. Puedes editarlo todo. Los cambios se guardan automáticamente en este navegador.</div>
      <div className="cards">{this.renderStat('Metas activas',d.goals.length,'Incluye sub-metas','target')}{this.renderStat('Rutinas creadas',d.routines.length,'Procedimientos reutilizables','checklist')}{this.renderStat('Actividades del día',es.length,`${n} completadas`,'calendar')}{this.renderStat('Cumplimiento diario',rate+'%','De actividades planificadas','chart')}</div>
      <div className="two-col"><section className="panel"><div className="panel-head"><div><h2>Agenda del día</h2><p className="panel-sub">{fmtDate(date)}</p></div><button className="link-btn" onClick={()=>this.route('calendario')}>Ver calendario <Icon name="arrow-right" size={15}/></button></div>{this.renderTodayList(date,true)}</section>
        <section className="panel"><div className="panel-head"><div><h2>Mis metas</h2><p className="panel-sub">Indicadores de resultados, no solo tareas</p></div><button className="link-btn" onClick={()=>this.route('metas')}>Ver todas <Icon name="arrow-right" size={15}/></button></div>
        {tracked.length?tracked.slice(0,5).map(g=><div key={g.id} className="goal-summary"><div className="goal-summary-top"><strong>{g.title}</strong><span>{percent(g.current,g.target)}%</span></div><div className="progress-track"><div className="progress-fill" style={{width:`${percent(g.current,g.target)}%`,background:g.color}}/></div><p className="caption">{g.current} de {g.target} {g.unit}</p></div>):<div className="empty"><strong>Sin metas medibles</strong><p>Configura un objetivo numérico para visualizar su avance.</p></div>}
        </section></div>
      <div className="section-head"><h2 className="section-title">Acceso rápido</h2></div><div className="goal-grid"><button className="goal-card" style={{textAlign:'left',cursor:'pointer'}} onClick={()=>this.openGoal()}><div className="row"><span className="routine-badge"><Icon name="target"/></span><div><div className="goal-name">Nueva meta</div><div className="goal-desc">Desglosa un objetivo y define cómo medirlo.</div></div></div><span className="link-btn">Crear meta <Icon name="arrow-right" size={14}/></span></button><button className="goal-card" style={{textAlign:'left',cursor:'pointer'}} onClick={()=>this.openRoutine()}><div className="row"><span className="routine-badge"><Icon name="checklist"/></span><div><div className="goal-name">Nueva rutina</div><div className="goal-desc">Diseña los pasos de un procedimiento.</div></div></div><span className="link-btn">Crear rutina <Icon name="arrow-right" size={14}/></span></button></div>
    </>;
  }
  renderGoalCard(g:Goal,depth=0):any{
    const d=this.state.data,children=d.goals.filter(x=>x.parentId===g.id),linked=d.events.filter(e=>e.goalId===g.id).length;
    return <div className="goal-card" key={g.id} style={{borderLeft:`4px solid ${g.color}`}}><div className="goal-card-title"><div className="goal-color" style={{background:g.color}}/><div className="flex"><div className="goal-level">{depth?'SUB-META · NIVEL '+(depth+1):'META PRINCIPAL'}</div><h3 className="goal-name">{g.title}</h3><p className="goal-desc">{g.desc||'Sin descripción'}</p></div></div>
      {g.target>0?<div><div className="goal-summary-top"><strong>{g.current} / {g.target} {g.unit}</strong><span>{percent(g.current,g.target)}%</span></div><div className="progress-track"><div className="progress-fill" style={{background:g.color,width:`${percent(g.current,g.target)}%`}}/></div></div>:<div className="caption">Meta cualitativa · Sin objetivo numérico</div>}
      <div className="goal-footer"><span>{children.length} sub-metas · {linked} actividades vinculadas</span><span className="small-tag">{g.history.length} registros</span></div>
      <div className="actions"><Btn kind="secondary" tiny onClick={()=>this.openProgress(g)}><Icon name="chart" size={14}/> Registrar avance</Btn><Btn kind="ghost" tiny onClick={()=>this.openGoal(g)}><Icon name="edit" size={14}/> Editar</Btn><Btn kind="ghost" tiny onClick={()=>this.openGoal(undefined,g.id)} title="Añadir sub-meta"><Icon name="plus" size={14}/> Sub-meta</Btn><Btn kind="ghost" tiny onClick={()=>this.deleteGoal(g)} title="Eliminar"><Icon name="trash" size={14}/></Btn></div>
    </div>;
  }
  renderGoals():any{
    const gs=this.state.data.goals;
    const items:{goal:Goal;depth:number}[]=[];
    const seen=new Set<string>();
    const visit=(g:Goal,depth:number)=>{if(seen.has(g.id))return;seen.add(g.id);items.push({goal:g,depth});gs.filter(x=>x.parentId===g.id).forEach(c=>visit(c,depth+1));};
    gs.filter(g=>!g.parentId||!gs.some(x=>x.id===g.parentId)).forEach(g=>visit(g,0));gs.forEach(g=>visit(g,0));
    return <>{this.renderHeading('Mis metas','De una visión amplia a objetivos concretos. Crea sub-metas, vincula actividades y registra resultados.',<Btn onClick={()=>this.openGoal()}><Icon name="plus"/> Crear meta</Btn>)}
      <div className="notice">El progreso de una meta numérica se actualiza cuando registras un resultado. Completar actividades no equivale automáticamente a conseguir un resultado.</div>
      {items.length?<div className="goal-grid" style={{marginTop:20}}>{items.map(x=><div key={x.goal.id} style={{paddingLeft:Math.min(x.depth,3)*12}}>{this.renderGoalCard(x.goal,x.depth)}</div>)}</div>:<div className="panel" style={{marginTop:20}}><div className="empty"><Icon name="target"/><strong>Tu primera meta empieza aquí</strong><p>Define algo que quieras conseguir y desglósalo en pasos.</p><Btn onClick={()=>this.openGoal()}>Crear meta</Btn></div></div>}
    </>;
  }
  renderRoutines():any{
    const rs=this.state.data.routines;
    return <>{this.renderHeading('Rutinas y procedimientos','Convierte actividades complejas en pasos claros, reutilizables y fáciles de ejecutar.',<Btn onClick={()=>this.openRoutine()}><Icon name="plus"/> Nueva rutina</Btn>)}
      <div className="routine-grid">{rs.map(r=><div className="routine-card" key={r.id}><div className="row"><span className="routine-badge"><Icon name="checklist" size={21}/></span><div className="flex"><h3 className="goal-name">{r.title}</h3><p className="goal-desc">{r.desc||'Procedimiento sin descripción'}</p></div></div>
        <div className="routine-steps"><Icon name="clock" size={15}/>{r.steps.length} pasos · {r.steps.reduce((s,x)=>s+x.min,0)} min estimados</div><div className="routine-step-preview">{r.steps.slice(0,3).map((s,i)=><div key={s.id}>{i+1}. {s.title} <span className="muted">· {s.min} min</span></div>)}{r.steps.length>3&&<div>+{r.steps.length-3} pasos más</div>}</div>
        <div className="actions"><Btn tiny onClick={()=>this.setState({modal:'event',eventDraft:{...eDraft(this.state.selectedDate),title:r.title,routineId:r.id,minutes:r.steps.reduce((s,x)=>s+x.min,0)}})}><Icon name="calendar" size={14}/> Programar</Btn><Btn tiny kind="secondary" onClick={()=>this.openRoutine(r)}><Icon name="edit" size={14}/> Editar</Btn><Btn tiny kind="ghost" onClick={()=>this.deleteRoutine(r)}><Icon name="trash" size={14}/></Btn></div></div>)}
      </div>{!rs.length&&<div className="panel"><div className="empty"><strong>Aún no tienes rutinas</strong><p>Crea un procedimiento, sus pasos y duración estimada.</p><Btn onClick={()=>this.openRoutine()}>Crear rutina</Btn></div></div>}
    </>;
  }
  monthDays():{day:string;inside:boolean}[]{
    const start=parseDay(this.state.month),offset=(start.getDay()+6)%7;const first=addDays(this.state.month,-offset);const result=[];
    for(let i=0;i<42;i++){const day=addDays(first,i);result.push({day,inside:day.slice(0,7)===this.state.month.slice(0,7)});}return result;
  }
  changeMonth=(offset:number):void=>{const d=parseDay(this.state.month);d.setMonth(d.getMonth()+offset);const newMonth=ymd(d);this.setState({month:newMonth,selectedDate:newMonth})}
  renderCalendar():any{
    const date=this.state.selectedDate,d=this.state.data;
    return <>{this.renderHeading('Calendario','Tu agenda propia. Organiza fechas, repeticiones y prioridades sin conectar servicios externos.',<Btn onClick={()=>this.openEvent()}><Icon name="plus"/> Programar actividad</Btn>)}
      <div className="calendar-layout"><section className="panel"><div className="calendar-toolbar"><div className="month-name">{fmtMonth(this.state.month)}</div><div className="calendar-nav"><button className="icon-btn" onClick={()=>this.changeMonth(-1)} title="Mes anterior"><Icon name="left"/></button><button className="icon-btn" onClick={()=>this.chooseDay(today())} title="Volver a hoy"><Icon name="sun"/></button><button className="icon-btn" onClick={()=>this.changeMonth(1)} title="Mes siguiente"><Icon name="right"/></button></div></div>
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
      <div className="cards">{this.renderStat('Últimos 7 días',weekPlanned,'Actividades programadas','calendar')}{this.renderStat('Completadas',weekDone,'Registros de ejecución','checklist')}{this.renderStat('Cumplimiento',weekPlanned?Math.round(weekDone/weekPlanned*100)+'%':'—','Últimos 7 días','chart')}{this.renderStat('Metas con medida',d.goals.filter(g=>g.target>0).length,'Objetivos cuantificados','target')}</div>
      <div className="two-col"><section className="panel"><div className="panel-head"><div><h2>Actividad de la semana</h2><p className="panel-sub">Porcentaje diario de actividades completadas</p></div></div><div className="week-chart">{days.map(day=>{const a=eventsOn(d,day),c=a.filter(e=>done(d,e,day)).length,p=a.length?Math.round(c/a.length*100):0;return <div key={day} className="bar-wrap"><div className="bar-value">{a.length?p+'%':'—'}</div><div className="bar" style={{height:(5+p*.85)+'%',background:day===today()?'#407d5d':'#b7d0b4'}} title={`${c}/${a.length}`}/><div className="bar-label">{longDays[parseDay(day).getDay()].slice(0,3)}</div></div>})}</div></section>
        <section className="panel"><div className="panel-head"><div><h2>Resultados medibles</h2><p className="panel-sub">Actualizados manualmente con su historial</p></div></div>{d.goals.filter(g=>g.target>0).length?d.goals.filter(g=>g.target>0).map(g=><div key={g.id} className="goal-summary"><div className="goal-summary-top"><strong>{g.title}</strong><span>{g.current}/{g.target} {g.unit}</span></div><div className="progress-track"><div className="progress-fill" style={{width:percent(g.current,g.target)+'%',background:g.color}}/></div><div className="actions" style={{marginTop:9}}><Btn kind="ghost" tiny onClick={()=>this.openProgress(g)}>Actualizar resultado</Btn></div></div>):<div className="empty"><strong>No hay indicadores configurados</strong><p>Asigna una cantidad objetivo a una meta para verla aquí.</p></div>}</section></div>
      <div className="section-head"><h2 className="section-title">Últimos registros de resultados</h2></div><section className="panel">{d.goals.flatMap(g=>g.history.map(h=>({...h,goal:g.title,unit:g.unit}))).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,12).map((h,i)=><div className="agenda-item" key={i}><div className="agenda-time">{h.date.slice(5)}</div><div className="agenda-main"><div className="agenda-name">{h.goal} · {h.value} {h.unit}</div>{h.note&&<div className="agenda-sub">{h.note}</div>}</div></div>)}{!d.goals.some(g=>g.history.length>0)&&<div className="empty"><strong>Aún no hay resultados registrados</strong><p>Desde una meta, pulsa «Registrar avance» para iniciar tu historial.</p></div>}</section>
    </>;
  }
  renderSettings():any{return <>{this.renderHeading('Respaldo y ajustes','Todo permanece bajo tu control. Realiza copias de seguridad para conservar tus datos incluso si cambias de dispositivo o navegador.')}
    <div className="settings-box"><h2>Exportar mis datos</h2><p>Descarga un archivo JSON con todas tus metas, rutinas, actividades, fechas, pasos completados y registros. Guárdalo en un lugar seguro.</p><Btn onClick={this.exportData}><Icon name="download" size={16}/> Descargar respaldo</Btn></div>
    <div className="settings-box"><h2>Restaurar un respaldo</h2><p>Importa un archivo JSON exportado anteriormente. <strong>Esto reemplazará los datos actuales</strong> de este navegador. Te pediremos confirmación.</p><label className="btn secondary" style={{display:'inline-flex',cursor:'pointer',marginBottom:0}}><Icon name="upload" size={16}/> Elegir archivo JSON<input className="hide" type="file" accept=".json,application/json" onChange={this.importData}/></label></div>
    <div className="settings-box"><h2>Restablecer datos de ejemplo</h2><p>Vuelve al contenido inicial para hacer nuevas pruebas. Primero descarga un respaldo si hay algo que quieras conservar.</p><Btn kind="danger" onClick={this.reset}><Icon name="trash" size={15}/> Restablecer ejemplos</Btn></div>
    <div className="notice"><strong>Importante:</strong> los datos se almacenan con localStorage, solo en este navegador y perfil. Si limpias los datos del sitio, usas modo privado o cambias de dispositivo, podrías perderlos. Este prototipo no cifra la información ni hace respaldos automáticos. Para datos importantes o privados, usa una copia de seguridad y una futura versión con almacenamiento más robusto.</div>
    </>}
  renderModal():any{
    const modal=this.state.modal;if(!modal)return null;
    let title='';if(modal==='goal')title=this.state.goalDraft.id?'Editar meta':'Crear meta';if(modal==='routine')title=this.state.routineDraft.id?'Editar rutina':'Nueva rutina';if(modal==='event')title=this.state.eventDraft.id?'Editar actividad':'Programar actividad';if(modal==='execute')title='Ejecutar procedimiento';if(modal==='progress')title='Registrar avance';
    return <div className="modal-backdrop" onClick={(ev:any)=>{if(ev.target===ev.currentTarget)this.close()}}><div className="modal" role="dialog" aria-modal="true" aria-label={title}><div className="modal-header"><h2 className="modal-title">{title}</h2><button className="icon-btn" onClick={this.close} aria-label="Cerrar"><Icon name="close"/></button></div>
      <div className="modal-body">{modal==='goal'?this.goalForm():modal==='routine'?this.routineForm():modal==='event'?this.eventForm():modal==='progress'?this.progressForm():this.executeForm()}</div>
      <div className="modal-footer"><Btn kind="secondary" onClick={this.close}>Cerrar</Btn>{modal==='goal'&&<Btn onClick={this.saveGoal}>Guardar meta</Btn>}{modal==='routine'&&<Btn onClick={this.saveRoutine}>Guardar rutina</Btn>}{modal==='event'&&<Btn onClick={this.saveEvent}>Guardar actividad</Btn>}{modal==='progress'&&<Btn onClick={this.saveProgress}>Registrar resultado</Btn>}</div>
    </div></div>;
  }
  goalForm():any{
    const x=this.state.goalDraft,notAllowed=x.id?[x.id,...this.descendants(x.id)]:[];
    return <><div className="field"><label>Nombre de la meta *</label><input maxLength={90} value={x.title} onChange={e=>this.updateGoalDraft({title:e.target.value})} placeholder="Ej. Mejorar mi fuerza"/></div>
      <div className="field"><label>Descripción o propósito</label><textarea maxLength={350} value={x.desc} onChange={e=>this.updateGoalDraft({desc:e.target.value})} placeholder="¿Qué quiero conseguir y para qué?"/></div>
      <div className="field"><label>Meta superior (opcional)</label><select value={x.parentId} onChange={e=>this.updateGoalDraft({parentId:e.target.value})}><option value="">Ninguna · Meta principal</option>{this.state.data.goals.filter(g=>!notAllowed.includes(g.id)).map(g=><option value={g.id} key={g.id}>{g.title}</option>)}</select></div>
      <div className="field-grid"><div className="field"><label>Resultado actual</label><input type="number" min="0" step="any" value={x.current} onChange={e=>this.updateGoalDraft({current:asInt(e.target.value)})}/></div><div className="field"><label>Resultado objetivo (0 = sin medida)</label><input type="number" min="0" step="any" value={x.target} onChange={e=>this.updateGoalDraft({target:asInt(e.target.value)})}/></div></div>
      <div className="field"><label>Unidad de medida</label><input maxLength={40} placeholder="Ej. km, sesiones, capítulos, kg" value={x.unit} onChange={e=>this.updateGoalDraft({unit:e.target.value})}/></div>
      <div className="field"><label>Color de identificación</label><div className="row">{colorOptions.map(c=><button key={c} onClick={()=>this.updateGoalDraft({color:c})} title={c} style={{width:31,height:31,borderRadius:'50%',background:c,border:x.color===c?'3px solid #1b3a2c':'3px solid white',outline:x.color===c?'1px solid #afc3b1':'none'}}/>)}</div></div>
    </>;
  }
  routineForm():any{
    const r=this.state.routineDraft,changeStep=(id:string,patch:Partial<Step>)=>this.updateRoutineDraft({steps:r.steps.map(s=>s.id===id?{...s,...patch}:s)});
    return <><div className="field"><label>Nombre de la rutina *</label><input maxLength={90} value={r.title} onChange={e=>this.updateRoutineDraft({title:e.target.value})} placeholder="Ej. Preparación para el gimnasio"/></div>
      <div className="field"><label>Descripción</label><textarea maxLength={350} value={r.desc} onChange={e=>this.updateRoutineDraft({desc:e.target.value})} placeholder="¿Cuál es el propósito de esta rutina?"/></div>
      <div className="field"><div className="row spread"><label style={{margin:0}}>Pasos del procedimiento</label><span className="caption">{r.steps.reduce((v,s)=>v+s.min,0)} minutos en total</span></div></div>
      {r.steps.map((s,i)=><div className="step-edit" key={s.id}><span className="step-label">{i+1}.</span><input aria-label={'Nombre del paso '+(i+1)} value={s.title} onChange={e=>changeStep(s.id,{title:e.target.value})} placeholder="Nombre del paso"/><input className="step-min" aria-label="Duración en minutos" type="number" min="1" value={s.min} onChange={e=>changeStep(s.id,{min:asInt(e.target.value,1)})}/><button className="icon-btn" title="Mover paso arriba" disabled={i===0} onClick={()=>{const a=[...r.steps];[a[i-1],a[i]]=[a[i],a[i-1]];this.updateRoutineDraft({steps:a})}}>↑</button><button className="icon-btn" title="Mover paso abajo" disabled={i===r.steps.length-1} onClick={()=>{const a=[...r.steps];[a[i],a[i+1]]=[a[i+1],a[i]];this.updateRoutineDraft({steps:a})}}>↓</button><button className="icon-btn" title="Quitar paso" onClick={()=>this.updateRoutineDraft({steps:r.steps.filter(x=>x.id!==s.id)})}><Icon name="close" size={13}/></button></div>)}
      <div style={{marginTop:13}}><Btn kind="secondary" tiny onClick={()=>this.updateRoutineDraft({steps:[...r.steps,{id:uid(),title:'',min:5}]})}><Icon name="plus" size={14}/> Agregar paso</Btn></div>
      <div className="notice" style={{marginTop:18}}>Puedes vincular la rutina a actividades del calendario. Cambiar la plantilla modificará los pasos que verás en ejecuciones futuras y al consultar las existentes.</div>
    </>;
  }
  eventForm():any{
    const e=this.state.eventDraft,rs=this.state.data.routines,gs=this.state.data.goals;
    return <><div className="field"><label>Título de la actividad *</label><input maxLength={100} value={e.title} onChange={v=>this.updateEventDraft({title:v.target.value})} placeholder="Ej. Entrenamiento de fuerza"/></div>
      <div className="field-grid"><div className="field"><label>Fecha de inicio *</label><input type="date" value={e.date} onChange={v=>this.updateEventDraft({date:v.target.value})}/></div><div className="field"><label>Hora *</label><input type="time" value={e.time} onChange={v=>this.updateEventDraft({time:v.target.value})}/></div></div>
      <div className="field-grid"><div className="field"><label>Duración estimada (min)</label><input type="number" min="1" max="1440" value={e.minutes} onChange={v=>this.updateEventDraft({minutes:asInt(v.target.value,30)})}/></div><div className="field"><label>Repetición</label><select value={e.repeat} onChange={v=>this.updateEventDraft({repeat:v.target.value as Repeat})}><option value="none">Solo esta fecha</option><option value="daily">Todos los días</option><option value="weekdays">Lunes a viernes</option><option value="weekly">Cada semana</option></select></div></div>
      <div className="field"><label>Rutina o procedimiento (opcional)</label><select value={e.routineId} onChange={v=>{const id=v.target.value,r=rs.find(x=>x.id===id);this.updateEventDraft({routineId:id,...(r?{title:r.title,minutes:r.steps.reduce((a,s)=>a+s.min,0)}:{})})}}><option value="">Actividad sencilla</option>{rs.map(r=><option key={r.id} value={r.id}>{r.title}</option>)}</select></div>
      <div className="field"><label>Meta vinculada (opcional)</label><select value={e.goalId} onChange={v=>this.updateEventDraft({goalId:v.target.value})}><option value="">Sin meta asociada</option>{gs.map(g=><option value={g.id} key={g.id}>{g.title}</option>)}</select></div>
      <div className="field"><label>Notas e instrucciones</label><textarea value={e.note} onChange={v=>this.updateEventDraft({note:v.target.value})} maxLength={400} placeholder="Detalles que quieras recordar"/></div>
      {e.id&&<div className="row spread" style={{marginTop:16}}><div className="caption">Editar una actividad recurrente modifica su programación general. Los cambios de ±15 min en el calendario afectan solo al día elegido.</div><Btn kind="danger" tiny onClick={()=>this.deleteEvent(e)}><Icon name="trash" size={14}/> Eliminar</Btn></div>}
    </>;
  }
  progressForm():any{
    const g=this.state.data.goals.find(x=>x.id===this.state.progressGoalId);if(!g)return null;
    return <><div className="notice">{g.title} · Valor actual: {g.current} {g.unit}{g.target>0?' · Objetivo: '+g.target+' '+g.unit:''}</div><div className="field" style={{marginTop:18}}><label>Nuevo resultado</label><input type="number" step="any" min="0" value={this.state.progressValue} onChange={e=>this.setState({progressValue:e.target.value})}/></div><div className="field"><label>Nota del registro (opcional)</label><textarea value={this.state.progressNote} onChange={e=>this.setState({progressNote:e.target.value})} placeholder="¿Qué cambió desde el registro anterior?"/></div><p className="caption">El resultado se guarda en el historial de la meta con la fecha de hoy.</p></>;
  }
  executeForm():any{
    const date=this.state.selectedDate,e=this.state.data.events.find(x=>x.id===this.state.activeEventId);if(!e)return null;
    const r=this.state.data.routines.find(x=>x.id===e.routineId);if(!r)return <p>La rutina ya no está disponible.</p>;
    const log=this.state.data.logs[key(e,date)]||{completed:false,checkedSteps:[]};
    return <><div className="notice"><strong>{e.title}</strong> · {fmtDate(date)} a las {eventTime(e,date)}. Los pasos marcados se guardan únicamente para esta ejecución.</div><div style={{marginTop:15}}>{r.steps.map((s,i)=><div className="routine-step" key={s.id}><button className={`check-circle ${log.checkedSteps.includes(s.id)?'checked':''}`} onClick={()=>this.toggleStep(e,date,s.id)} aria-label={'Marcar '+s.title}>{log.checkedSteps.includes(s.id)&&<Icon name="check" size={13}/>}</button><div className="flex"><div className="agenda-name" style={{textDecoration:log.checkedSteps.includes(s.id)?'line-through':'none'}}>{i+1}. {s.title}</div><div className="agenda-sub">{s.min} min estimados</div></div></div>)}</div><div className="divider"/><div className="row spread"><span className="caption">{log.checkedSteps.length} / {r.steps.length} pasos completados</span>{log.completed&&<span className="small-tag">Actividad completada</span>}</div></>;
  }
  render():any{
    const title:{[K in Page]:string}={inicio:'Inicio',metas:'Metas',rutinas:'Rutinas',calendario:'Calendario',progreso:'Progreso',ajustes:'Ajustes'};
    return <div className="app-shell">{this.renderSidebar()}<main className="main"><header className="topbar"><div className="crumb"><Icon name="sprout" size={16}/><span>Mi espacio</span><span>/</span><strong>{title[this.state.page]}</strong></div><div className="top-right"><span className="pill"><span className="dot"/> Datos locales</span><button className="icon-btn" onClick={()=>this.route('ajustes')} title="Respaldos y ajustes"><Icon name="settings"/></button></div></header>
      <div className="content">{this.state.page==='inicio'?this.renderHome():this.state.page==='metas'?this.renderGoals():this.state.page==='rutinas'?this.renderRoutines():this.state.page==='calendario'?this.renderCalendar():this.state.page==='progreso'?this.renderProgress():this.renderSettings()}</div></main>{this.renderModal()}{this.state.toast&&<div className="toast" role="status" onClick={()=>this.setState({toast:''})}>{this.state.toast} <span style={{marginLeft:9,opacity:.65,cursor:'pointer'}}>×</span></div>}</div>;
  }
}
ReactDOM.render(<Planner/>,document.getElementById('app'));