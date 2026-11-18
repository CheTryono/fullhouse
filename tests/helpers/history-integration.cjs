'use strict';
const {scheduleSource}=require('../../scripts/history-browser.cjs'),{plannerSource}=require('../../scripts/planner-actions.cjs');
const {createEngine}=require('../../history/engine.cjs'),{createReader}=require('../../history/reader.cjs'),{createAdapter}=require('../../history/adapter.cjs');
const {createMemoryStorage,createMemoryLock}=require('../../history/storage-memory.cjs'),{createRepository,KEYS}=require('../../history/persistence.cjs');
const {createIntegration}=require('../../history/integration.cjs');
const {documentV2,clone,key,at}=require('../fixtures/history-v2.cjs');
function compile(source){const m={exports:{}};new Function('module',source)(m);return m.exports;}
const schedule=compile(scheduleSource()),plannerActions=compile(plannerSource());
function make(storage=createMemoryStorage(),lock=createMemoryLock()){
  const engine=createEngine(schedule.validData),adapter=createAdapter(schedule),reader=createReader(schedule.validData,adapter),repository=createRepository({storage,lock,legacy:schedule.validData});
  const integration=createIntegration({engine,adapter,reader,repository,plannerActions,legacy:schedule.validData});
  return {storage,lock,engine,adapter,reader,repository,integration};
}
function empty(){const d=clone(documentV2());d.logs={};d.recipeRevisions={};d.events.forEach(e=>{delete e.recipeRevisionId;delete e.seriesId;});return d;}
const request=(action,id='write1')=>({executionId:'execution',at,context:{eventId:'event',date:'2030-01-07',seriesId:'series',revisionId:'revision'},operationId:id,action});
module.exports={make,empty,request,schedule,plannerActions,documentV2,clone,key,at,KEYS};
