const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { app, emptyData, plain } = require('./helpers/app.cjs');
const { documentV2, alternativesV2, clone, key, at } = require('./fixtures/history-v2.cjs');
const { validateV2, validateTransition, classifyBackup, checkpoint } = require('../contracts/history-v2.cjs');
const validator = app();
const legacy = value => validator.call('validData', value);
const valid = d => assert.deepEqual(validateV2(d, legacy), []);

test('contrato offline: captura parcial, fechas límite y duración real desconocida', () => valid(documentV2()));
test('contrato offline: completar por pasos o declaración explícita', () => {
  for (const source of ['manual', 'steps']) {
    const d = documentV2(), l = d.logs[key]; l.completed = true;
    if (source === 'steps') l.checkedSteps.push('two');
    Object.assign(l.history.state, { status: 'completed', completionSource: source, completedRecordedAt: at }); valid(d);
  }
});
test('contrato offline: cierre parcial y duración real declarada separada', () => {
  const d = documentV2(); d.logs[key].history.state.status = 'closed-partial';
  d.logs[key].history.actualTiming = { minutes: 17, source: 'manual', recordedAt: at }; valid(d);
  assert.equal(d.logs[key].history.resolution.totalPlannedMinutes, 30);
});
test('contrato offline: editar/eliminar plantilla conserva revisión y ejecución', () => {
  for (const action of ['edit-template', 'delete-template', 'reprogram']) {
    const before = documentV2(), after = clone(before);
    if (action === 'edit-template') after.routines[0].steps.push({ id: 'future', title: 'Future', min: 50 });
    if (action === 'delete-template') { after.routines = []; after.events = []; }
    if (action === 'reprogram') { after.logs['moved@2030-01-08'] = after.logs[key]; delete after.logs[key]; }
    assert.deepEqual(validateTransition(before, after, action, legacy), []);
  }
});
test('contrato offline: continuar otro día conserva identidad y fecha original', () => {
  const before = documentV2(), after = clone(before);
  after.logs[key].history.state.lastRecordedAt = '2030-01-08T12:00:00Z';
  after.logs[key].history.continuations.push({ recordedAt: '2030-01-08T12:00:00Z', localDate: '2030-01-08', timezoneOffsetMinutes: 60 });
  assert.deepEqual(validateTransition(before, after, 'continue', legacy), []);
});
test('contrato offline: corregir alternativa conserva marcas, nota y evidencia anterior', () => {
  const before = alternativesV2(), after = clone(before), l = after.logs[key]; valid(before);
  l.history.corrections.push({ id: 'correction1', recordedAt: at, reason: 'Synthetic correction', kind: 'choice', before: clone(checkpoint(before.logs[key])) });
  l.choices.parent = 'option';
  l.history.resolution.tree[0].variantId = 'option'; l.history.resolution.tree[0].plannedMinutes = 20;
  l.history.resolution.tree[0].children[0].stepId = 'two'; l.history.resolution.tree[0].children[0].plannedMinutes = 20;
  l.history.resolution.unitStepIds = ['two']; l.history.resolution.totalPlannedMinutes = 20;
  assert.deepEqual(validateTransition(before, after, 'correct-choice', legacy), []);
  l.checkedSteps = []; assert.ok(validateTransition(before, after, 'correct-choice', legacy).length);
  assert.equal(JSON.stringify(after).split('data:image/jpeg;base64,AA==').length - 1, 1);
});
const malformed = {
  'referencia inexistente': d => { d.logs[key].history.capture.recipeRevisionId = 'missing'; },
  'duración real inventada': d => { d.logs[key].history.actualTiming = { minutes: 30, source: 'planned', recordedAt: at }; },
  'intervalo posterior a medianoche': d => { d.logs[key].history.capture.plan.window.endMin = 1441; },
  'paso desconocido': d => { d.logs[key].checkedSteps.push('unknown'); },
  'unidades incoherentes': d => { d.logs[key].history.resolution.unitStepIds = []; },
  'ejecución duplicada': d => { d.logs.other = clone(d.logs[key]); },
  'captura falsa del legado': d => { d.logs[key].history.capture.provenance = 'verified-legacy'; },
  'auditoría malformada': d => { d.logs[key].history.corrections = [{ before: { evidenceIds: 'bad' } }]; },
};
for (const [name, change] of Object.entries(malformed)) test(`contrato offline rechaza ${name}`, () => {
  const d = documentV2(); change(d); assert.ok(validateV2(d, legacy).length);
});
test('contrato offline: revisión, captura y fotografías no se pueden borrar ni reescribir', () => {
  const before = documentV2();
  for (const change of [d => { d.recipeRevisions.rev1.definition.title = 'Changed'; }, d => { d.logs[key].history.capture.scheduledDate = '2030-01-08'; },
    d => { d.logs[key].evidences = []; }, d => { d.logs = {}; }]) {
    const after = clone(before); change(after); assert.ok(validateTransition(before, after, 'progress', legacy).length);
  }
});
test('compatibilidad: exportaciones sintéticas reales 0.1–0.9 sin mutación ni reconstrucción', () => {
  const dir = path.join(__dirname, 'fixtures/historical');
  const files = fs.readdirSync(dir).filter(f => /^v\d+\.json$/.test(f));
  assert.equal(files.length, 9);
  for (const file of files) {
    const d = JSON.parse(fs.readFileSync(path.join(dir, file))).data, original = clone(d);
    assert.equal(classifyBackup(d, legacy).kind, 'legacy', file); assert.deepEqual(d, original);
  }
});
test('contrato offline: coexistencia de legado desconocido y captura verificable; validación pura', () => {
  const d = documentV2(); d.logs['legacy@2029-01-01'] = { completed: true, checkedSteps: ['lost-id'], note: 'Original fact' };
  const original = clone(d); assert.equal(classifyBackup(d, legacy).kind, 'history-v2'); assert.deepEqual(d, original);
  assert.equal(d.logs['legacy@2029-01-01'].history, undefined);
});
test('producción sigue rechazando v2 sin sustituir memoria ni almacenamiento v1', async () => {
  const data = emptyData(), stored = JSON.stringify(data), a = app({ data, stored: { 'fullhouse-v01': stored } });
  await a.importBackup(JSON.stringify(documentV2()));
  assert.deepEqual(plain(a.controller.state.data), data); assert.equal(a.storage.get('fullhouse-v01'), stored);
  assert.equal(a.storage.has('fullhouse-v02'), false);
});
test('contrato offline: elección pendiente no inventa minutos ni permite completado', () => {
  const d = alternativesV2(), l = d.logs[key]; delete l.choices; l.checkedSteps = [];
  l.history.resolution = { rule: 'leaf-count-v1', tree: [{ stepId: 'parent', variantId: null, plannedMinutes: null, decisionPending: true, children: [] }],
    unitStepIds: [], unitsKnown: false, totalPlannedMinutes: null }; valid(d);
  l.completed = true; Object.assign(l.history.state, { status: 'completed', completionSource: 'manual', completedRecordedAt: at });
  assert.ok(validateV2(d, legacy).length);
});
test('contrato offline: reparto fijo/flexible conserva asignación, no recalcula plantilla', () => {
  const d = documentV2(), l = d.logs[key];
  d.recipeRevisions.rev1.definition.steps[1].flexible = true;
  l.history.capture.plan.durationMode = 'fixed'; l.history.capture.plan.budgetMinutes = 60;
  l.history.resolution.tree[1].plannedMinutes = 50; l.history.resolution.totalPlannedMinutes = 60; valid(d);
  l.history.resolution.totalPlannedMinutes = 30; assert.ok(validateV2(d, legacy).length);
});
test('contrato offline: actividad sin rutina no necesita definición histórica ficticia', () => {
  const d = documentV2(), l = d.logs[key]; l.checkedSteps = []; l.evidences = [];
  Object.assign(l.history.capture, { sourceRoutineId: null, recipeRevisionId: null });
  l.history.capture.plan.kind = 'activity'; l.history.capture.plan.durationMode = 'event';
  l.history.resolution = { rule: 'leaf-count-v1', tree: [], unitStepIds: [], unitsKnown: true, totalPlannedMinutes: 60 }; valid(d);
});
test('contrato offline: reabrir conserva el checkpoint del completado anterior', () => {
  const before = documentV2(), l = before.logs[key]; l.completed = true;
  Object.assign(l.history.state, { status: 'completed', completionSource: 'manual', completedRecordedAt: at });
  const after = clone(before), next = after.logs[key]; next.completed = false;
  Object.assign(next.history.state, { status: 'active', completionSource: null, completedRecordedAt: null });
  next.history.corrections.push({ id: 'reopen1', recordedAt: at, reason: 'Synthetic reopening', kind: 'reopen', before: clone(checkpoint(l)) });
  assert.deepEqual(validateTransition(before, after, 'reopen', legacy), []);
});
