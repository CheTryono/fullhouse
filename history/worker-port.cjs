'use strict';
function createWorkerPort(factory) {
    if (typeof factory !== 'function')
        throw Error('Factoría Worker inyectada necesaria');
    const worker = factory(), pending = new Map();
    let closed = false;
    const rejectAll = e => { closed = true; for (const p of pending.values())
        p.reject(e); pending.clear(); worker.terminate(); };
    worker.onmessage = event => { const value = event.data, p = pending.get(value?.id); if (!p)
        return; pending.delete(value.id); value.ok ? p.resolve(value.value) : p.reject(Error(value.error)); };
    worker.onerror = () => rejectAll(Error('Worker interrumpido: confirmado intacto, construcción no persistida'));
    return Object.freeze({ run(id, type, value) { if (closed || typeof id !== 'string' || !id.trim() || pending.has(id))
            return Promise.reject(Error('Worker cerrado o ID ocupado')); return new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); try {
            worker.postMessage({ id, type, value });
        }
        catch (e) {
            pending.delete(id);
            reject(e);
        } }); }, close() { rejectAll(Error('Construcción cancelada; no se escribió almacenamiento')); } });
}
module.exports = { createWorkerPort };
