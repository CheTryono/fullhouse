'use strict';
const {copy,freeze}=require('./json.cjs');
const {validateV2}=require('./codec.cjs');
const {resolve}=require('./resolution.cjs');
function dateOf(key){const m=/@(\d{4}-\d{2}-\d{2})$/.exec(key);return m?m[1]:null;}
function catalog(r){const map=new Map();function walk(steps){for(const s of steps){map.set(s.id,s);walk(s.children || []);for(const v of s.variants || [])walk(v.children || []);}}if(r)walk(r.steps);return map;}
function createReader(legacy,schedule){
  function read(document,key,options={}){
    try { return readCopied(copy(document),key,options); }
    catch { return freeze({kind:'incomplete',key,date:dateOf(key),label:'Información histórica incompleta · necesita recuperación',errors:['Documento no interpretable']}); }
  }
  function readCopied(doc,key,{estimate=false}={}){
    let fallbackFacts;
    try {
      const log=doc.logs[key];if(!log)return freeze({kind:'missing',key,label:'No hay registro'});
      if(![1,2].includes(doc.version))throw new Error('Versión desconocida');
      const facts={completed:log.completed,checkedSteps:log.checkedSteps,note:log.note || '',stepNotes:log.stepNotes || {},choices:log.choices || {},evidences:log.evidences || []};
      fallbackFacts=facts;
      if(doc.version===1 || log.history===undefined){
        if(!legacy({version:1,goals:[],routines:[],events:[],logs:{record:log}}))throw new Error('Registro heredado inválido');
        const base={kind:'legacy',key,date:dateOf(key),label:'Registro heredado · contexto desconocido',facts,tree:[]};
        if(!estimate)return freeze(base);
        const event=doc.events.find(e=>key===e.id+'@'+base.date),r=event && doc.routines.find(r=>r.id===event.routineId);
        if(!r)return freeze({...base,estimateUnavailable:true});
        const plan={durationMode:r.durationMode || 'steps',budgetMinutes:r.durationMin ?? event.minutes};
        try {
          const resolution=resolve(r,base.date,log.choices || {},plan);
          return freeze({...base,kind:'estimated',label:'Reconstrucción estimada · plantilla actual',source:'current-template',title:event.title,description:r.desc,tree:tree(r,resolution,log)});
        } catch { return freeze({...base,estimateUnavailable:true}); }
      }
      const h=log.history,c=h.capture,revision=c.recipeRevisionId===null?null:doc.recipeRevisions?.[c.recipeRevisionId];
      const minimal={version:2,goals:[],routines:[],events:[],logs:{record:log},recipeRevisions:revision?{[revision.id]:revision}:{}};
      const errors=validateV2(minimal,legacy);
      const collisions=Object.values(doc.logs).filter(l=>l.history && (l.history.capture?.executionId===c.executionId || l.history.capture?.seriesId===c.seriesId && l.history.capture?.scheduledDate===c.scheduledDate));
      if(errors.length || collisions.length!==1)return freeze({kind:'incomplete',key,label:'Información histórica incompleta · necesita recuperación',date:c.scheduledDate,eventId:c.sourceEventId,seriesId:c.seriesId,facts,errors:errors.length?errors:['Identidad duplicada']});
      const r=revision?.definition || null,index=catalog(r),units=h.resolution.unitStepIds,active=new Set(units);
      return freeze({kind:'historical',key,label:c.provenance==='recorded'?'Historial verificado':'Captura posterior a adopción · pasado no verificado',provenance:c.provenance,
        executionId:c.executionId,seriesId:c.seriesId,eventId:c.sourceEventId,date:c.scheduledDate,capturedAt:c.capturedAt,
        title:c.plan.title,description:c.plan.description,routineDescription:r?.desc || '',plan:c.plan,
        tree:tree(r,h.resolution,log),plannedMinutes:h.resolution.totalPlannedMinutes,facts,status:h.state,actualTiming:h.actualTiming,continuations:h.continuations,
        progress:{done:units.filter(id=>log.checkedSteps.includes(id)).length,total:h.resolution.unitsKnown?units.length:null,knownUnits:units.length},
        inactiveMarks:log.checkedSteps.filter(id=>!active.has(id)).map(id=>({id,title:index.get(id)?.title || id,note:log.stepNotes?.[id] || '',evidenceIds:facts.evidences.filter(e=>e.stepId===id).map(e=>e.id)})),
        corrections:h.corrections.map((x,i)=>({id:x.id,kind:x.kind,at:x.recordedAt,reason:x.reason,before:x.before,lifecycle:x.before.lifecycle || null,
          changedChoices:changedChoices(x.before.choices,h.corrections[i+1]?.before.choices || log.choices || {})}))});
    } catch {return freeze({kind:'incomplete',key,date:dateOf(key),label:'Información histórica incompleta · necesita recuperación',...(fallbackFacts?{facts:fallbackFacts}:{}),errors:['Registro no interpretable']});}
  }
  function tree(r,resolution,log){
    const index=catalog(r);
    function nodes(items){return items.map(n=>{const s=index.get(n.stepId),v=n.variantId===null?null:s.variants.find(v=>v.id===n.variantId),selected=v || s;
      return {id:n.stepId,title:selected.title || s.title,description:selected.desc || '',variantId:n.variantId,decisionPending:n.decisionPending,
        plannedMinutes:n.plannedMinutes,flexible:!!selected.flexible,checked:log.checkedSteps.includes(n.stepId),note:log.stepNotes?.[n.stepId] || '',
        evidenceIds:(log.evidences || []).filter(e=>e.stepId===n.stepId).map(e=>e.id),children:nodes(n.children)};});}
    return nodes(resolution.tree);
  }
  function changedChoices(a,b){return [...new Set([...Object.keys(a),...Object.keys(b)])].filter(k=>a[k]!==b[k]).map(stepId=>({stepId,from:a[stepId] ?? null,to:b[stepId] ?? null}));}
  function index(document){
    try {const doc=copy(document);if(!doc.logs || typeof doc.logs!=='object' || Array.isArray(doc.logs))throw new Error('Sin registros');return Object.keys(doc.logs).sort().map(key=>readCopied(doc,key));}
    catch {return [freeze({kind:'incomplete',key:'document',date:null,label:'Información histórica incompleta · necesita recuperación',errors:['Documento no interpretable']})];}
  }
  function timeline(doc,date){
    const all=index(doc),records=all.filter(v=>v.date===date || v.continuations?.some(c=>c.localDate===date));
    const scheduled=schedule.scheduled(doc,date);
    const entries=records.map(view=>({id:view.executionId?'execution:'+view.executionId:'log:'+view.key,kind:'record',view,continued:view.date!==date}));
    for(const {event,frame} of scheduled){
      const captured=records.some(v=>v.date===date && (v.eventId===event.id || v.seriesId && event.seriesId===v.seriesId || v.key===event.id+'@'+date));
      if(!captured)entries.push({id:'planned:'+event.id+'@'+date,kind:'planned',event:copy(event),frame:copy(frame)});
    }
    return freeze(entries);
  }
  function progress(doc,date){
    const records=index(doc).filter(v=>!date || v.date===date),verified=records.filter(v=>v.kind==='historical' && v.provenance==='recorded');
    const known=verified.filter(v=>v.progress.total!==null);
    const planned=date?schedule.scheduled(doc,date):[];
    const completedPlanned=planned.filter(({event})=>records.some(v=>(v.kind==='historical'?v.status.status==='completed':v.kind==='legacy' && v.facts.completed) && (v.eventId===event.id || v.seriesId && v.seriesId===event.seriesId || v.key===event.id+'@'+date))).length;
    return freeze({steps:{done:known.reduce((n,v)=>n+v.progress.done,0),total:known.reduce((n,v)=>n+v.progress.total,0),unknownExecutions:verified.length-known.length},
      executions:{completed:verified.filter(v=>v.status.status==='completed').length,total:verified.length},
      legacy:{total:records.filter(v=>v.kind==='legacy').length,completed:records.filter(v=>v.kind==='legacy' && v.facts.completed).length},
      incomplete:records.filter(v=>v.kind==='incomplete').length,adopted:records.filter(v=>v.kind==='historical' && v.provenance!=='recorded').length,
      scheduled:date?planned.length:null,planning:{completed:completedPlanned,total:date?planned.length:null,invalid:planned.filter(p=>!p.frame).length}});
  }
  return Object.freeze({read,index,timeline,progress});
}
module.exports={createReader};
