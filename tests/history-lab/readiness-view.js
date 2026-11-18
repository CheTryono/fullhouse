'use strict';
const H = FullhouseHistory, $ = id => document.getElementById(id), L = H.schedule.validData;
let db = null, api = null, token = null, pending = null, busy = false, fault = null, packet = null, after = null;
const drafts = Object.create(null);
let photoURL = null;
function clearPhoto() { if (photoURL)
    URL.revokeObjectURL(photoURL); photoURL = null; $('lazy-photo').replaceChildren(); }
window.readinessLab = { state: () => ({ token, pending, busy, drafts, packet: packet?.metadata || null }) };
function text(id, value) { $(id).textContent = typeof value === 'string' ? value : JSON.stringify(value, null, 2); }
function state() { text('confirmed', token ? 'Último estado verificado · generación ' + token.generation + (Object.keys(drafts).length ? ' · hay borradores en memoria' : '') : 'No hay estado verificado'); text('pending', pending ? { meaning: 'PENDIENTE, no confirmado', id: pending.id, changedRows: pending.changedRows, newImages: pending.newImages } : null); }
async function run(fn) {
    if (busy)
        return;
    busy = true;
    try {
        await fn();
    }
    catch (e) {
        text('status', e.message);
    }
    finally {
        busy = false;
        state();
    }
}
function connect() {
    if (!db) {
        db = H.createLabDatabase({ factory: indexedDB, name: $('db-name').value, legacy: L, schedule: H.schedule });
        api = db.incremental;
    }
}
async function read() {
    clearPhoto();
    if (!token)
        return;
    const key = $('record').value;
    if (!key)
        return;
    const view = await api.readExecution(token, key);
    text('view', view);
    if (drafts[key] === view.log.note)
        delete drafts[key];
    $('note').value = drafts[key] ?? view.log.note ?? '';
}
async function page(reset = false) {
    if (reset)
        after = null;
    const result = await api.page(token, { after, limit: 25 });
    after = result.next;
    const existing = new Set([...$('record').options].map(o => o.value));
    for (const row of result.rows)
        if (!existing.has(row.key))
            $('record').append(new Option(row.key, row.key));
    await read();
}
async function open() {
    if (pending)
        throw Error('Exporta, reintenta o cancela el candidato antes de reabrir');
    connect();
    token = (await api.openWindow()).token;
    $('record').replaceChildren();
    await page(true);
    text('status', 'Base verificada; fotografías bajo demanda, sin hidratar.');
}
async function save(action) {
    if (!token || pending)
        throw Error('Abre la base y resuelve primero los pendientes');
    const key = $('record').value, view = await api.readExecution(token, key), id = crypto.randomUUID(), command = view.log.history ? { executionId: view.log.history.capture.executionId, at: '2030-01-07T13:00:00Z', operationId: id, editId: id, reason: 'Edición explícita en laboratorio', action } : { id, at: '2030-01-07T13:00:00Z', reason: 'Edición explícita del legado', action };
    pending = await api.prepareExecution(token, key, command);
    state();
    await retry();
}
async function retry() {
    if (!pending)
        throw Error('No hay candidato pendiente');
    const mode = fault;
    fault = null;
    const saved = await api.commitExecution(pending, { fault: mode });
    if (saved.status !== 'confirmed')
        throw Error('Existe un recibo anterior pero otra operación lo superó. Exporta y reconcilia; no se sobrescribe.');
    token = saved.token;
    pending = null;
    delete drafts[$('record').value];
    await read();
    text('status', 'Guardado confirmado tras transacción y lectura del cambio.');
}
function download(blob, name) { const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 2000); }
function ask(title, message) { text('dialog-title', title); text('dialog-text', message); $('confirm-dialog').showModal(); return new Promise(resolve => { const done = v => { $('confirm-dialog').close(); resolve(v); }; $('dialog-cancel').onclick = () => done(false); $('dialog-confirm').onclick = () => done(true); $('confirm-dialog').oncancel = e => { e.preventDefault(); done(false); }; }); }
$('theme').onchange = () => $('lab').dataset.theme = $('theme').value;
$('seed').onclick = () => run(async () => {
    connect();
    const original = await db.open();
    if (original.status !== 'empty')
        throw Error('Destino no vacío: no se reemplaza');
    const doc = H.scenarios(H).list.find(x => x.id === 'partial').doc, worker = H.createWorkerPort(() => new Worker('/history-worker.js'));
    try {
        const plan = await worker.run('seed', 'prepare', doc);
        await db.commit(plan, { id: 'seed' });
    }
    finally {
        worker.close();
    }
    await open();
});
$('open').onclick = () => run(open);
$('scrub').onclick = () => run(open);
$('page').onclick = () => run(() => page());
$('record').onchange = () => run(read);
$('note').oninput = () => { drafts[$('record').value] = $('note').value; };
$('save-note').onclick = () => run(() => save({ type: 'note', text: $('note').value }));
$('mark').onclick = () => run(async () => {
    const view = await api.readExecution(token, $('record').value), stepId = view.log.history?.resolution.unitStepIds[0];
    if (!stepId)
        throw Error('Sin unidad histórica aplicable');
    await save({ type: 'step', stepId, checked: true });
});
$('show-photo').onclick = () => run(async () => { const key = $('record').value, view = await api.readExecution(token, key), first = view.evidence[0]; if (!first)
    throw Error('No hay fotografía en esta ejecución'); const value = await api.readPhoto(token, first.owner, first.id), url = URL.createObjectURL(new Blob([value.blob], { type: first.mime })), image = new Image(); try {
    image.src = url;
    image.alt = first.caption || 'Fotografía sintética recuperada a demanda';
    await image.decode();
    if ($('record').value !== key) {
        URL.revokeObjectURL(url);
        return;
    }
    clearPhoto();
    photoURL = url;
    $('lazy-photo').append(image);
}
catch (e) {
    URL.revokeObjectURL(url);
    throw e;
} });
$('statistics').onclick = () => run(async () => text('stats', await api.statistics(token)));
$('fail').onclick = () => { fault = 'after-records'; text('status', 'El próximo intento abortará dentro de la transacción.'); };
$('lost-ack').onclick = () => { fault = 'lost-ack'; text('status', 'El próximo intento perderá el acuse después del commit.'); };
$('retry').onclick = () => run(retry);
$('cancel').onclick = () => run(async () => {
    if (!pending)
        throw Error('No hay candidato pendiente');
    const info = await api.inspectOperation(pending);
    text('recovery', info);
    if (info.status === 'recovery')
        throw Error('Ambigüedad: conserva y exporta para recuperación');
    if (!await ask('Cancelar candidato en memoria', info.status === 'persisted-receipt' ? 'La operación ya tiene recibo. Cancelar no la deshace: se volverá a verificar lo persistido.' : 'Puedes descargar el paquete antes de cancelar. Se descartará solo el candidato de esta ventana; el confirmado permanece intacto.'))
        return;
    pending = null;
    await open();
});
$('export-originals').onclick = () => run(async () => { connect(); download(await db.exportDiagnostic(), 'fullhouse-synthetic-unverified.fhdiagnostic'); text('status', 'Diagnóstico sin validar; NO es un respaldo completo restaurable. Conserva los originales.'); });
$('export-confirmed').onclick = () => run(async () => {
    connect();
    const snapshot = await db.open();
    if (snapshot.status !== 'ready')
        throw Error('No hay respaldo completo verificable');
    download(await H.storageArchive.exportArchive(snapshot.plan, L), 'fullhouse-synthetic-complete.fharchive');
    text('status', 'Descarga completa solicitada; comprueba el archivo.');
});
$('export-pending').onclick = () => run(async () => {
    if (!pending)
        throw Error('No hay candidato');
    download(await api.exportPending(pending, drafts), 'fullhouse-synthetic-pending.fhrecovery');
    text('status', 'Paquete pendiente: no demuestra que el candidato esté guardado.');
});
$('recovery-file').onchange = () => run(async () => {
    const file = $('recovery-file').files[0];
    if (!file)
        return;
    packet = await H.recoveryBinary.inspectRecovery(file, L);
    text('recovery', packet.metadata);
    text('status', 'Paquete íntegro examinado · candidato NO confirmado.');
});
$('forget-packet').onclick = () => run(async () => {
    if (!await ask('Olvidar paquete de esta ventana', 'Se liberará la copia en memoria. No se borran archivos descargados, bases de datos ni candidatos pendientes.'))
        return;
    packet = null;
    $('recovery-file').value = '';
    text('recovery', 'Paquete olvidado en esta ventana; los archivos externos siguen existiendo.');
});
$('resume').onclick = () => run(async () => {
    if (!packet || pending)
        throw Error('Examina un paquete y resuelve el pendiente actual');
    const recovered = await api.resumePending(token, packet);
    pending = recovered.status === 'already-confirmed' ? null : recovered;
    Object.assign(drafts, packet.metadata.drafts);
    await read();
    text('status', recovered.status === 'already-confirmed' ? 'El candidato ya tiene confirmación verificable; no se vuelve a escribir.' : 'Candidato recuperado; usa Reintentar para persistir el mismo ID.');
});
$('restore-new').onclick = () => run(async () => {
    if (!packet)
        throw Error('Examina primero el paquete');
    if (!await ask('Restaurar candidato en otra base', 'El candidato no estaba confirmado. Se escribirá en una base nueva, sin modificar el origen, los datos v1 ni otras ramas.'))
        return;
    const name = 'fullhouse-lab-recovered-' + crypto.randomUUID(), destination = H.createLabDatabase({ factory: indexedDB, name, legacy: L });
    try {
        const state = await destination.open();
        if (state.status !== 'empty')
            throw Error('Destino no vacío');
        await destination.commit(packet.candidate, { id: 'recovery:' + packet.metadata.id });
        text('restored', 'Candidato confirmado únicamente en destino nuevo: ' + name);
    }
    finally {
        destination.close();
    }
});
$('privacy').onclick = () => run(async () => {
    const snapshot = await db.open();
    if (snapshot.status !== 'ready')
        throw Error('Base no verificada');
    const first = snapshot.plan.tables.evidence[0]?.value;
    if (!first)
        throw Error('No hay fotografía');
    text('privacy-report', await H.photoPrivacy.photoRemovalReport(snapshot.plan, [{ owner: first.owner, id: first.id }], L));
});
window.addEventListener('beforeunload', e => {
    if (busy || pending || Object.keys(drafts).length) {
        e.preventDefault();
        e.returnValue = '';
    }
});
state();
