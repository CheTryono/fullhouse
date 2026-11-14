'use strict';
// Build de laboratorio: reutiliza funciones puras de app.tsx, nunca Planner/load/save.
// No se publica: pages.yml copia únicamente los recursos públicos existentes.
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const root=path.resolve(__dirname,'..');
const {plannerSource}=require('./planner-actions.cjs');
const functions=['validData','parseDay','minutes','key','occurs','stepMinutes','activeStep','activeSteps','routineForDay','baseLength','eventFrame'];
function scheduleSource(){
  const source=ts.createSourceFile('app.tsx',fs.readFileSync(path.join(root,'app.tsx'),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const found=new Map(source.statements.filter(ts.isFunctionDeclaration).filter(n=>n.name&&functions.includes(n.name.text)).map(n=>[n.name.text,n.getText(source)]));
  if(found.size!==functions.length)throw new Error('Falta función pura de producción');
  const days=source.statements.filter(ts.isVariableStatement).flatMap(n=>[...n.declarationList.declarations]).find(n=>n.name.getText(source)==='DAYS');
  if(!days?.initializer)throw new Error('Falta constante DAYS de producción');
  const code='const DAYS='+days.initializer.getText(source)+';\n'+functions.map(n=>found.get(n)).join('\n')+'\nmodule.exports={'+functions.join(',')+'};';
  return ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;
}
function bundle(){
  const names=['json','resolution','codec','engine','reader','adapter','backups','storage-memory','persistence','integration'];
  const modules=names.map(n=>[n,fs.readFileSync(path.join(root,'history',n+'.cjs'),'utf8')]);modules.push(['schedule',scheduleSource()]);modules.push(['planner',plannerSource()]);modules.push(['scenarios',fs.readFileSync(path.join(root,'tests/history-lab/scenarios.cjs'),'utf8')]);
  return `(function(){'use strict';const modules={${modules.map(([name,code])=>JSON.stringify(name)+':function(require,module,exports){\n'+code+'\n}').join(',')}};const cache={};function load(name){if(!Object.hasOwn(modules,name))throw Error('Módulo no autorizado: '+name);if(cache[name])return cache[name].exports;const module={exports:{}};cache[name]=module;modules[name](p=>{if(!/^\.\\/[a-z-]+\\.cjs$/.test(p))throw Error('Dependencia no portátil');return load(p.slice(2,-4));},module,module.exports);return module.exports;}globalThis.FullhouseHistory=Object.freeze({createEngine:load('engine').createEngine,createReader:load('reader').createReader,createAdapter:load('adapter').createAdapter,schedule:load('schedule'),scenarios:load('scenarios').scenarios,createMemoryStorage:load('storage-memory').createMemoryStorage,createMemoryLock:load('storage-memory').createMemoryLock,createRepository:load('persistence').createRepository,KEYS:load('persistence').KEYS,createIntegration:load('integration').createIntegration,backups:load('backups'),plannerActions:load('planner')});})();`;
}
module.exports={bundle,scheduleSource};
if(require.main===module)process.stdout.write(bundle());
