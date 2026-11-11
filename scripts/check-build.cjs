// Compile in memory: verification must never replace the shipped app.js.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const configPath = path.join(root, 'tsconfig.json');
const config = ts.readConfigFile(configPath, ts.sys.readFile);
if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
const program = ts.createProgram(parsed.fileNames, parsed.options);
const diagnostics = [...parsed.errors, ...ts.getPreEmitDiagnostics(program)];
assert.equal(diagnostics.length, 0, diagnostics.map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n')).join('\n'));
let javascript;
const result = program.emit(undefined, (name, text) => {
  if (path.resolve(name) === path.join(root, 'app.js')) javascript = text;
});
assert.equal(result.emitSkipped, false);
assert.equal(typeof javascript, 'string');
assert.equal(javascript, fs.readFileSync(path.join(root, 'app.js'), 'utf8'), 'app.js must match app.tsx compiled with the pinned TypeScript version');
console.log('TypeScript and shipped app.js match (no files written).');
