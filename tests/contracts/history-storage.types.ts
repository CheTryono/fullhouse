import {createLabDatabase} from '../../history/storage-idb.cjs';
import {prepareDocument} from '../../history/storage-model.cjs';
import {proposeMigration} from '../../history/storage-sources.cjs';
import type {DocumentV2} from '../../contracts/history-v2';
declare const document: DocumentV2;
const legacy=(_value:unknown)=>true;
const db=createLabDatabase({factory:indexedDB,name:'fullhouse-lab-types',legacy});
// @ts-expect-error El prototipo no puede seleccionar una base pública.
createLabDatabase({factory:indexedDB,name:'fullhouse',legacy});
// @ts-expect-error Un documento inline no es un plan físico validado.
db.commit(document,{id:'test'});
// @ts-expect-error No se confirma una migración sin confirmación ni fuentes frescas.
db.finalizeMigration('migration',{});
// @ts-expect-error No se admite elegir automáticamente la más reciente.
proposeMigration({main:null,alias:null},'newest',legacy);
async function valid(){const plan=await prepareDocument(document,legacy);await db.commit(plan,{id:'synthetic'});
 // @ts-expect-error Los campos físicos no se alteran tras preparar.
 plan.rootHash='changed';
}
void valid;
