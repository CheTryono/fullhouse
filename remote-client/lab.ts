import {connectFirebase} from '../auth/firebase';
import {RemoteSession,PROJECT} from './session';
import {emulatorApi} from './transport';
import {plannerPort} from './planner-port';
const host=location.hostname;
if(!['127.0.0.1','localhost','[::1]'].includes(host))throw Error('El laboratorio no se sirve fuera de loopback.');
const root=document.getElementById('workspace')!,status=document.getElementById('remote-status')!,login=document.getElementById('login') as HTMLFormElement;
const message=document.getElementById('message')!,leases=new Map<string,Lease>();
const access=connectFirebase({firebase:{apiKey:'demo-key',authDomain:PROJECT+'.firebaseapp.com',projectId:PROJECT,appId:'demo-fullhouse-remote-web'},emulatorUrl:'http://127.0.0.1:9098'});
// Laboratory fault injection only; this bundle is never included in public builds.
export async function simulateSessionLoss(){await (await access).logout();}
type Port=Awaited<typeof access>;
interface Lease {uid:string;frame:HTMLIFrameElement;session:RemoteSession;planner:any;tasks:number;resolvers:Array<()=>void>;loaded:boolean;revisionDraft:string}
let port:Port,current:Lease|null=null,epoch=0,uiBusy=false;
const valid=(lease:Lease)=>current===lease&&port.user?.uid===lease.uid&&port.user.emailVerified===true;
function button(text:string,run:()=>void,disabled=false){const b=document.createElement('button');b.type='button';b.className='btn secondary';b.textContent=text;b.disabled=disabled;b.onclick=run;return b;}
function download(name:string,raw:string){const a=document.createElement('a'),url=URL.createObjectURL(new Blob([raw],{type:'application/json'}));a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);}
async function act(run:()=>Promise<void>){if(uiBusy)return;uiBusy=true;message.textContent='';render();try{await run();}catch(e){message.textContent=(e as Error).message;}finally{uiBusy=false;render();}}
function mount(lease:Lease){if(!lease.loaded&&lease.session.ready){lease.loaded=true;lease.frame.src='/planner.html';root.append(lease.frame);}}
function refreshPlanner(lease:Lease){if(lease.planner&&!lease.planner.hasUnsavedChanges()){lease.planner.close(true);lease.planner.retryLocalLoad();}}
async function confirm(lease:Lease,title:string,text:string,label:string){if(!lease.planner)return false;const answer=lease.planner.askConfirm(title,text,label);lease.frame.inert=false;try{return await answer;}finally{render();}}
function render(){
  status.replaceChildren();
  for(const lease of leases.values()){lease.frame.hidden=!valid(lease);lease.frame.inert=!valid(lease)||lease.session.hasPending||lease.tasks>0;}
  if(!current)return;
  const lease=current,s=lease.session;mount(lease);
  const title=document.createElement('strong');title.textContent='Estado remoto: '+({pending:'Pendiente',confirming:'Confirmando',confirmed:'Confirmado',error:'Error',conflict:'Conflicto'}[s.phase]);title.dataset.phase=s.phase;
  const detail=document.createElement('p');detail.textContent=s.message;
  const revision=document.createElement('p');revision.textContent='Última revisión confirmada conocida: '+(s.confirmed?.revisionId||'ninguna');
  status.append(title,detail,revision);
  if(s.pending){const op=document.createElement('p');op.textContent='Candidato: '+s.pending.operationId;op.dataset.operation=s.pending.operationId;status.append(op);}
  const disabled=uiBusy||s.busy||s.phase==='confirming'||lease.tasks>0;
  status.append(button('Reintentar / inspeccionar recibo',()=>{void act(()=>s.retry());},disabled||!s.pending));
  status.append(button('Exportar candidato v1',()=>{try{download('fullhouse-candidato-v1.json',s.exportCandidate());}catch(e){message.textContent=(e as Error).message;}},!s.pending));
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
}
(window as any).fullhouseWorkspaceFor=(child:Window)=>{
  const lease=current;if(!lease||lease.frame.contentWindow!==child||!valid(lease))return null;
  return plannerPort(lease.session,localStorage,()=>valid(lease),planner=>{if(lease.planner)return;lease.planner=planner;const photo=planner.saveEvidence;planner.saveEvidence=async(...args:any[])=>{if(!valid(lease)||lease.session.blocked())return;lease.tasks++;render();try{await photo(...args);}finally{lease.tasks--;render();}};render();},()=>valid(lease)?Promise.resolve():new Promise<void>(resolve=>lease.resolvers.push(resolve)));
};
login.onsubmit=event=>{event.preventDefault();const email=(document.getElementById('email') as HTMLInputElement).value,password=(document.getElementById('password') as HTMLInputElement).value;void act(async()=>{const auth=await access;await auth.login(email,password);});};
document.getElementById('logout')!.onclick=()=>{void act(async()=>{if(current&&(current.session.hasPending||current.tasks||current.planner?.hasUnsavedChanges()))throw Error('Conserva y resuelve los candidatos, fotos y borradores antes de salir.');await port.logout();});};
window.addEventListener('beforeunload',e=>{if([...leases.values()].some(l=>l.session.hasPending||l.tasks||l.planner?.hasUnsavedChanges())){e.preventDefault();e.returnValue='';}});
void access.then(value=>{
  port=value;port.watch(user=>{
    const token=++epoch;current=null;for(const l of leases.values()){l.frame.hidden=true;l.frame.inert=true;if(l.uid!==user?.uid&&!l.session.hasPending&&!l.tasks&&!l.planner?.hasUnsavedChanges()){l.frame.remove();leases.delete(l.uid);}}login.hidden=!!user?.emailVerified;status.replaceChildren();
    if(!user?.emailVerified){message.textContent=user?'Verifica el correo en el emulador antes de abrir el planificador.':'Accede con una cuenta sintética verificada del emulador.';return;}
    let lease=leases.get(user.uid);
    if(lease){current=lease;for(const resolve of lease.resolvers.splice(0))resolve();render();return;}
    const frame=document.createElement('iframe');frame.className='planner-frame';frame.title='Planificador remoto de laboratorio';frame.hidden=true;
    lease={uid:user.uid,frame,planner:null,tasks:0,resolvers:[],loaded:false,revisionDraft:'',session:null as unknown as RemoteSession};
    const owned=lease;
    lease.session=new RemoteSession(user.uid,localStorage,emulatorApi(PROJECT,host,()=>port.user,user.uid),()=>valid(owned));leases.set(user.uid,lease);current=lease;
    lease.session.onChange(()=>{if(valid(owned))render();});
    void lease.session.open().then(()=>{if(token===epoch&&valid(owned)){mount(owned);render();}});
  },()=>{current=null;render();message.textContent='No pudimos comprobar la sesión; los borradores anteriores siguen aislados.';});
}).catch(()=>{message.textContent='No pudimos iniciar el laboratorio. Comprueba los emuladores locales.';});
