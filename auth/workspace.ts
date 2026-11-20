// Local account separation only; no remote data, migration or v2 history.
export interface SessionUser {uid:string;email:string|null;emailVerified:boolean}
export interface Planner {hasUnsavedChanges():boolean;notice(message:string):void;saveEvidence?:(...args:any[])=>Promise<void>}
export function accountStorage(source:Pick<Storage,'getItem'|'setItem'>,project:string,uid:string,active:()=>boolean){
  if(!project||!uid)throw Error('Se requiere proyecto y usuario');
  const prefix='fullhouse-account-local-v1:'+encodeURIComponent(project)+':'+encodeURIComponent(uid)+':';
  const key=(name:string)=>{if(!active())throw new DOMException('Sesión del planificador inactiva','SecurityError');if(name==='botanica-planificador-v01')throw new DOMException('No se consulta el alias local en una cuenta','SecurityError');return prefix+encodeURIComponent(name);};
  return Object.freeze({getItem:(name:string)=>source.getItem(key(name)),setItem:(name:string,value:string)=>source.setItem(key(name),value)});
}
interface Lease {uid:string;active:boolean;tasks:number;frame:HTMLIFrameElement;planner:Planner|null;workspace:{storage:ReturnType<typeof accountStorage>;registerPlanner:(planner:Planner)=>void}}
export function createWorkspaceManager(root:HTMLElement,project:string,currentUser:()=>SessionUser|null,source:Pick<Storage,'getItem'|'setItem'>){
  let active:Lease|null=null,held:Lease|null=null;
  const dirty=(lease:Lease)=>lease.tasks>0||!!lease.planner?.hasUnsavedChanges();
  const valid=(lease:Lease)=>lease===active&&lease.active&&lease.frame.isConnected&&currentUser()?.uid===lease.uid&&currentUser()?.emailVerified===true;
  function session(user:SessionUser|null){
    if(active&&user?.uid===active.uid&&user.emailVerified)return 'open';
    if(active){const old=active;old.active=false;old.frame.hidden=true;old.frame.inert=true;active=null;if(dirty(old))held=old;else old.frame.remove();}
    if(!user?.emailVerified)return 'closed';
    if(held){if(held.uid!==user.uid)return 'pending-other';active=held;held=null;active.active=true;active.frame.hidden=false;active.frame.inert=false;active.planner?.notice('Recuperamos los borradores de esta sesión. Revisa y guarda los cambios pendientes.');return 'recovered';}
    const frame=document.createElement('iframe');frame.title='Planificador de tu cuenta';frame.src='/planner.html';frame.className='planner-frame';
    const lease={} as Lease;Object.assign(lease,{uid:user.uid,active:true,tasks:0,frame,planner:null});
    lease.workspace=Object.freeze({storage:accountStorage(source,project,user.uid,()=>valid(lease)),registerPlanner:(planner:Planner)=>{if(!valid(lease)||lease.planner)return;lease.planner=planner;if(planner.saveEvidence){const savePhoto=planner.saveEvidence;planner.saveEvidence=async(...args:any[])=>{if(!valid(lease)){planner.notice('La sesión cambió; vuelve a entrar antes de añadir la foto.');return;}lease.tasks++;try{await savePhoto(...args);}finally{lease.tasks--;}};}}});
    active=lease;root.append(frame);return 'open';
  }
  return {session,workspaceFor(child:Window){return active?.frame.contentWindow===child&&valid(active)?active.workspace:null;},canLogout(){if(active&&dirty(active)){active.planner?.notice('Guarda o exporta y resuelve los cambios pendientes antes de cerrar la sesión.');return false;}return true;},hasUnsaved(){return !!held||!!active&&dirty(active);},get heldUid(){return held?.uid||null;}};
}
