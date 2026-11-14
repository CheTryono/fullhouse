'use strict';
const {documentV2,clone,key}=require('./history-v2.cjs'),src=require('./synthetic-image.cjs');
function growth(executions,revisions=1,photosPerExecution=0){
  const d=documentV2(),template=clone(d.logs[key]),recipe=clone(d.recipeRevisions.rev1);d.logs={};d.recipeRevisions={};d.events[0].repeat='daily';
  for(let r=1;r<=revisions;r++){const id='rev'+r;d.recipeRevisions[id]={...clone(recipe),id,definition:{...clone(recipe.definition),title:'Synthetic revision '+r}};}
  for(let i=0;i<executions;i++){
    const date=new Date(Date.UTC(2030,0,7+i)).toISOString().slice(0,10),l=clone(template),stamp=date+'T12:00:00Z';
    Object.assign(l.history.capture,{executionId:'execution-'+i,scheduledDate:date,capturedAt:stamp,recipeRevisionId:'rev'+(i%revisions+1)});l.history.state.lastRecordedAt=stamp;
    l.evidences=Array.from({length:photosPerExecution},(_,p)=>({id:'image-'+p,kind:'image',src,caption:'Synthetic compressed pattern',stepId:'one',createdAt:stamp}));d.logs['event@'+date]=l;
  }
  return d;
}
module.exports={growth};
