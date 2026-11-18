'use strict';
const H = FullhouseHistory, $ = id => document.getElementById(id), L = H.schedule.validData;
let copies = { main: null, alias: null }, original = null, candidate = null, pending = null, token = null, unreadable = false, busy = false;
const raw = note => JSON.stringify({ version: 1, goals: [], routines: [], events: [], logs: { old: { completed: false, checkedSteps: ['lost'], note } } });
const db = H.createLineageDatabase({ factory: indexedDB, name: 'fullhouse-lab-lineage-ui', legacy: L, schedule: H.schedule, readSources: () => { if (unreadable)
        throw Error('Fuente inaccesible simulada'); return { ...copies }; } });
function text(id, v) { $(id).textContent = typeof v === 'string' ? v : JSON.stringify(v, null, 2); }
function render() { text('sources', copies); text('pending', pending ? { id: pending.id, meaning: 'pendiente, no confirmado' } : null); }
async function run(fn) { if (busy)
    return; busy = true; try {
    await fn();
}
catch (e) {
    text('status', e.message);
}
finally {
    busy = false;
    render();
} }
window.lineageLab = { state: () => ({ busy, pending, candidate, token }) };
$('theme').onchange = () => $('lab').dataset.theme = $('theme').value;
$('fixture').onclick = () => run(async () => { const mode = $('scenario').value, a = raw('Hecho A'), b = raw('Hecho B'); copies = mode === 'main' ? { main: a, alias: null } : mode === 'alias' ? { main: null, alias: a } : mode === 'same' ? { main: a, alias: a } : mode === 'facts' ? { main: a, alias: JSON.stringify(JSON.parse(a), null, 2) } : { main: a, alias: b }; original = { ...copies }; $('source').value = ''; text('status', 'Elige una fuente: no hay combinación automática.'); });
$('stage').onclick = () => run(async () => { candidate = await H.storageSources.proposeMigration(copies, $('source').value, L); await db.stageMigration(candidate, { id: 'migration-ui' }); text('status', 'Candidato preparado, sin autoridad activa.'); });
$('finalize').onclick = () => run(async () => { if (!candidate || !$('confirm').checked || $('source').value !== candidate.selection)
    throw Error('Confirma la fuente que elegiste al preparar el candidato'); const result = await db.finalizeMigration('migration-ui', { confirm: true }); if (result.status !== 'confirmed')
    throw Error('Recuperación necesaria'); token = (await db.incremental.openWindow()).token; text('authority', (await db.open()).authority); text('status', 'Migración sintética confirmada con autoridad persistente.'); });
async function retry() { if (!pending)
    throw Error('No hay candidato pendiente'); const result = await db.incremental.commitExecution(pending); if (result.status !== 'confirmed')
    throw Error('Otro commit superó el candidato: conserva las ramas'); token = result.token; pending = null; text('authority', (await db.open()).authority); text('status', 'Nota confirmada tras comprobar linaje y fuentes.'); }
$('save-note').onclick = () => run(async () => { if (pending || !token)
    throw Error('Abre una autoridad y resuelve el pendiente'); const id = crypto.randomUUID(); pending = await db.incremental.prepareExecution(token, 'old', { id, at: '2030-01-07T12:00:00Z', reason: 'Edición voluntaria', action: { type: 'note', text: $('note').value } }); await retry(); });
$('retry').onclick = () => run(retry);
$('watch').onclick = () => run(async () => { const state = await db.open(); text('authority', state.authority || state); if (state.status !== 'ready')
    throw Error(state.error || 'Solo lectura/recuperación'); token = (await db.incremental.openWindow()).token; text('status', 'Fuentes y cadena verificadas.'); });
$('old-tab').onclick = () => run(async () => { copies = { ...copies, main: raw('Cambio de una pestaña antigua') }; text('status', 'Fuente modificada: la siguiente comprobación detendrá escrituras.'); });
$('restore-sources').onclick = () => run(async () => { copies = { ...original }; unreadable = false; text('status', 'Bytes iniciales restaurados. Los conflictos observados no se eliminan automáticamente.'); });
$('read-error').onclick = () => run(async () => { unreadable = true; text('status', 'La siguiente lectura de fuentes fallará; no se considera ausencia.'); });
$('export').onclick = () => run(async () => { const data = await db.sourceRecovery(), url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' })), a = document.createElement('a'); a.href = url; a.download = 'fullhouse-lab-lineage-sources.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 2000); text('status', 'Descarga de fuentes solicitada: no es un respaldo Data2 completo.'); });
window.addEventListener('beforeunload', e => { if (busy || pending) {
    e.preventDefault();
    e.returnValue = '';
} });
render();
