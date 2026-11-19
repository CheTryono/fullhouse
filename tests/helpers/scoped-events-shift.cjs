'use strict';
const H=require('./scoped-events-edit.cjs'),Shift=require('../../history/storage-events-shift.cjs');
const ctx=(operationId='shift',extra={})=>H.ctx(operationId,{confirm:true,...extra});
const request=(extra={})=>({eventId:'event',seriesId:'s',date:'2030-01-08',deltaMinutes:15,...extra});
function fixture(extra={}){const d=H.empty();d.events[0]={...d.events[0],routineId:'',repeat:'daily',seriesId:'s',time:'08:00',minutes:60,...extra};return d;}
async function prepare(d=fixture(),p=request(),c=ctx()){const plan=await H.model.prepareDocument(d,H.schedule.validData),index=H.E.historyIdentities(plan),scope=Shift.selectScope(plan,p,c,index,H.schedule);return {...await Shift.buildShift(scope,H.ports),scope,plan};}
module.exports={...H,Shift,ctx,request,fixture,prepare};
function chain(){const {routine,event}=require('./calendar.cjs'),d=fixture();d.routines=[routine('a',60),routine('b',5,{steps:[{id:'b-flex',title:'B flexible',min:5,flexible:true}]}),routine('c',60),routine('d',60),routine('e',30)];d.events=[event('event',{time:'08:00',routineId:'a',seriesId:'s'}),event('c',{time:'10:00',routineId:'c'}),event('b',{routineId:'b',anchor:'between',afterRoutineId:'a',beforeRoutineId:'c'}),event('d',{routineId:'d',anchor:'between',afterRoutineId:'b',beforeRoutineId:'e'}),event('e',{time:'11:00',routineId:'e'})];return d;}
module.exports.chain=chain;
