'use strict';
importScripts('/history-browser.js');
self.onmessage = async (event) => { const { id, type, value } = event.data || {}, H = FullhouseHistory; try {
    let result;
    if (type === 'prepare')
        result = await H.storageModel.prepareDocument(value, H.schedule.validData);
    else if (type === 'verify') {
        await H.storageModel.verifyPlan(value, H.schedule.validData);
        result = { valid: true };
    }
    else if (type === 'export')
        result = await H.storageArchive.exportArchive(value, H.schedule.validData);
    else if (type === 'import')
        result = await H.storageArchive.importArchive(value, H.schedule.validData);
    else
        throw Error('Acción Worker desconocida');
    self.postMessage({ id, ok: true, value: result });
}
catch (e) {
    self.postMessage({ id, ok: false, error: e.message });
} };
