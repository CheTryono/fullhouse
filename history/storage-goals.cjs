'use strict';
// Preparación pura: solo entidades de planificación; nunca recibe logs ni blobs.
const { copy, same } = require('./json.cjs'), model = require('./storage-model.cjs');
const METHODS = ['saveGoal', 'saveProgress', 'toggleMilestone', 'saveDayReview'];
const fail = s => { throw Error(s); };
const validDay = s => typeof s === 'string' && /^\d{4}-\d\d-\d\d$/.test(s) && Number.isFinite(Date.parse(s + 'T12:00:00Z')) && new Date(s + 'T12:00:00Z').toISOString().slice(0, 10) === s;
function inputs(method, payload, context) {
    if (!METHODS.includes(method))
        fail('Operación fuera del alcance B.1');
    payload = copy(payload);
    context = copy(context);
    if (!payload || typeof payload !== 'object' || Array.isArray(payload) || !context || typeof context !== 'object' || Array.isArray(context))
        fail('Se requiere formulario y contexto');
    if (typeof context.operationId !== 'string' || !context.operationId.trim() || !validDay(context.today) || typeof context.at !== 'string' || !/^\d{4}-\d\d-\d\dT/.test(context.at) || !Number.isFinite(Date.parse(context.at)) || !Array.isArray(context.ids) || context.ids.some(id => typeof id !== 'string' || !id.trim()) || new Set(context.ids).size !== context.ids.length)
        fail('Reserva identidad, día e instante explícitos');
    if (Object.keys(context).some(k => !['operationId', 'today', 'at', 'ids', 'state', 'confirm'].includes(k)))
        fail('Contexto desconocido');
    const allowed = ['selectedDate', 'progressGoalId', 'progressValue', 'progressStatus', 'progressNote', 'reviewDraft'];
    if (context.state && Object.keys(context.state).some(k => !allowed.includes(k)))
        fail('Estado de formulario fuera del alcance');
    return { method, payload, context, goalId: method === 'saveGoal' ? (payload.id || context.ids[0]) : method === 'toggleMilestone' ? payload.goalId : context.state?.progressGoalId };
}
function selectScope(plan, method, payload, context) {
    const request = inputs(method, payload, context), { goalId } = request, goals = new Map(plan.tables.goals.map(r => [r.key, r])), rows = [], seen = new Set();
    const add = (store, row) => { if (row && !seen.has(store + '\0' + row.key)) {
        seen.add(store + '\0' + row.key);
        rows.push({ store, row });
    } };
    if (method === 'saveDayReview') {
        add('reviews', plan.tables.reviews.find(r => r.key === request.context.today));
        return { request, rows };
    }
    if (typeof goalId !== 'string' || !goalId.trim())
        fail('Falta meta');
    const old = goals.get(goalId);
    if (method === 'saveGoal' ? !!payload.id && !old : !old)
        fail('La meta ya no existe');
    if (method === 'saveGoal' && !payload.id && old)
        fail('ID de meta reservado ya existe');
    add('goals', old);
    if (method === 'toggleMilestone' && !old.value.milestones?.some(m => m.id === payload.milestoneId))
        fail('El hito ya no existe');
    if (method === 'saveGoal') {
        const target = { ...payload, id: goalId }, changed = !old || target.parentId !== old.value.parentId || (target.dependsOn || '') !== (old.value.dependsOn || ''), active = new Set(), visited = new Set();
        function visit(id) { if (active.has(id)) {
            if (changed)
                fail('Las relaciones de metas forman un ciclo');
            return;
        } if (visited.has(id))
            return; visited.add(id); active.add(id); const g = id === goalId ? target : goals.get(id)?.value; if (g) {
            if (id !== goalId)
                add('goals', goals.get(id));
            for (const ref of [g.parentId, g.dependsOn].filter(Boolean)) {
                if (id === goalId && changed && !goals.has(ref) && ref !== goalId)
                    fail('Referencia de meta inexistente');
                visit(ref);
            }
        } active.delete(id); }
        visit(goalId);
        const review = plan.tables.events.find(r => r.key === 'review-' + goalId);
        if (review && (review.value.kind !== 'review' || review.value.goalId !== goalId || review.value.routineId))
            fail('ID review-* ocupado por otra actividad');
        add('events', review);
    }
    return { request, rows };
}
async function buildChange(scope, { legacy, schedule, plannerActions }) {
    if (typeof plannerActions !== 'function')
        fail('Puerto de métodos reales de Planner no disponible');
    const { method, payload, context, goalId } = scope.request;
    const before = { version: 2, goals: scope.rows.filter(r => r.store === 'goals').map(r => copy(r.row.value)), routines: [], events: scope.rows.filter(r => r.store === 'events').map(r => copy(r.row.value)), logs: {}, recipeRevisions: {} };
    if (scope.rows.some(r => r.store === 'reviews'))
        before.dayReviews = Object.fromEntries(scope.rows.filter(r => r.store === 'reviews').map(r => [r.row.key, copy(r.row.value)]));
    const { controller, result } = plannerActions(copy(before), context);
    if (method === 'saveGoal')
        controller.state.goalDraft = payload;
    if (method === 'toggleMilestone')
        await controller.toggleMilestone(goalId, payload.milestoneId);
    else
        await controller[method]();
    const { candidate, messages } = result();
    if (!candidate)
        fail(messages.join('\n') || 'Formulario rechazado');
    if (method === 'saveGoal')
        for (const event of candidate.events) {
            // review-* no tiene rutina ni dependencias: su intervalo se verifica para base y
            // cada excepción aplicable; recurrir no altera su longitud de 30 minutos.
            for (const day of new Set([event.date, ...Object.keys(event.overrides)])) {
                if (!schedule.occurs(event, day) || event.overrides[day]?.skip)
                    continue;
                const probe = { ...event, date: day, repeat: 'none' };
                if (!schedule.eventFrame(probe, day, { ...candidate, events: [probe] }))
                    fail('La revisión debe terminar dentro del día, hasta las 24:00');
            }
        }
    const partial = await model.prepareDocument(candidate, legacy);
    // La única eliminación permitida en B.1 es el evento review-* del propio objetivo.
    return { partial, request: scope.request };
}
function relatedRows(plan, id) {
    const result = [];
    const add = (store, row) => { if (row && !result.some(x => x.store === store && x.row.key === row.key))
        result.push({ store, row }); };
    const goals = new Map(plan.tables.goals.map(r => [r.key, r])), visited = new Set();
    function ancestor(key) { if (!key || visited.has(key))
        return; visited.add(key); const row = goals.get(key); if (row) {
        add('goals', row);
        ancestor(row.value.parentId);
        ancestor(row.value.dependsOn);
    } }
    ancestor(id);
    for (const row of plan.tables.goals)
        if (row.value.parentId === id || row.value.dependsOn === id)
            add('goals', row);
    for (const row of plan.tables.events)
        if (row.value.goalId === id)
            add('events', row);
    const references = steps => steps.some(s => s.goalId === id || references(s.children || []) || (s.variants || []).some(v => v.goalId === id || references(v.children || [])));
    for (const row of plan.tables.routines)
        if (references(row.value.steps))
            add('routines', row);
    return result;
}
module.exports = { METHODS, selectScope, buildChange, relatedRows };
