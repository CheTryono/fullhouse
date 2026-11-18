'use strict';
const event = (id = 'e', extra = {}) => ({ id, title: id, date: '2000-01-01', time: '23:00', minutes: 60, goalId: '', routineId: '', repeat: 'daily', note: '', overrides: {}, ...extra });
const routine = (id = 'r', min = 30, extra = {}) => ({ id, title: id, desc: '', steps: [{ id: 's', title: 'Step', min }], ...extra });
const input = (events = [event()], routines = [], extra = {}) => ({ events, routines, from: '2000-01-01', ...extra });
module.exports = { event, routine, input };
