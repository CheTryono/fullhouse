import {PROJECT,digest,canonical,RemoteSession} from './session';
import {DurableWorkStore,type DraftRow} from './durable-store';
const fields=['page','selectedDate','month','modal','goalDraft','routineDraft','eventDraft','activeEventId','detailPath','progressValue','progressNote','progressStatus','progressGoalId','reviewDraft','evidenceCaption','returnToSchedule','scheduleContextNote'] as const;
interface Snapshot {format:'fullhouse-local-draft-v1';project:string;uid:string;build:string;zone:string;day:string;baseRevision:string|null;candidateId:string|null;workingHash:string;hasWork:boolean;state:Record<string,any>;notes:[string,string][];initialDraft:string;pendingSchedule:unknown;pendingScheduleBaseline:string;numericEdits:Array<{index:number;label:string;value:string;committed:string}>;localPending:unknown}
const civil=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');};
export class DraftCheckpoints {
  readonly id=crypto.randomUUID();status:'pending'|'writing'|'protected'|'error'='pending';message='Comprobando borradores…';
  private generation=0;private serial=0;private ack=-1;private timer:ReturnType<typeof setTimeout>|null=null;private flight:Promise<void>|null=null;private last='';private dataRaw='';private dataHash='';private listeners=new Set<()=>void>();
  constructor(private planner:any,private session:RemoteSession,private store:DurableWorkStore,private build:string,private doc?:Document,private day= civil,private zone=Intl.DateTimeFormat().resolvedOptions().timeZone){
    const set=planner.setState.bind(planner);planner.setState=(patch:any,callback?:()=>void)=>set(patch,()=>{try{callback?.();}finally{this.queue();}});
    const note=planner.noteProps?.bind(planner);if(note)planner.noteProps=(...args:any[])=>{const props=note(...args),change=props.onDraft;return {...props,onDraft:(value:string|undefined)=>{change(value);this.queue();}};};
    doc?.addEventListener('input',()=>this.queue(),true);doc?.addEventListener('change',()=>this.queue(),true);
    session.onChange(()=>this.queue());this.queue();
  }
  onChange(fn:()=>void){this.listeners.add(fn);return()=>this.listeners.delete(fn);}
  private emit(){for(const fn of this.listeners)fn();}
  get unprotected(){return this.ack!==this.serial;}
  queue(){this.serial++;this.status='pending';this.message='Cambios recientes aún sin copia local confirmada.';if(this.timer)clearTimeout(this.timer);this.timer=setTimeout(()=>{this.timer=null;void this.flush();},200);this.emit();}
  private async capture():Promise<Snapshot>{
    const p=this.planner,s=p.state,raw=canonical(JSON.stringify(s.data));
    const edits=Array.from(this.doc?.querySelectorAll<HTMLInputElement>('input[data-committed-value]')||[]).flatMap((input,index)=>input.value!==input.getAttribute('data-committed-value')?[{index,label:input.getAttribute('aria-label')||input.name||'Campo numérico',value:input.value,committed:input.getAttribute('data-committed-value')||''}]:[]);
    const hasWork=!!p.hasUnsavedChanges()||edits.length>0;
    // Capture one synchronous view before hashing. A later edit schedules another checkpoint.
    const snapshot=JSON.parse(JSON.stringify({format:'fullhouse-local-draft-v1',project:PROJECT,uid:this.session.uid,build:this.build,zone:this.zone,day:this.day(),baseRevision:this.session.confirmed?.revisionId||null,candidateId:this.session.pending?.operationId||null,workingHash:'',hasWork,state:hasWork?Object.fromEntries(fields.map(k=>[k,s[k]])): {},notes:hasWork?Array.from(p.noteDrafts.entries()):[],initialDraft:hasWork?p.initialDraft:'',pendingSchedule:hasWork?p.pendingSchedule:null,pendingScheduleBaseline:hasWork?p.pendingScheduleBaseline:'',numericEdits:hasWork?edits:[],localPending:hasWork?s.pending:null})) as Snapshot;
    if(raw!==this.dataRaw){this.dataHash=await digest(raw);this.dataRaw=raw;}snapshot.workingHash=this.dataHash;return snapshot;
  }
  flush():Promise<void>{
    if(this.timer){clearTimeout(this.timer);this.timer=null;}if(this.flight)return this.flight;
    this.flight=this.write().finally(()=>{this.flight=null;if(this.ack!==this.serial&&this.status!=='error'&&!(this.session.pending&&this.session.durability!=='durable'))this.queue();});return this.flight;
  }
  private async write(){
    const wanted=this.serial;
    try{
      const snapshot=await this.capture();
      // A cleared form is not proof that its candidate reached IndexedDB yet.
      if(!snapshot.hasWork&&this.session.pending&&this.session.durability!=='durable'){this.status='pending';this.message='Conservamos el borrador previo mientras se confirma el candidato local.';this.emit();return;}
      const raw=JSON.stringify(snapshot);if(new TextEncoder().encode(raw).length>8*1024*1024)throw Error('El borrador supera el límite de copia local.');
      if(raw!==this.last){this.status='writing';this.message='Guardando copia local del borrador…';this.emit();const saved=await this.store.saveDraft(this.id,this.generation,raw);this.generation=saved.generation;this.last=raw;}
      this.ack=wanted;this.status=this.ack===this.serial?'protected':'pending';this.message=this.status==='protected'?'Último borrador confirmado en IndexedDB; no enviado al servidor.':'Hay cambios más recientes aún por proteger.';
    }catch{this.status='error';this.message='No pudimos confirmar la copia del borrador. Mantén la página abierta y expórtalo.';}
    this.emit();
  }
  async list(){return (await this.store.drafts()).filter(row=>{try{return JSON.parse(row.raw).hasWork===true;}catch{return true;}});}
  async exportCurrent(){return JSON.stringify(await this.capture(),null,2);}
  async restore(row:DraftRow,consent:boolean):Promise<{manual:string[]}>{
    if(!consent||this.session.blocked()||this.planner.hasUnsavedChanges())throw Error('La recuperación requiere una sesión activa, confirmación y ningún trabajo abierto.');
    if(row.owner!==this.store.owner||await digest(row.raw)!==row.hash)throw Error('La copia no pertenece a esta cuenta o no coincide con su huella.');
    const snapshot=JSON.parse(row.raw) as Snapshot;
    if(snapshot.format!=='fullhouse-local-draft-v1'||snapshot.project!==PROJECT||snapshot.uid!==this.session.uid||snapshot.build!==this.build||snapshot.zone!==this.zone||!snapshot.hasWork||!snapshot.state||!Array.isArray(snapshot.notes)||snapshot.notes.some(x=>!Array.isArray(x)||x.length!==2||x.some(v=>typeof v!=='string')))throw Error('Copia incompatible; expórtala para revisión.');
    const currentRaw=canonical(JSON.stringify(this.planner.state.data)),hash=await digest(currentRaw),base=this.session.confirmed?.revisionId||null;
    if(this.session.blocked()||this.planner.hasUnsavedChanges()||canonical(JSON.stringify(this.planner.state.data))!==currentRaw)throw Error('La sesión o el trabajo cambió durante la recuperación. Conserva la copia.');
    if(hash!==snapshot.workingHash||!(snapshot.baseRevision===base||snapshot.candidateId===base))throw Error('La base o los datos cambiaron. No reasignaremos este borrador; conserva la exportación.');
    const state=Object.fromEntries(fields.filter(k=>Object.hasOwn(snapshot.state,k)).map(k=>[k,snapshot.state[k]])),manual=snapshot.numericEdits.map(x=>x.label+': '+x.value);
    if(snapshot.day!==this.day()&&state.reviewDraft){manual.push('Revisión de '+snapshot.day+': '+state.reviewDraft);state.reviewDraft=this.planner.state.data.dayReviews?.[this.day()]?.note||'';}
    this.planner.noteDrafts=new Map(snapshot.notes);this.planner.initialDraft=snapshot.initialDraft;this.planner.pendingSchedule=snapshot.pendingSchedule;this.planner.pendingScheduleBaseline=snapshot.pendingScheduleBaseline;
    await new Promise<void>(resolve=>this.planner.setState({...state,guideOpen:false},resolve));this.queue();return {manual};
  }
}
