import {connectFirebase} from '../auth/firebase';
import {RemoteSession,PROJECT,JOURNAL_LIMIT,digest} from './session';
import {emulatorApi} from './transport';
import {plannerPort} from './planner-port';
import {DurableWorkStore,type DraftRow,type PhotoRow} from './durable-store';
import {DraftCheckpoints} from './drafts';
const host=location.hostname;
if(!['127.0.0.1','localhost','[::1]'].includes(host))throw Error('El laboratorio no se sirve fuera de loopback.');
const root=document.getElementById('workspace')!,status=document.getElementById('remote-status')!,login=document.getElementById('login') as HTMLFormElement;
const message=document.getElementById('message')!,leases=new Map<string,Lease>();
const access=connectFirebase({firebase:{apiKey:'demo-key',authDomain:PROJECT+'.firebaseapp.com',projectId:PROJECT,appId:'demo-fullhouse-remote-web'},emulatorUrl:'http://127.0.0.1:9098'});
// Laboratory fault injection only; this bundle is never included in public builds.
export async function simulateSessionLoss(){await (await access).logout();}
type Port=Awaited<typeof access>;
interface Lease {uid:string;frame:HTMLIFrameElement;session:RemoteSession;store:DurableWorkStore;drafts:DraftCheckpoints|null;draftRows:DraftRow[];photoRows:PhotoRow[];volatile:Map<string,{file:File;context:PhotoRow['context']}>;legacy:Array<{op:string;raw:string}>;legacyIssue:string;planner:any;tasks:number;resolvers:Array<()=>void>;loaded:boolean;revisionDraft:string;confirming:boolean}
let port:Port,current:Lease|null=null,epoch=0,uiBusy=false;
const valid=(lease:Lease)=>current===lease&&port.user?.uid===lease.uid&&port.user.emailVerified===true;
function button(text:string,run:()=>void,disabled=false){const b=document.createElement('button');b.type='button';b.className='btn secondary';b.textContent=text;b.disabled=disabled;b.onclick=run;return b;}
function download(name:string,raw:string){const a=document.createElement('a'),url=URL.createObjectURL(new Blob([raw],{type:'application/json'}));a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);}
function downloadPhoto(name:string,blob:Blob){const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);}
async function copies(lease:Lease){
  const prefix=lease.store.prefix+'pending:',legacy=[];
  lease.legacyIssue='';
  try{for(let n=0;n<localStorage.length;n++){const key=localStorage.key(n);if(!key?.startsWith(prefix))continue;const op=key.slice(prefix.length),raw=localStorage.getItem(key);if(raw===null)continue;const marker=lease.store.getItem(lease.store.prefix+'legacy:'+op);if(marker!==await digest(raw))legacy.push({op,raw});}lease.legacy=legacy;}
  catch{lease.legacyIssue='No pudimos inspeccionar las copias 3B anteriores. Las escrituras están bloqueadas; no borramos fuentes.';}
  lease.draftRows=await lease.drafts?.list()||[];lease.photoRows=await lease.store.photos();if(valid(lease))render();
}
const legacyBlocked=(l:Lease)=>l.legacyIssue||(l.legacy.length?'Hay candidatos 3B en localStorage. Exporta y copia explícitamente cada uno antes de continuar.':'');
async function act(run:()=>Promise<void>){if(uiBusy)return;uiBusy=true;message.textContent='';render();try{await run();}catch(e){message.textContent=(e as Error).message;}finally{uiBusy=false;render();}}
function mount(lease:Lease){if(!lease.loaded&&lease.session.ready){lease.loaded=true;lease.frame.src='/planner.html';root.append(lease.frame);}}
function refreshPlanner(lease:Lease){if(lease.planner&&!lease.planner.hasUnsavedChanges()){lease.planner.close(true);lease.planner.retryLocalLoad();}}
async function confirm(lease:Lease,title:string,text:string,label:string){if(!lease.planner)return false;lease.confirming=true;const answer=lease.planner.askConfirm(title,text,label);lease.frame.inert=false;try{return await answer;}finally{lease.confirming=false;render();}}
function render(){
  const recoveryOpen=status.querySelector('details')?.open||false;
  status.replaceChildren();
  for(const lease of leases.values()){lease.frame.hidden=!valid(lease);lease.frame.inert=!valid(lease)||(!lease.confirming&&(lease.session.hasPending||lease.tasks>0||!!legacyBlocked(lease)));}
  if(!current)return;
  const lease=current,s=lease.session;mount(lease);
  const title=document.createElement('strong');title.textContent='Estado remoto: '+({pending:'Pendiente',confirming:'Confirmando',confirmed:'Confirmado',error:'Error',conflict:'Conflicto'}[s.phase]);title.dataset.phase=s.phase;
  const detail=document.createElement('p');detail.textContent=s.message;
  const revision=document.createElement('p');revision.textContent='Última revisión confirmada conocida: '+(s.confirmed?.revisionId||'ninguna');
  status.append(title,detail,revision);
  if(s.pending){const op=document.createElement('p');op.textContent='Candidato: '+s.pending.operationId;op.dataset.operation=s.pending.operationId;status.append(op);}
  const local=document.createElement('p');local.dataset.local=s.pending?s.durability:'none';local.textContent='Copia local del candidato: '+(s.pending?{memory:'solo en memoria',writing:'escritura en curso; aún no confirmada',durable:'transacción IndexedDB confirmada; no equivale a guardado remoto',error:'falló: sigue en memoria, exporta antes de cerrar'}[s.durability]:'sin candidato');status.append(local);
  const disabled=uiBusy||s.busy||s.phase==='confirming'||lease.tasks>0;
  status.append(button('Reintentar / inspeccionar recibo',()=>{void act(()=>s.retry());},disabled||!s.pending));
  status.append(button('Exportar candidato v1',()=>{try{download('fullhouse-candidato-v1.json',s.exportCandidate());}catch(e){message.textContent=(e as Error).message;}},!s.pending));
  status.append(button('Exportar paquete pendiente',()=>{try{download('fullhouse-paquete-pendiente.json',s.exportPending());}catch(e){message.textContent=(e as Error).message;}},!s.pending));
  status.append(button('Usar versión del servidor',()=>{void act(async()=>{
    if(lease.planner?.hasUnsavedChanges())throw Error('Conserva primero los formularios y notas sin enviar; no los sustituiremos.');
    if(!await confirm(lease,'Cargar versión del servidor','Se conservará el candidato enviado en una copia local de recuperación. Esto no cancela peticiones que ya estén procesándose en el servidor ni sobrescribe sus datos. Exporta también tu candidato antes de continuar.','Cargar versión'))return;
    await s.useServer(true);refreshPlanner(lease);
  });},disabled));
  const input=document.createElement('input');input.id='revision-id';input.placeholder='ID de una revisión propia';input.setAttribute('aria-label','ID de revisión');input.value=lease.revisionDraft;input.oninput=()=>{lease.revisionDraft=input.value;};
  status.append(input,button('Consultar y exportar revisión',()=>{void act(async()=>{const r=await s.preview(input.value.trim());download('fullhouse-revision-v1.json',r.backup);});},disabled));
  status.append(button('Restaurar revisión',()=>{const id=input.value.trim();void act(async()=>{
    if(lease.planner?.hasUnsavedChanges())throw Error('Conserva primero los formularios o notas sin enviar.');
    if(!await confirm(lease,'Restaurar revisión','Crearemos una revisión nueva. Las revisiones anteriores seguirán disponibles.','Restaurar'))return;
    await s.restore(id,true);refreshPlanner(lease);await s.retry();
  });},disabled||s.hasPending));
  if(!s.ready){status.append(button('Reintentar carga',()=>{void act(()=>s.open());},uiBusy));for(const op of s.listPending()){status.append(button('Recuperar candidato '+op,()=>{void act(async()=>{await s.open(op);mount(lease);});},uiBusy));status.append(button('Exportar paquete local '+op,()=>{download('fullhouse-paquete-recuperacion.json',s.exportOriginal(op));}));}}
  for(const op of s.listRecoveries())status.append(button('Exportar candidato archivado '+op,()=>{download('fullhouse-recuperacion-candidato-v1.json',s.exportRecovery(op));}));
  const recovery=document.createElement('details'),summary=document.createElement('summary');recovery.open=recoveryOpen;summary.textContent='Recuperación local y borradores';recovery.append(summary);status.append(recovery);
  if(legacyBlocked(lease)){const p=document.createElement('p');p.textContent=legacyBlocked(lease);recovery.append(p);if(lease.legacy.length)recovery.open=true;}
  for(const item of lease.legacy){recovery.append(button('Exportar paquete anterior '+item.op,()=>download('fullhouse-paquete-3B.json',item.raw)));recovery.append(button('Copiar paquete anterior '+item.op,()=>{void act(async()=>{if(!await confirm(lease,'Copiar candidato anterior','Copiamos el paquete de esta cuenta a IndexedDB sin eliminar localStorage. No se enviará hasta que inspecciones el recibo.','Copiar'))return;await s.copyLegacy(item.op,item.raw,true);await copies(lease);refreshPlanner(lease);});},disabled||s.hasPending));}
  if(lease.drafts){const p=document.createElement('p');p.dataset.draft=lease.drafts.status;p.textContent=lease.drafts.message;recovery.append(p);
    recovery.append(button('Proteger borrador ahora',()=>{void act(()=>lease.drafts!.flush());}),button('Exportar borrador actual',()=>{void act(async()=>download('fullhouse-borrador-recuperacion.json',await lease.drafts!.exportCurrent()));}));
  }
  recovery.append(button('Consultar copias locales',()=>{void act(()=>copies(lease));}));
  const label=document.createElement('label'),file=document.createElement('input');label.textContent='Recuperar paquete pendiente de esta cuenta ';file.type='file';file.accept='.json,application/json';file.disabled=disabled||s.hasPending;file.onchange=()=>{const selected=file.files?.[0];if(!selected)return;void act(async()=>{if(selected.size>JOURNAL_LIMIT)throw Error('El paquete supera el límite de recuperación.');if(lease.planner?.hasUnsavedChanges())throw Error('Conserva primero los borradores abiertos.');const raw=await selected.text();if(!valid(lease))throw Error('La sesión cambió. Conserva el archivo.');if(!await confirm(lease,'Recuperar paquete pendiente','Solo admite el mismo proyecto y UID. Conserva su operación y base, sin enviarlo automáticamente ni sobrescribir el servidor. No es una importación de datos locales.','Recuperar paquete'))return;await s.recoverPacket(raw,true);refreshPlanner(lease);});};label.append(file);recovery.append(label);
  for(const row of lease.draftRows){
    const label=row.id+' / '+row.generation,p=document.createElement('p');p.textContent='Borrador '+label;recovery.append(p);
    recovery.append(button('Exportar borrador '+label,()=>download('fullhouse-borrador-recuperacion.json',row.raw)),button('Recuperar borrador '+label,()=>{void act(async()=>{if(!await confirm(lease,'Recuperar borrador','No lo enviaremos. Solo se recupera automáticamente si coinciden cuenta, base, datos, versión de interfaz y zona. Los campos numéricos sin confirmar y revisiones de otro día se mostrarán como texto para copia manual.','Recuperar'))return;const result=await lease.drafts!.restore(row,true);message.textContent=result.manual.length?'Texto para recuperar manualmente: '+result.manual.join('\n'):'Borrador recuperado; todavía sin enviar.';});},disabled||!lease.drafts||s.hasPending),button('Eliminar copia de borrador '+label,()=>{void act(async()=>{if(row.id===lease.drafts?.id)throw Error('La copia activa se actualiza automáticamente; no se elimina desde aquí.');if(await confirm(lease,'Eliminar copia local','Eliminará únicamente esta copia del borrador, no registros confirmados. Exporta primero si quieres conservarla.','Eliminar copia')){await lease.store.deleteDraft(row);await copies(lease);}});}));
  }
  for(const row of lease.photoRows){const p=document.createElement('p');p.textContent='Original fotográfico recuperable: '+row.name+' · '+row.context.eventId+' · '+row.context.date+' · '+row.size+' bytes. No acredita que esté adjunto a la actividad.';recovery.append(p,button('Descargar original '+row.id,()=>downloadPhoto(row.name,row.blob)));}
  for(const [id,item] of lease.volatile){const p=document.createElement('p');p.textContent='Foto solo en memoria: '+item.file.name+'. Descárgala antes de cerrar; no fue adjuntada.';recovery.append(p,button('Descargar foto pendiente '+id,()=>downloadPhoto(item.file.name,item.file)),button('Reintentar copia de foto '+id,()=>{void act(async()=>{await lease.store.savePhoto(id,item.context,item.file);lease.volatile.delete(id);await copies(lease);});}));}
  recovery.append(button('Consultar espacio del navegador',()=>{void act(async()=>{const estimate=await navigator.storage?.estimate?.();message.textContent=estimate?'Uso aproximado del origen: '+estimate.usage+' / '+estimate.quota+' bytes. No garantiza espacio para la próxima escritura.':'Estimación no disponible.';});}),button('Solicitar conservación del almacenamiento',()=>{void act(async()=>{const granted=await navigator.storage?.persist?.();message.textContent=granted?'El navegador concedió almacenamiento persistente; aún puedes perderlo al borrar el sitio o el perfil.':'El navegador no concedió persistencia. Conserva exportaciones externas.';});}));
}
(window as any).fullhouseWorkspaceFor=(child:Window)=>{
  const lease=current;if(!lease||lease.frame.contentWindow!==child||!valid(lease))return null;
  const workspace=plannerPort(lease.session,localStorage,()=>valid(lease),planner=>{
    if(lease.planner)return;lease.planner=planner;lease.drafts=new DraftCheckpoints(planner,lease.session,lease.store,(window as any).FullhouseLabBuild,lease.frame.contentDocument!);lease.drafts.onChange(()=>{if(valid(lease))render();});
    const photo=planner.saveEvidence;planner.saveEvidence=async(e:any,date:string,stepId:string,file:File)=>{
      if(!valid(lease)||lease.session.blocked()||legacyBlocked(lease))return;
      const id=crypto.randomUUID(),context={eventId:e.id,date,stepId,baseRevision:lease.session.confirmed?.revisionId||null};lease.volatile.set(id,{file,context});lease.tasks++;render();
      try{await lease.store.savePhoto(id,context,file);lease.volatile.delete(id);await copies(lease);if(!valid(lease))await new Promise<void>(resolve=>lease.resolvers.push(resolve));await photo(e,date,stepId,file);}
      catch{message.textContent='No se completó la foto. Conserva o descarga el original desde recuperación; no afirmamos que esté adjunta.';}
      finally{lease.tasks--;render();}
    };
    void copies(lease).catch(()=>{message.textContent='No pudimos consultar las copias locales.';});render();
  },()=>valid(lease)?Promise.resolve():new Promise<void>(resolve=>lease.resolvers.push(resolve)));
  return {...workspace,storage:{...workspace.storage,setItem:(name:string,value:string)=>{if(name==='fullhouse-v01'&&legacyBlocked(lease))throw Error(legacyBlocked(lease));workspace.storage.setItem(name,value);}},persistence:{...workspace.persistence,blocked:()=>legacyBlocked(lease)||workspace.persistence.blocked()}};
};
login.onsubmit=event=>{event.preventDefault();const email=(document.getElementById('email') as HTMLInputElement).value,password=(document.getElementById('password') as HTMLInputElement).value;void act(async()=>{const auth=await access;await auth.login(email,password);});};
document.getElementById('logout')!.onclick=()=>{void act(async()=>{if(current){if(current.session.hasPending||current.tasks||current.volatile.size||current.planner?.hasUnsavedChanges())throw Error('Conserva y resuelve los candidatos, fotos y borradores antes de salir.');await current.drafts?.flush();if(current.drafts?.unprotected)throw Error('No se confirmó la copia local; expórtala antes de salir.');}await port.logout();});};
window.addEventListener('beforeunload',e=>{if([...leases.values()].some(l=>l.session.hasPending||l.tasks||l.volatile.size||l.drafts?.unprotected||l.planner?.hasUnsavedChanges())){e.preventDefault();e.returnValue='';}});
const flush=()=>{for(const l of leases.values())void l.drafts?.flush();};window.addEventListener('pagehide',flush);document.addEventListener('visibilitychange',()=>{if(document.hidden)flush();});
void access.then(value=>{
  port=value;port.watch(user=>{
    const token=++epoch;current=null;for(const l of leases.values()){l.frame.hidden=true;l.frame.inert=true;/* Keep leases until page close: timers and IDB operations may still own work. */}login.hidden=!!user?.emailVerified;status.replaceChildren();
    if(!user?.emailVerified){message.textContent=user?'Verifica el correo en el emulador antes de abrir el planificador.':'Accede con una cuenta sintética verificada del emulador.';return;}
    let lease=leases.get(user.uid);
    if(lease){current=lease;for(const resolve of lease.resolvers.splice(0))resolve();render();return;}
    const frame=document.createElement('iframe');frame.className='planner-frame';frame.title='Planificador remoto de laboratorio';frame.hidden=true;
    lease={uid:user.uid,frame,planner:null,tasks:0,resolvers:[],loaded:false,revisionDraft:'',confirming:false,session:null as unknown as RemoteSession,store:new DurableWorkStore(user.uid),drafts:null,draftRows:[],photoRows:[],volatile:new Map(),legacy:[],legacyIssue:'Comprobando las copias locales anteriores…'};
    const owned=lease;
    lease.session=new RemoteSession(user.uid,lease.store,emulatorApi(PROJECT,host,()=>port.user,user.uid),()=>valid(owned));leases.set(user.uid,lease);current=lease;
    lease.session.onChange(()=>{if(valid(owned))render();});
    void lease.session.open().then(async()=>{await copies(owned);if(token===epoch&&valid(owned)){mount(owned);render();}}).catch(()=>{if(valid(owned)){message.textContent='No se pudo abrir IndexedDB; no se habilitan escrituras. Conservamos las fuentes.';render();}});
  },()=>{current=null;render();message.textContent='No pudimos comprobar la sesión; los borradores anteriores siguen aislados.';});
}).catch(()=>{message.textContent='No pudimos iniciar el laboratorio. Comprueba los emuladores locales.';});
