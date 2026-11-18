'use strict';
const {snapshotInput}=require('./calendar-proof.cjs');
// Puerto de laboratorio. No conoce IndexedDB, Planner ni fuentes personales.
function createCalendarProofPort(factory){
 if(typeof factory!=='function')throw Error('Worker factory required');
 const worker=factory(),pending=new Map();let closed=false;
 const stop=error=>{closed=true;for(const p of pending.values()){p.cleanup();p.reject(error);}pending.clear();worker.terminate();};
 worker.onerror=()=>stop(Error('Calendar worker interrupted; no persistence was requested'));
 worker.onmessage=({data})=>{const p=pending.get(data?.id);if(!p)return;pending.delete(data.id);p.cleanup();data.ok?p.resolve(data.value):p.reject(Error(data.error||'Calendar worker failed'));};
 function cancel(id){if(!pending.has(id)||closed)return false;try{worker.postMessage({id,type:'cancel'});return true;}catch{stop(Error('Calendar worker interrupted during cancellation'));return false;}}
 return Object.freeze({prove(id,input,{signal}={}){
  if(closed||typeof id!=='string'||!id.trim()||id.length>100||pending.has(id)||pending.size>=4)return Promise.reject(Error('Worker closed, busy or invalid ID'));
  let value;try{value=snapshotInput(input);}catch(e){return Promise.reject(e);}
  return new Promise((resolve,reject)=>{
   const abort=()=>cancel(id),cleanup=()=>signal?.removeEventListener('abort',abort);
   pending.set(id,{resolve,reject,cleanup});signal?.addEventListener('abort',abort,{once:true});
   try{worker.postMessage({id,type:'prove',value});if(signal?.aborted)cancel(id);}catch(e){pending.delete(id);cleanup();reject(e);}
  });
 },cancel,close(){stop(Error('Calendar proof cancelled; no persistence was requested'));}});
}
module.exports={createCalendarProofPort};
