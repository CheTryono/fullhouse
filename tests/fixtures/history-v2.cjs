// Exclusivamente datos sintéticos. No representa una migración ejecutable.
const { emptyData, routine, step, event, DAY } = require('../helpers/app.cjs');
const clone = value => JSON.parse(JSON.stringify(value));
const key = `event@${DAY}`;
const at = `${DAY}T12:00:00Z`;
function documentV2() {
  const definition = routine('routine', { steps: [step('one', { min: 10 }), step('two', { min: 20 })] });
  return { ...emptyData(), version: 2, routines: [clone(definition)],
    recipeRevisions: { rev1: { id: 'rev1', sourceRoutineId: 'routine', createdAt: at, definition } },
    events: [event('event', { routineId: 'routine', seriesId: 'series1', recipeRevisionId: 'rev1' })],
    logs: { [key]: { completed: false, checkedSteps: ['one'], note: 'Synthetic observation',
      evidences: [{ id: 'photo1', kind: 'image', src: 'data:image/jpeg;base64,AA==', caption: 'Synthetic', stepId: 'one', createdAt: at }],
      history: { capture: { format: 1, executionId: 'execution1', seriesId: 'series1', sourceEventId: 'event', sourceRoutineId: 'routine',
        scheduledDate: DAY, capturedAt: at, captureReason: 'step', provenance: 'recorded', recipeRevisionId: 'rev1',
        plan: { title: 'Synthetic routine', description: '', kind: 'routine', allDay: false, durationMode: 'steps',
          window: { startMin: 1380, endMin: 1440 }, budgetMinutes: 60, goals: [] } },
        resolution: { rule: 'leaf-count-v1', tree: ['one', 'two'].map((stepId, i) => ({ stepId, variantId: null, plannedMinutes: i ? 20 : 10, decisionPending: false, children: [] })),
          unitStepIds: ['one', 'two'], unitsKnown: true, totalPlannedMinutes: 30 },
        state: { status: 'active', completionSource: null, lastRecordedAt: at, completedRecordedAt: null },
        actualTiming: null, continuations: [], corrections: [] } } } };
}
function alternativesV2() {
  const d = documentV2(), log = d.logs[key];
  const definition = routine('routine', { steps: [step('parent', { mode: 'alternatives', chooseWhen: 'execute',
    children: [step('one', { min: 10 })], variants: [{ id: 'option', title: 'Synthetic alternative', desc: '', min: 20, days: [], children: [step('two', { min: 20 })] }] })] });
  d.routines = [clone(definition)]; d.recipeRevisions.rev1.definition = definition;
  log.choices = { parent: '__base' };
  log.history.resolution = { rule: 'leaf-count-v1', tree: [{ stepId: 'parent', variantId: null, plannedMinutes: 10, decisionPending: false,
    children: [{ stepId: 'one', variantId: null, plannedMinutes: 10, decisionPending: false, children: [] }] }], unitStepIds: ['one'], unitsKnown: true, totalPlannedMinutes: 10 };
  return d;
}
module.exports = { documentV2, alternativesV2, clone, key, at };
