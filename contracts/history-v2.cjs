'use strict';
// Validador OFFLINE del contrato, no un lector/escritor de producción.
// No I/O, migraciones, acceso a storage ni dependencia de React.
const same = (a, b) => canonical(a) === canonical(b);
function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
  return JSON.stringify(value);
}
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
    stepNotes: log.stepNotes || {}, evidenceIds: (log.evidences || []).map(e => e.id), resolution: log.history.resolution };
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
      check(nodes.length === allowed.length, 'missing resolved sibling');
      for (const node of nodes) {
        if (!check(object(node) && id(node.stepId) && typeof node.decisionPending === 'boolean' && Array.isArray(node.children), 'invalid resolved node')) continue;
        const source = allowed.find(s => s.id === node.stepId);
        if (!check(!!source && !seen.has(node.stepId), 'invalid resolved topology')) continue;
        seen.add(node.stepId);
        const variant = node.variantId === null ? null : (source.variants || []).find(v => v.id === node.variantId);
        check(node.variantId === null || !!variant, 'unknown resolved alternative');
        if (source.mode === 'alternatives' && source.chooseWhen === 'execute' && !node.decisionPending) check((log.choices || {})[source.id] === (node.variantId || '__base'), 'choice/resolution mismatch');
        const selected = variant || source;
        if (node.decisionPending) { pending = true; check(node.plannedMinutes === null && node.children.length === 0, 'unresolved branch must not claim a duration'); }
        else {
          check(number(node.plannedMinutes), 'invalid resolved minutes');
          if ((selected.children || []).length) { check(node.children.length > 0, 'missing resolved children'); visit(node.children, selected.children); }
          else { check(node.children.length === 0, 'unexpected resolved children'); leaves.push(node.stepId); sum += node.plannedMinutes; }
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
      if (h.state.completionSource === 'steps') check(subset(resolution.unitStepIds, log.checkedSteps), 'automatic completion requires all units');
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
function classifyBackup(doc, isLegacyData) {
  if (doc?.version === 1) return { kind: isLegacyData(doc) ? 'legacy' : 'invalid', errors: isLegacyData(doc) ? [] : ['invalid legacy payload'] };
  const errors = validateV2(doc, isLegacyData); return { kind: errors.length ? 'invalid' : 'history-v2', errors };
}
function validateTransition(before, after, action, isLegacyData) {
  const errors = [...validateV2(before, isLegacyData), ...validateV2(after, isLegacyData)];
  if (!['progress', 'complete', 'correct-choice', 'continue', 'close-partial', 'reopen', 'edit-template', 'delete-template', 'reprogram'].includes(action)) errors.push('unknown transition');
  if (errors.length) return errors;
  const check = (ok, message) => { if (!ok) errors.push(message); };
  const afterRecords = new Map(Object.values(after.logs).filter(l => l.history).map(l => [l.history.capture.executionId, l]));
  for (const [id, recipe] of Object.entries(before.recipeRevisions)) check(same(recipe, after.recipeRevisions[id]), 'historical recipe removed or mutated');
  for (const old of Object.values(before.logs).filter(l => l.history)) {
    const next = afterRecords.get(old.history.capture.executionId);
    if (!next) { errors.push('historical execution removed'); continue; }
    check(same(old.history.capture, next.history.capture), 'capture identity/context mutated');
    check(next.history.corrections.length >= old.history.corrections.length && same(old.history.corrections, next.history.corrections.slice(0, old.history.corrections.length)), 'correction history replaced');
    check(subset((old.evidences || []).map(e => e.id), (next.evidences || []).map(e => e.id)), 'referenced evidence removed');
    for (const photo of old.evidences || []) check(same(photo, (next.evidences || []).find(e => e.id === photo.id)), 'evidence payload mutated');
    if (['edit-template', 'delete-template', 'reprogram'].includes(action)) check(same(old, next), 'planning change reinterpreted an execution');
    if (action === 'continue') check(next.history.continuations.length === old.history.continuations.length + 1 && same(old.history.continuations, next.history.continuations.slice(0, -1)), 'continuation must append without changing original dates');
    if (action === 'correct-choice' || action === 'reopen') {
      const correction = next.history.corrections.at(-1);
      check(next.history.corrections.length === old.history.corrections.length + 1 && correction?.kind === (action === 'reopen' ? 'reopen' : 'choice') && same(correction?.before, checkpoint(old)), 'explicit correction must preserve the previous checkpoint');
      check(subset(old.checkedSteps, next.checkedSteps), 'choice correction erased checked steps');
      check(old.note === next.note && same(old.stepNotes || {}, next.stepNotes || {}), 'choice correction erased notes');
    }
  }
  return errors;
}
module.exports = { validateV2, validateTransition, classifyBackup, checkpoint };
