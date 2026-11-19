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
            if(method==='shiftEventOccurrence')return access.prepareEventShift(t,await access.reserveEventShift(t,draft,ctx));
            throw Error('Operación de programación no admitida');
        }, commitPlanning: access.commitEvent });
    return Object.freeze({ ...base,readEventShift:(request,context)=>access.readEventShift(base.state().confirmed,request,context), readEventEdit: id => access.readEventEdit(base.state().confirmed, id), readEvent: (id, options) => access.readEvent(base.state().confirmed, id, options) });
}
module.exports = { createEventsSession };
