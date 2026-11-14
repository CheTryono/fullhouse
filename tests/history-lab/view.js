'use strict';
const lab=FullhouseHistory.scenarios(FullhouseHistory),reader=lab.reader;
let scenario=lab.list[0],view='Mi día',selected=null,estimate=false;
const content=document.getElementById('content'),dateInput=document.getElementById('date');
function el(tag,text,attrs={}){const n=document.createElement(tag);if(text!==null)n.textContent=text;for(const [k,v] of Object.entries(attrs))n.setAttribute(k,String(v));return n;}
function add(parent,tag,text,attrs){const n=el(tag,text,attrs);parent.append(n);return n;}
const button=(parent,text,fn)=>{const b=add(parent,'button',text,{type:'button'});b.onclick=fn;return b;};
const format=n=>n===null?'desconocida':n+' min';
function clock(n){return n===1440?'24:00':String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');}
const scenarioInput=document.getElementById('scenario');lab.list.forEach(s=>scenarioInput.append(el('option',s.title,{value:s.id})));
scenarioInput.onchange=()=>{scenario=lab.list.find(s=>s.id===scenarioInput.value);dateInput.value=scenario.date;selected=null;estimate=false;render();};
document.getElementById('theme').onchange=e=>document.getElementById('lab').dataset.theme=e.target.value;
dateInput.onchange=()=>render();
const nav=document.querySelector('nav');
for(const name of ['Mi día','Horario','Calendario','Detalle','Progreso','Archivo'])button(nav,name,()=>{view=name;estimate=false;render();});
function show(key){selected=key;view='Detalle';estimate=false;render();}
function photoId(v,id){return 'evidence-'+encodeURIComponent(v.key)+'-'+encodeURIComponent(id);}
function facts(parent,v){
  const f=v.facts;if(!f)return;
  add(parent,'h3','Hechos conservados');add(parent,'p',f.note || 'Sin nota general',{class:'note'});
  for(const [id,note] of Object.entries(f.stepNotes || {}))add(parent,'p','Nota de '+id+': '+note);
  if(v.kind==='legacy' || v.kind==='estimated' || v.kind==='incomplete')add(parent,'p','Marcas originales: '+(f.checkedSteps || []).join(', '));
  const photos=add(parent,'div',null,{class:'photos'});
  for(const p of f.evidences || []){
    if(typeof p.src!=='string' || !/^data:image\/(png|jpeg|webp|gif);base64,/.test(p.src))continue;
    const figure=add(photos,'figure',null,{id:photoId(v,p.id)});figure.append(el('img',null,{src:p.src,alt:p.caption || 'Evidencia histórica'}));add(figure,'figcaption',p.caption || p.id);
  }
}
function nodes(parent,tree){const list=add(parent,'ul',null,{class:'steps'});for(const n of tree){const li=add(list,'li',null,{'data-step':n.id});
  const label=add(li,'label',null);const check=el('input',null,{type:'checkbox',disabled:'', 'aria-label':n.title});check.checked=n.checked;label.append(check,el('strong',n.title));
  add(li,'p',n.description);add(li,'span',n.decisionPending?'Alternativa pendiente':format(n.plannedMinutes)+(n.flexible?' · flexible':' · fijo'));
  if(n.variantId)add(li,'p','Alternativa seleccionada: '+n.variantId);
  if(n.note)add(li,'p',n.note);if(n.children.length)nodes(li,n.children);
}}
function record(parent,v,{detail=false,continued=false}={}){
  const a=add(parent,'article',null,{'data-record':v.key,'data-kind':v.kind});add(a,'p',v.label,{class:'label'});add(a,'h2',v.title || 'Registro '+v.key);
  add(a,'p','Fecha original: '+(v.date || 'desconocida')+(continued?' · Continuación en esta fecha':''));
  if(v.kind==='historical'){
    add(a,'p',v.description);if(v.routineDescription && v.routineDescription!==v.description)add(a,'p',v.routineDescription);
    if(v.plan.window)add(a,'p','Intervalo previsto: '+clock(v.plan.window.startMin)+'–'+clock(v.plan.window.endMin));
    add(a,'p','Estado: '+v.status.status+' · Pasos: '+v.progress.done+'/'+(v.progress.total ?? '?'));
    add(a,'p','Duración prevista: '+format(v.plannedMinutes)+' · Duración real: '+(v.actualTiming?format(v.actualTiming.minutes):'desconocida'));
    add(a,'p','Completada: '+(v.status.completedRecordedAt || 'sin completado vigente'));
    add(a,'p','Metas: '+v.plan.goals.map(g=>g.title || g.id+' (etiqueta desconocida)').join(', '));
    for(const c of v.continuations)add(a,'p','Continuación: '+c.localDate+' · '+c.recordedAt+' · desfase '+c.timezoneOffsetMinutes+' min');
  }
  if(v.tree?.length)nodes(a,v.tree);
  for(const m of v.inactiveMarks || [])add(a,'p','Marca conservada de rama inactiva: '+m.title+' ('+m.id+')');
  facts(a,v);
  if(detail){
    if(v.kind==='legacy' || v.kind==='estimated'){
      const label=add(a,'label',null);const input=el('input',null,{type:'checkbox',id:'estimate'});input.checked=estimate;input.onchange=()=>{estimate=input.checked;render();};label.append(input,document.createTextNode('Mostrar reconstrucción estimada con la plantilla actual'));
      add(a,'p','Continuar requiere adopción explícita. No disponible: los hechos antiguos se conservarán separados; no se emparejan pasos por nombre.');
    }
    for(const c of v.corrections || []){
      const audit=add(a,'details',null,{'data-audit':c.id});add(audit,'summary',(c.kind==='reopen'?'Reabierta':'Alternativa corregida')+' · '+c.at);
      add(audit,'p','Motivo: '+c.reason);add(audit,'p','Estado anterior: '+(c.lifecycle?.status || (c.before.completed?'completada (metadatos desconocidos)':'metadatos desconocidos')));
      add(audit,'p','Completado anterior: '+(c.lifecycle?.completedRecordedAt || 'fecha desconocida'));
      add(audit,'p','Marcas anteriores: '+c.before.checkedSteps.join(', '));add(audit,'p','Nota anterior: '+c.before.note);
      for(const [id,note] of Object.entries(c.before.stepNotes))add(audit,'p','Nota anterior de '+id+': '+note);
      for(const ch of c.changedChoices)add(audit,'p','Elección '+ch.stepId+': '+(ch.from ?? 'pendiente')+' → '+(ch.to ?? 'pendiente'));
      for(const id of c.before.evidenceIds)add(audit,'a','Consultar evidencia '+id,{href:'#'+photoId(v,id)});
    }
  } else button(a,'Consultar registro',()=>show(v.key));
}
function entries(parent,date){for(const item of reader.timeline(scenario.doc,date)){
  if(item.kind==='record')record(parent,item.view,{continued:item.continued});else {const a=add(parent,'article',null,{'data-kind':'planned'});add(a,'p','Programación actual · no es historial verificado',{class:'label'});add(a,'h2',item.event.title);add(a,'p',item.frame?clock(item.frame.start)+'–'+clock(item.frame.end):'Horario inválido · revisar dependencias');}
}}
function render(){
  content.replaceChildren();for(const b of nav.querySelectorAll('button'))b.setAttribute('aria-current',String(b.textContent===view));
  add(content,'h2',view);const date=dateInput.value;
  if(view==='Mi día' || view==='Horario')entries(content,date);
  if(view==='Calendario'){const grid=add(content,'div',null,{class:'calendar'});for(let i=0;i<7;i++){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+i);const day=d.toISOString().slice(0,10),column=add(grid,'section',null);add(column,'h3',day);entries(column,day);}}
  if(view==='Archivo')for(const v of reader.index(scenario.doc))record(content,v);
  if(view==='Detalle'){const key=selected || Object.keys(scenario.doc.logs)[0];if(key)record(content,reader.read(scenario.doc,key,{estimate}),{detail:true});else add(content,'p','No hay ejecuciones registradas');}
  if(view==='Progreso'){
    const p=reader.progress(scenario.doc,date),section=add(content,'section',null,{class:'metrics'});
    add(section,'h3','Historial verificado · fecha original');add(section,'p','Pasos realizados: '+p.steps.done+'/'+p.steps.total,{'data-metric':'steps'});add(section,'p','Actividades completas/capturadas: '+p.executions.completed+'/'+p.executions.total,{'data-metric':'executions'});
    add(section,'p','Ejecuciones con denominador desconocido: '+p.steps.unknownExecutions);add(section,'h3','Programación actual · métrica independiente');add(section,'p','Actividades completas/programadas ahora: '+p.planning.completed+'/'+p.planning.total,{'data-metric':'scheduled'});
    add(section,'p','Registros heredados: '+p.legacy.total+' · Completados declarados: '+p.legacy.completed+' · Información incompleta: '+p.incomplete);
    add(section,'p','Las estimaciones no participan en los porcentajes verificados. Las continuaciones conservan el crédito en la fecha original.');
  }
}
render();
