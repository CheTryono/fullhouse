'use strict';
const { empty, schedule, plannerActions } = require('./history-integration.cjs'), model = require('../../history/storage-model.cjs'), E = require('../../history/storage-events.cjs'), Edit = require('../../history/storage-events-edit.cjs');
const clone = x => JSON.parse(JSON.stringify(x)), ctx = (id = 'edit', extra = {}) => ({ operationId: id, today: '2030-01-08', at: '2030-01-08T12:00:00Z', ...extra });
const head = { generation: 1, receiptHash: 'a'.repeat(64) }, ports = { legacy: schedule.validData, schedule, plannerActions };
async function prepare(doc, payload, context = ctx()) { const plan = await model.prepareDocument(doc, schedule.validData), index = E.historyIdentities(plan), reservation = Edit.issue(plan, head, payload.id, context.operationId, index), scope = Edit.selectScope(plan, reservation, payload, context, index, schedule); return { ...await Edit.buildEdit(scope, ports), plan, reservation, scope }; }
module.exports = { empty, schedule, plannerActions, model, E, Edit, clone, ctx, head, ports, prepare };
