'use strict';
// Validador OFFLINE del contrato, no un lector/escritor de producción.
// No I/O, migraciones, acceso a storage ni dependencia de React.
const { copy, freeze, same } = require('./json.cjs');
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const text = v => typeof v === 'string';
const id = v => text(v) && v.trim().length > 0;
const number = v => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const stamp = v => text(v) && /^\d{4}-\d\d-\d\dT/.test(v) && Number.isFinite(Date.parse(v));
const day = v => text(v) && /^\d{4}-\d\d-\d\d$/.test(v) && Number.isFinite(Date.parse(v + 'T12:00:00Z')) && new Date(v + 'T12:00:00Z').toISOString().slice(0, 10) === v;
const strings = v => Array.isArray(v) && v.every(id) && new Set(v).size === v.length;
const subset = (a, b) => a.every(x => b.includes(x));
function checkpoint(log) {
  return { completed: log.completed, checkedSteps: log.checkedSteps, choices: log.choices || {}, note: log.note || '',
    stepNotes: log.stepNotes || {}, evidenceIds: (log.evidences || []).map(e => e.id), resolution: log.history.resolution, lifecycle: log.history.state };
}
function recipeIndex(definition) {
  const steps = new Map();
  const visit = list => { for (const s of list) { steps.set(s.id, s); visit(s.children || []); for (const v of s.variants || []) visit(v.children || []); } };
  visit(definition.steps); return steps;
}
function validateV2(doc, isLegacyData) {
  if (typeof isLegacyData !== 'function') throw new TypeError('A real version-1 validator is required');
  const errors = [], check = (ok, label) => { if (!ok) errors.push(label); return ok; };
  if (!check(object(doc) && doc.version === 2, 'version must be 2')) return errors;
  // Validate the unchanged legacy payload using the existing application codec.
  if (!check(isLegacyData({ ...doc, version: 1 }), 'invalid legacy payload')) return errors;
  if (!check(object(doc.recipeRevisions), 'recipeRevisions must be a dictionary')) return errors;
  for (const [key, r] of Object.entries(doc.recipeRevisions)) {
    if (!check(object(r) && r.id === key && id(r.sourceRoutineId) && stamp(r.createdAt), 'invalid recipe revision')) continue;
    check(isLegacyData({ version: 1, goals: [], routines: [r.definition], events: [], logs: {} }), 'invalid recipe definition');
    check(r.definition?.id === r.sourceRoutineId, 'recipe source must match definition');
  }
  if (errors.length) return errors;
  const executions = new Set(), occurrences = new Set();
  for (const [key, log] of Object.entries(doc.logs)) {
    if (log.history === undefined) continue; // Legacy facts remain unmodified.
    const h = log.history;
    if (!check(object(h) && object(h.capture) && object(h.state), `invalid history ${key}`)) continue;
    const c = h.capture;
    check(c.format === 1 && id(c.executionId) && id(c.seriesId) && id(c.sourceEventId), 'invalid capture identity');
    check(!executions.has(c.executionId), 'duplicate executionId'); executions.add(c.executionId);
    const occurrence = JSON.stringify([c.seriesId, c.scheduledDate]);
    check(!occurrences.has(occurrence), 'duplicate series/date occurrence'); occurrences.add(occurrence);
    check(day(c.scheduledDate) && stamp(c.capturedAt), 'invalid capture date');
    check(['complete', 'step', 'choice', 'note', 'evidence'].includes(c.captureReason), 'invalid capture reason');
    check(['recorded', 'adopted-current'].includes(c.provenance), 'invalid provenance');
    check(c.sourceRoutineId === null || id(c.sourceRoutineId), 'invalid sourceRoutineId');
    const recipe = c.recipeRevisionId === null ? null : doc.recipeRevisions[c.recipeRevisionId];
    if (!check(c.recipeRevisionId === null || !!recipe, 'missing recipe reference')) continue;
    check(recipe ? recipe.sourceRoutineId === c.sourceRoutineId : c.sourceRoutineId === null, 'inconsistent recipe source');
    const p = c.plan;
    if (!check(object(p), 'missing captured plan')) continue;
    check(id(p.title) && text(p.description) && typeof p.allDay === 'boolean', 'invalid plan labels');
    check(['activity', 'routine', 'review', 'occasion'].includes(p.kind) && ['steps', 'fixed', 'between', 'event'].includes(p.durationMode), 'invalid plan mode');
    check(p.budgetMinutes === null || number(p.budgetMinutes), 'invalid planned budget');
    if (p.window !== null) check(object(p.window) && number(p.window.startMin) && number(p.window.endMin) && p.window.startMin < p.window.endMin && p.window.endMin <= 1440, 'invalid planned window');
    check(Array.isArray(p.goals) && p.goals.every(g => object(g) && id(g.id) && (g.title === null || text(g.title)) && (g.area === undefined || ['mind', 'physical', 'purpose', 'social', 'other'].includes(g.area)) && (g.color === undefined || text(g.color))), 'invalid captured goals');
    const index = recipe ? recipeIndex(recipe.definition) : new Map();
    const evidenceIds = (log.evidences || []).map(e => e.id);
    check(new Set(evidenceIds).size === evidenceIds.length, 'duplicate evidence');
    if (recipe) {
      check(log.checkedSteps.every(s => index.has(s)), 'unknown checked step');
      for (const [s, choice] of Object.entries(log.choices || {})) check(index.has(s) && (choice === '__base' || (index.get(s).variants || []).some(v => v.id === choice)), 'unknown choice');
      check(Object.keys(log.stepNotes || {}).every(s => index.has(s)), 'unknown step note');
      check((log.evidences || []).every(e => !e.stepId || index.has(e.stepId)), 'unknown evidence step');
    }
    const resolution = h.resolution;
    if (!check(object(resolution) && resolution.rule === 'leaf-count-v1' && Array.isArray(resolution.tree) && strings(resolution.unitStepIds) && typeof resolution.unitsKnown === 'boolean', 'invalid resolution')) continue;
    const seen = new Set(), leaves = [];
    let sum = 0, pending = false;
    const visit = (nodes, allowed) => {
      const byId = new Map(allowed.map(s=>[s.id,s]));
      for (const node of nodes) {
        if (!check(object(node) && id(node.stepId) && typeof node.decisionPending === 'boolean' && Array.isArray(node.children), 'invalid resolved node')) continue;
        const source = byId.get(node.stepId);
        if (!check(!!source && !seen.has(node.stepId), 'invalid resolved topology')) continue;
        seen.add(node.stepId);
        const variant = node.variantId === null ? null : (source.variants || []).find(v => v.id === node.variantId);
        check(node.variantId === null || !!variant, 'unknown resolved alternative');
        if (source.mode === 'alternatives' && source.chooseWhen === 'execute' && !node.decisionPending) check((log.choices || {})[source.id] === (node.variantId || '__base'), 'choice/resolution mismatch');
        const selected = variant || source;
        if (node.decisionPending) { pending = true; check(node.plannedMinutes === null && node.children.length === 0, 'unresolved branch must not claim a duration'); }
        else {
          check(number(node.plannedMinutes) || (node.plannedMinutes === null && node.children.length > 0), 'invalid resolved minutes');
          if ((selected.children || []).length) { visit(node.children, selected.children); if (!node.children.length) { leaves.push(node.stepId); sum += node.plannedMinutes; } }
          else { check(node.children.length === 0, 'unexpected resolved children'); if(!selected.flexible)check(node.plannedMinutes===selected.min,'fixed leaf allocation changed'); leaves.push(node.stepId); sum += node.plannedMinutes; }
        }
      }
    };
    if (recipe) visit(resolution.tree, recipe.definition.steps);
    else check(resolution.tree.length === 0, 'plain activity must not invent routine steps');
    check(resolution.unitsKnown === !pending, 'resolution certainty mismatch');
    check(same([...resolution.unitStepIds].sort(), [...leaves].sort()), 'incorrect progress units');
    if (pending) check(resolution.totalPlannedMinutes === null, 'unresolved total must be unknown');
    else check(number(resolution.totalPlannedMinutes) && (!recipe || Math.abs(resolution.totalPlannedMinutes - sum) < 1e-8), 'incorrect planned total');
    if (!pending && ['fixed', 'between'].includes(p.durationMode)) check(p.budgetMinutes === resolution.totalPlannedMinutes, 'allocation must match the frozen budget');
    check(['active', 'completed', 'closed-partial'].includes(h.state.status) && stamp(h.state.lastRecordedAt), 'invalid lifecycle');
    check(log.completed === (h.state.status === 'completed'), 'completion state mismatch');
    if (log.completed) {
      check(!pending && stamp(h.state.completedRecordedAt) && ['manual', 'steps'].includes(h.state.completionSource), 'invalid completion metadata');
      if (h.state.completionSource === 'steps') check(resolution.unitStepIds.length > 0 && subset(resolution.unitStepIds, log.checkedSteps), 'automatic completion requires all units');
    } else check(h.state.completedRecordedAt === null && h.state.completionSource === null, 'inactive completion metadata');
    check(h.actualTiming === null || (object(h.actualTiming) && number(h.actualTiming.minutes) && ['manual', 'timer'].includes(h.actualTiming.source) && stamp(h.actualTiming.recordedAt)), 'actual duration needs a measured/declared source');
    check(Array.isArray(h.continuations) && h.continuations.every(x => object(x) && stamp(x.recordedAt) && day(x.localDate) && Number.isInteger(x.timezoneOffsetMinutes) && Math.abs(x.timezoneOffsetMinutes) <= 840), 'invalid continuation');
    if (check(Array.isArray(h.corrections), 'invalid corrections')) for (const correction of h.corrections) {
      const old = correction?.before;
      check(object(correction) && id(correction.id) && stamp(correction.recordedAt) && id(correction.reason) && ['choice', 'reopen'].includes(correction.kind), 'invalid correction metadata');
      check(object(old) && typeof old.completed === 'boolean' && strings(old.checkedSteps) && object(old.choices) && text(old.note) && object(old.stepNotes) && strings(old.evidenceIds) && object(old.resolution), 'invalid correction checkpoint');
      if (Array.isArray(old?.evidenceIds)) check(subset(old.evidenceIds, evidenceIds), 'correction references missing evidence');
      check(!Object.hasOwn(old || {}, 'evidences') && !Object.hasOwn(old || {}, 'src'), 'checkpoint must reference images, not duplicate them');
    }
  }
  for (const e of doc.events) {
    if (e.seriesId !== undefined) check(id(e.seriesId), 'invalid event series');
    if (e.recipeRevisionId !== undefined) check(!!doc.recipeRevisions[e.recipeRevisionId] && doc.recipeRevisions[e.recipeRevisionId].sourceRoutineId === e.routineId, 'missing event recipe reference');
  }
  return errors;
}

