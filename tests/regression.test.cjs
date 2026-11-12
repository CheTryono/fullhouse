const { test } = require('node:test');
const assert = require('node:assert/strict');
const { app, plain, DAY, emptyData, step, routine, event } = require('./helpers/app.cjs');

test('save persists version 1 and reload restores logs, choices, notes and evidence', () => {
  const data = { ...emptyData(), routines: [routine()], events: [event('event', { routineId: 'routine' })],
    logs: { [`event@${DAY}`]: { completed: true, checkedSteps: ['step'], note: 'Synthetic note',
      choices: { step: 'variant' }, evidences: [{ id: 'image', kind: 'image', src: 'data:image/jpeg;base64,AA==', caption: '', createdAt: `${DAY}T12:00:00Z` }] } } };
  const a = app(); a.controller.save(data);
  assert.deepEqual(JSON.parse(a.storage.get('fullhouse-v01')), data);
  const b = app({ stored: Object.fromEntries(a.storage) });
  assert.deepEqual(plain(b.call('load').data), data);
});
test('failed storage write warns and preserves previous persisted bytes', () => {
  const previous = JSON.stringify(emptyData());
  const a = app({ stored: { 'fullhouse-v01': previous }, failWrite: true });
  a.controller.save({ ...emptyData(), routines: [routine()] });
  assert.equal(a.storage.get('fullhouse-v01'), previous);
  assert.match(a.controller.state.toast, /No se pudo guardar/);
});
test('failed storage read enters recovery without writing', () => {
  const a = app({ failRead: true });
  assert.deepEqual(plain(a.call('load').data), emptyData());
  assert.equal(a.call('load').recovery.key, 'fullhouse-v01');
  assert.equal(a.storage.size, 0);
  assert.ok(a.warnings.length > 0);
});
test('legacy store is copied without removing the original', () => {
  const bytes = JSON.stringify(emptyData());
  const a = app({ stored: { 'botanica-planificador-v01': bytes } });
  assert.deepEqual(plain(a.call('load').data), emptyData());
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
    assert.match(a.controller.state.toast, /Tus datos anteriores siguen intactos/);
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

const { legacyBackup, modernBackup } = require('./fixtures/backups.cjs');
for (const [name, fixture] of [['early version-1', legacyBackup], ['modern version-1', modernBackup]]) {
  test(`valid ${name} backup imports and reloads without normalization or lost fields`, async () => {
    const backup = fixture(); const a = app();
    assert.equal(a.call('validData', backup), true);
    await a.importBackup(JSON.stringify(backup));
    assert.deepEqual(plain(a.controller.state.data), backup);
    assert.deepEqual(JSON.parse(a.storage.get('fullhouse-v01')), backup);
    const b = app({ stored: Object.fromEntries(a.storage) });
    assert.deepEqual(plain(b.call('load').data), backup);
  });
}
test('application examples also satisfy the backup validator', () => {
  const a = app(); assert.equal(a.call('validData', a.call('seed')), true);
});
test('unknown fields, blank optional dates and orphaned historical references remain compatible', async () => {
  const backup = legacyBackup();
  backup.futureMetadata = { synthetic: true };
  backup.goals[0].startDate = ''; backup.goals[0].dueDate = '';
  backup.goals[0].futureField = ['preserve'];
  backup.events[0].endDate = '';
  backup.logs['deleted-event@2029-12-01'] = { completed: true, checkedSteps: ['deleted-step'] };
  const a = app(); await a.importBackup(JSON.stringify(backup));
  assert.deepEqual(plain(a.controller.state.data), backup);
  assert.deepEqual(JSON.parse(a.storage.get('fullhouse-v01')), backup);
});
test('all-day backup with no hour remains compatible', () => {
  const a = app(), backup = legacyBackup(); backup.events[0].allDay = true; backup.events[0].time = '';
  assert.equal(a.call('validData', backup), true);
});

const malformedBackups = [
  ['null goal', b => { b.goals = [null]; }],
  ['goal missing history', b => { delete b.goals[0].history; }],
  ['numeric goal title', b => { b.goals[0].title = 12; }],
  ['null history entry', b => { b.goals[0].history = [null]; }],
  ['string numeric progress', b => { b.goals[0].current = '2'; }],
  ['invalid goal mode', b => { b.goals[0].mode = 'unknown'; }],
  ['invalid review', b => { b.goals[0].review.time = '25:00'; }],
  ['null milestone', b => { b.goals[0].milestones = [null]; }],
  ['duplicate goal identifier', b => { b.goals.push({ ...b.goals[0] }); }],
  ['null routine', b => { b.routines = [null]; }],
  ['missing routine steps', b => { delete b.routines[0].steps; }],
  ['non-array routine steps', b => { b.routines[0].steps = {}; }],
  ['null step', b => { b.routines[0].steps = [null]; }],
  ['negative step duration', b => { b.routines[0].steps[0].min = -1; }],
  ['null nested child', b => { b.routines[0].steps[0].children = [null]; }],
  ['duplicate nested step id', b => { b.routines[0].steps[0].children[0].id = 'parent'; }],
  ['null alternative', b => { b.routines[0].steps[0].variants = [null]; }],
  ['invalid weekday', b => { b.routines[0].steps[0].variants[0].days = [7]; }],
  ['malformed alternative substeps', b => { b.routines[0].steps[0].variants[0].children = [null]; }],
  ['null event', b => { b.events = [null]; }],
  ['impossible date', b => { b.events[0].date = '2030-02-30'; }],
  ['invalid time', b => { b.events[0].time = '24:30'; }],
  ['unknown recurrence', b => { b.events[0].repeat = 'sometimes'; }],
  ['negative event duration', b => { b.events[0].minutes = -5; }],
  ['null override', b => { b.events[0].overrides[DAY] = null; }],
  ['string skip override', b => { b.events[0].overrides[DAY] = { skip: 'yes' }; }],
  ['invalid override date', b => { b.events[0].overrides['not-a-date'] = {}; }],
  ['null execution log', b => { b.logs[`event@${DAY}`] = null; }],
  ['string completion flag', b => { b.logs[`event@${DAY}`].completed = 'true'; }],
  ['non-string checked step', b => { b.logs[`event@${DAY}`].checkedSteps = [null]; }],
  ['invalid choices map', b => { b.logs[`event@${DAY}`].choices = { parent: {} }; }],
  ['invalid step notes', b => { b.logs[`event@${DAY}`].stepNotes = { leaf: null }; }],
  ['null evidence', b => { b.logs[`event@${DAY}`].evidences = [null]; }],
  ['invalid image source', b => { b.logs[`event@${DAY}`].evidences[0].src = 'javascript:synthetic'; }],
  ['null daily review', b => { b.dayReviews[DAY] = null; }],
  ['invalid daily review date', b => { b.dayReviews['broken'] = { note: '', closedAt: `${DAY}T12:00:00Z` }; }],
];
for (const [name, mutate] of malformedBackups) {
  test(`malformed backup: ${name} is rejected without replacing memory or stored bytes`, async () => {
    const backup = modernBackup(); mutate(backup);
    const before = legacyBackup(); const bytes = JSON.stringify(before, null, 2);
    const a = app({ data: before, stored: { 'fullhouse-v01': bytes, 'fullhouse-theme-v02': 'midnight' } });
    const initialStorage = [...a.storage];
    assert.equal(a.call('validData', backup), false);
    const input = await a.importBackup(JSON.stringify(backup));
    assert.deepEqual(plain(a.controller.state.data), before);
    assert.deepEqual([...a.storage], initialStorage);
    assert.equal(input.target.value, '');
    assert.match(a.controller.state.toast, /Tus datos anteriores siguen intactos/);
    assert.doesNotMatch(a.controller.state.toast, /Respaldo restaurado/);
  });
}
test('non-finite numbers and cyclic in-memory step trees are rejected', () => {
  const a = app(), backup = legacyBackup(); backup.goals[0].current = Infinity;
  assert.equal(a.call('validData', backup), false);
  backup.goals[0].current = 2;
  backup.routines[0].steps[0].children = [backup.routines[0].steps[0]];
  assert.equal(a.call('validData', backup), false);
});
test('valid import with a storage failure preserves previous memory, bytes and navigation', async () => {
  const before = legacyBackup(); const bytes = JSON.stringify(before, null, 2);
  const a = app({ data: before, stored: { 'fullhouse-v01': bytes }, failWrite: true });
  a.controller.state.page = 'ajustes';
  await a.importBackup(JSON.stringify(modernBackup()));
  assert.deepEqual(plain(a.controller.state.data), before);
  assert.equal(a.storage.get('fullhouse-v01'), bytes);
  assert.equal(a.controller.state.page, 'ajustes');
  assert.match(a.controller.state.toast, /falta espacio|bloqueó/);
  assert.match(a.controller.state.toast, /Tus datos anteriores siguen intactos/);
});
for (const fileFailure of ['error', 'abort', 'throw']) {
  test(`file read ${fileFailure} preserves memory and storage with a friendly message`, async () => {
    const before = legacyBackup(), bytes = JSON.stringify(before);
    const a = app({ data: before, stored: { 'fullhouse-v01': bytes }, fileFailure });
    await a.importBackup(JSON.stringify(modernBackup()));
    assert.deepEqual(plain(a.controller.state.data), before);
    assert.equal(a.storage.get('fullhouse-v01'), bytes);
    assert.match(a.controller.state.toast, /Tus datos anteriores siguen intactos/);
  });
}
for (const accept of [true, false]) {
  test(`React 16 pooled event can be released during confirmation (accept=${accept})`, async () => {
    const a = app();
    const input = { files: [{ text: JSON.stringify(legacyBackup()) }], value: 'synthetic.json' };
    const event = { target: input };
    a.controller.askConfirm = async () => { event.target = null; return accept; };
    await a.controller.importData(event);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(input.value, '');
    assert.deepEqual(plain(a.controller.state.data), accept ? legacyBackup() : emptyData());
  });
}

const fs = require('node:fs');
const path = require('node:path');
for (const file of fs.readdirSync(path.join(__dirname, 'fixtures/historical')).filter(name => name.endsWith('.json'))) {
  const fixture = require(`./fixtures/historical/${file}`);
  test(`actual ${fixture.version} writer export (${fixture.commit.slice(0, 7)}) loads and imports unchanged`, async () => {
    const bytes = JSON.stringify(fixture.data, null, 2);
    const a = app({ stored: { 'fullhouse-v01': bytes }, useLoadedData: true });
    assert.equal(a.controller.state.recovery, null);
    assert.equal(a.call('validData', fixture.data), true);
    assert.deepEqual(plain(a.controller.state.data), fixture.data);
    assert.equal(a.storage.get('fullhouse-v01'), bytes);
    const b = app(); await b.importBackup(bytes);
    assert.deepEqual(plain(b.controller.state.data), fixture.data);
    assert.deepEqual(JSON.parse(b.storage.get('fullhouse-v01')), fixture.data);
  });
}
for (const raw of ['', '{broken', JSON.stringify({ ...emptyData(), routines: [null] }), JSON.stringify({ ...emptyData(), version: 99 })]) {
  test(`invalid existing local data enters recovery and blocks save/import/reset (${JSON.stringify(raw)})`, async () => {
    const original = { 'fullhouse-v01': raw, 'botanica-planificador-v01': JSON.stringify(legacyBackup()) };
    const a = app({ stored: original, useLoadedData: true });
    assert.deepEqual(plain(a.controller.state.data), emptyData());
    assert.equal(a.controller.state.recovery.raw, raw);
    assert.equal(a.controller.state.recovery.key, 'fullhouse-v01');
    assert.equal(a.controller.state.guideOpen, false);
    a.controller.save(modernBackup());
    await a.importBackup(JSON.stringify(modernBackup()));
    await a.controller.reset();
    a.controller.retryLocalLoad();
    assert.deepEqual(Object.fromEntries(a.storage), original);
    const reopened = app({ stored: Object.fromEntries(a.storage), useLoadedData: true });
    assert.equal(reopened.controller.state.recovery.raw, raw);
    assert.deepEqual(plain(reopened.controller.state.data), emptyData());
    assert.deepEqual(plain(a.controller.state.data), emptyData());
    assert.ok(a.controller.state.recovery);
    assert.equal(a.confirmations.length, 0);
    a.controller.exportData();
    assert.equal(a.downloads.length, 1);
    assert.equal(await a.downloads[0].blob.text(), raw);
    assert.ok(a.controller.state.recovery, 'Downloading must not unlock overwrites');
    assert.deepEqual(Object.fromEntries(a.storage), original);
  });
}
test('an invalid legacy store is preserved and never migrated', () => {
  const bytes = '  {broken legacy  ';
  const a = app({ stored: { 'botanica-planificador-v01': bytes }, useLoadedData: true });
  assert.equal(a.controller.state.recovery.key, 'botanica-planificador-v01');
  a.controller.save(modernBackup());
  assert.equal(a.storage.has('fullhouse-v01'), false);
  assert.equal(a.storage.get('botanica-planificador-v01'), bytes);
});
test('failed legacy copy remains recoverable and leaves the source unchanged', async () => {
  const bytes = JSON.stringify(legacyBackup(), null, 2);
  const a = app({ stored: { 'botanica-planificador-v01': bytes }, failWrite: true, useLoadedData: true });
  assert.equal(a.controller.state.recovery.key, 'botanica-planificador-v01');
  a.controller.downloadOriginal();
  assert.equal(await a.downloads[0].blob.text(), bytes);
  assert.equal(a.storage.has('fullhouse-v01'), false);
  assert.equal(a.storage.get('botanica-planificador-v01'), bytes);
});
test('unreadable storage blocks all writes, and retry recovers after access returns', async () => {
  const bytes = JSON.stringify(legacyBackup(), null, 2);
  const a = app({ stored: { 'fullhouse-v01': bytes }, failRead: true, useLoadedData: true });
  assert.equal(a.controller.state.recovery.raw, null);
  a.controller.save(modernBackup()); await a.importBackup(JSON.stringify(modernBackup())); await a.controller.reset();
  assert.equal(a.storage.get('fullhouse-v01'), bytes);
  a.controller.downloadOriginal(); assert.equal(a.downloads.length, 0);
  a.setReadFailure(false); a.controller.retryLocalLoad();
  assert.equal(a.controller.state.recovery, null);
  assert.deepEqual(plain(a.controller.state.data), legacyBackup());
  assert.equal(a.storage.get('fullhouse-v01'), bytes);
});
test('a readable recovery snapshot survives a later failed read or external removal', async () => {
  const raw = '{broken';
  const a = app({ stored: { 'fullhouse-v01': raw }, useLoadedData: true });
  a.setReadFailure(true); a.controller.retryLocalLoad();
  assert.equal(a.controller.state.recovery.raw, raw);
  a.setReadFailure(false); a.storage.delete('fullhouse-v01'); a.controller.retryLocalLoad();
  assert.equal(a.controller.state.recovery.raw, raw);
  a.controller.downloadOriginal(); assert.equal(await a.downloads[0].blob.text(), raw);
  assert.equal(a.storage.has('fullhouse-v01'), false);
});
test('a new installation alone receives examples, while a valid empty store stays empty', () => {
  const fresh = app({ useLoadedData: true });
  assert.equal(fresh.controller.state.recovery, null);
  assert.ok(fresh.controller.state.data.routines.length > 0);
  const existing = app({ useLoadedData: true, stored: { 'fullhouse-v01': JSON.stringify(emptyData()) } });
  assert.equal(existing.controller.state.recovery, null);
  assert.deepEqual(plain(existing.controller.state.data), emptyData());
});
test('retry after external removal does not copy legacy data over the captured source', () => {
  const a = app({ stored: { 'fullhouse-v01': '{original', 'botanica-planificador-v01': JSON.stringify(legacyBackup()) }, useLoadedData: true });
  a.storage.delete('fullhouse-v01');
  a.controller.retryLocalLoad();
  assert.equal(a.controller.state.recovery.raw, '{original');
  assert.equal(a.storage.has('fullhouse-v01'), false);
});
