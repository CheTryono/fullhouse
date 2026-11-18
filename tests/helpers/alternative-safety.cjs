'use strict';
const {schedule,plannerActions,empty}=require('./history-integration.cjs');
const {routine,event}=require('./calendar.cjs');
const R=require('../../history/storage-routines.cjs'),model=require('../../history/storage-model.cjs');
const day='2030-01-07',context=id=>({operationId:id,today:day,at:day+'T12:00:00Z',ids:[]});
function manual(base=20,variant=10){return routine('r',base,{steps:[{id:'s',title:'S',min:base,mode:'alternatives',chooseWhen:'execute',variants:[{id:'__base',title:'Variant',desc:'',min:variant,days:[]}]}]});}
function fixture(base=20,variant=10){const d=empty();d.routines=[routine('a',60),routine('c',60),routine('r',10)];d.events=[event('a',{date:day,routineId:'a',time:'08:00'}),event('c',{date:day,routineId:'c',time:'09:10'}),event('block',{date:day,routineId:'r',anchor:'between',afterRoutineId:'a',beforeRoutineId:'c'})];return {doc:d,draft:manual(base,variant)};}
async function build(doc,draft,id='edit'){const scope=R.selectScope(await model.prepareDocument(doc,schedule.validData),'saveRoutine',draft,context(id));return R.buildChange(scope,{legacy:schedule.validData,schedule,plannerActions});}
module.exports={manual,fixture,build,day,context};
