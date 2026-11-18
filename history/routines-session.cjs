'use strict';
const {createGoalsSession}=require('./goals-session.cjs');
// Misma semántica de confirmado/pendiente y recuperación, otro puerto de preparación.
function createRoutinesSession(access){const base=createGoalsSession({...access,preparePlanning:access.prepareRoutine,commitPlanning:access.commitRoutine});return Object.freeze({...base,readRoutine:(id,options)=>access.readRoutine(base.state().confirmed,id,options)});}
module.exports={createRoutinesSession};
