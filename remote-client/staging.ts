// Preparatory adapter only. Not imported by either public Hosting build.
import {stagingScope,type StagingConfig} from './environment';
import {RemoteSession,type RemoteApi} from './session';
import {DurableWorkStore} from './durable-store';
interface User {uid:string;emailVerified:boolean;getIdTokenResult():Promise<{token:string;claims:{aud?:unknown;iss?:unknown;sub?:unknown}}>}
export function stagingWorkspace(config:StagingConfig,origin:string,uid:string,current:()=>User|null,appCheck:()=>Promise<string>,factory?:IDBFactory,request:typeof fetch=fetch){
 const scope=stagingScope(config,origin),active=()=>current()?.uid===uid&&current()?.emailVerified===true;
 const call=async(method:string,input:unknown)=>{
  const owner=current();if(!owner||!active())throw Error('Inicia sesión con la cuenta original y verifica su correo.');
  const result=await owner.getIdTokenResult();if(result.claims.aud!==scope.project||result.claims.iss!=='https://securetoken.google.com/'+scope.project||result.claims.sub!==uid)throw Error('La cuenta pertenece a otro proyecto. No se enviará el candidato.');
  const token=result.token,appToken=await appCheck();if(current()!==owner||!active())throw Error('La sesión cambió antes de enviar.');if(!token||!appToken)throw Error('Falta Auth o App Check.');
  const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),30000);
  try{const response=await request('https://us-central1-fullhouse-staging.cloudfunctions.net/remoteV1',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+token,'X-Firebase-AppCheck':appToken},body:JSON.stringify({data:{method,input}}),signal:abort.signal});const json=await response.json();if(current()!==owner||!active())throw Error('La respuesta pertenece a otra sesión; conserva el candidato original.');if(json.error)throw Object.assign(Error('El servidor no confirmó la operación. Conserva el candidato.'),{code:String(json.error.status||'unknown').toLowerCase().replaceAll('_','-')});if(!response.ok||!Object.hasOwn(json,'result'))throw Error('Confirmación incompleta.');return json.result;}finally{clearTimeout(timer);}
 };
 const api:RemoteApi={project:scope.project,read:revisionId=>call('read',{revisionId}),inspect:operationId=>call('inspect',{operationId}),save:input=>call('save',input),restore:input=>call('restore',input)};
 const store=new DurableWorkStore(uid,factory,scope.database,undefined,scope),session=new RemoteSession(uid,store,api,active,()=>crypto.randomUUID(),scope);
 return {session,store,project:scope.project};
}
