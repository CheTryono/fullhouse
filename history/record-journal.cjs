'use strict';
const {copy,same}=require('./json.cjs');
function facts(log){const result=copy(log);delete result.history;delete result.recordEdits;if(result.evidences){result.evidenceIds=result.evidences.map(e=>e.id);delete result.evidences;}return result;}
const hidden=log=>log.recordEdits?.entries.at(-1)?.hiddenAfter || [];
function append(old,next,{id,at,reason,type,hiddenAfter=hidden(old)}){
  if(typeof id!=='string'||!id.trim()||typeof reason!=='string'||!reason.trim())throw Error('La edición necesita identidad y motivo');
  const journal=copy(old.recordEdits || {format:1,original:facts(old),entries:[]});
  if(journal.entries.some(e=>e.id===id))throw Error('Identidad de edición reutilizada');
  journal.entries.push({id,at,reason,type,before:facts(old),after:facts(next),hiddenBefore:copy(hidden(old)),hiddenAfter:copy(hiddenAfter)});
  next.recordEdits=journal;return next;
}
function retained(old,next){
  if(!old.recordEdits)return !next.recordEdits || same(next.recordEdits.original,facts(old));
  return !!next.recordEdits && same(old.recordEdits.original,next.recordEdits.original) && same(old.recordEdits.entries,next.recordEdits.entries.slice(0,old.recordEdits.entries.length)) && (same(old.recordEdits.adoption,next.recordEdits.adoption) || !old.recordEdits.adoption && next.recordEdits.entries.at(-1)?.type==='adopt');
}
function validate(log,legacy){
  const j=log.recordEdits;if(!j)return [];
  const errors=[],ok=(v,s)=>{if(!v)errors.push(s);};
  const fields=(v,keys)=>v && typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
  const stamp=s=>typeof s==='string'&&/^\d{4}-\d\d-\d\dT/.test(s)&&Number.isFinite(Date.parse(s));
  const ids=a=>Array.isArray(a)&&a.every(x=>typeof x==='string'&&x.trim())&&new Set(a).size===a.length;
  if(!j || ![1].includes(j.format) || !Array.isArray(j.entries) || !j.entries.length || !Object.keys(j).every(k=>['format','original','entries','adoption'].includes(k)))return ['Diario incompatible'];
  const photoIds=(log.evidences || []).map(e=>e.id);
  function summary(value){
    if(!value || !Object.keys(value).every(k=>['completed','checkedSteps','note','stepNotes','choices','evidenceIds'].includes(k)))return false;
    const {evidenceIds,...rest}=value;
    return (evidenceIds===undefined || ids(evidenceIds)&&evidenceIds.every(i=>photoIds.includes(i))) && legacy({version:1,goals:[],routines:[],events:[],logs:{record:rest}});
  }
  ok(summary(j.original),'Hechos originales inválidos');let last=j.original,oldHidden=[],time=-Infinity;const seen=new Set();
  for(const e of j.entries){
    if(!fields(e,['id','at','reason','type','before','after','hiddenBefore','hiddenAfter'])){errors.push('Entrada de diario inválida');continue;}
    ok(typeof e.id==='string'&&e.id.trim()&&!seen.has(e.id),'ID de diario duplicado');seen.add(e.id);
    ok(stamp(e.at)&&Date.parse(e.at)>=time && (!log.history || Date.parse(e.at)>=Date.parse(log.history.capture.capturedAt)),'Fecha de diario inválida');time=Date.parse(e.at);
    ok(typeof e.reason==='string'&&e.reason.trim()&&['step','complete','reopen','note','choice','evidence','visibility','adopt','native'].includes(e.type),'Edición sin motivo/tipo');
    ok(summary(e.before)&&summary(e.after)&&same(last,e.before),'Cadena de hechos alterada');
    ok(ids(e.hiddenBefore)&&ids(e.hiddenAfter)&&e.hiddenAfter.every(i=>photoIds.includes(i))&&same(oldHidden,e.hiddenBefore),'Retirada de evidencia inválida');
    last=e.after;oldHidden=e.hiddenAfter;
  }
  ok(same(last,facts(log)),'Estado no corresponde al diario');
  if(j.adoption)ok(fields(j.adoption,['executionId','logKey','recordedAt','sourceRoutineId','recipeRevisionId'])&&stamp(j.adoption.recordedAt)&&['executionId','logKey','sourceRoutineId','recipeRevisionId'].every(k=>typeof j.adoption[k]==='string'&&j.adoption[k].trim()),'Adopción inválida');
  return errors;
}
module.exports={facts,hidden,append,retained,validate};
