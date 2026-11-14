'use strict';
const { same } = require('./json.cjs');
// Mantiene las reglas de activeStep/leafAllocation actuales, sin consultar Planner.
function resolve(definition, date, choices, plan) {
  if (!definition) return { rule: 'leaf-count-v1', tree: [], unitStepIds: [], unitsKnown: true, totalPlannedMinutes: plan.budgetMinutes ?? 0 };
  const weekday = new Date(date + 'T12:00:00Z').getUTCDay(), leaves = [];
  let pending = false;
  const walk = steps => steps.flatMap(s => {
    const mode = s.mode || ((s.variants || []).length ? 'alternatives' : 'always');
    if (mode === 'selected' && !(s.days || []).includes(weekday)) return [];
    let variant = null;
    const manual = mode === 'alternatives' && s.chooseWhen === 'execute';
    if (manual && !Object.hasOwn(choices, s.id)) {
      pending = true; return [{ stepId: s.id, variantId: null, plannedMinutes: null, decisionPending: true, children: [] }];
    }
    if (mode === 'alternatives') {
      variant = manual ? (s.variants || []).find(v => v.id === choices[s.id]) : (s.variants || []).find(v => v.days.includes(weekday));
      if (manual && choices[s.id] !== '__base' && !variant) throw new Error('Alternativa inexistente');
      if (!manual && !variant && !(s.days || [0,1,2,3,4,5,6].filter(d => !(s.variants || []).some(v => v.days.includes(d)))).includes(weekday)) return [];
    }
    const selected = variant || s;
    const node = { stepId: s.id, variantId: variant?.id || null, plannedMinutes: selected.min, decisionPending: false, children: walk(selected.children || []) };
    // Un nodo cuyos hijos no aplican ese día conserva el comportamiento hoja actual.
    if (!node.children.length) leaves.push({ node, min: selected.min, flexible: !!selected.flexible, weight: Math.max(1, selected.flexWeight || 1) });
    return [node];
  });
  const tree = walk(definition.steps);
  if (!pending) {
    const constrained = ['fixed', 'between'].includes(plan.durationMode);
    const available = constrained ? plan.budgetMinutes : leaves.reduce((n, l) => n + l.min, 0);
    if (typeof available !== 'number' || !Number.isFinite(available) || available < 0) throw new Error('Presupuesto previsto inválido');
    const fixed = leaves.filter(l => !l.flexible).reduce((n, l) => n + l.min, 0), flex = leaves.filter(l => l.flexible);
    if (fixed > available || (!flex.length && fixed !== available)) throw new Error('Pasos incompatibles con el presupuesto');
    const free = Math.round(available - fixed), weight = flex.reduce((n,l) => n+l.weight, 0);
    const portions = flex.map(l => ({ l, ideal: free * l.weight / weight }));
    let used = 0; portions.forEach(p => { p.l.node.plannedMinutes = Math.floor(p.ideal); used += Math.floor(p.ideal); });
    portions.slice().sort((a,b) => (b.ideal % 1) - (a.ideal % 1)).slice(0,free-used).forEach(p => p.l.node.plannedMinutes++);
    if (constrained && Math.abs(leaves.reduce((n,l) => n+l.node.plannedMinutes,0)-available)>1e-8) throw new Error('Asignación no exacta');
  }
  function total(nodes) {
    let sum = 0, unknown = false;
    for (const node of nodes) {
      if (node.decisionPending) { unknown = true; continue; }
      if (node.children.length) node.plannedMinutes = total(node.children);
      if (node.plannedMinutes === null) unknown = true;
      else sum += node.plannedMinutes;
    }
    return unknown ? null : sum;
  }
  const sum = total(tree);
  return { rule: 'leaf-count-v1', tree, unitStepIds: leaves.map(l=>l.node.stepId), unitsKnown: !pending, totalPlannedMinutes: pending ? null : sum };
}
// Topología/alternativas se comprueban sin recalcular la asignación histórica:
// los minutos congelados no dependen de futuras versiones del algoritmo de reparto.
function topology(resolution) {
  return resolution.tree.map(function node(n) { return { stepId:n.stepId, variantId:n.variantId, decisionPending:n.decisionPending, children:n.children.map(node) }; });
}
function matchesTopology(resolution, definition, date, choices, plan) {
  // Presupuesto de pasos evita exigir un reparto al comprobar solo topología.
  const expected = resolve(definition, date, choices, { ...plan, durationMode:'steps' });
  return same(topology(resolution), topology(expected));
}
module.exports = { resolve, matchesTopology };
