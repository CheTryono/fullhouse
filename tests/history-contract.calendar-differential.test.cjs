'use strict';
// Cada archivo de node:test tiene su propio proceso; los casos no UTC usan subprocesos.
process.env.TZ = 'UTC';
const test = require('node:test'), assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { schedule } = require('./helpers/history-integration.cjs');
const { event, routine, input } = require('./helpers/calendar.cjs');
const P = require('../history/calendar-proof.cjs'), M = require('../history/calendar-math.cjs');
const engine = P.createCalendarProof(schedule);
const immediate = () => Promise.resolve();
test('reducción gregoriana: igualdad exhaustiva de occurs en dos ciclos completos', () => {
    const origins = ['2000-01-31', '2000-01-29', '2000-02-29'];
    for (const origin of origins) {
        const e = event('e', { date: origin, repeat: origin.endsWith('02-29') ? 'yearly' : 'monthly' });
        for (let n = 0; n < 146097; n++) {
            const d = M.date(M.ordinal('2001-01-01') + n), next = M.date(M.ordinal(d) + 146097);
            assert.equal(schedule.occurs(e, d), schedule.occurs(e, next), d);
        }
    }
});
test('propiedad modular: fases, MCD y períodos compatibles con occurs real', () => {
    // Toda combinación de fases de períodos pequeños; no se pretende probar otros N por muestreo.
    for (let a = 1; a <= 7; a++)
        for (let b = 1; b <= 7; b++)
            for (let phase = 0; phase < b; phase++) {
                const start = M.ordinal('2000-01-01'), A = event('a', { repeat: 'every', everyDays: a }), B = event('b', { repeat: 'every', everyDays: b, date: M.date(start + phase) }), period = Number(M.lcm(a, b));
                let intersect = false;
                for (let n = phase; n < phase + period; n++) {
                    const date = M.date(start + n);
                    assert.equal(schedule.occurs(A, date), n % a === 0);
                    assert.equal(schedule.occurs(B, date), (n - phase) % b === 0);
                    intersect ||= schedule.occurs(A, date) && schedule.occurs(B, date);
                }
                assert.equal(intersect, BigInt(phase) % M.gcd(a, b) === 0n);
            }
});
test('memoización: todos los grafos dirigidos de tres bloques, órdenes y fechas', () => {
    const routines = ['a', 'b', 'c'].map(id => routine(id, 30)), day = '2000-01-01';
    // Por nodo: fijo, dos órdenes de límites, límite ausente. Incluye todos los ciclos de ese universo.
    for (let code = 0; code < 64; code++)
        for (const reverse of [false, true]) {
            let digits = code;
            const events = ['a', 'b', 'c'].map((id, i) => {
                const kind = digits % 4;
                digits = Math.floor(digits / 4);
                const other = ['a', 'b', 'c'].filter(x => x !== id);
                return event(id, { routineId: id, time: ['08:00', '10:00', '12:00'][i], repeatDays: [0, 2], repeat: i === 1 ? 'custom' : 'daily', ...(kind ? { anchor: 'between', afterRoutineId: kind === 2 ? other[1] : other[0], beforeRoutineId: kind === 3 ? 'missing' : kind === 2 ? other[0] : other[1] } : {}) });
            });
            if (reverse)
                events.reverse();
            for (let n = 0; n < 7; n++) {
                const date = M.date(M.ordinal(day) + n), actual = P.stateFrames(events, routines, date, {}, schedule), data = { routines, events, logs: {} };
                for (const e of events)
                    if (schedule.occurs(e, date))
                        assert.deepEqual(actual.frame(e), schedule.eventFrame(e, date, data), `${code} ${reverse} ${date} ${e.id}`);
            }
        }
});
test('prueba finita diferencial: contraejemplos idénticos al calendario real, generación determinista', async () => {
    let seed = 73019;
    const rand = n => { seed = (1664525 * seed + 1013904223) >>> 0; return seed % n; };
    for (let trial = 0; trial < 70; trial++) {
        const rules = ['none', 'dates', 'daily', 'weekly', 'weekdays', 'custom', 'monthly', 'yearly', 'every'];
        const events = Array.from({ length: 4 }, (_, i) => event('e' + i, { repeat: rules[rand(rules.length)], date: M.date(M.ordinal('2000-01-01') + rand(7)), endDate: rand(2) ? '2000-03-09' : '', specificDates: ['2000-01-20', '2000-02-29'], repeatDays: [rand(7), rand(7)], everyDays: 1 + rand(14), time: '23:00', minutes: 55 + rand(9), overrides: { '2000-02-15': { time: rand(2) ? '23:30' : '22:00' } } }));
        const x = input(events, [], { through: '2000-03-20' }), result = await engine.prove(x, { yieldControl: immediate });
        let witness = null;
        for (let n = M.ordinal(x.from); n <= M.ordinal(x.through) && !witness; n++)
            for (const e of events) {
                const date = M.date(n);
                if (schedule.occurs(e, date) && !schedule.eventFrame(e, date, { events, routines: [], logs: {} })) {
                    witness = { date, eventId: e.id };
                    break;
                }
            }
        assert.equal(result.status, witness ? 'invalid' : 'valid', 'trial ' + trial);
        if (witness) {
            const w = result.certificate.counterexample, e = events.find(e => e.id === w.eventId);
            assert.ok(schedule.occurs(e, w.date));
            assert.equal(schedule.eventFrame(e, w.date, { events, routines: [], logs: {} }), null);
        }
    }
});
test('alternativas: base sin ID centinela, hijos, días y ramas inactivas', async () => {
    const r = routine('r', 20, { steps: [{ id: 's', title: 'S', min: 20, mode: 'alternatives', chooseWhen: 'execute', variants: [{ id: '__base', title: 'V', desc: '', min: 10, days: [] }] }] });
    const a = event('a', { routineId: 'a', time: '08:00' }), c = event('c', { routineId: 'c', time: '09:10' }), e = event('e', { routineId: 'r', anchor: 'between', afterRoutineId: 'a', beforeRoutineId: 'c' }), rs = [routine('a', 60), routine('c', 60), r];
    const result = await engine.prove(input([a, c, e], rs));
    assert.equal(result.status, 'invalid');
    assert.deepEqual(result.certificate.counterexample.choices.e, {});
    // Reproducción B.2 experimental: su centinela colisiona con un ID legítimo y omite la base.
    // Se deja visible, sin cambiar Planner ni sustituir B.2 automáticamente.
    const old = require('../history/storage-routines.cjs').choices(r);
    assert.ok(old.every(choices => schedule.routineBalance(r, '2000-01-01', 10, choices).error === ''));
    assert.ok(schedule.routineBalance(r, '2000-01-01', 10, {}).error);
    const weekdays = routine('r', 1, { steps: [{ id: 's', title: 'S', min: 10, mode: 'alternatives', days: [1, 2, 3, 4, 5], variants: [{ id: 'sat', title: 'Weekend', desc: '', min: 61, days: [6], children: [] }] }] });
    const result2 = await engine.prove(input([event('e', { routineId: 'r', date: '2000-01-03' })], [weekdays], { from: '2000-01-03' }));
    assert.equal(result2.status, 'invalid');
    assert.equal(result2.certificate.counterexample.date, '2000-01-08');
});
test('paridad B.2 admitida y nuevas pruebas que B.2 bloquea', async () => {
    const old = require('../history/storage-routines.cjs');
    for (const repeat of ['none', 'dates', 'daily', 'weekly', 'weekdays', 'custom'])
        for (const minutes of [60, 61]) {
            const e = event('e', { routineId: 'r', repeat, repeatDays: [0, 1], specificDates: ['2100-01-01'] }), r = routine('r', minutes);
            const before = { events: [e], routines: [r], logs: {} }, candidate = { ...before, routines: [r] };
            // El build real B.2 usa este mismo catálogo de fechas y luego eventFrame/routineBalance.
            let oldValid = true;
            for (const date of old.proofDates([e], '2000-01-01'))
                if (schedule.occurs(e, date) && !schedule.eventFrame(e, date, candidate))
                    oldValid = false;
            const result = await engine.prove(input([e], [r]));
            assert.equal(result.status, oldValid ? 'valid' : 'invalid');
        }
    assert.throws(() => old.proofDates([event('e', { repeat: 'monthly' })], '2000-01-01'), /indefinida/);
    assert.equal((await engine.prove(input([event('e', { repeat: 'monthly' })]))).status, 'valid');
});
test('zonas reales: DST y salto de fecha no se sustituyen por aritmética UTC', () => {
    const script = `const {schedule:s}=require('./tests/helpers/history-integration.cjs'),{createCalendarProof}=require('./history/calendar-proof.cjs'),{event,input}=require('./tests/helpers/calendar.cjs');(async()=>{const e=event('e',{date:'2011-12-29',repeat:'every',everyDays:2});const engine=createCalendarProof(s);console.log(JSON.stringify({zone:Intl.DateTimeFormat().resolvedOptions().timeZone,occurs:s.occurs(e,'2011-12-31'),finite:(await engine.prove(input([e],[],{from:'2011-12-29',through:'2012-01-03'}))).status,unbounded:(await engine.prove(input([e],[],{from:'2011-12-29'}))).status}));})()`;
    for (const zone of ['UTC', 'America/New_York', 'Europe/Madrid', 'Pacific/Apia']) {
        const r = JSON.parse(execFileSync(process.execPath, ['-e', script], { cwd: require('node:path').resolve(__dirname, '..'), env: { ...process.env, TZ: zone }, encoding: 'utf8' }));
        assert.equal(r.finite, 'valid');
        assert.equal(r.unbounded, zone === 'UTC' ? 'valid' : 'indeterminate');
        assert.equal(r.occurs, zone !== 'Pacific/Apia');
    }
});
test('entradas arbitrarias, presupuestos, cambios de entorno y referencias ausentes bloquean', async () => {
    for (const x of [null, {}, [], input([event(), event()]), input([event()], [], { unknown: true }), input([event()], [], { budgets: { states: 0 } }), input([event()], [], { budgets: { states: 1000001 } })])
        assert.equal((await engine.prove(x)).status, 'indeterminate');
    const missing = await engine.prove(input([event('e', { anchor: 'between', afterRoutineId: 'missing', beforeRoutineId: 'other' })]));
    assert.equal(missing.status, 'invalid');
    assert.equal(missing.certificate.reason, 'missing-boundary');
    const save = global.Date;
    try {
        const result = await engine.prove(input(), { yieldControl: async () => { global.Date = class extends save {
            }; } });
        assert.equal(result.status, 'indeterminate');
        assert.equal(result.certificate.reason, 'environment-changed');
    }
    finally {
        global.Date = save;
    }
});
