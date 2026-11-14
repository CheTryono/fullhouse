'use strict';
// Datos sintéticos; ejecutados con el mismo motor y adaptador que se distribuirán a tests.
function scenarios(H){
  const engine=H.createEngine(H.schedule.validData),adapter=H.createAdapter(H.schedule),reader=H.createReader(H.schedule.validData,adapter);
  const date='2030-01-07',at=date+'T12:00:00Z',later='2030-01-08T12:00:00Z';
  const pixel='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
  const copy=x=>JSON.parse(JSON.stringify(x));
  const step=(id,min=10)=>({id,title:'Paso original '+id,desc:'Instrucción original '+id,min});
  function initial(){return {version:2,recipeRevisions:{},goals:[{id:'goal',title:'Meta original',desc:'',parentId:'',color:'#a26cf4',current:0,target:10,unit:'veces',history:[]}],routines:[{id:'r',title:'Rutina original',desc:'Instrucciones originales de rutina',steps:[step('one'),step('two',20)]}],events:[{id:'e',title:'Actividad original',date,time:'09:00',minutes:30,goalId:'goal',routineId:'r',repeat:'daily',note:'Instrucciones originales de actividad',overrides:{}}],logs:{}};}
  function act(d,action,options={}){return adapter.prepare(engine,d,{executionId:'execution',at,context:{eventId:'e',date,seriesId:'series',revisionId:'revision'},action,...options}).after;}
  function base(){let d=act(initial(),{type:'step',stepId:'one',checked:true});d=act(d,{type:'note',text:'Nota sintética conservada'});return act(d,{type:'evidence',evidence:{id:'photo',kind:'image',src:pixel,caption:'Evidencia sintética',stepId:'one',createdAt:at}});}
  const list=[];
  function add(id,title,doc,day=date){list.push({id,title,doc,date:day});}
  let d=act(base(),{type:'complete',source:'manual'});d=copy(d);d.routines[0].steps=Array.from({length:10},(_,i)=>step('future'+i));d.events[0].title='Actividad futura modificada';add('edited','Completada y plantilla modificada',d);
  d=initial();d.routines[0].durationMode='fixed';d.routines[0].durationMin=60;d.routines[0].steps=[{...step('parent'),mode:'alternatives',chooseWhen:'weekday',days:[2],variants:[{id:'monday',title:'Alternativa del lunes',desc:'Instrucción del lunes',min:10,days:[1],children:[step('one')]}]},{...step('two'),flexible:true,flexWeight:2}];
  d=act(d,{type:'note',text:'Reparto original 10 + 50'});d=copy(d);d.routines[0].durationMin=90;d.routines[0].steps[0].variants[0].title='Alternativa futura';add('durations','Duración y alternativas modificadas',d);
  d=copy(base());d.routines=[];d.events=[];add('deleted','Rutina y evento eliminados',d);
  add('partial','Ejecución parcialmente realizada',base());
  d=initial();d.routines[0].steps=[{...step('manual'),mode:'alternatives',chooseWhen:'execute',variants:[{id:'option',title:'Opción sintética',desc:'',min:20,days:[]}]}];
  d=act(d,{type:'note',text:'Elección todavía pendiente'});add('pending','Alternativa manual pendiente',d);
  d=act(base(),{type:'continue',localDate:'2030-01-08',timezoneOffsetMinutes:0},{at:later});add('continued','Continuada otro día',d,'2030-01-08');
  d=initial();d.routines[0].steps=[{...step('parent'),mode:'alternatives',chooseWhen:'execute',children:[step('one')],variants:[{id:'other',title:'Alternativa corregida',desc:'Instrucción corregida',min:20,days:[],children:[step('two',20)]}]}];
  d=act(d,{type:'choice',stepId:'parent',variantId:'__base'});d=act(d,{type:'step',stepId:'one',checked:true});d=act(d,{type:'note',text:'Nota antes de corregir'});d=act(d,{type:'evidence',evidence:{id:'photo',kind:'image',src:pixel,caption:'Evidencia antes de corregir',stepId:'one',createdAt:at}});d=act(d,{type:'complete',source:'steps'});
  d=act(d,{type:'reopen',correctionId:'reopened',reason:'Continuar revisión'},{at:later});d=act(d,{type:'choice',stepId:'parent',variantId:'other',correctionId:'corrected',reason:'Corregir elección explícitamente'},{at:later});add('corrected','Reabierta y alternativa corregida',d);
  d=initial();d.logs['e@'+date]={completed:false,checkedSteps:['missing'],note:'Hecho heredado conservado',stepNotes:{missing:'Paso desaparecido'},evidences:[{id:'legacy-photo',kind:'image',src:pixel,caption:'Foto heredada',createdAt:at}]};add('legacy','Legado sin contexto verificable',d);
  d=copy(base());d.events[0].time='17:00';d.events.push({...copy(d.events[0]),id:'future',seriesId:'new-series',title:'Programación adicional'});add('statistics','Progreso con programación modificada',d);
  d=copy(base());d.events[0].id='segment';d.events[0].overrides={'2030-01-08':{skip:true}};add('recurring','Serie dividida y excepción cancelada',d,'2030-01-08');
  d=copy(base());d.goals=[];d.events.push({id:'review-goal',kind:'review',title:'Revisión · Meta original',date,time:'18:00',minutes:30,goalId:'goal',routineId:'',repeat:'weekly',note:'Revisión sintética',overrides:{}});
  d=adapter.prepare(engine,d,{executionId:'review-execution',at,context:{eventId:'review-goal',date,seriesId:'review-series',revisionId:'unused'},action:{type:'note',text:'Revisión registrada'}}).after;add('review','Revisión de meta y etiquetas históricas',d);
  d=copy(base());delete d.recipeRevisions.revision;add('broken','Referencia histórica faltante',d);
  return {engine,adapter,reader,list};
}
module.exports={scenarios};
