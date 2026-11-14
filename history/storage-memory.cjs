'use strict';
// Solo simulación inyectable. No referencia Storage, localStorage ni IndexedDB.
function createMemoryStorage(initial={},quotaBytes=Infinity){
  const values=new Map(Object.entries(initial));let fault=null;const trace=[];
  const size=()=>[...values].reduce((n,[k,v])=>n+2*(k.length+v.length),0);
  function check(op,key,after){if(fault && fault.op===op && (!fault.key || fault.key===key) && !!fault.after===after){if(fault.skip>0){fault.skip--;return;}const f=fault;fault=null;throw new Error(f.message || 'Fallo simulado de '+op);}}
  return Object.freeze({
    async read(key){trace.push({op:'read',key});check('read',key,false);return values.get(key) ?? null;},
    async write(key,raw){trace.push({op:'write',key});check('write',key,false);const old=values.get(key);if(size()-2*(old?.length || 0)+2*(raw.length+(old===undefined?key.length:0))>quotaBytes)throw new Error('QuotaExceededError');values.set(key,raw);check('write',key,true);},
    async remove(key){trace.push({op:'remove',key});check('remove',key,false);values.delete(key);check('remove',key,true);},
    failNext(spec){fault={...spec};},setQuota(bytes){quotaBytes=bytes;},bytes:size,
    externalWrite(key,raw){values.set(key,raw);},raw:key=>values.get(key) ?? null,
    dump:()=>Object.fromEntries(values),trace
  });
}
function createMemoryLock(){let tail=Promise.resolve();return Object.freeze({exclusive(fn){const next=tail.then(fn);tail=next.catch(()=>{});return next;}});}
module.exports={createMemoryStorage,createMemoryLock};
