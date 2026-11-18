'use strict';
const {copy,freeze,same}=require('./json.cjs');
const model=require('./storage-model.cjs');
// Sesión de laboratorio: almacenamiento inyectado, sin APIs públicas.
function createCompatSession({database,compat,legacy,plannerActions,engine}){
 let confirmed=null,head=null,pending=null,busy=false,recovery=null;const drafts=Object.create(null);
 const state=()=>freeze({confirmed,head,pending:pending?{id:pending.id,document:pending.document,error:pending.error}:null,busy,recovery,drafts:copy(drafts)});
 const ready=()=>{if(busy||pending||recovery||!confirmed)throw Error('Resuelve pendientes o recuperación antes de editar');};
 async function open(){if(pending||busy)throw Error('Hay pendientes');busy=true;try{const result=await database.open();if(result.status==='recovery'){throw Error(result.error);}const document=result.plan?freeze(await model.hydrate(result.plan,legacy)):null;head=result.head;confirmed=document;recovery=null;}catch(e){recovery=e.message;}finally{busy=false;}return state();}
 async function write(){try{
   if(!pending.plan)pending.plan=await model.prepareDocument(pending.document,legacy);
   const result=await database.commit(pending.plan,{expected:pending.base,id:pending.id});
   if(result.status!=='confirmed')throw Error('Operación confirmada anteriormente pero superada: exporta y reconcilia');
   confirmed=pending.document;head=result.head;pending=null;
 }catch(e){pending.error=e.message;}return state();}
 async function save(document,id){if(busy||pending||recovery)throw Error('Hay pendientes o recuperación');if(typeof id!=='string'||!id.trim())throw Error('Reserva ID antes de escribir');const errors=engine.validate(document);if(errors.length)throw Error(errors.join('; '));pending={document:freeze(copy(document)),base:head,id,plan:null,error:null};busy=true;try{await write();}finally{busy=false;}return state();}
 async function edit(key,command){ready();return save(compat.edit(confirmed,key,command).after,command.id);}
 async function native(request){ready();let document=compat.native(confirmed,request).after;const log=Object.values(document.logs).find(l=>l.history?.capture.executionId===request.executionId);
   if(request.action.type==='step'&&request.action.checked&&log?.history.state.status==='active'&&log.history.resolution.unitsKnown&&log.history.resolution.unitStepIds.length&&log.history.resolution.unitStepIds.every(id=>log.checkedSteps.includes(id)))document=compat.native(document,{executionId:request.executionId,at:request.at,editId:request.editId+':complete',reason:'Todas las unidades aplicables marcadas',action:{type:'complete',source:'steps'}}).after;
   return save(document,request.operationId);
 }
 async function adopt(key,request){ready();return save(compat.adopt(confirmed,key,request).after,request.id);}
 async function retry(){if(busy||!pending||recovery)throw Error('No hay pendiente reintentable');busy=true;try{await write();}finally{busy=false;}return state();}
 async function plan(method,payload,context){ready();context=copy(context);
   const allowed=['saveRoutine','saveEvent','shiftEvent','deleteRoutine','deleteEvent','saveGoal','saveProgress','saveDayReview','toggleMilestone'];if(!allowed.includes(method))throw Error('Formulario no permitido');
   const before=confirmed;const collection={saveRoutine:'routines',saveEvent:'events',saveGoal:'goals'}[method];if(collection && payload.id && !before[collection].some(x=>x.id===payload.id))throw Error('El elemento a editar ya no existe');
   if(method==='deleteRoutine'&&!before.routines.some(x=>x.id===payload.id))throw Error('La rutina ya no existe');if(['deleteEvent','shiftEvent'].includes(method)&&!before.events.some(x=>x.id===(payload.eventId || payload.id)))throw Error('La actividad ya no existe');
   const {controller,result}=plannerActions(copy(before),{...context,state:context.state});
   const draftsByMethod={saveRoutine:'routineDraft',saveEvent:'eventDraft',saveGoal:'goalDraft'};
   if(draftsByMethod[method])controller.state[draftsByMethod[method]]=copy(payload);
   if(method==='shiftEvent')await controller.shiftEvent(before.events.find(e=>e.id===payload.eventId),payload.date,payload.delta);
   else if(method==='deleteRoutine')await controller.deleteRoutine(before.routines.find(r=>r.id===payload.id));
   else if(method==='deleteEvent')await controller.deleteEvent(before.events.find(e=>e.id===payload.id));
   else if(method==='toggleMilestone')await controller.toggleMilestone(payload.goalId,payload.milestoneId);
   else await controller[method]();
   const {candidate,messages}=result();if(!candidate)throw Error(messages.join('\n')||'Formulario rechazado');
   candidate.logs=copy(before.logs);candidate.recipeRevisions=copy(before.recipeRevisions);
   for(const event of candidate.events)if(event.recipeRevisionId&&event.routineId!==candidate.recipeRevisions[event.recipeRevisionId]?.sourceRoutineId)delete event.recipeRevisionId;
   // Comparar problemas, no prohibir datos antiguos ya conservados.
   const preview=doc=>{controller.state.data=doc;return doc.events.flatMap(e=>controller.schedulePreview({...e,applyFrom:context.today}).filter(r=>r.issue).map(r=>JSON.stringify([e.id,r.date,r.issue])));};
   const oldIssues=new Set(preview(before));if(preview(candidate).some(x=>!oldIssues.has(x)))throw Error('El formulario invalida el horario o sus dependencias');
   return save(candidate,context.operationId);
 }
 async function photo(target,process,command){ready();const reserved=copy(target),reservedCommand=copy(command),base=confirmed;busy=true;
   let evidence;try{evidence=await process();if(confirmed!==base)throw Error('El contexto cambió mientras se procesaba la foto');}finally{busy=false;}
   // No se consulta selección/fecha global al terminar. Cada reserva pertenece a un destino.
   if(reserved.kind==='legacy')return edit(reserved.key,{...reservedCommand,action:{type:'evidence',evidence}});
   return native({...reserved.request,...reservedCommand,action:{type:'evidence',evidence}});
 }
 function packet(){const value=copy({format:'fullhouse-lab-compat-recovery',version:1,head:copy(head),confirmed:copy(confirmed),pending:pending?{id:pending.id,document:copy(pending.document),base:copy(pending.base)}:null,drafts:copy(drafts)});if(JSON.stringify(value).length>32000000)throw Error('Paquete demasiado grande para recuperación JSON; conserva la sesión y revisa el presupuesto');return freeze(value);}
 function resume(value){if(busy||pending)throw Error('Hay pendientes');const p=copy(value);if(p.format!=='fullhouse-lab-compat-recovery'||p.version!==1)throw Error('Paquete incompatible');
   if(p.pending && head?.id===p.pending.id && same(p.pending.document,confirmed)){Object.assign(drafts,p.drafts);return state();}
   if(!same(p.head,head)||!same(p.confirmed,confirmed))throw Error('Paquete obsoleto: no se aplica automáticamente');
   if(p.pending){const errors=engine.validate(p.pending.document);if(errors.length||!same(p.pending.base,head)||typeof p.pending.id!=='string'||!p.pending.id.trim())throw Error('Candidato de recuperación inválido');pending={...p.pending,plan:null,error:'Recuperado: pendiente de confirmar'};}
   Object.assign(drafts,p.drafts);return state();
 }
 return Object.freeze({state,open,save,edit,native,adopt,retry,plan,photo,packet,resume,setDraft(key,value){drafts[key]=copy(value);},clearDraft(key){delete drafts[key];}});
}
module.exports={createCompatSession};
