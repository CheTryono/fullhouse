// Synthetic representations of the documented version-1 formats, not user files.
const { DAY, emptyData, routine, event, step } = require('../helpers/app.cjs');
const goal = (patch = {}) => ({ id: 'goal', title: 'Synthetic goal', desc: '', parentId: '', color: '#a26cf4', current: 2, target: 10, unit: 'units', history: [{ date: DAY, value: 2, note: 'Synthetic history' }], ...patch });
function legacyBackup() {
  // No mode, area, durationMode, variants, evidence or dayReviews in early backups.
  return { ...emptyData(), goals: [goal()], routines: [routine()], events: [event('event', { routineId: 'routine', goalId: 'goal', repeat: 'daily' })],
    logs: { [`event@${DAY}`]: { completed: true, checkedSteps: ['step'] } } };
}
function modernBackup() {
  const data = legacyBackup();
  data.goals[0] = goal({ mode: 'milestones', status: 'working', area: 'mind', startDate: DAY, dueDate: '2030-03-01',
    milestones: [{ id: 'milestone', title: 'Synthetic milestone', done: false }],
    review: { date: DAY, time: '18:00', repeat: 'weekly' } });
  data.routines[0] = routine('routine', { color: '#a26cf4', icon: 'book', durationMode: 'fixed', durationMin: 30,
    requestEvidence: true, steps: [step('parent', { mode: 'alternatives', chooseWhen: 'execute', flexible: true, flexWeight: 2,
      children: [step('base', { flexible: true })], variants: [{ id: 'alternative', title: 'Synthetic option', desc: '', min: 10,
        days: [1, 3], flexible: true, goalId: 'goal', requestEvidence: true, children: [step('child', { children: [step('leaf', { flexible: true })] })] }] })] });
  data.events[0] = event('event', { routineId: 'routine', goalId: 'goal', repeat: 'custom', repeatDays: [1, 3],
    endDate: '2030-04-01', overrides: { '2030-01-09': { time: '10:00', skip: false } } });
  data.logs[`event@${DAY}`] = { completed: true, checkedSteps: ['leaf'], choices: { parent: 'alternative' },
    note: 'Synthetic note', stepNotes: { leaf: 'Synthetic detail' }, evidences: [{ id: 'evidence', kind: 'image',
      src: 'data:image/jpeg;base64,AA==', caption: 'Synthetic caption', stepId: 'leaf', createdAt: `${DAY}T12:00:00Z` }] };
  data.dayReviews = { [DAY]: { note: 'Synthetic review', closedAt: `${DAY}T12:00:00Z` } };
  return data;
}
module.exports = { goal, legacyBackup, modernBackup };