const { matchesTopology } = require('./resolution.cjs');
const own = (obj, key) => Object.hasOwn(obj, key);
function strengthen(doc, isLegacyData) {
  const errors = [], check = (ok, label) => { if (!ok) errors.push(label); return ok; };
  function fields(v, required, optional = []) {
    return check(object(v) && required.every(k => own(v,k)) && Object.keys(v).every(k => [...required,...optional].includes(k)), 'missing/unknown model field');
  }
  const dictionary = v => check(object(v) && Object.keys(v).every(k => id(k) && !['__proto__','constructor','prototype'].includes(k)), 'unsafe dictionary');
  const unique = a => check(new Set(a).size === a.length, 'duplicate identifier');
  const ts = s => stamp(s) && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?(?:Z|[+-]\d\d:\d\d)$/.test(s) && day(s.slice(0,10));
  fields(doc,['version','goals','routines','events','logs','recipeRevisions'],['dayReviews']);
  dictionary(doc.logs); dictionary(doc.recipeRevisions);
  for (const g of doc.goals) {
    fields(g,['id','title','desc','parentId','color','current','target','unit','history'],['area','mode','status','startDate','dueDate','dependsOn','milestones','review']);
    for (const h of g.history) fields(h,['date','value','note'],['status']);
    for (const m of g.milestones || []) fields(m,['id','title','done']);
    unique((g.milestones || []).map(m=>m.id));
    if (g.review) fields(g.review,['date','time','repeat']);
  }
  function recipe(r) {
    fields(r,['id','title','desc','steps'],['color','icon','durationMode','durationMin','requestEvidence']);
    function steps(list) { for (const s of list) {
      fields(s,['id','title','min'],['desc','children','variants','mode','days','chooseWhen','flexible','flexWeight','goalId','requestEvidence']);
      check(!(s.variants || []).some(v=>v.id==='__base'), 'reserved alternative id');
      unique(s.days || []);
      for (const v of s.variants || []) { fields(v,['id','title','desc','min','days'],['children','flexible','flexWeight','goalId','requestEvidence']); unique(v.days); steps(v.children || []); }
      steps(s.children || []);
    } }
    steps(r.steps);
  }
  doc.routines.forEach(recipe);
  for (const r of Object.values(doc.recipeRevisions)) { fields(r,['id','sourceRoutineId','createdAt','definition']); recipe(r.definition); check(ts(r.createdAt),'invalid revision timestamp'); }
  for (const e of doc.events) {
    fields(e,['id','title','date','time','minutes','goalId','routineId','repeat','note','overrides'],['endDate','applyFrom','repeatDays','everyDays','specificDates','kind','allDay','anchor','endTime','afterRoutineId','beforeRoutineId','overlapMode','requestEvidence','seriesId','recipeRevisionId']);
    for (const x of Object.values(e.overrides)) fields(x,[],['time','skip']);
    unique(e.repeatDays || []); unique(e.specificDates || []);
  }
  for (const r of Object.values(doc.dayReviews || {})) fields(r,['note','closedAt']);
  for (const log of Object.values(doc.logs)) {
    fields(log,['completed','checkedSteps'],['note','choices','stepNotes','evidences','history']);
    unique(log.checkedSteps); dictionary(log.choices || {}); dictionary(log.stepNotes || {});
    for (const e of log.evidences || []) fields(e,['id','kind','src','caption','createdAt'],['stepId']);
    unique((log.evidences || []).map(e=>e.id));
    if (!log.history) continue;
    const h=log.history,c=h.capture,p=c.plan,r=c.recipeRevisionId===null?null:doc.recipeRevisions[c.recipeRevisionId].definition;
    fields(h,['capture','resolution','state','actualTiming','continuations','corrections']);
    fields(c,['format','executionId','seriesId','sourceEventId','sourceRoutineId','scheduledDate','capturedAt','captureReason','provenance','recipeRevisionId','plan']);
    fields(p,['title','description','kind','allDay','durationMode','window','budgetMinutes','goals']);
    if (p.window) fields(p.window,['startMin','endMin']);
    unique(p.goals.map(g=>g.id)); p.goals.forEach(g=>fields(g,['id','title'],['area','color']));
    check(ts(c.capturedAt),'invalid capture timestamp');
    if(c.recipeRevisionId!==null) check(Date.parse(c.capturedAt)>=Date.parse(doc.recipeRevisions[c.recipeRevisionId].createdAt),'capture predates recipe');
    if(p.window && p.budgetMinutes!==null) check(Math.abs(p.window.endMin-p.window.startMin-p.budgetMinutes)<1e-8,'window/budget mismatch');
    const evidenceSteps=r?recipeIndex(r):new Map();
    check((log.evidences || []).every(e=>!e.stepId || evidenceSteps.has(e.stepId)),'evidence refers to unknown step');
    fields(h.state,['status','completionSource','lastRecordedAt','completedRecordedAt']);
    check(ts(h.state.lastRecordedAt) && Date.parse(h.state.lastRecordedAt)>=Date.parse(c.capturedAt),'invalid lifecycle chronology');
    if(h.state.completedRecordedAt!==null) check(ts(h.state.completedRecordedAt) && Date.parse(h.state.completedRecordedAt)>=Date.parse(c.capturedAt) && Date.parse(h.state.completedRecordedAt)<=Date.parse(h.state.lastRecordedAt),'invalid completion chronology');
    if(h.actualTiming!==null) { fields(h.actualTiming,['minutes','source','recordedAt']); check(ts(h.actualTiming.recordedAt) && Date.parse(h.actualTiming.recordedAt)>=Date.parse(c.capturedAt),'invalid actual timestamp'); }
    let continuationAt=Date.parse(c.capturedAt);
    for(const x of h.continuations) { fields(x,['recordedAt','localDate','timezoneOffsetMinutes']); check(ts(x.recordedAt) && Date.parse(x.recordedAt)>=continuationAt && Date.parse(x.recordedAt)<=Date.parse(h.state.lastRecordedAt),'invalid continuation chronology'); continuationAt=Date.parse(x.recordedAt); }
    unique(h.corrections.map(x=>x.id));
    let correctionAt=Date.parse(c.capturedAt);
    for(const x of h.corrections) {
      fields(x,['id','recordedAt','reason','kind','before']);
      check(ts(x.recordedAt) && Date.parse(x.recordedAt)>=correctionAt && Date.parse(x.recordedAt)<=Date.parse(h.state.lastRecordedAt),'invalid correction chronology'); correctionAt=Date.parse(x.recordedAt);
      fields(x.before,['completed','checkedSteps','choices','note','stepNotes','evidenceIds','resolution'],['lifecycle']);
      if(x.before.lifecycle!==undefined) {
        const state=x.before.lifecycle;
        fields(state,['status','completionSource','lastRecordedAt','completedRecordedAt']);
        check(x.kind==='reopen'?['completed','closed-partial'].includes(state.status):state.status==='active','correction kind/prior state mismatch');
        check(['active','completed','closed-partial'].includes(state.status) && x.before.completed===(state.status==='completed'),'invalid prior lifecycle');
        check(ts(state.lastRecordedAt) && Date.parse(state.lastRecordedAt)>=Date.parse(c.capturedAt) && Date.parse(state.lastRecordedAt)<=Date.parse(x.recordedAt),'invalid prior lifecycle time');
        if(state.completionSource==='steps')check(x.before.resolution.unitsKnown && x.before.resolution.unitStepIds.length>0 && x.before.resolution.unitStepIds.every(id=>x.before.checkedSteps.includes(id)),'prior automatic completion missing units');
        check(state.status==='completed' ? ['manual','steps'].includes(state.completionSource) && ts(state.completedRecordedAt) && Date.parse(state.completedRecordedAt)>=Date.parse(c.capturedAt) && Date.parse(state.completedRecordedAt)<=Date.parse(state.lastRecordedAt) : state.completionSource===null && state.completedRecordedAt===null,'invalid prior completion');
      }
      const fake=copy(log); delete fake.history; Object.assign(fake,{completed:x.before.completed,checkedSteps:x.before.checkedSteps,choices:x.before.choices,note:x.before.note,stepNotes:x.before.stepNotes});
      check(isLegacyData({version:1,goals:[],routines:[],events:[],logs:{audit:fake}}),'invalid audit payload');
      check(strings(x.before.evidenceIds) && subset(x.before.evidenceIds,(log.evidences || []).map(e=>e.id)),'invalid audit evidence');
      resolved(x.before.resolution,x.before.choices,x.before.checkedSteps,x.before.stepNotes);
    }
    resolved(h.resolution,log.choices || {},log.checkedSteps,log.stepNotes || {});
    function resolved(res,choices,checked,notes) {
      fields(res,['rule','tree','unitStepIds','unitsKnown','totalPlannedMinutes']);
      const catalog=r?recipeIndex(r):new Map();
      check(strings(checked) && checked.every(k=>catalog.has(k)),'invalid historical marks');
      dictionary(choices); dictionary(notes);
      check(Object.keys(notes).every(k=>catalog.has(k)),'invalid historical notes');
      for(const [k,v] of Object.entries(choices)) check(catalog.has(k) && (catalog.get(k).mode==='alternatives' || (catalog.get(k).variants || []).length) && catalog.get(k).chooseWhen==='execute' && (v==='__base' || (catalog.get(k).variants || []).some(x=>x.id===v)), 'invalid historical choice');
      if(!check(object(res) && res.rule==='leaf-count-v1' && Array.isArray(res.tree) && strings(res.unitStepIds) && typeof res.unitsKnown==='boolean','invalid historical resolution')) return;
      let sum=0, pending=false; const leaves=[],seen=new Set();
      function nodes(items) { let total=0, unknown=false; for(const n of items) {
        if(!fields(n,['stepId','variantId','plannedMinutes','decisionPending','children']) || !Array.isArray(n.children)) { unknown=true; continue; }
        check(id(n.stepId) && !seen.has(n.stepId),'duplicate resolved step'); seen.add(n.stepId);
        check(n.variantId===null || id(n.variantId),'invalid resolved variant id');
        check(typeof n.decisionPending==='boolean','invalid pending flag');
        if(n.decisionPending) { pending=true; unknown=true; check(n.plannedMinutes===null && n.children.length===0,'invalid unresolved duration'); }
        else if(n.children.length) { const child=nodes(n.children); check(child===null?n.plannedMinutes===null:number(n.plannedMinutes)&&Math.abs(n.plannedMinutes-child)<1e-8,'invalid parent allocation'); if(child===null) unknown=true; else total+=child; }
        else { check(number(n.plannedMinutes),'invalid leaf allocation'); leaves.push(n.stepId); total+=n.plannedMinutes; }
      } return unknown?null:total; }
      sum=nodes(res.tree);
      check(res.unitsKnown===!pending && same(res.unitStepIds,leaves),'invalid denominator');
      check(sum===null?res.totalPlannedMinutes===null:number(res.totalPlannedMinutes)&&(!r || Math.abs(sum-res.totalPlannedMinutes)<1e-8),'invalid historical sum');
      if(r) check(matchesTopology(res,r,c.scheduledDate,choices,p),'historical topology does not match frozen recipe');
      else check(res.tree.length===0 && res.unitStepIds.length===0 && same(res.totalPlannedMinutes,p.budgetMinutes ?? 0),'invalid plain execution');
      if(!pending && ['fixed','between'].includes(p.durationMode)) check(res.totalPlannedMinutes===p.budgetMinutes,'invalid historical budget');
    }
  }
  return errors;
}
function validateSafe(doc, legacy) {
  try {
    const clean=copy(doc), errors=validateV2(clean,legacy);
    return errors.length?errors:strengthen(clean,legacy);
  } catch { return ['Malformed or excessively complex history document']; }
}
function classifySafe(doc, legacy) {
  try {
    const clean=copy(doc);
    if(clean?.version===1) return legacy(clean)?{kind:'legacy',errors:[]}:{kind:'invalid',errors:['invalid legacy payload']};
    const errors=validateSafe(clean,legacy); return {kind:errors.length?'invalid':'history-v2',errors};
  } catch { return {kind:'invalid',errors:['Invalid JSON document']}; }
}
function transitionSafe(before, after, action, legacy, targetId) {
  const errors=[...validateSafe(before,legacy),...validateSafe(after,legacy)];
  if(errors.length) return errors;
  try {
    const b=copy(before),a=copy(after);
    const check=(ok,label)=>{if(!ok)errors.push(label);};
    const actions=['progress','complete','correct-choice','continue','close-partial','reopen','edit-template','delete-template','reprogram'];
    check(actions.includes(action),'unknown transition');
    for(const [k,r] of Object.entries(b.recipeRevisions)) check(same(r,a.recipeRevisions[k]),'historical recipe removed or mutated');
    const records=new Map(Object.values(a.logs).filter(l=>l.history).map(l=>[l.history.capture.executionId,l]));
    let changed=0;
    for(const [key,old] of Object.entries(b.logs)) {
      if(!old.history) { check(same(old,a.logs[key]),'legacy facts altered'); continue; }
      const next=records.get(old.history.capture.executionId);
      if(!next){errors.push('historical execution removed');continue;}
      if(same(old,next)) continue;
      changed++;
      check(!targetId || targetId===old.history.capture.executionId,'unrelated execution altered');
      const h=old.history,n=next.history;
      check(same(h.capture,n.capture),'capture mutated');
      check(Date.parse(n.state.lastRecordedAt)>=Date.parse(h.state.lastRecordedAt),'record time reversed');
      check(same(h.actualTiming,n.actualTiming),'actual duration changed by unrelated action');
      check((old.evidences || []).every(e=>same(e,(next.evidences || []).find(x=>x.id===e.id))),'evidence lost or overwritten');
      const corrected=action==='correct-choice'||action==='reopen';
      check(n.corrections.length===h.corrections.length+(corrected?1:0) && same(h.corrections,n.corrections.slice(0,h.corrections.length)),'audit changed unexpectedly');
      check(same(h.continuations,action==='continue'?n.continuations.slice(0,-1):n.continuations) && n.continuations.length===h.continuations.length+(action==='continue'?1:0),'invalid continuation transition');
      if(corrected) { const x=n.corrections.at(-1); check(x.kind===(action==='reopen'?'reopen':'choice') && same(x.before,checkpoint(old)),'missing prior checkpoint'); }
      if(action!=='correct-choice' && action!=='progress') check(same(old.choices || {},next.choices || {}) && same(h.resolution,n.resolution),'unexpected alternative change');
      if(action==='progress') {
        check(h.state.status==='active' && n.state.status==='active','progress requires active execution');
        // Only previously unresolved choices may resolve without a correction.
        check(Object.entries(old.choices || {}).every(([k,v])=>next.choices?.[k]===v),'existing choice needs explicit correction');
        if(same(old.choices || {},next.choices || {})) check(same(h.resolution,n.resolution),'unexpected allocation change');
      }
      if(action==='correct-choice') {
        check(h.state.status==='active' && n.state.status==='active','reopen before correcting closed execution');
        check(subset(old.checkedSteps,next.checkedSteps) && old.note===next.note && same(old.stepNotes || {},next.stepNotes || {}),'correction erased progress');
      }
      if(action==='reopen') check(['completed','closed-partial'].includes(h.state.status) && n.state.status==='active','invalid reopening');
      if(action==='complete') check(h.state.status==='active' && n.state.status==='completed','invalid completion');
      if(action==='close-partial') check(h.state.status==='active' && n.state.status==='closed-partial','invalid partial closure');
      if(action==='continue') check(h.state.status==='active' && n.state.status==='active','only active execution can continue');
      if(['edit-template','delete-template','reprogram'].includes(action)) check(false,'planning changed historical execution');
      if(!['progress','correct-choice'].includes(action)) check(same(old.checkedSteps,next.checkedSteps) && old.note===next.note && same(old.stepNotes || {},next.stepNotes || {}) && same(old.evidences || [],next.evidences || []),'unrelated progress changed');
    }
    // Action operates on one execution. Other records may be read, never rewritten.
    check(changed<=1,'multi-execution transition is not supported');
    for(const [key,l] of Object.entries(a.logs)) if(!l.history) check(same(l,b.logs[key]),'legacy facts added or changed by execution action');
    if(!['edit-template','delete-template','reprogram'].includes(action)) {
      check(same(b.goals,a.goals) && same(b.routines,a.routines) && same(b.dayReviews,a.dayReviews),'unrelated document section changed');
      const oldIds=new Set(Object.values(b.logs).filter(l=>l.history).map(l=>l.history.capture.executionId));
      const newRecords=Object.values(a.logs).filter(l=>l.history&&!oldIds.has(l.history.capture.executionId));
      check(newRecords.length<=1 && !(changed && newRecords.length),'multiple executions changed');
      check(b.events.length===a.events.length,'execution action changed event list');
      for(const e of b.events) {
        const next=a.events.find(x=>x.id===e.id);
        if(!next){errors.push('execution action removed event');continue;}
        const expected=copy(e);
        const created=newRecords.find(l=>l.history.capture.sourceEventId===e.id);
        if(created) {expected.seriesId=created.history.capture.seriesId; if(created.history.capture.recipeRevisionId)expected.recipeRevisionId=created.history.capture.recipeRevisionId;}
        check(same(expected,next),'execution action changed scheduling');
      }
      for(const l of newRecords) {
        const h=l.history;
        check(h.state.status===(action==='complete'?'completed':'active'),'new execution has wrong lifecycle');
        check(h.capture.provenance==='recorded','legacy adoption requires a separate explicit protocol');
        check(!!b.events.find(e=>e.id===h.capture.sourceEventId),'new execution has no source event');
        check(h.corrections.length===0 && h.continuations.length===0 && h.actualTiming===null,'new execution invented prior history');
      }
      const used=new Set(newRecords.map(l=>l.history.capture.recipeRevisionId).filter(Boolean));
      for(const k of Object.keys(a.recipeRevisions))if(!own(b.recipeRevisions,k))check(used.has(k),'execution action created unrelated revision');
    }
    return errors;
  } catch { return ['Invalid history transition']; }
}
function decode(raw,legacy) {
  try {
    if(typeof raw!=='string' || raw.length>32000000) throw new Error('Invalid JSON size');
    const parsed=JSON.parse(raw);
    // JSON.parse silently accepts duplicate object keys; the codec must not.
    const stack=[]; const tokens=raw.match(/"(?:[^"\\]|\\.)*"|[{}\[\]:]|[^\s{}\[\]:,]+/g)||[];
    for(let i=0;i<tokens.length;i++) { const t=tokens[i];
      if(t==='{' || t==='[')stack.push(t==='{'?new Set():null);
      else if(t==='}' || t===']')stack.pop();
      else if(t.startsWith('"') && tokens[i+1]===':') {const key=JSON.parse(t),set=stack.at(-1); if(set?.has(key))throw new Error('Duplicate JSON key');set?.add(key);}
    }
    const classification=classifySafe(parsed,legacy);
    if(classification.kind==='invalid') return {ok:false,errors:classification.errors};
    return {ok:true,kind:classification.kind,document:freeze(copy(parsed))};
  } catch { return {ok:false,errors:['Invalid JSON backup']}; }
}
function encode(doc,legacy) {
  const result=classifySafe(doc,legacy); if(result.kind==='invalid')throw new Error(result.errors.join('; '));
  return JSON.stringify(copy(doc));
}
module.exports={validateV2:validateSafe,validateTransition:transitionSafe,classifyBackup:classifySafe,checkpoint:log=>copy(checkpoint(log)),decode,encode};
