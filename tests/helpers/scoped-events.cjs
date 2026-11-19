'use strict';
const {empty,schedule,plannerActions}=require('./history-integration.cjs'),model=require('../../history/storage-model.cjs'),E=require('../../history/storage-events.cjs');
const day='2030-01-07',clone=x=>JSON.parse(JSON.stringify(x));
function fixture(){const d=empty();d.events=[];return d;}
const draft=extra=>({id:'',title:' New event ',date:day,time:'09:00',minutes:30,goalId:'',routineId:'',repeat:'none',note:'',overrides:{},...extra});
const context=(operationId='create',extra={})=>({operationId,today:day,at:day+'T12:00:00Z',...extra});
const head={generation:1,receiptHash:'a'.repeat(64)};
async function build(doc,payload=draft(),ctx=context()){
 const plan=await model.prepareDocument(doc,schedule.validData),reservation=E.issue(head,ctx.operationId),scope=E.selectScope(plan,reservation,payload,ctx,E.historyIdentities(plan));
 return {...await E.buildChange(scope,{legacy:schedule.validData,schedule,plannerActions}),reservation,plan};
}
module.exports={fixture,draft,context,head,build,clone,day};
