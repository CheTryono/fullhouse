// These are real failing assertions, intentionally separate from the passing
// regression baseline. Remove a case from this file when its bug is fixed.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { app, plain, DAY, emptyData, step, routine, event } = require('./helpers/app.cjs');

test('BUG-01: failed persistence must not leave an apparently saved in-memory replacement', () => {
  const before = { ...emptyData(), routines: [routine()] };
  const a = app({ data: before, stored: { 'fullhouse-v01': JSON.stringify(before) }, failWrite: true });
  a.controller.save(emptyData());
  assert.deepEqual(plain(a.controller.state.data), before, 'Until explicit unsaved-state recovery exists, preserve the last saved state');
});
test('BUG-02: backup validation must reject malformed nested entities', () => {
  const a = app();
  assert.equal(a.call('validData', { ...emptyData(), goals: [null] }), false);
});
test('BUG-03: importing a malformed entity must preserve the previous data and storage', async () => {
  const before = { ...emptyData(), routines: [routine()] };
  const a = app({ data: before, stored: { 'fullhouse-v01': JSON.stringify(before) } });
  await a.importBackup(JSON.stringify({ ...emptyData(), routines: [null] }));
  assert.deepEqual(plain(a.controller.state.data), before);
  assert.deepEqual(JSON.parse(a.storage.get('fullhouse-v01')), before);
});
test('BUG-04: shifting past midnight must reject the change and keep the event visible', () => {
  const e = event('late', { time: '23:00', minutes: 60 });
  const before = { ...emptyData(), events: [e] };
  const a = app({ data: before });
  a.controller.shiftEvent(e, DAY, 15);
  assert.equal(a.call('eventsOn', a.controller.state.data, DAY).length, 1, 'The shifted event must remain visible');
  assert.deepEqual(plain(a.controller.state.data), before);
});
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
