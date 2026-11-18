'use strict';
importScripts('/history-browser.js');
const engine=FullhouseHistory.createCalendarProof(FullhouseHistory.schedule),running=new Map();
self.onmessage=async({data})=>{
 const {id,type,value}=data||{};if(typeof id!=='string'||!id.trim()||id.length>100)return;
 if(type==='cancel'){running.get(id)?.abort();return;}
 if(type!=='prove'||running.size){postMessage({id,ok:false,error:'Calendar worker busy or unknown operation'});return;}
 const controller=new AbortController();running.set(id,controller);
 try{postMessage({id,ok:true,value:await engine.prove(value,{signal:controller.signal})});}
 catch(e){postMessage({id,ok:false,error:e.message});}
 finally{running.delete(id);}
};
