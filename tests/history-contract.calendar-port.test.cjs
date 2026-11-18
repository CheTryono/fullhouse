'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createCalendarProofPort}=require('../history/calendar-proof-port.cjs');
test('puerto Worker: identidad, cancelación, fallo, cierre y frontera JSON',async()=>{
 const sent=[],worker={postMessage:x=>sent.push(x),terminate(){this.closed=true;}},port=createCalendarProofPort(()=>worker),controller=new AbortController();
 const pending=port.prove('job',{events:[],routines:[],from:'2000-01-01'},{signal:controller.signal});
 await assert.rejects(port.prove('job',{}),/ID/);controller.abort();assert.equal(sent[1].type,'cancel');assert.equal(port.cancel('missing'),false);
 worker.onmessage({data:{id:'job',ok:true,value:{status:'indeterminate'}}});assert.equal((await pending).status,'indeterminate');
 await assert.rejects(port.prove('getter',{get events(){throw Error('executed');}}),/input-getter/);
 const interrupted=port.prove('another',{});worker.onerror();await assert.rejects(interrupted,/interrupted/);assert.equal(worker.closed,true);await assert.rejects(port.prove('closed',{}),/closed/);
 const w={postMessage(){throw Error('clone failed');},terminate(){}},p=createCalendarProofPort(()=>w);await assert.rejects(p.prove('id',{}),/clone failed/);p.close();
});
