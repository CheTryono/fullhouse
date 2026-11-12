// These are real failing assertions, intentionally separate from the passing
// regression baseline. Remove a case from this file when its bug is fixed.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { app, plain, DAY, emptyData, step, routine, event } = require('./helpers/app.cjs');

test('BUG-05: editing a routine must preserve the interpretation of completed historical steps', () => {
  const past = '2030-01-06';
  const e = event('history', { date: past, repeat: 'daily', routineId: 'routine' });
  const a = app({ data: { ...emptyData(), routines: [routine('routine', { steps: [step('original', { min: 10 })] })], events: [e],
    logs: { [`history@${past}`]: { completed: true, checkedSteps: ['original'] } } } });
  const snapshot = () => plain(a.call('routineForDay', e, past, a.controller.state.data)).map(({ id, min }) => ({ id, min }));
  const historicalSteps = snapshot();
  a.controller.state.routineDraft = routine('routine', { steps: [step('replacement', { min: 45 })] });
  a.controller.saveRoutine();
  assert.deepEqual(snapshot(), historicalSteps);
});
