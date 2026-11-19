'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
for(const zone of ['UTC','America/Mexico_City','America/New_York','Europe/Madrid','Pacific/Apia'])test('shift de una fecha local, sin autorización global: '+zone,()=>{
const code=`const assert=require('node:assert/strict'),H=require('./tests/helpers/scoped-events-shift.cjs');(async()=>{
 const context=H.ctx('local',{today:'2011-12-29',at:'2011-12-29T12:00:00Z'});
 for(const [repeat,date] of [['daily','2011-12-31'],['monthly','2012-01-01'],['yearly','2012-01-01'],['every','2011-12-31']]){
 const d=H.fixture({date:'2011-01-01',repeat,everyDays:1}),p=H.request({date}),out=await H.prepare(d,p,context);
 assert.equal(out.proof.status,'valid');assert.equal(out.proof.certificate.date,date);assert.equal(out.metrics.after.certificate.from,date);assert.equal(out.metrics.after.certificate.through,date);
 }
 if(process.env.TZ==='Pacific/Apia')await assert.rejects(H.prepare(H.fixture({date:'2011-01-01'}),H.request({date:'2011-12-30'}),context),e=>e.code==='NORMALIZED_DATE');
})().catch(e=>{console.error(e);process.exitCode=1;});`;
const p=spawnSync(process.execPath,['-e',code],{env:{...process.env,TZ:zone},cwd:require('node:path').resolve(__dirname,'..'),encoding:'utf8'});assert.equal(p.status,0,p.stderr);
});
