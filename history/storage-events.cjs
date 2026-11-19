'use strict';
// Creación exclusivamente experimental: sin DOM, reloj implícito ni almacenamiento.
const { copy, same, freeze, canonical } = require('./json.cjs'), model = require('./storage-model.cjs');
const civil = require('./calendar-math.cjs'), calendar = require('./calendar-proof.cjs'), R = require('./storage-routines.cjs'), codec = require('./codec.cjs');
const LIMITS = Object.freeze({ planningEvents: 2048, componentEvents: 32, moveEvents: 64 });
const clock = () => performance.now();
const { sha256 } = require('./persistence.cjs');
function stop(code, message, status = 'invalid', counterexample = null) { const e = Error(message); Object.assign(e, { code, status, counterexample }); throw e; }
function historyIdentities(plan) {
    const events = new Set(), series = new Set(), byEvent = new Map();
    for (const row of plan.tables.executions) {
        const c = row.value.log.history?.capture;
        events.add(row.key);
        const at = row.key.lastIndexOf('@');
        if (at > 0)
            events.add(row.key.slice(0, at));
        if (c) {
            events.add(c.sourceEventId);
            series.add(c.seriesId);
        }
        const source = c?.sourceEventId || (at > 0 ? row.key.slice(0, at) : row.key);
        if (!byEvent.has(source))
            byEvent.set(source, []);
        byEvent.get(source).push({ key: row.key, executionId: c?.executionId || null, seriesId: c?.seriesId || null, legacy: !c });
    }
    for (const rows of byEvent.values())
        rows.sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
    return { events, series, byEvent };
}
function issue(head, operationId) {
    if (typeof operationId !== 'string' || !/^[A-Za-z0-9_.:-]{1,128}$/.test(operationId) || !Number.isSafeInteger(head.generation + 1) || !/^[a-f0-9]{64}$/.test(head.receiptHash || ''))
        stop('IDENTITY', 'Reserva un ID de operación y una cabeza con linaje');
    const suffix = head.receiptHash + ':' + encodeURIComponent(operationId);
    return freeze({ format: 'event-reservation-v1', operationId, parentReceiptHash: head.receiptHash, generation: head.generation, eventId: 'event-v2:' + suffix, seriesId: 'series-v2:' + suffix });
}
function checkIdentity(plan, reservation, historical) {
    const { eventId, seriesId } = reservation;
    if (!eventId || !seriesId || eventId.startsWith('review-'))
        stop('IDENTITY', 'Identidad reservada para revisiones o incompleta');
    if (plan.tables.events.some(r => r.key === eventId) || historical.events.has(eventId))
        stop('EVENT_ID_USED', 'El ID del evento ya existe o aparece en el historial');
    if (plan.tables.events.some(r => r.value.seriesId === seriesId) || historical.series.has(seriesId))
        stop('SERIES_ID_USED', 'El ID de serie ya existe o aparece en el historial');
}
function component(events, id) {
    const seen = new Set([id]), todo = events.filter(e => e.id === id);
    const refs = (a, b) => a.anchor === 'between' && !a.allDay && !!b.routineId && [a.afterRoutineId, a.beforeRoutineId].includes(b.routineId);
    while (todo.length) {
        const a = todo.pop();
        for (const b of events)
            if (!seen.has(b.id) && (a.routineId && a.routineId === b.routineId || refs(a, b) || refs(b, a))) {
                seen.add(b.id);
                todo.push(b);
                if (seen.size > LIMITS.componentEvents)
                    stop('COMPONENT_BUDGET', 'Componente demasiado grande para demostrarlo', 'indeterminate');
            }
    }
    return events.filter(e => seen.has(e.id));
}
function selectScope(plan, reservation, payload, context, historical) {
    const started = clock(), p = calendar.snapshotInput(payload), c = calendar.snapshotInput(context);
    if (!p || typeof p !== 'object' || Array.isArray(p) || (p.id !== undefined && p.id !== ''))
        stop('CREATE_ONLY', 'Solo se admite crear un evento nuevo, sin ID previo');
    if (Object.hasOwn(p, 'seriesId') || Object.hasOwn(p, 'recipeRevisionId'))
        stop('OWNED_IDENTITY', 'El puerto reserva la serie; no se acepta una revisión capturada en el formulario');
    if (p.kind === 'review')
        stop('REVIEW_RESERVED', 'Las revisiones se crean desde su meta');
    if (!c || Object.keys(c).some(k => !['operationId', 'today', 'at', 'budgets'].includes(k)) || c.operationId !== reservation.operationId || typeof c.at !== 'string' || !/^\d{4}-\d\d-\d\dT/.test(c.at) || !Number.isFinite(Date.parse(c.at)))
        stop('CONTEXT', 'Reserva fecha, instante e identidad exactos');
    civil.ordinal(c.today);
    checkIdentity(plan, reservation, historical);
    if (plan.tables.events.length > LIMITS.planningEvents)
        stop('PLANNING_BUDGET', 'Catálogo de planificación excedido', 'indeterminate');
    const maps = Object.fromEntries(['events', 'routines', 'goals', 'revisions'].map(t => [t, new Map(plan.tables[t].map(r => [r.key, r]))]));
    const all = plan.header.eventIds.map(k => maps.events.get(k).value), seed = { ...p, id: reservation.eventId, seriesId: reservation.seriesId };
    const connected = component([...all, seed], seed.id), ids = new Set(connected.map(e => e.id));
    const move = p.overlapMode === 'move' && p.repeat === 'none' && !p.allDay && p.anchor !== 'between';
    if (move && all.length > LIMITS.moveEvents)
        stop('MOVE_BUDGET', 'No se puede comprobar el solapamiento dentro del presupuesto', 'indeterminate');
    const events = all.filter(e => move || ids.has(e.id)), rids = new Set([p.routineId, p.afterRoutineId, p.beforeRoutineId, ...events.flatMap(e => [e.routineId, e.afterRoutineId, e.beforeRoutineId])].filter(Boolean));
    if (p.routineId && !maps.routines.has(p.routineId))
        stop('ROUTINE_MISSING', 'La rutina seleccionada ya no existe');
    if (p.goalId && !maps.goals.has(p.goalId))
        stop('GOAL_MISSING', 'La meta seleccionada ya no existe');
    if (p.anchor === 'between' && (!p.routineId || !p.afterRoutineId || !p.beforeRoutineId || p.afterRoutineId === p.beforeRoutineId || [p.afterRoutineId, p.beforeRoutineId].includes(p.routineId) || !maps.routines.has(p.afterRoutineId) || !maps.routines.has(p.beforeRoutineId)))
        stop('BOUNDARIES', 'Elige una rutina y dos rutinas límite existentes y diferentes');
    if (p.allDay && p.anchor === 'between')
        stop('ANCHOR_UNSUPPORTED', 'Todo el día entre rutinas no está admitido en esta entrega', 'indeterminate');
    const rows = events.map(e => ({ store: 'events', row: maps.events.get(e.id) }));
    for (const id of plan.header.routineIds.filter(k => rids.has(k)))
        rows.push({ store: 'routines', row: maps.routines.get(id) });
    if (p.goalId)
        rows.push({ store: 'goals', row: maps.goals.get(p.goalId) });
    for (const id of new Set(events.map(e => e.recipeRevisionId).filter(Boolean))) {
        const row = maps.revisions.get(id);
        if (!row)
            stop('REVISION_MISSING', 'Falta una definición histórica referenciada');
        rows.push({ store: 'revisions', row });
    }
    return { payload: p, context: c, reservation, rows, componentIds: [...ids], componentMs: clock() - started };
}
function canonicalLocal(date, schedule) {
    civil.ordinal(date);
    const d = schedule.parseDay(date), parts = date.split('-').map(Number);
    if (d.getFullYear() !== parts[0] || d.getMonth() + 1 !== parts[1] || d.getDate() !== parts[2])
        stop('NORMALIZED_DATE', 'La fecha local no existe o se normaliza: no se crea la programación', 'indeterminate');
}
function effectEnd(e) {
    if (e.repeat === 'none')
        return e.kind === 'occasion' && e.endDate ? e.endDate : e.date;
    if (e.repeat === 'dates') {
        const last = [e.date, ...(e.specificDates || [])].sort().at(-1);
        return e.endDate && e.endDate < last ? e.endDate : last;
    }
    return e.endDate || null;
}
function memoFrames(schedule) {
    let previous = null;
    return (e, date, data) => {
        if (!previous || previous.events !== data.events || previous.routines !== data.routines || previous.logs !== data.logs || previous.date !== date) {
            const choices = Object.fromEntries(data.events.map(x => [x.id, data.logs[schedule.key(x, date)]?.choices || {}]));
            previous = { events: data.events, routines: data.routines, logs: data.logs, date, state: calendar.stateFrames(data.events, data.routines, date, choices, schedule) };
        }
        return previous.state.frame(e);
    };
}
function budgets(value) {
    if (value !== undefined && (!value || typeof value !== 'object' || Array.isArray(value)))
        stop('BUDGET', 'Presupuesto inválido', 'indeterminate');
    if (value && Object.keys(value).some(k => !Object.hasOwn(calendar.HARD, k)))
        stop('BUDGET', 'Presupuesto desconocido', 'indeterminate');
    const b = { ...calendar.DEFAULTS, ...value };
    for (const k of Object.keys(b))
        if (!Number.isSafeInteger(b[k]) || b[k] < 1 || b[k] > calendar.HARD[k])
            stop('BUDGET', 'Presupuesto fuera de límites', 'indeterminate');
    return b;
}
async function localWeekdayProof(events, routines, event, context, schedule) {
    const start = clock(), limits = budgets(context.budgets), input = calendar.snapshotInput({ events, routines, from: event.date, budgets: limits }), zone = R.calendarZone();
    await calendar.assertCalendarSemantics(schedule);
    if (!schedule.validData({ version: 1, goals: [], routines, events, logs: {} }))
        stop('CALENDAR_MODEL', 'Modelo de calendario inválido');
    // calendarDates rechaza meses/años/every indefinidos: no existe autorización por muestra.
    const catalog = R.calendarDates(events, event.date, schedule.parseDay);
    if (catalog.segments.length > limits.segments)
        stop('SEGMENT_BUDGET', 'Demasiados segmentos', 'indeterminate');
    let profiles = [{}];
    const byRoutine = new Map(routines.map(r => [r.id, r])), nodes = new Map();
    function count(steps) { return steps.reduce((sum, s) => sum + 1 + count(s.children || []) + (s.variants || []).reduce((n, v) => n + count(v.children || []), 0), 0); }
    for (const r of routines)
        nodes.set(r.id, count(r.steps));
    for (const e of events) {
        const r = byRoutine.get(e.routineId), options = r ? R.choices(r) : [{}];
        if (profiles.length * options.length > limits.profiles)
            stop('PROFILE_BUDGET', 'Demasiadas alternativas independientes', 'indeterminate');
        profiles = profiles.flatMap(p => options.map(c => ({ ...p, [e.id]: c })));
    }
    const checksLimit = Math.min(limits.checks, R.LIMITS.checks), cost = events.length * (2 * events.length + 3 * routines.length + 1) + events.reduce((n, e) => n + 8 * (nodes.get(e.routineId) || 0), 0);
    let states = 0, checks = 0, work = 0, chunk = 0;
    for (const date of catalog.dates)
        for (const profile of profiles) {
            if (states >= limits.states || checks + events.length > checksLimit || work + cost > limits.work)
                stop('CALENDAR_BUDGET', 'No se acepta una comprobación parcial del calendario local', 'indeterminate');
            if (chunk >= 4096) {
                await new Promise(r => setTimeout(r, 0));
                chunk = 0;
                if (R.calendarZone() !== zone)
                    stop('ZONE_CHANGED', 'La zona cambió durante la prueba', 'indeterminate');
            }
            states++;
            work += cost;
            chunk += cost;
            const evaluated = calendar.stateFrames(events, routines, date, profile, schedule);
            for (const e of events) {
                checks++;
                if (!evaluated.active.has(e.id))
                    continue;
                const frame = evaluated.frame(e), r = byRoutine.get(e.routineId), balance = frame && r ? schedule.routineBalance(r, date, frame.length, profile[e.id]) : null;
                if (!frame || !Number.isFinite(frame.start) || !Number.isFinite(frame.end) || frame.start < 0 || frame.end > 1440 || frame.end <= frame.start || balance?.error)
                    stop('CALENDAR_INVALID', 'Calendario inválido: ' + e.title + ' (' + e.id + ') el ' + date + (balance?.error ? ': ' + balance.error : ': intervalo o dependencia imposible'), 'invalid', { date, eventId: e.id, rule: balance?.error ? 'routine-balance' : 'day-or-dependency', choices: profile, frame: frame || null, balance, dependencies: evaluated.selections });
            }
        }
    if (R.calendarZone() !== zone)
        stop('ZONE_CHANGED', 'La zona cambió durante la prueba', 'indeterminate');
    const certificate = freeze({ format: 'fullhouse-local-event-calendar-proof', version: 1, algorithm: 'weekday-state-coverage-v1', status: 'valid', semanticsHash: calendar.APPROVED, inputHash: await sha256(canonical(input)), zone, domain: catalog.domain, from: event.date, through: civil.MAX, eventIds: events.map(e => e.id), segments: catalog.segments, counts: { states, checks, work, profiles: profiles.length }, limits });
    return freeze({ status: 'valid', certificate, proofHash: await sha256(canonical(certificate)), metrics: { elapsedMs: clock() - start } });
}
async function proveCalendar(events, routines, event, context, schedule) {
    const end = effectEnd(event), zone = R.calendarZone();
    if (zone !== 'UTC' && !end)
        return localWeekdayProof(events, routines, event, context, schedule);
    const input = { events, routines, from: event.date, ...(end ? { through: end } : {}), ...(context.budgets ? { budgets: context.budgets } : {}) };
    const result = await calendar.createCalendarProof(schedule).prove(input);
    if (result.status !== 'valid')
        stop('CALENDAR_' + result.status.toUpperCase(), 'No se pudo demostrar el calendario: ' + result.certificate.reason, result.status, result.certificate.counterexample);
    return result;
}
async function buildChange(scope, { legacy, schedule, plannerActions }) {
    const started = clock(), { payload, context, reservation } = scope, zone = R.calendarZone();
    await calendar.assertCalendarSemantics(schedule);
    if (!schedule.validData({ version: 1, goals: [], routines: [], events: [{ ...payload, minutes: typeof payload.minutes === 'number' ? Math.max(1, payload.minutes) : payload.minutes, id: reservation.eventId, seriesId: reservation.seriesId }], logs: {} }))
        stop('DRAFT_INVALID', 'El formulario contiene campos inválidos');
    for (const date of [payload.date, payload.endDate, payload.applyFrom, ...(payload.specificDates || []), ...Object.keys(payload.overrides || {})].filter(Boolean))
        canonicalLocal(date, schedule);
    if (payload.endDate && payload.endDate < payload.date)
        stop('DATE_ORDER', 'La fecha final no puede ser anterior al comienzo');
    const values = t => scope.rows.filter(r => r.store === t).map(r => copy(r.row.value));
    const before = { version: 2, goals: values('goals'), routines: values('routines'), events: values('events'), logs: {}, recipeRevisions: Object.fromEntries(values('revisions').map(r => [r.id, r])) };
    if (payload.routineId) {
        const r = before.routines.find(r => r.id === payload.routineId), id = reservation.seriesId + ':definition-validation';
        if (payload.allDay)
            stop('ALLDAY_ROUTINE_UNSUPPORTED', 'Día completo con rutina requiere demostrar paridad de asignación histórica; no se admite todavía', 'indeterminate');
        const compatible = steps => { for (const step of steps) {
            if (!step.mode && (step.variants || []).length)
                stop('IMPLICIT_ALTERNATIVES', 'La rutina necesita modo de alternativas explícito para garantizar su captura', 'indeterminate');
            if (['__proto__', 'constructor', 'prototype'].includes(step.id))
                stop('STEP_ID_UNSUPPORTED', 'El ID de paso no es compatible con las operaciones históricas de diccionario', 'indeterminate');
            compatible(step.children || []);
            for (const v of step.variants || [])
                compatible(v.children || []);
        } };
        compatible(r.steps);
        const errors = codec.validateV2({ version: 2, goals: [], routines: [], events: [], logs: {}, recipeRevisions: { [id]: { id, sourceRoutineId: r.id, createdAt: context.at, definition: r } } }, legacy);
        if (errors.length)
            stop('ROUTINE_NOT_CAPTURABLE', 'La rutina puede planificarse, pero su definición todavía no puede capturarse: ' + errors.join('; '), 'indeterminate');
    }
    const normalizationAt = clock(), actor = plannerActions(copy(before), { ...context, ids: [reservation.eventId], confirm: false, resolveFrame: memoFrames(schedule) }), confirmations = [];
    actor.controller.schedulePreview = () => []; // Sustituido por la demostración completa, nunca por un prefijo.
    actor.controller.askConfirm = async (...args) => { confirmations.push(args); return false; };
    actor.controller.state.eventDraft = { ...copy(payload), id: '', seriesId: reservation.seriesId };
    await actor.controller.saveEvent();
    const { candidate, messages } = actor.result(), normalizationMs = clock() - normalizationAt;
    if (confirmations.length)
        stop('MOVE_UNSUPPORTED', 'Esta creación requiere desplazar otros bloques; operación aplazada a B.3c', 'indeterminate');
    if (!candidate)
        stop('PLANNER_REJECTED', messages.join('\n') || 'Planner rechazó el formulario', 'invalid', { date: payload.date, eventId: reservation.eventId, rule: 'planner-input', messages });
    const event = candidate.events.find(e => e.id === reservation.eventId);
    if (!event || event.seriesId !== reservation.seriesId || candidate.events.length !== before.events.length + 1 || !same(candidate.events.slice(0, -1), before.events) || !same(candidate.routines, before.routines) || !same(candidate.goals, before.goals) || !same(candidate.recipeRevisions, before.recipeRevisions) || Object.keys(candidate.logs).length)
        stop('SCOPE_CHANGED', 'La creación intentó modificar otras entidades');
    const componentEvents = component(candidate.events, event.id), rid = new Set(componentEvents.map(e => e.routineId).filter(Boolean)), routines = before.routines.filter(r => rid.has(r.id));
    const calendarAt = clock(), proof = await proveCalendar(componentEvents, routines, event, context, schedule), calendarMs = clock() - calendarAt;
    if (Object.hasOwn(event, 'recipeRevisionId'))
        stop('SCOPE_CHANGED', 'Programar no crea una revisión histórica');
    const partial = await model.prepareDocument({ version: 2, goals: [], routines: [], events: [event], logs: {}, recipeRevisions: {} }, legacy);
    if (R.calendarZone() !== zone)
        stop('ZONE_CHANGED', 'La zona cambió durante la preparación', 'indeterminate');
    return { row: partial.tables.events[0], event: freeze(copy(event)), proof, zone, metrics: { componentMs: scope.componentMs, normalizationMs, calendarMs, constructionMs: clock() - started } };
}
module.exports = { LIMITS, historyIdentities, issue, checkIdentity, component, selectScope, buildChange, effectEnd, memoFrames, canonicalLocal, proveCalendar, localWeekdayProof };
