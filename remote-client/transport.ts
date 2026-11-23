import type {RemoteApi} from './session';
import {PROJECT} from './session';
interface User {uid:string;emailVerified:boolean;getIdToken():Promise<string>}
export function emulatorApi(project:string,hostname:string,current:()=>User|null,uid:string,request:typeof fetch=fetch):RemoteApi {
  if(project!==PROJECT||!['localhost','127.0.0.1','[::1]'].includes(hostname))throw Error('La persistencia remota 3B solo funciona en el laboratorio demo local.');
  async function call(name:string,data:unknown){
    const owner=current();if(!owner||owner.uid!==uid||!owner.emailVerified)throw Object.assign(Error('Sesión inactiva'),{code:'session-changed'});
    const token=await owner.getIdToken();
    if(current()!==owner||current()?.uid!==uid||!current()?.emailVerified)throw Object.assign(Error('Sesión cambiada antes de enviar'),{code:'session-changed'});
    // Freeze this user's token. A later Auth switch must never send A's candidate with B's token.
    const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),30000);
    try{
      const response=await request(`http://127.0.0.1:5002/${PROJECT}/us-central1/${name}`,{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+token},body:JSON.stringify({data}),signal:abort.signal});
      const json=await response.json();
      if(current()!==owner||!current()?.emailVerified)throw Object.assign(Error('La respuesta pertenece a la sesión anterior'),{code:'session-changed'});
      if(json.error)throw Object.assign(Error('El servidor no confirmó la operación'),{code:String(json.error.status||'unknown').toLowerCase().replaceAll('_','-')});
      if(!response.ok||!Object.hasOwn(json,'result'))throw Error('Respuesta remota incompleta');
      return json.result;
    }finally{clearTimeout(timer);}
  }
  return {read:revisionId=>call('readRemoteV1',{revisionId}),inspect:operationId=>call('inspectRemoteV1',{operationId}),save:data=>call('saveRemoteV1',data),restore:data=>call('restoreRemoteV1',data)};
}
