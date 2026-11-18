'use strict';
process.env.TZ='UTC';
const test=require('node:test'),assert=require('node:assert/strict'),{schedule}=require('./helpers/history-integration.cjs'),{event,routine,input}=require('./helpers/calendar.cjs'),P=require('../history/calendar-proof.cjs');
const engine=P.createCalendarProof(schedule);
test('cada presupuesto detiene la prueba sin aceptar prefijos',async()=>{
 for(const extra of [{through:''},{through:null},{budgets:null},{budgets:7}])assert.equal((await engine.prove(input([event()],[],extra))).status,'indeterminate');
 for(const [budget,value,reason] of [['checks',1,'check-budget'],['work',1,'work-budget'],['segments',1,'segment-budget']]){
  const result=await engine.prove(input([event()],[],{budgets:{[budget]:value}}));assert.equal(result.status,'indeterminate');assert.equal(result.certificate.reason,reason);
 }
 const r=routine('r',1,{steps:Array.from({length:9},(_,i)=>({id:'s'+i,title:'S',min:1,mode:'alternatives',chooseWhen:'execute',variants:[{id:'v',title:'V',desc:'',min:1,days:[]}]}))});
 const huge=await engine.prove(input([event('e',{routineId:'r'})],[r]));assert.equal(huge.status,'indeterminate');assert.equal(huge.certificate.reason,'profile-budget');
 const ambiguous=await engine.prove(input([], [routine('r',1,{steps:[{id:'s',title:'A',min:1},{id:'s',title:'B',min:1}]})]));assert.equal(ambiguous.certificate.reason,'input-model');
 const cycle={};cycle.self=cycle;assert.equal((await engine.prove(cycle)).certificate.reason,'input-cycle');
 const oversized=input([event('e',{note:'x'.repeat(2000001)})]);assert.equal((await engine.prove(oversized)).certificate.reason,'input-budget');
 assert.equal((await engine.prove({['x'.repeat(2000001)]:false})).certificate.reason,'input-budget');
 assert.equal((await engine.prove(Object.fromEntries(Array.from({length:21000},(_,i)=>['k'+i,{}])))).certificate.reason,'input-budget');
});
test('muchos segmentos válidos producen certificado verificable dentro de límites propios',async()=>{
 const overrides=Object.fromEntries(Array.from({length:1000},(_,i)=>{const date=require('../history/calendar-math.cjs').date(require('../history/calendar-math.cjs').ordinal('2000-01-01')+i*2);return [date,{skip:true}];}));
 const x=input([event('e',{overrides})],[],{budgets:{segments:4096}}),result=await engine.prove(x);
 assert.equal(result.status,'valid');assert.ok(result.certificate.counts.segments>1000);assert.ok(await engine.verify(x,result));
});
test('every enorme usa BigInt y devuelve indeterminado antes de explorar todo el dominio',async()=>{
 const result=await engine.prove(input([event('e',{repeat:'every',everyDays:Number.MAX_SAFE_INTEGER})],[],{budgets:{states:10}}));assert.equal(result.status,'indeterminate');assert.equal(result.certificate.reason,'state-budget');assert.ok(BigInt(result.certificate.components[0].periodDays)>BigInt(Number.MAX_SAFE_INTEGER));
});
test('fechas finitas, skip, occasion y ancla end usan exactamente reglas actuales',async()=>{
 const e=event('e',{repeat:'none',kind:'occasion',endDate:'2000-02-01',anchor:'end',endTime:'23:59',time:'23:50',minutes:60,overrides:{'2000-01-21':{time:'23:01',skip:true}}});
 const x=input([e],[],{through:'2000-02-10'});assert.equal((await engine.prove(x)).status,'valid');e.overrides['2000-01-21'].skip=false;
 const result=await engine.prove(x);assert.equal(result.status,'invalid');assert.equal(result.certificate.counterexample.date,'2000-01-21');
});
