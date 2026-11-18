import {createLegacyCompat} from '../../history/legacy-compat.cjs';
import {createCompatSession} from '../../history/compat-session.cjs';
import type {Engine} from '../../history/engine.cjs';
import type {Adapter} from '../../history/adapter.cjs';
import type {DocumentV2} from '../../contracts/history-v2';
declare const engine:Engine,adapter:Adapter,doc:DocumentV2;
const compat=createLegacyCompat({legacy:()=>true,engine,adapter});
compat.edit(doc,'original',{id:'edit',at:'2030-01-07T12:00:00Z',reason:'Corrección',action:{type:'step',stepId:'original-id',checked:false}});
// @ts-expect-error La confirmación no es opcional.
compat.adopt(doc,'original',{id:'adopt',at:'2030-01-07T12:00:00Z',reason:'Continuar'});
// @ts-expect-error No hay borrado físico autorizado.
compat.edit(doc,'original',{id:'delete',at:'2030-01-07T12:00:00Z',reason:'Quitar',action:{type:'purge'}});
void createCompatSession;
