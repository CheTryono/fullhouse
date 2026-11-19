'use strict';
const {snapshotInput}=require('./calendar-proof.cjs');
const {createGoalsSession}=require('./goals-session.cjs');
function createEventsSession(access){
 const base=createGoalsSession({...access,preparePlanning:async(t,method,payload,context)=>{
  if(method!=='createEvent')throw Error('Solo creación de eventos; edición y movimientos pendientes');
  const draft=snapshotInput(payload),ctx=snapshotInput(context);
  return access.prepareEvent(t,await access.reserveEvent(t,ctx.operationId),draft,ctx);
 },commitPlanning:access.commitEvent});
 return Object.freeze({...base,readEvent:(id,options)=>access.readEvent(base.state().confirmed,id,options)});
}
module.exports={createEventsSession};
