'use strict';
const {schedule,plannerActions,empty}=require('./history-integration.cjs'),{event,routine}=require('./calendar.cjs'),model=require('../../history/storage-model.cjs'),R=require('../../history/storage-routines.cjs');
function skippedFriday(){
 const d=empty(),origin='2011-01-01',from='2011-12-29';
 const r=routine('r',10,{steps:[{id:'s',title:'S',min:10,mode:'alternatives',chooseWhen:'weekday',variants:[{id:'friday',title:'Friday',desc:'',min:11,days:[5]}]}]});
 d.routines=[routine('a',60),routine('c',60),routine('r',10)];
 d.events=[event('a',{date:origin,routineId:'a',time:'08:00'}),event('c',{date:origin,routineId:'c',time:'09:10'}),event('block',{date:origin,routineId:'r',repeat:'custom',repeatDays:[5],anchor:'between',afterRoutineId:'a',beforeRoutineId:'c'})];
 return {doc:d,draft:r,from};
}
async function build({doc,draft,from}){return R.buildChange(R.selectScope(await model.prepareDocument(doc,schedule.validData),'saveRoutine',draft,{operationId:'local',today:from,at:from+'T12:00:00Z',ids:[]}),{legacy:schedule.validData,schedule,plannerActions});}
module.exports={skippedFriday,build};
