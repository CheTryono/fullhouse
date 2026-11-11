const { test } = require('node:test');
const assert = require('node:assert/strict');
const { app, plain, DAY, emptyData, step, routine, event } = require('./helpers/app.cjs');

test('save persists version 1 and reload restores logs, choices, notes and evidence', () => {
  const data = { ...emptyData(), routines: [routine()], events: [event('event', { routineId: 'routine' })],
    logs: { [`event@${DAY}`]: { completed: true, checkedSteps: ['step'], note: 'Synthetic note',
      choices: { step: 'variant' }, evidences: [{ id: 'image', kind: 'image', src: 'data:image/jpeg;base64,AA==', createdAt: `${DAY}T12:00:00Z` }] } } };
  const a = app(); a.controller.save(data);
  assert.deepEqual(JSON.parse(a.storage.get('fullhouse-v01')), data);
  const b = app({ stored: Object.fromEntries(a.storage) });
  assert.deepEqual(plain(b.call('load')), data);
});
test('failed storage write warns and preserves previous persisted bytes', () => {
  const previous = JSON.stringify(emptyData());
  const a = app({ stored: { 'fullhouse-v01': previous }, failWrite: true });
  a.controller.save({ ...emptyData(), routines: [routine()] });
  assert.equal(a.storage.get('fullhouse-v01'), previous);
  assert.match(a.controller.state.toast, /No se pudo guardar/);
});
test('failed storage read returns usable examples without writing', () => {
  const a = app({ failRead: true });
  assert.equal(a.call('load').version, 1);
  assert.ok(a.call('load').routines.length > 0);
  assert.equal(a.storage.size, 0);
  assert.ok(a.warnings.length > 0);
});
test('legacy store is copied without removing the original', () => {
  const bytes = JSON.stringify(emptyData());
  const a = app({ stored: { 'botanica-planificador-v01': bytes } });
  assert.deepEqual(plain(a.call('load')), emptyData());
  assert.equal(a.storage.get('fullhouse-v01'), bytes);
  assert.equal(a.storage.get('botanica-planificador-v01'), bytes);
});
test('validation rejects invalid root structures and unsupported versions', () => {
  const a = app();
  for (const value of [null, {}, { ...emptyData(), version: 2 }, { ...emptyData(), goals: {} }, { ...emptyData(), logs: [] }]) {
    assert.equal(a.call('validData', value), false);
  }
});
test('valid backup import preserves synthetic history and asks confirmation', async () => {
  const data = { ...emptyData(), routines: [routine()], logs: { [`event@${DAY}`]: { completed: true, checkedSteps: ['step'] } } };
  const a = app(); const input = await a.importBackup(JSON.stringify(data));
  assert.deepEqual(plain(a.controller.state.data), data);
  assert.deepEqual(JSON.parse(a.storage.get('fullhouse-v01')), data);
  assert.equal(a.confirmations.length, 1);
  assert.equal(input.target.value, '');
});
test('cancelled backup import leaves memory and storage unchanged', async () => {
  const a = app(); await a.importBackup(JSON.stringify({ ...emptyData(), routines: [routine()] }), false);
  assert.deepEqual(plain(a.controller.state.data), emptyData());
  assert.equal(a.storage.size, 0);
});
test('invalid JSON and invalid root imports preserve current data', async () => {
  for (const text of ['{broken', JSON.stringify({ ...emptyData(), version: 99 })]) {
    const a = app({ data: { ...emptyData(), routines: [routine()] } });
    const before = plain(a.controller.state.data);
    await a.importBackup(text);
    assert.deepEqual(plain(a.controller.state.data), before);
    assert.equal(a.storage.size, 0);
    assert.match(a.controller.state.toast, /Archivo inválido/);
  }
});
test('routine creation saves named nested steps without changing schema', () => {
  const a = app();
  a.controller.state.routineDraft = routine('', { steps: [step('parent', { children: [step('child', { min: 12 })] })] });
  a.controller.saveRoutine();
  const saved = a.controller.state.data.routines[0];
  assert.ok(saved.id);
  assert.equal(saved.steps[0].min, 12);
  assert.equal(a.controller.state.data.version, 1);
});
test('invalid fixed-duration routine is rejected', () => {
  const a = app(); a.controller.state.routineDraft = routine('', { durationMode: 'fixed', durationMin: 5 });
  a.controller.saveRoutine();
  assert.equal(a.controller.state.data.routines.length, 0);
  assert.match(a.controller.state.toast, /distribución de tiempo/);
});
test('routine scheduling creates an occurrence and rejects a second future schedule', async () => {
  const a = app({ data: { ...emptyData(), routines: [routine()] } });
  a.controller.state.eventDraft = event('', { routineId: 'routine', minutes: 10, repeat: 'daily' });
  await a.controller.saveEvent();
  assert.equal(a.controller.state.data.events.length, 1);
  assert.equal(a.call('eventsOn', a.controller.state.data, DAY).length, 1);
  a.controller.state.eventDraft = event('', { routineId: 'routine', time: '14:00', minutes: 10, repeat: 'daily' });
  await a.controller.saveEvent();
  assert.equal(a.controller.state.data.events.length, 1);
  assert.match(a.controller.state.toast, /programación futura|ya está programada/);
});
test('reprogramming splits past/future and transfers only future execution logs', async () => {
  const old = event('old', { date: '2030-01-01', repeat: 'daily', routineId: 'routine' });
  const past = { completed: true, checkedSteps: ['step'], note: 'Synthetic historical note' };
  const future = { completed: false, checkedSteps: [], choices: { step: 'choice' } };
  const a = app({ data: { ...emptyData(), routines: [routine()], events: [old], logs: { 'old@2030-01-06': past, 'old@2030-01-08': future } } });
  a.controller.state.eventDraft = { ...old, time: '11:00', applyFrom: DAY };
  await a.controller.saveEvent();
  const data = a.controller.state.data;
  assert.equal(data.events.length, 2);
  assert.equal(data.events.find(e => e.id === 'old').endDate, '2030-01-06');
  const next = data.events.find(e => e.id !== 'old');
  assert.equal(next.date, DAY);
  assert.deepEqual(plain(data.logs['old@2030-01-06']), past);
  assert.deepEqual(plain(data.logs[`${next.id}@2030-01-08`]), future);
  assert.equal(data.logs['old@2030-01-08'], undefined);
  assert.equal(a.call('eventsOn', data, '2030-01-06')[0].time, '09:00');
  assert.equal(a.call('eventsOn', data, DAY)[0].time, '11:00');
});

