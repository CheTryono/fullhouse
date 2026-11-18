import {createRepository} from '../../history/persistence.cjs';
import {createMemoryStorage,createMemoryLock} from '../../history/storage-memory.cjs';
import type {DocumentV2} from '../../contracts/history-v2';
declare const document: DocumentV2;
const repo=createRepository({storage:createMemoryStorage(),lock:createMemoryLock(),legacy:(_value:unknown)=>true});
// @ts-expect-error No se confirma un objeto que no haya preparado el repositorio.
repo.write({document});
// @ts-expect-error No se inventa el token base de otra pestaña.
repo.prepare({},document,'synthetic');
async function check(){const result=await repo.open();if(result.status==='ready'){
  const operation=await repo.prepare(result.token,document,'synthetic');
  // @ts-expect-error La persistencia no permite modificar el candidato preparado.
  operation.document.logs.changed={completed:true,checkedSteps:[]};
}}
void check;
