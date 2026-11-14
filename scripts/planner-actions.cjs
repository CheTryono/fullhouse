'use strict';
// Extrae operaciones reales, sin constructor, carga inicial ni acceso a Storage.
const ts=require('typescript'),fs=require('node:fs'),path=require('node:path');
const members=['routineIssue','schedulePreview','betweenDayIssue','cancelFutureDependencies','saveRoutine','saveEvent','shiftEvent','deleteRoutine','deleteEvent'];
function plannerSource(){
  const ast=ts.createSourceFile('app.tsx',fs.readFileSync(path.join(__dirname,'../app.tsx'),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const functions=new Map(),constants=new Map();
  for(const n of ast.statements){if(ts.isFunctionDeclaration(n)&&n.name)functions.set(n.name.text,n);if(ts.isVariableStatement(n))for(const d of n.declarationList.declarations)if(ts.isIdentifier(d.name)&&d.initializer)constants.set(d.name.text,d);}
  const planner=ast.statements.find(n=>ts.isClassDeclaration(n)&&n.name.text==='Planner'),selected=members.map(name=>{const node=planner.members.find(m=>m.name?.getText(ast)===name);if(!node?.initializer)throw Error('Método Planner no extraíble: '+name);return [name,node.initializer];});
  const needed=new Map(),overrides=new Set(['uid','today']);
  function visit(node){if(ts.isIdentifier(node)&&!overrides.has(node.text)&&!needed.has(node.text)){
    const declaration=functions.get(node.text)||constants.get(node.text);if(declaration){needed.set(node.text,declaration);visit(declaration);}
  }ts.forEachChild(node,visit);}
  selected.forEach(([,node])=>visit(node));
  const helpers=[...needed.values()].map(n=>ts.isFunctionDeclaration(n)?n.getText(ast):'const '+n.getText(ast)+';').join('\n');
  // Las constantes elegidas solo pueden ser literales, nunca inicializadores de preferencias.
  for(const [name,n] of needed)if(/\b(getPreference|localStorage|sessionStorage|document|window|fetch|navigator)\b/.test(n.getText(ast)))throw Error('Dependencia con efectos: '+name);
  const source=`module.exports=function controllerFor(doc,options){let candidate=null;const messages=[],ids=options.ids.slice();const uid=()=>{if(!ids.length)throw Error('Falta identificador explícito');return ids.shift();},today=()=>options.today;
${helpers}
const controller={state:{data:doc,guideOpen:false,returnToSchedule:false,selectedDate:options.today},pendingSchedule:null,save(next){candidate=JSON.parse(JSON.stringify(next));return true;},notice(text){messages.push(text);},setState(patch){Object.assign(this.state,patch);if(patch.toast)messages.push(patch.toast);},askConfirm:async()=>options.confirm===true,close(){},editRoutineFromSchedule(){messages.push('Se requiere ajustar rutina');}};
${selected.map(([name,node])=>'controller.'+name+'=(function(){return '+node.getText(ast)+';}).call(controller);').join('\n')}
return {controller,result:()=>({candidate,messages})};};`;
  return ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;
}
module.exports={plannerSource};
