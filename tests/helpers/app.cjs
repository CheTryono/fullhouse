const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const plain = value => JSON.parse(JSON.stringify(value));
const DAY = '2030-01-07'; // Monday. All fixtures are synthetic.
const emptyData = () => ({ version: 1, goals: [], routines: [], events: [], logs: {} });
const step = (id = 'step', patch = {}) => ({ id, title: `Synthetic ${id}`, min: 10, ...patch });
const routine = (id = 'routine', patch = {}) => ({ id, title: `Synthetic ${id}`, desc: '', steps: [step()], ...patch });
const event = (id = 'event', patch = {}) => ({
  id, title: `Synthetic ${id}`, date: DAY, time: '09:00', minutes: 30,
  goalId: '', routineId: '', repeat: 'none', note: '', overrides: {}, ...patch,
});

function app({ data = emptyData(), stored = {}, failRead = false, failWrite = false, fileFailure = '', useLoadedData = false } = {}) {
  const storage = new Map(Object.entries(stored));
  const confirmations = [];
  const warnings = [];
  const downloads = [];
  const blobs = new Map();
  // This adapter exercises controller methods, not React rendering/batching.
  class Component {
    constructor(props) { this.props = props; }
    setState(patch) { Object.assign(this.state, typeof patch === 'function' ? patch(this.state) : patch); }
  }
  class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : [2030, 0, 7, 12, 0, 0])); }
    static now() { return new Clock().getTime(); }
  }
  class FileReader {
    readAsText(file) {
      if (fileFailure === 'throw') throw new Error('Synthetic file read failure');
      setImmediate(() => {
        if (fileFailure === 'error') { this.onerror(); return; }
        if (fileFailure === 'abort') { this.onabort(); return; }
        this.result = file.text; this.onload();
      });
    }
  }
  const context = vm.createContext({
    Date: Clock, FileReader, Blob, setTimeout() {},
    URL: { createObjectURL(blob) { const url = 'blob:synthetic-' + blobs.size; blobs.set(url, blob); return url; }, revokeObjectURL() {} },
    React: { Component, createElement() {} }, ReactDOM: { render() {} },
    document: { getElementById() { return null; }, body: { appendChild() {} }, createElement() { return { click() { downloads.push({ name: this.download, blob: blobs.get(this.href) }); }, remove() {} }; } },
    console: { warn(...args) { warnings.push(args); } },
    localStorage: {
      getItem(name) { if (failRead) throw new Error('Synthetic read failure'); return storage.get(name) ?? null; },
      setItem(name, value) { if (failWrite) throw new Error('Synthetic quota failure'); storage.set(name, String(value)); },
    },
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../../app.js'), 'utf8'), context, { filename: 'app.js' });
  const controller = vm.runInContext('new Planner({})', context);
  if (!useLoadedData) controller.state.data = plain(data);
  controller.state.guideOpen = false;
  controller.askConfirm = async (...args) => { confirmations.push(args); return true; };
  return {
    controller, storage, warnings, confirmations, downloads,
    setReadFailure(value) { failRead = value; },
    call(name, ...args) { return vm.runInContext(name, context)(...args); },
    async importBackup(text, accept = true) {
      controller.askConfirm = async (...args) => { confirmations.push(args); return accept; };
      const input = { target: { files: [{ text }], value: 'synthetic.json' } };
      await controller.importData(input);
      await new Promise(resolve => setImmediate(resolve));
      return input;
    },
  };
}
module.exports = { app, plain, DAY, emptyData, step, routine, event };
