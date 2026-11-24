import {RemoteSession} from './session';
export function plannerPort(session:RemoteSession,source:Pick<Storage,'getItem'|'setItem'>,active:()=>boolean,register:(planner:any)=>void,waitForSession:()=>Promise<void>=()=>Promise.resolve(),schedule:(task:()=>void)=>void=queueMicrotask){
  const check=()=>{if(!active())throw Error('La sesión del planificador está inactiva.');};
  const preference=(name:string)=>{if(name==='botanica-planificador-v01')throw Error('No se importa el alias local en una cuenta.');return session.preferencePrefix+session.project+':'+session.uid+':'+name;};
  return Object.freeze({
    storage:{getItem(name:string){check();if(name==='fullhouse-v01'){if(!session.ready)throw Error('La carga remota no está comprobada.');return session.workingRaw;}return source.getItem(preference(name));},setItem(name:string,value:string){check();if(name==='fullhouse-v01'){session.stage(value);schedule(()=>{void session.retry();});}else source.setItem(preference(name),value);}},
    persistence:{blocked:()=>session.blocked(),hasPending:()=>session.hasPending,queuedMessage:'Cambios pendientes de confirmación remota. Consulta el estado de la copia local antes de cerrar.',waitForSession},
    registerPlanner(planner:any){check();if(planner)register(planner);}
  });
}
