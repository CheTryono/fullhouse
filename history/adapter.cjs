'use strict';
const {copy,freeze}=require('./json.cjs');
// Inyectar las funciones puras reales de Fullhouse; nunca acceder a Planner/storage.
function createAdapter(schedule){
  function context(doc,eventId,date,ids){
    const event=doc.events.find(e=>e.id===eventId);if(!event || !schedule.occurs(event,date))throw new Error('No existe una ocurrencia aplicable');
    const frame=schedule.eventFrame(event,date,doc);if(!frame)throw new Error('Intervalo o dependencias imposibles');
    if(event.seriesId && event.seriesId!==ids.seriesId)throw new Error('Serie incompatible');
    return freeze({eventId,date,seriesId:ids.seriesId,...(ids.revisionId?{revisionId:ids.revisionId}:{}),window:{startMin:frame.start,endMin:frame.end},budgetMinutes:frame.length});
  }
  function prepare(engine,doc,request){
    const next=copy(request);
    if(!Object.values(doc.logs).some(l=>l.history?.capture.executionId===request.executionId))next.context=context(doc,request.context.eventId,request.context.date,request.context);
    return engine.prepare(doc,next);
  }
  return Object.freeze({context,prepare,scheduled(document,date){const doc=copy(document);return freeze(doc.events.filter(e=>schedule.occurs(e,date)).map(e=>({event:e,frame:schedule.eventFrame(e,date,doc)})));}});
}
module.exports={createAdapter};
