'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), { execFileSync } = require('node:child_process');
for (const zone of ['America/Mexico_City', 'America/New_York', 'Europe/Madrid', 'Pacific/Apia'])
    test('creación con prueba completa en ' + zone, () => {
        const code = `(async()=>{const F=require('./tests/helpers/scoped-events.cjs'),{routine,event}=require('./tests/helpers/calendar.cjs'),E=require('./history/storage-events.cjs');const d=F.fixture(),from='2011-12-29';d.routines=[routine('a',60),routine('c',60),routine('r',10)];d.events=[event('a',{date:'2011-01-01',time:'08:00',routineId:'a'}),event('c',{date:'2011-01-01',time:'09:10',routineId:'c'})];const ctx=F.context('local',{today:from,at:from+'T12:00:00Z'}),p=F.draft({date:from,routineId:'r',repeat:'daily',anchor:'between',afterRoutineId:'a',beforeRoutineId:'c'}),valid=await F.build(d,p,ctx),again=await F.build(d,p,ctx),finite=[],blocked=[];for(const repeat of ['monthly','yearly','every']){finite.push((await F.build(d,{...p,repeat,everyDays:2,endDate:'2012-02-01'},ctx)).proof.status);try{await F.build(d,{...p,repeat,everyDays:2},ctx);blocked.push(false);}catch(e){blocked.push(e.status==='indeterminate');}}d.routines[2].steps[0]={id:'s',title:'S',min:10,mode:'alternatives',chooseWhen:'weekday',variants:[{id:'friday',title:'Friday',desc:'',min:11,days:[5]}]};let witness=null;try{await F.build(d,{...p,repeat:'custom',repeatDays:[5]},ctx);}catch(e){witness=e.counterexample;}let normalized=null;try{await F.build(F.fixture(),F.draft({date:'2011-12-30'}),ctx);normalized=false;}catch(e){normalized=e.code==='NORMALIZED_DATE';}console.log(JSON.stringify({format:valid.proof.certificate.format,zone:valid.proof.certificate.zone,states:valid.proof.certificate.counts.states,stable:valid.proof.proofHash===again.proof.proofHash,finite,blocked,witness,normalized}));})().catch(e=>{console.error(e);process.exitCode=1;});`;
        const result = JSON.parse(execFileSync(process.execPath, ['-e', code], { cwd: require('node:path').resolve(__dirname, '..'), env: { ...process.env, TZ: zone }, encoding: 'utf8' }));
        assert.equal(result.format, 'fullhouse-local-event-calendar-proof');
        assert.equal(result.zone, zone);
        assert.equal(result.stable, true);
        assert.deepEqual(result.finite, ['valid', 'valid', 'valid']);
        assert.deepEqual(result.blocked, [true, true, true]);
        assert.equal(result.witness.eventId.startsWith('event-v2:'), true);
        assert.equal(result.witness.date, zone === 'Pacific/Apia' ? '2012-01-06' : '2011-12-30');
        assert.equal(result.normalized, zone === 'Pacific/Apia');
    });
