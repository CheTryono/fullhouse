import {validData} from '../remote/v1-validator.cjs';
export const PROJECT='demo-fullhouse-remote';
export type Phase='pending'|'confirming'|'confirmed'|'error'|'conflict';
export interface Revision {revisionId:string;backup:string;backupHash:string}
export interface Receipt {operationId:string;revisionId:string;sequence:number;baseRevision:string|null;backupHash:string}
export interface Pending {kind:'save'|'restore';operationId:string;baseRevision:string|null;backup:string;restoreRevision?:string}
interface Journal {format:1;project:string;uid:string;confirmed:Revision|null;pending:Pending}
export interface RemoteApi {
  read(id:string|null):Promise<Revision|null>;
  inspect(id:string):Promise<Receipt|null>;
  save(data:{operationId:string;baseRevision:string|null;backup:string}):Promise<Receipt>;
  restore(data:{operationId:string;baseRevision:string|null;restoreRevision:string}):Promise<Receipt>;
}
type Store=Pick<Storage,'getItem'|'setItem'|'removeItem'|'key'|'length'>;
const empty=JSON.stringify({version:1,goals:[],routines:[],events:[],logs:{}});
const id=(value:unknown):value is string=>typeof value==='string'&&/^[A-Za-z0-9_-]{16,80}$/.test(value);
export function canonical(raw:string):string {
  if(typeof raw!=='string'||new TextEncoder().encode(raw).length>8*1024*1024)throw Error('El candidato supera el límite de 8 MiB. Exporta una copia.');
  const value=JSON.parse(raw);if(!validData(value))throw Error('El documento no es un respaldo v1 válido.');return JSON.stringify(value);
}
export async function digest(raw:string):Promise<string>{const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw));return Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('');}
export class RemoteSession {
  phase:Phase='pending';message='Consultando la cuenta…';confirmed:Revision|null=null;observed:Revision|null=null;pending:Pending|null=null;ready=false;
  private prefix:string;private flight:Promise<void>|null=null;private resolving=false;private opening=false;private listeners=new Set<()=>void>();
  constructor(readonly uid:string,private store:Store,private api:RemoteApi,private active:()=>boolean,private makeId=()=>crypto.randomUUID(),project=PROJECT){
    if(project!==PROJECT||!/^[A-Za-z0-9_-]{1,128}$/.test(uid))throw Error('Solo se permite el laboratorio demo por UID.');
    this.prefix='fullhouse-remote-lab-v1:'+project+':'+uid+':';
  }
  onChange(fn:()=>void){this.listeners.add(fn);return()=>this.listeners.delete(fn);}
  private emit(){for(const fn of this.listeners)fn();}
  private requireActive(){if(!this.active())throw Object.assign(Error('La sesión cambió. El candidato sigue perteneciendo a su cuenta original.'),{code:'session-changed'});}
  private key(op:string){return this.prefix+'pending:'+op;}
  private async checkRevision(value:Revision|null):Promise<Revision|null>{
    if(!value)return null;
    if(!id(value.revisionId)||canonical(value.backup)!==value.backup||await digest(value.backup)!==value.backupHash)throw Error('La revisión no supera la comprobación de integridad.');
    return {...value};
  }
  listPending():string[]{
    this.requireActive();const result:string[]=[];
    for(let n=0;n<this.store.length;n++){const key=this.store.key(n);if(key?.startsWith(this.prefix+'pending:')){const op=key.slice((this.prefix+'pending:').length);if(!id(op))throw Error('Hay una identidad local incompatible. Conserva los originales.');result.push(op);}}
    return result.sort(); // Sorting is for presentation, never authority/selection.
  }
  private load(op:string):Journal {
    const raw=this.store.getItem(this.key(op));if(raw===null)throw Error('No encontramos el candidato solicitado.');
    const j=JSON.parse(raw) as Journal,p=j.pending;
    if(j.format!==1||j.project!==PROJECT||j.uid!==this.uid||!p||p.operationId!==op||!id(op)||!['save','restore'].includes(p.kind)||!(p.baseRevision===null||id(p.baseRevision))||p.baseRevision!==(j.confirmed?.revisionId||null)||(p.kind==='restore'&&!id(p.restoreRevision)))throw Error('El candidato local no pertenece a esta cuenta/base.');
    if(canonical(p.backup)!==p.backup)throw Error('El candidato local fue alterado.');
    return j;
  }
  async open(selected?:string):Promise<void>{
    this.requireActive();if(this.pending||this.busy)throw Error('Resuelve el candidato abierto antes de cargar otro.');this.opening=true;
    try{
      const ids=this.listPending();
      if(selected&&!ids.includes(selected))throw Error('El candidato seleccionado no existe.');
      if(ids.length>1&&!selected){this.phase='conflict';this.message='Hay varios candidatos locales. Elige uno por su identidad; conservaremos todos.';return;}
      if(selected||ids.length===1){const j=this.load(selected||ids[0]);this.confirmed=await this.checkRevision(j.confirmed);this.requireActive();this.pending={...j.pending};this.ready=true;}
      const latest=await this.checkRevision(await this.api.read(null));this.requireActive();this.observed=latest;
      if(this.pending){this.phase=(latest?.revisionId||null)===this.pending.baseRevision?'pending':'conflict';this.message='Candidato recuperado. Inspecciona y reintenta para comprobar si llegó al servidor.';}
      else{this.confirmed=latest;this.ready=true;this.phase='confirmed';this.message=latest?'Revisión recibida y verificada.':'Cuenta vacía comprobada en el servidor.';}
    }catch(e){this.phase='error';this.message='No pudimos abrir la cuenta. No se han sustituido datos por ejemplos.';}
    finally{this.opening=false;this.emit();}
  }
  get workingRaw(){return this.pending?.backup||this.confirmed?.backup||empty;}
  get hasPending(){return !!this.pending||!!this.flight||this.resolving;}
  get busy(){return !!this.flight||this.resolving||this.opening;}
  blocked():string{return !this.active()?'La sesión está inactiva; vuelve a tu cuenta.':!this.ready?'La cuenta aún no está comprobada.':this.hasPending?'Resuelve el candidato pendiente desde el panel remoto antes de guardar otra acción.':'';}
  stage(raw:string,kind:'save'|'restore'='save',restoreRevision?:string):void{
    this.requireActive();const issue=this.blocked();if(issue)throw Error(issue);
    const operationId=this.makeId();if(!id(operationId))throw Error('Identidad de operación incompatible.');
    const pending:Pending={kind,operationId,baseRevision:this.confirmed?.revisionId||null,backup:canonical(raw),...(kind==='restore'?{restoreRevision}: {})};
    if(kind==='restore'&&!id(restoreRevision))throw Error('Revisión de restauración incompatible.');
    if(this.store.getItem(this.key(operationId))!==null)throw Error('La identidad ya pertenece a otro candidato.');
    const journal:Journal={format:1,project:PROJECT,uid:this.uid,confirmed:this.confirmed,pending};
    this.store.setItem(this.key(operationId),JSON.stringify(journal)); // Durable local candidate BEFORE any request.
    this.pending=pending;this.phase='pending';this.message='Candidato conservado en este navegador; pendiente de confirmación remota.';this.emit();
  }
  retry():Promise<void>{
    if(this.resolving||this.opening)return Promise.reject(Error('Espera a que termine la recuperación o carga.'));
    if(this.flight)return this.flight;
    this.flight=this.send().finally(()=>{this.flight=null;this.emit();});return this.flight;
  }
  private async send():Promise<void>{
    const p=this.pending;if(!p)return;
    try{
      this.requireActive();this.phase='confirming';this.message='Comprobando recibo y confirmando con el servidor…';this.emit();
      const expected=await digest(p.backup);this.requireActive();
      let receipt=await this.api.inspect(p.operationId);this.requireActive();
      if(!receipt){receipt=p.kind==='restore'?await this.api.restore({operationId:p.operationId,baseRevision:p.baseRevision,restoreRevision:p.restoreRevision!}):await this.api.save({operationId:p.operationId,baseRevision:p.baseRevision,backup:p.backup});this.requireActive();}
      if(receipt.operationId!==p.operationId||receipt.revisionId!==p.operationId||receipt.baseRevision!==p.baseRevision||!Number.isSafeInteger(receipt.sequence)||receipt.sequence<1||receipt.backupHash!==expected)throw Error('El recibo no corresponde al candidato enviado.');
      // Storage failure here is uncertain locally, not a remote rollback.
      this.store.removeItem(this.key(p.operationId));
      this.confirmed={revisionId:receipt.revisionId,backup:p.backup,backupHash:expected};this.pending=null;this.phase='confirmed';this.message='Guardado confirmado por el servidor y huella verificada.';
    }catch(e){const code=(e as {code?:string}).code;this.phase=code==='failed-precondition'||code==='already-exists'?'conflict':'error';this.message=this.phase==='conflict'?'Otra revisión entró en conflicto. Tu candidato sigue intacto; no se sobrescribió automáticamente.':'Confirmación no disponible. El commit podría existir: el reintento inspeccionará el recibo y conservará el mismo ID.';}
    this.emit();
  }
  async preview(revisionId:string):Promise<Revision>{this.requireActive();if(!id(revisionId))throw Error('Identidad de revisión inválida.');const r=await this.checkRevision(await this.api.read(revisionId));this.requireActive();if(!r||r.revisionId!==revisionId)throw Error('No se encontró esa revisión propia.');return r;}
  async restore(revisionId:string,consent:boolean):Promise<void>{if(!consent)throw Error('La restauración requiere confirmación explícita.');if(this.blocked())throw Error(this.blocked());this.resolving=true;try{const r=await this.preview(revisionId);this.resolving=false;this.stage(r.backup,'restore',revisionId);}finally{this.resolving=false;this.emit();}}
  async useServer(consent:boolean):Promise<void>{
    this.requireActive();if(!consent||this.busy)throw Error('Confirma la recuperación cuando no haya peticiones en curso.');this.resolving=true;
    try{const latest=await this.checkRevision(await this.api.read(null));this.requireActive();
    if(this.pending){const key=this.key(this.pending.operationId),raw=this.store.getItem(key);if(raw===null)throw Error('Falta la copia local del candidato.');const archive=this.prefix+'recovery:'+this.pending.operationId,old=this.store.getItem(archive);if(old!==null&&old!==raw)throw Error('La copia de recuperación no coincide.');this.store.setItem(archive,raw);this.store.removeItem(key);}
    this.confirmed=latest;this.observed=latest;this.pending=null;this.ready=true;this.phase='confirmed';this.message='Versión del servidor cargada por tu indicación. El candidato anterior conserva su copia de recuperación.';
    }finally{this.resolving=false;this.emit();}
  }
  exportCandidate():string{this.requireActive();if(!this.pending)throw Error('No hay candidato pendiente.');return this.pending.backup;}
  exportOriginal(op:string):string{this.requireActive();if(!id(op))throw Error('Identidad incompatible.');const raw=this.store.getItem(this.key(op));if(raw===null)throw Error('Candidato no encontrado.');return raw;}
  listRecoveries():string[]{this.requireActive();const result:string[]=[];for(let n=0;n<this.store.length;n++){const key=this.store.key(n);if(key?.startsWith(this.prefix+'recovery:')){const op=key.slice((this.prefix+'recovery:').length);if(id(op))result.push(op);}}return result.sort();}
  exportRecovery(op:string):string{this.requireActive();if(!id(op))throw Error('Copia incompatible.');const raw=this.store.getItem(this.prefix+'recovery:'+op);if(!raw)throw Error('Copia no encontrada.');const j=JSON.parse(raw) as Journal;if(j.format!==1||j.uid!==this.uid||j.project!==PROJECT||j.pending.operationId!==op)throw Error('Copia de otra identidad.');return canonical(j.pending.backup);}
}
