'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), { spawnSync } = require('node:child_process');
for (const zone of ['America/Mexico_City', 'America/New_York', 'Europe/Madrid', 'Pacific/Apia'])
    test('edición temporal civil y garantías conservadoras en ' + zone, () => {
        const source = `const assert=require('node:assert/strict'),H=require('./tests/helpers/scoped-events-edit.cjs');(async()=>{
 const make=()=>{const d=H.empty();d.events[0]={...d.events[0],date:'2011-01-01',time:'07:00',repeat:'daily'};return d;},ctx=H.ctx('local',{today:'2011-12-29',at:'2011-12-29T12:00:00Z',confirm:true});
 const d=make(),out=await H.prepare(d,{...d.events[0],time:'09:00',applyFrom:'2011-12-31'},ctx);
 assert.equal(out.proof.status,'valid');assert.equal(out.events[0].endDate,'2011-12-30');assert.equal(out.events[1].date,'2011-12-31');
 for(const repeat of ['monthly','yearly','every']){
  const finite=make();finite.events[0].endDate='2013-03-01';const p={...finite.events[0],repeat,everyDays:3,time:'09:00',applyFrom:'2012-01-03'};
  assert.equal((await H.prepare(finite,p,ctx)).proof.status,'valid');
  const unbounded=make();await assert.rejects(H.prepare(unbounded,{...unbounded.events[0],repeat,everyDays:3,time:'09:00'},ctx),e=>e.status==='indeterminate');
 }
 if(process.env.TZ==='Pacific/Apia')await assert.rejects(H.prepare(d,{...d.events[0],time:'09:00',applyFrom:'2011-12-30'},ctx),e=>e.code==='NORMALIZED_DATE');
 })().catch(e=>{console.error(e);process.exitCode=1});`;
        const p = spawnSync(process.execPath, ['-e', source], { cwd: require('node:path').resolve(__dirname, '..'), env: { ...process.env, TZ: zone }, encoding: 'utf8' });
        assert.equal(p.status, 0, p.stderr);
    });
