'use strict';
const { snapshotInput } = require('./calendar-proof.cjs');
const { createGoalsSession } = require('./goals-session.cjs');
function createEventsSession(access) {
    const base = createGoalsSession({ ...access, preparePlanning: async (t, method, payload, context) => {
            const draft = snapshotInput(payload), ctx = snapshotInput(context);
            if (method === 'createEvent')
                return access.prepareEvent(t, await access.reserveEvent(t, ctx.operationId), draft, ctx);
            if (method === 'editEvent')
                return access.prepareEventEdit(t, await access.reserveEventEdit(t, draft.id, ctx.operationId), draft, ctx);
            throw Error('Solo creación o edición de eventos; movimientos pendientes');
        }, commitPlanning: access.commitEvent });
    return Object.freeze({ ...base, readEventEdit: id => access.readEventEdit(base.state().confirmed, id), readEvent: (id, options) => access.readEvent(base.state().confirmed, id, options) });
}
module.exports = { createEventsSession };