function dependencies() {
  return { ...emptyData(), events: [
    event('a', { routineId: 'a', time: '08:00', minutes: 30, repeat: 'daily' }),
    event('b', { routineId: 'b', time: '10:00', repeat: 'daily' }),
    event('middle', { routineId: 'middle', anchor: 'between', afterRoutineId: 'a', beforeRoutineId: 'b', repeat: 'daily' }),
  ] };
}
test('dependent interval follows boundary movements without rewriting its links', () => {
  const data = dependencies(), a = app({ data });
  assert.deepEqual(plain(a.call('eventFrame', data.events[2], DAY, data)), { start: 510, end: 600, length: 90 });
  a.controller.shiftEvent(a.controller.state.data.events[0], DAY, 15);
  const updated = a.controller.state.data;
  assert.equal(a.call('eventFrame', updated.events[2], DAY, updated).length, 75);
  assert.equal(updated.events[2].afterRoutineId, 'a');
});
test('movement that collapses a dependent interval is rejected', () => {
  const data = dependencies(), a = app({ data });
  a.controller.shiftEvent(a.controller.state.data.events[0], DAY, 120);
  assert.deepEqual(plain(a.controller.state.data), data);
  assert.match(a.controller.state.toast, /sin espacio/);
});
test('missing or circular boundaries produce no interval', () => {
  const data = dependencies(), a = app();
  assert.equal(a.call('eventFrame', data.events[2], DAY, { ...data, events: data.events.slice(1) }), null);
  data.events[0] = { ...data.events[0], anchor: 'between', afterRoutineId: 'middle', beforeRoutineId: 'b' };
  assert.equal(a.call('eventFrame', data.events[2], DAY, data), null);
});
test('deleting a schedule preserves previous and already logged current occurrences', async () => {
  const e = event('old', { date: '2030-01-01', routineId: 'routine', repeat: 'daily' });
  const logs = { [`old@${DAY}`]: { completed: true, checkedSteps: ['step'] } };
  const a = app({ data: { ...emptyData(), events: [e], logs } });
  await a.controller.deleteEvent(e);
  assert.equal(a.controller.state.data.events[0].endDate, DAY);
  assert.deepEqual(plain(a.controller.state.data.logs), logs);
  assert.equal(a.call('eventsOn', a.controller.state.data, '2030-01-08').length, 0);
});
test('cancelling boundary dependencies preserves earlier dates and logs', () => {
  const data = dependencies(); data.events.forEach(e => { e.date = '2030-01-01'; });
  data.logs['middle@2030-01-06'] = { completed: true, checkedSteps: [] };
  const a = app(); const next = a.controller.cancelFutureDependencies(data, 'a', DAY);
  assert.equal(next.events.find(e => e.id === 'middle').endDate, '2030-01-06');
  assert.deepEqual(plain(next.logs), data.logs);
});
test('weekday alternatives replace nested substeps; selected days filter steps', () => {
  const a = app(); const s = step('parent', { mode: 'alternatives', days: [2], children: [step('base')],
    variants: [{ id: 'monday', title: 'Synthetic Monday', desc: '', min: 20, days: [1], children: [step('child', { children: [step('leaf')] })] }] });
  const active = a.call('activeSteps', [s, step('off', { mode: 'selected', days: [2] })], DAY);
  assert.equal(active.length, 1);
  assert.equal(active[0].title, 'Synthetic Monday');
  assert.equal(active[0].children[0].children[0].id, 'leaf');
  assert.equal(a.call('activeSteps', [s], '2030-01-08')[0].children[0].id, 'base');
});
test('manual alternatives are required before completing a routine', () => {
  const s = step('choice', { mode: 'alternatives', chooseWhen: 'execute', variants: [{ id: 'v', title: 'Synthetic alternative', desc: '', days: [], min: 10, children: [step('leaf')] }] });
  const e = event('event', { routineId: 'routine' });
  const a = app({ data: { ...emptyData(), routines: [routine('routine', { steps: [s] })], events: [e] } });
  a.controller.toggleEvent(e, DAY);
  assert.equal(a.controller.state.data.logs[`event@${DAY}`], undefined);
  a.controller.selectVariant(e, DAY, 'choice', 'v');
  assert.equal(a.call('routineForDay', e, DAY, a.controller.state.data)[0].children[0].id, 'leaf');
  a.controller.toggleStep(e, DAY, 'leaf');
  assert.equal(a.controller.state.data.logs[`event@${DAY}`].completed, true);
  assert.equal(a.controller.state.data.logs['event@2030-01-08'], undefined);
});
test('changing an alternative resets current checks but preserves other days', () => {
  const old = { completed: true, checkedSteps: ['old'], note: 'Synthetic note' };
  const a = app({ data: { ...emptyData(), logs: { [`event@${DAY}`]: old, 'event@2030-01-06': old } } });
  a.controller.selectVariant(event(), DAY, 'choice', 'new');
  const log = a.controller.state.data.logs[`event@${DAY}`];
  assert.deepEqual(plain(log.checkedSteps), []);
  assert.equal(log.completed, false);
  assert.equal(log.note, old.note);
  assert.deepEqual(plain(a.controller.state.data.logs['event@2030-01-06']), old);
});
test('flexible leaf weights distribute remainder exactly alongside fixed nested time', () => {
  const a = app(); const steps = [step('parent', { children: [step('fixed', { min: 10 }), step('large', { flexible: true, flexWeight: 9 }), step('small', { flexible: true, flexWeight: 1 })] })];
  const allocation = a.call('leafAllocation', steps, 31);
  assert.deepEqual(plain(allocation), { large: 19, small: 2 });
  assert.equal(a.call('effectiveStepMinutes', steps[0], allocation), 31);
});
test('fixed duration rejects excess fixed minutes and unallocated time without flexible leaves', () => {
  const a = app();
  assert.match(a.call('routineBalance', routine('r', { durationMode: 'fixed', durationMin: 5 }), DAY).error, /Faltan/);
  assert.match(a.call('routineBalance', routine('r', { durationMode: 'fixed', durationMin: 20 }), DAY).error, /Sobran/);
  assert.equal(a.call('routineBalance', routine('r', { durationMode: 'fixed', durationMin: 20, steps: [step(), step('flex', { flexible: true })] }), DAY).error, '');
});
test('frame rejects midnight overflow and permits ending exactly at midnight', () => {
  const a = app(), data = emptyData();
  assert.equal(a.call('eventFrame', event('late', { time: '23:30', minutes: 31 }), DAY, data), null);
  assert.equal(a.call('eventFrame', event('end', { anchor: 'end', endTime: '00:10', minutes: 20 }), DAY, data), null);
  assert.equal(a.call('eventFrame', event('ok', { time: '23:30', minutes: 30 }), DAY, data).end, 1440);
});

test('shifting before the beginning of the day clamps to 00:00 and keeps a valid event', () => {
  const e = event('early', { time: '00:05', minutes: 30 });
  const a = app({ data: { ...emptyData(), events: [e] } });
  a.controller.shiftEvent(e, DAY, -15);
  assert.equal(a.controller.state.data.events[0].overrides[DAY].time, '00:00');
  assert.equal(a.call('eventsOn', a.controller.state.data, DAY).length, 1);
});
