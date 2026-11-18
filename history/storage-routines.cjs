'use strict';
const { copy, same } = require('./json.cjs'), model = require('./storage-model.cjs');
const clock = () => performance.now(), fail = s => { throw Error(s); };
const LIMITS = Object.freeze({ combinations: 256, dates: 20000, checks: 100000 });
const add = (day, n) => {
    const d = new Date(day + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + n);
    const s = d.toISOString().slice(0, 10);
    if (!/^\d{4}-\d\d-\d\d$/.test(s))
        fail('Fecha fuera del presupuesto verificable');
    return s;
};
function references(steps, field) { return steps.flatMap(s => [s[field], ...references(s.children || [], field), ...(s.variants || []).flatMap(v => [v[field], ...references(v.children || [], field)])]).filter(Boolean); }
function component(events, id) {
    const ids = new Set([id]);
    let changed = true;
    while (changed) {
        changed = false;
        for (const e of events)
            if (ids.has(e.routineId) || e.anchor === 'between' && (ids.has(e.afterRoutineId) || ids.has(e.beforeRoutineId))) {
                for (const r of [e.routineId, ...(e.anchor === 'between' ? [e.afterRoutineId, e.beforeRoutineId] : [])].filter(Boolean))
                    if (!ids.has(r)) {
                        ids.add(r);
                        changed = true;
                    }
            }
    }
    return events.filter(e => ids.has(e.routineId) || e.anchor === 'between' && (ids.has(e.afterRoutineId) || ids.has(e.beforeRoutineId)));
}
function choices(r) {
    let result = [{}];
    const seen = new Set(), walk = steps => {
        for (const s of steps) {
            if (typeof s.id !== 'string' || !s.id.trim() || seen.has(s.id))
                fail('Identificadores de pasos ambiguos');
            seen.add(s.id);
            const variants = s.variants || [];
            if (variants.some(v => typeof v.id !== 'string' || !v.id.trim()) || new Set(variants.map(v => v.id)).size !== variants.length)
                fail('Identificadores de variantes ambiguos');
            if ((s.mode || ((s.variants || []).length ? 'alternatives' : 'always')) === 'alternatives' && s.chooseWhen === 'execute') {
                // Ausencia de clave = base de planificación. Ningún string queda
                // reservado: '__base' puede ser un ID real en una plantilla v1.
                const options = [null, ...variants.map(v => v.id)];
                if (result.length * options.length > LIMITS.combinations)
                    fail('Demasiadas combinaciones de alternativas para demostrar seguridad');
                result = result.flatMap(c => options.map(id => id === null ? { ...c } : ({ ...c, [s.id]: id })));
            }
            walk(s.children || []);
            for (const v of s.variants || [])
                walk(v.children || []);
        }
    };
    walk(r.steps);
    return result;
}
function proofDates(events, today) {
    const boundaries = new Set([today]), weekly = new Set(['none', 'dates', 'daily', 'weekly', 'weekdays', 'custom']);
    for (const e of events) {
        if (!weekly.has(e.repeat) && !e.endDate)
            fail('Recurrencia indefinida no demostrable en B.2: ' + e.id + ' (' + e.repeat + ')');
        for (const d of [e.date, ...(e.specificDates || []), ...Object.keys(e.overrides || {})])
            if (d >= today) {
                boundaries.add(d);
                boundaries.add(add(d, 1));
            }
        if (e.endDate && e.endDate >= today)
            boundaries.add(add(e.endDate, 1));
    }
    const points = [...boundaries].sort(), dates = new Set();
    const put = d => {
        dates.add(d);
        if (dates.size > LIMITS.dates)
            fail('Alcance de fechas demasiado grande; operación bloqueada, sin validación parcial');
    };
    for (let i = 0; i < points.length; i++) {
        const start = points[i], end = points[i + 1] || null, irregular = events.some(e => !weekly.has(e.repeat) && e.date < (end || '9999-12-31') && e.endDate >= start);
        if (irregular) {
            if (!end)
                fail('Recurrencia sin final demostrable');
            for (let d = start; d < end; d = add(d, 1))
                put(d);
        }
        else
            for (let n = 0; n < 7; n++) {
                const d = add(start, n);
                if (end && d >= end)
                    break;
                put(d);
            }
    }
    return [...dates].sort();
}
function prove(before, after, id, today, schedule) {
    const events = component(before.events, id), ids = new Set(events.map(e => e.id)), next = after.events.filter(e => ids.has(e.id)), dates = proofDates(next, today), routines = new Map(after.routines.map(r => [r.id, r]));
    let profiles = [{}], checks = 0;
    for (const e of next) {
        const r = routines.get(e.routineId), options = r ? choices(r) : [{}];
        if (profiles.length * options.length > LIMITS.combinations)
            fail('Dependencias con demasiadas alternativas para demostrar seguridad');
        profiles = profiles.flatMap(p => options.map(c => ({ ...p, [e.id]: c })));
    }
    if (dates.length * profiles.length * Math.max(1, next.length) > LIMITS.checks)
        fail('Presupuesto de comprobación agotado; no se acepta un calendario parcial');
    for (const date of dates)
        for (const profile of profiles) {
            const data = { ...after, logs: Object.fromEntries(next.map(e => [schedule.key(e, date), { completed: false, checkedSteps: [], choices: profile[e.id] }])) };
            for (const e of next) {
                if (!schedule.occurs(e, date))
                    continue;
                if (++checks > LIMITS.checks)
                    fail('Presupuesto de comprobación agotado; no se acepta un calendario parcial');
                const frame = schedule.eventFrame(e, date, data);
                if (!frame)
                    fail('Horario o dependencia inválida para ' + e.id + ' el ' + date + ' (límites 00:00–24:00)');
                const r = routines.get(e.routineId);
                if (r) {
                    const issue = schedule.routineBalance(r, date, frame.length, profile[e.id]).error;
                    if (issue)
                        fail('Distribución inválida para ' + e.id + ' el ' + date + ': ' + issue);
                }
            }
        }
    return { dates: dates.length, combinations: profiles.length, checks, proof: 'weekly-segments-or-finite-exhaustion', from: today, eventIds: [...ids] };
}
function selectScope(plan, method, payload, context) {
    if (!['saveRoutine', 'deleteRoutine'].includes(method))
        fail('Operación fuera del alcance B.2');
    payload = copy(payload);
    context = copy(context);
    if (typeof context.operationId !== 'string' || !context.operationId.trim() || typeof context.at !== 'string' || !/^\d{4}-\d\d-\d\dT/.test(context.at) || !Number.isFinite(Date.parse(context.at)) || !/^\d{4}-\d\d-\d\d$/.test(context.today) || !Number.isFinite(Date.parse(context.today + 'T12:00:00Z')) || !Array.isArray(context.ids) || context.ids.some(id => typeof id !== 'string' || !id.trim()) || new Set(context.ids).size !== context.ids.length || new Date(context.today + 'T12:00:00Z').toISOString().slice(0, 10) !== context.today)
        fail('Reserva identidad, fecha e instante');
    if (Object.keys(context).some(k => !['operationId', 'today', 'at', 'ids', 'confirm', 'state'].includes(k)) || context.state && Object.keys(context.state).some(k => k !== 'selectedDate'))
        fail('Contexto fuera del alcance');
    const id = payload.id || context.ids[0], old = plan.tables.routines.find(r => r.key === id);
    if (!id || method === 'deleteRoutine' && !old || payload.id && !old)
        fail('La rutina ya no existe');
    if (!payload.id && old)
        fail('ID reservado de rutina ya existe');
    if (method === 'deleteRoutine' && context.confirm !== true)
        fail('Confirma explícitamente la eliminación de rutina');
    const affected = component(plan.tables.events.map(r => r.value), id), eventIds = new Set(affected.map(e => e.id)), routineIds = new Set([id, ...affected.flatMap(e => [e.routineId, e.afterRoutineId, e.beforeRoutineId]).filter(Boolean)]);
    const rows = ['routines', 'events'].flatMap(store => { const map = new Map(plan.tables[store].map(row => [row.key, row])), selected = store === 'routines' ? routineIds : eventIds; return plan.header[store === 'routines' ? 'routineIds' : 'eventIds'].filter(key => selected.has(key)).map(key => ({ store, row: map.get(key) })); }), revisions = new Map(plan.tables.revisions.map(r => [r.key, r]));
    for (const e of plan.tables.events.filter(row => eventIds.has(row.key)))
        if (e.value.recipeRevisionId) {
            const row = revisions.get(e.value.recipeRevisionId);
            if (!row)
                fail('Revisión referenciada inexistente');
            if (!rows.some(x => x.store === 'revisions' && x.row.key === row.key))
                rows.push({ store: 'revisions', row });
        }
    const oldGoals = new Set(old ? references(old.value.steps, 'goalId') : []), goals = new Map(plan.tables.goals.map(r => [r.key, r]));
    if (method === 'saveRoutine')
        for (const goalId of references(payload.steps, 'goalId')) {
            const row = goals.get(goalId);
            if (!row && !oldGoals.has(goalId))
                fail('Meta nueva referenciada inexistente: ' + goalId);
            if (row && !rows.some(x => x.store === 'goals' && x.row.key === row.key))
                rows.push({ store: 'goals', row });
        }
    return { method, payload, context, id, rows };
}
async function buildChange(scope, { legacy, schedule, plannerActions }) {
    const started = clock(), { method, payload, context, id } = scope;
    const values = store => scope.rows.filter(r => r.store === store).map(r => copy(r.row.value));
    // El orden eventIds determina qué límite selecciona eventFrame cuando hay varios.
    const before = { version: 2, goals: [], routines: values('routines'), events: values('events'), logs: {}, recipeRevisions: Object.fromEntries(scope.rows.filter(r => r.store === 'revisions').map(r => [r.row.key, copy(r.row.value)])) };
    const { controller, result } = plannerActions(copy(before), context);
    if (method === 'saveRoutine') {
        controller.state.routineDraft = payload;
        await controller.saveRoutine();
    }
    else
        await controller.deleteRoutine(before.routines.find(r => r.id === id));
    const { candidate, messages } = result();
    if (!candidate)
        fail(messages.join('\n') || 'Rutina rechazada');
    for (const event of candidate.events)
        if (event.recipeRevisionId && event.routineId !== candidate.recipeRevisions[event.recipeRevisionId]?.sourceRoutineId)
            delete event.recipeRevisionId;
    const normalized = await model.prepareDocument(candidate, legacy), planningStart = clock();
    if (method === 'saveRoutine') {
        const r = candidate.routines.find(r => r.id === id);
        for (let n = 0; n < 7; n++) {
            const date = add(context.today, n);
            for (const c of choices(r)) {
                const active = schedule.activeSteps(r.steps, date, c);
                if (!active.length)
                    continue;
                const budget = r.durationMode === 'fixed' ? r.durationMin : active.reduce((sum, s) => sum + schedule.stepMinutes(s), 0), issue = schedule.routineBalance(r, date, budget, c).error;
                if (issue)
                    fail('Rutina inválida: ' + issue);
            }
        }
    }
    const proof = prove(before, candidate, id, context.today, schedule);
    return { partial: normalized, proof, validationMs: clock() - planningStart, constructionMs: planningStart - started };
}
function index(plan) {
    const result = new Map(), get = id => {
        if (!result.has(id))
            result.set(id, { revisions: [], executions: [] });
        return result.get(id);
    };
    for (const row of plan.tables.events)
        for (const id of [row.value.routineId, row.value.afterRoutineId, row.value.beforeRoutineId].filter(Boolean))
            get(id);
    for (const row of plan.tables.revisions)
        get(row.value.sourceRoutineId).revisions.push(row.key);
    for (const row of plan.tables.executions) {
        const c = row.value.log.history?.capture;
        if (c?.sourceRoutineId)
            get(c.sourceRoutineId).executions.push({ key: row.key, executionId: c.executionId, revisionId: c.recipeRevisionId, hash: row.hash, provenance: c.provenance });
    }
    for (const value of result.values()) {
        value.executions.sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
        value.revisions.sort();
    }
    return result;
}
function relatedRows(plan, id) {
    const events = component(plan.tables.events.map(r => r.value), id), eventIds = new Set(events.map(e => e.id)), routineIds = new Set([id, ...events.flatMap(e => [e.routineId, e.afterRoutineId, e.beforeRoutineId]).filter(Boolean)]), rows = plan.tables.routines.filter(r => routineIds.has(r.key)).map(row => ({ store: 'routines', row }));
    for (const row of plan.tables.events)
        if (eventIds.has(row.key))
            rows.push({ store: 'events', row });
    const goals = new Set(rows.filter(r => r.store === 'routines').flatMap(r => references(r.row.value.steps, 'goalId')));
    for (const row of plan.tables.goals)
        if (goals.has(row.key))
            rows.push({ store: 'goals', row });
    return rows;
}
module.exports = { LIMITS, selectScope, buildChange, relatedRows, index, proofDates, choices };
