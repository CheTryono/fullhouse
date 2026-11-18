'use strict';
const { copy, canonical, freeze, same } = require('./json.cjs'), { sha256 } = require('./persistence.cjs'), M = require('./calendar-math.cjs');
const ALGORITHM = 'gregorian-component-proof-v1';
const APPROVED = '1fa5e1fc4c3230c62d5c6b69c5d3d42c2f4c2d07c37aa119528718cb8cf042e2';
const NAMES = ['parseDay', 'occurs', 'minutes', 'key', 'stepMinutes', 'activeStep', 'activeSteps', 'routineForDay', 'baseLength', 'eventFrame', 'routineMinutesOn', 'fixedStepMinutes', 'leafSteps', 'durationText', 'routineBalance'];
const DEFAULTS = Object.freeze({ states: 300000, checks: 2000000, work: 20000000, profiles: 256, segments: 2048 });
const HARD = Object.freeze({ states: 1000000, checks: 4000000, work: 50000000, profiles: 256, segments: 4096 });
const later = () => new Promise(r => setTimeout(r, 0));
function bounded(value, certificate = false) { let nodes = 0, chars = 0; const stack = [{ v: value, d: 0 }], seen = new Set(); while (stack.length) {
    const { v, d, exit } = stack.pop();
    if (exit) {
        seen.delete(v);
        continue;
    }
    if (++nodes > (certificate ? 120000 : 20000) || d > 40)
        throw Error('input-budget');
    if (typeof v === 'string' && (chars += v.length) > (certificate ? 4000000 : 2000000))
        throw Error('input-budget');
    if (v && typeof v === 'object') {
        if (seen.has(v))
            throw Error('input-cycle');
        seen.add(v);
        stack.push({ v, d, exit: true });
        for (const [key, desc] of Object.entries(Object.getOwnPropertyDescriptors(v))) {
            if (Array.isArray(v) && key === 'length')
                continue;
            if (!Object.hasOwn(desc, 'value'))
                throw Error('input-getter');
            chars += key.length;
            stack.push({ v: desc.value, d: d + 1 });
        }
    }
} return copy(value); }
function normalize(input, s) {
    const v = bounded(input);
    if (!v || Object.keys(v).some(k => !['events', 'routines', 'from', 'through', 'budgets', 'disallowSameRoutineCooccurrence'].includes(k)))
        throw Error('input-fields');
    if (!Array.isArray(v.events) || !Array.isArray(v.routines) || v.events.length > 64 || v.routines.length > 64)
        throw Error('input-shape');
    const from = M.ordinal(v.from), through = M.ordinal(v.through || M.MAX);
    if (from > through)
        throw Error('date-order');
    if (!s.validData({ version: 1, goals: [], events: v.events, routines: v.routines, logs: {} }))
        throw Error('input-model');
    for (const e of v.events)
        for (const d of [e.date, e.endDate, e.applyFrom, ...(e.specificDates || []), ...Object.keys(e.overrides)].filter(Boolean))
            M.ordinal(d);
    const budgets = { ...DEFAULTS, ...v.budgets };
    if (v.budgets && Object.keys(v.budgets).some(k => !Object.hasOwn(HARD, k)))
        throw Error('budget-fields');
    for (const k of Object.keys(HARD))
        if (!Number.isSafeInteger(budgets[k]) || budgets[k] < 1 || budgets[k] > HARD[k])
            throw Error('budget-value');
    if (v.disallowSameRoutineCooccurrence !== undefined && typeof v.disallowSameRoutineCooccurrence !== 'boolean')
        throw Error('collision-policy');
    return { ...v, through: v.through || M.MAX, budgets, disallowSameRoutineCooccurrence: v.disallowSameRoutineCooccurrence === true };
}
function profiles(r, limit) { let list = [{}], count = 0; const seen = new Set(); function walk(steps) { for (const step of steps) {
    if (++count > 512)
        throw Error('routine-budget');
    if (seen.has(step.id))
        throw Error('ambiguous-step-id');
    seen.add(step.id);
    if ((step.mode || ((step.variants || []).length ? 'alternatives' : 'always')) === 'alternatives' && step.chooseWhen === 'execute') {
        const opts = [null, ...(step.variants || []).map(v => v.id)];
        if (list.length * opts.length > limit)
            throw Error('profile-budget');
        list = list.flatMap(p => opts.map(id => id === null ? { ...p } : { ...p, [step.id]: id }));
    }
    walk(step.children || []);
    for (const v of step.variants || [])
        walk(v.children || []);
} } walk(r.steps); return { list, nodes: count }; }
function components(events) {
    const adj = events.map(() => new Set());
    for (let i = 0; i < events.length; i++)
        for (let j = i + 1; j < events.length; j++) {
            const a = events[i], b = events[j], ref = (x, y) => x.anchor === 'between' && !x.allDay && !!y.routineId && [x.afterRoutineId, x.beforeRoutineId].includes(y.routineId);
            if (a.routineId && a.routineId === b.routineId || ref(a, b) || ref(b, a)) {
                adj[i].add(j);
                adj[j].add(i);
            }
        }
    const visited = new Set(), result = [];
    for (let i = 0; i < events.length; i++)
        if (!visited.has(i)) {
            const todo = [i], ids = [];
            visited.add(i);
            while (todo.length) {
                const k = todo.pop();
                ids.push(k);
                for (const n of adj[k])
                    if (!visited.has(n)) {
                        visited.add(n);
                        todo.push(n);
                    }
            }
            ids.sort((a, b) => a - b);
            if (ids.length > 32)
                throw Error('component-budget');
            result.push(ids.map(k => events[k]));
        }
    return result;
}
function segments(events, from, through, period) {
    const lo = M.ordinal(from), hi = M.ordinal(through), points = new Set([lo, hi + 1]);
    for (const e of events) {
        for (const d of [e.date, ...(e.specificDates || []), ...Object.keys(e.overrides)]) {
            const n = M.ordinal(d);
            if (n >= lo && n <= hi) {
                points.add(n);
                points.add(n + 1);
            }
        }
        if (e.endDate) {
            const n = M.ordinal(e.endDate) + 1;
            if (n >= lo && n <= hi)
                points.add(n);
        }
    }
    const p = [...points].sort((a, b) => a - b);
    return p.slice(0, -1).map((start, i) => { const end = p[i + 1] - 1, len = end - start + 1, n = period === null ? len : Number(BigInt(len) < period ? BigInt(len) : period); return { start, end, representatives: n, periodDays: period === null ? null : period.toString() }; });
}
// Memoización equivalente por inducción sobre la selección real de límites.
// No se llama recursivamente al eventFrame original (puede repetir subgrafos exponencialmente).
function stateFrames(events, routines, date, profile, s) {
    const active = new Set(events.filter(e => s.occurs(e, date)).map(e => e.id)), data = { version: 2, goals: [], routines, events, logs: Object.fromEntries(events.map(e => [s.key(e, date), { completed: false, checkedSteps: [], choices: profile[e.id] || {} }])), recipeRevisions: {} }, memo = new Map(), visiting = [], selections = Object.create(null);
    function frame(e) {
        if (memo.has(e.id))
            return memo.get(e.id);
        if (visiting.includes(e.id)) {
            selections[e.id] = { ...(selections[e.id] || {}), cycle: [...visiting.slice(visiting.indexOf(e.id)), e.id] };
            return null;
        }
        visiting.push(e.id);
        let value;
        if (e.allDay || e.anchor !== 'between')
            value = s.eventFrame(e, date, data);
        else if (!e.afterRoutineId || !e.beforeRoutineId || e.afterRoutineId === e.beforeRoutineId) {
            selections[e.id] = { after: null, before: null };
            value = null;
        }
        else {
            const find = rid => events.find(x => x.id !== e.id && x.routineId === rid && active.has(x.id)), a = find(e.afterRoutineId), b = find(e.beforeRoutineId);
            selections[e.id] = { after: a?.id || null, before: b?.id || null };
            if (!a || !b)
                value = null;
            else {
                const fa = frame(a), fb = frame(b);
                value = !fa || !fb || fa.end >= fb.start ? null : { start: fa.end, end: fb.start, length: fb.start - fa.end };
            }
        }
        visiting.pop();
        memo.set(e.id, value);
        return value;
    }
    return { active, data, frame, selections };
}
function environment() { return { zone: Intl.DateTimeFormat().resolvedOptions().timeZone, dateConstructor: Date.toString(), utc: Intl.DateTimeFormat().resolvedOptions().timeZone === 'UTC' }; }
function createCalendarProof(schedule) {
    const s = Object.freeze({ ...schedule }), pinnedDate = Date;
    const semantics = sha256(canonical({ functions: NAMES.map(n => [n, typeof s[n] === 'function' ? s[n].toString() : null]), DAYS: s.DAYS }));
    async function prove(input, { signal, yieldControl = later } = {}) {
        let snapshot, inputError;
        try {
            snapshot = bounded(input);
        }
        catch (e) {
            inputError = e.message;
        }
        const started = performance.now(), env = environment(), cert = { format: 'fullhouse-calendar-proof', version: 1, algorithm: ALGORITHM, status: 'indeterminate', reason: null, inputHash: null, semanticsHash: await semantics, environment: env, domain: { min: M.MIN, max: M.MAX }, from: null, through: null, restrictions: ['applicability', 'selected-dependencies', 'same-day-interval', 'routine-balance', 'all-manual-choices'], recurrences: [], components: [], counts: { states: 0, checks: 0, work: 0, segments: 0 }, counterexample: null };
        let v, workSinceYield = 0;
        async function finish(status, reason = null, witness = null) { cert.status = status; cert.reason = reason; cert.counterexample = witness; const frozen = freeze(cert); return Object.freeze({ status, certificate: frozen, proofHash: await sha256(canonical(frozen)), metrics: { elapsedMs: performance.now() - started } }); }
        async function pause(force = false) { if (signal?.aborted)
            throw Error('cancelled'); if (force || workSinceYield >= 4096) {
            await yieldControl();
            workSinceYield = 0;
            if (signal?.aborted)
                throw Error('cancelled');
            if (Date !== pinnedDate || !same(environment(), env))
                throw Error('environment-changed');
        } }
        try {
            if (inputError)
                throw Error(inputError);
            if (cert.semanticsHash !== APPROVED)
                throw Error('unsupported-semantics');
            v = normalize(snapshot, s);
            cert.inputHash = await sha256(canonical(v));
            cert.from = v.from;
            cert.through = v.through;
            cert.budgets = v.budgets;
            cert.restrictions.push(v.disallowSameRoutineCooccurrence ? 'no-same-routine-cooccurrence' : 'overlaps-and-collisions-not-forbidden');
            if (!env.utc && !Object.hasOwn(snapshot, 'through'))
                throw Error('non-utc-requires-finite-range');
            if (env.utc && v.events.some(e => e.repeat === 'every' && !Number.isSafeInteger(Math.max(1, e.everyDays || 1))) && !Object.hasOwn(snapshot, 'through'))
                throw Error('unsupported-interval-period');
            cert.recurrences = v.events.map(e => ({ id: e.id, repeat: e.repeat, origin: e.date, end: e.endDate || null, every: e.repeat === 'every' ? Math.max(1, e.everyDays || 1) : null, specificDates: e.specificDates || [], overrides: e.overrides }));
            const routineMap = new Map(v.routines.map(r => [r.id, r])), groups = components(v.events), rprofiles = new Map();
            for (const r of v.routines)
                rprofiles.set(r.id, profiles(r, v.budgets.profiles));
            for (const events of groups) {
                const period = env.utc ? M.period(events) : null, segs = segments(events, v.from, v.through, period), component = { eventIds: events.map(e => e.id), routineIds: [...new Set(events.map(e => e.routineId).filter(Boolean))], periodDays: period === null ? null : period.toString(), segments: [] };
                cert.components.push(component);
                let options = [{}];
                for (const e of events) {
                    const opts = rprofiles.get(e.routineId)?.list || [{}];
                    if (options.length * opts.length > v.budgets.profiles)
                        throw Error('profile-budget');
                    options = options.flatMap(p => opts.map(c => ({ ...p, [e.id]: c })));
                }
                for (const seg of segs) {
                    if (++cert.counts.segments > v.budgets.segments)
                        throw Error('segment-budget');
                    const record = { from: M.date(seg.start), through: M.date(seg.end), periodDays: seg.periodDays, representatives: seg.representatives, profiles: options.length, states: 0, coverage: period !== null && BigInt(seg.end - seg.start + 1) > period ? 'periodic' : 'finite' };
                    component.segments.push(record);
                    for (let n = 0; n < seg.representatives; n++) {
                        const date = M.date(seg.start + n);
                        for (const profile of options) {
                            await pause();
                            if (cert.counts.states >= v.budgets.states)
                                throw Error('state-budget');
                            const work = events.length * (2 * events.length + 3 * v.routines.length + 1) + events.reduce((sum, e) => sum + 8 * (rprofiles.get(e.routineId)?.nodes || 0), 0);
                            if (cert.counts.work + work > v.budgets.work)
                                throw Error('work-budget');
                            cert.counts.work += work;
                            workSinceYield += work;
                            ++cert.counts.states;
                            ++record.states;
                            const evaluated = stateFrames(events, v.routines, date, profile, s);
                            for (const e of events) {
                                if (cert.counts.checks >= v.budgets.checks)
                                    throw Error('check-budget');
                                cert.counts.checks++;
                                if (!evaluated.active.has(e.id))
                                    continue;
                                const frame = evaluated.frame(e), dependencies = evaluated.selections;
                                let rule = null, balance = null;
                                if (!frame)
                                    rule = e.anchor === 'between' && !e.allDay ? (Object.values(dependencies).some(d => d.cycle) ? 'dependency-cycle' : Object.values(dependencies).some(d => d.after === null || d.before === null) ? 'missing-boundary' : 'nonpositive-dependency-window') : 'day-bounds';
                                else if (!Number.isFinite(frame.start) || !Number.isFinite(frame.end) || frame.start < 0 || frame.end > 1440 || frame.end <= frame.start)
                                    rule = 'day-bounds';
                                else if (routineMap.has(e.routineId)) {
                                    balance = s.routineBalance(routineMap.get(e.routineId), date, frame.length, profile[e.id]);
                                    if (balance.error)
                                        rule = 'routine-balance';
                                }
                                if (rule)
                                    return finish('invalid', rule, { date, eventId: e.id, rule, choices: profile, frame: frame || null, balance, dependencies });
                            }
                            if (v.disallowSameRoutineCooccurrence)
                                for (let i = 0; i < events.length; i++)
                                    for (let j = i + 1; j < events.length; j++) {
                                        const a = events[i], b = events[j];
                                        if (a.routineId && a.routineId === b.routineId && evaluated.active.has(a.id) && evaluated.active.has(b.id))
                                            return finish('invalid', 'same-routine-cooccurrence', { date, eventId: a.id, otherEventId: b.id, rule: 'same-routine-cooccurrence', choices: profile, dependencies: evaluated.selections });
                                    }
                        }
                    }
                }
            }
            await pause(true);
            return finish('valid');
        }
        catch (e) {
            return finish('indeterminate', e.message || 'verification-failed');
        }
    }
    async function verify(input, result, options) { try {
        const expected = bounded({ certificate: result.certificate, proofHash: result.proofHash, status: result.status }, true), actual = await prove(input, options);
        return expected.status === actual.status && expected.proofHash === actual.proofHash && same(expected.certificate, actual.certificate);
    }
    catch {
        return false;
    } }
    return Object.freeze({ prove, verify });
}
function projectPlan(plan, { from, through, budgets, disallowSameRoutineCooccurrence } = {}) { const events = new Map(plan.tables.events.map(r => [r.key, r.value])), routines = new Map(plan.tables.routines.map(r => [r.key, r.value])); return { events: plan.header.eventIds.map(k => copy(events.get(k))), routines: plan.header.routineIds.map(k => copy(routines.get(k))), from, ...(through === undefined ? {} : { through }), ...(budgets === undefined ? {} : { budgets }), ...(disallowSameRoutineCooccurrence === undefined ? {} : { disallowSameRoutineCooccurrence }) }; }
module.exports = { ALGORITHM, APPROVED, DEFAULTS, HARD, createCalendarProof, projectPlan, stateFrames, snapshotInput: bounded };
