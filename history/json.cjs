'use strict';
// Frontera JSON sin getters/toJSON, ciclos, números no finitos ni profundidad ilimitada.
// Sin reloj, aleatoriedad, DOM, almacenamiento ni servicios externos.
function copy(value) {
  const ancestors = new Set(); let count = 0;
  function visit(v, depth) {
    if (++count > 200000 || depth > 64) throw new Error('Documento demasiado complejo');
    if (v === null || typeof v === 'boolean') return v;
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && v.length <= 16000000) return v;
    if (typeof v !== 'object' || ancestors.has(v)) throw new Error('Se requieren datos JSON sin ciclos');
    const proto = Object.getPrototypeOf(v);
    if (!Array.isArray(v) && proto !== Object.prototype && proto !== null) throw new Error('Objeto JSON no válido');
    if (Object.getOwnPropertySymbols(v).length) throw new Error('Clave no JSON');
    ancestors.add(v);
    const descriptors = Object.getOwnPropertyDescriptors(v), entries = [];
    for (const k of Object.keys(descriptors)) {
      if (Array.isArray(v) && k === 'length') continue;
      const d = descriptors[k];
      if (!d.enumerable || !Object.hasOwn(d, 'value')) throw new Error('Propiedad JSON no válida');
      if (Array.isArray(v) && !/^(0|[1-9]\d*)$/.test(k)) throw new Error('Array no JSON');
      entries.push([k, visit(d.value, depth + 1)]);
    }
    let result;
    if (Array.isArray(v)) {
      if (entries.length !== v.length) throw new Error('Array disperso');
      result = entries.map(([, x]) => x);
    } else result = Object.fromEntries(entries);
    ancestors.delete(v); return result;
  }
  return visit(value, 0);
}
function canonical(v) {
  if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canonical(v[k])).join(',') + '}';
  return JSON.stringify(v);
}
const same = (a, b) => canonical(a) === canonical(b);
function freeze(v) { if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); } return v; }
module.exports = { copy, canonical, same, freeze };
