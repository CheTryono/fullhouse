'use strict';
const {copy,freeze}=require('./json.cjs');
// Borradores y candidato se conservan separados del token confirmado. Solo laboratorio.
function createGoalsSession(access){
 let confirmed=null,pending=null,busy=false;const drafts=Object.create(null);
 const state=()=>freeze({confirmed,pending:pending?{id:pending.operation.id,error:pending.error}:null,busy,drafts:copy(drafts)});
 async function open(){if(busy||pending)throw Error('Resuelve pendientes antes de abrir');busy=true;try{confirmed=(await access.openWindow()).token;}finally{busy=false;}return state();}
 async function write(options){try{const result=await access.commitPlanning(pending.operation,options);if(result.status!=='confirmed')throw Error('Confirmado pero superado: recupera y reconcilia');confirmed=result.token;pending=null;}catch(e){pending.error=e.message;}return state();}
 async function save(method,payload,context,options){if(busy||pending||!confirmed)throw Error('Resuelve pendientes antes de editar');busy=true;try{const operation=await access.preparePlanning(confirmed,method,payload,context);pending={operation,error:null};await write(options);}finally{busy=false;}return state();}
 async function retry(options){if(busy||!pending)throw Error('No hay pendiente reintentable');busy=true;try{await write(options);}finally{busy=false;}return state();}
 async function exportPending(){if(!pending)throw Error('No hay pendiente');return access.exportPending(pending.operation,drafts);}
 async function resume(packet){if(busy||pending||!confirmed)throw Error('Abre y resuelve pendientes');busy=true;try{const result=await access.resumePending(confirmed,packet);Object.assign(drafts,copy(packet.metadata.drafts));if(result.status!=='already-confirmed')pending={operation:result,error:'Recuperado, pendiente de confirmar'};}finally{busy=false;}return state();}
 return Object.freeze({state,open,save,retry,exportPending,resume,readGoal:id=>access.readGoal(confirmed,id),readDayReview:date=>access.readDayReview(confirmed,date),setDraft(key,value){drafts[key]=copy(value);},cancel(){if(busy)throw Error('Operación en curso');pending=null;return state();}});
}
module.exports={createGoalsSession};
