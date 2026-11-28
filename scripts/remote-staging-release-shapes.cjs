'use strict';
// Pure, redacted explanations of metadata already in memory. No API calls.
const id=require('./remote-staging-build-identity.cjs');
const UUID='[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}';
function buildAnnotation(key,value,approved){
 const full=typeof value==='string'&&value.length<=256?new RegExp(`^projects/([a-z0-9-]+)/locations/([a-z0-9-]+)/builds/(${UUID})$`).exec(value):null;
 const bare=typeof value==='string'&&new RegExp('^'+UUID+'$').test(value);
 const present=value!==undefined,format=full?'resource':bare?'uuid':present?'unsupported':'absent';
 const projectMatch=full?[id.PROJECT,id.NUMBER].includes(full[1]):null,regionMatch=full?full[2]===id.REGION:null;
 const idMatch=full?full[3]===approved:bare?value===approved:false;
 const valid=idMatch&&(full?projectMatch&&regionMatch:key==='run.googleapis.com/build-id');
 return {present,format,observed:full||bare?value:null,approvedBuildId:approved,projectMatch,regionMatch,idMatch,
  status:!present?'missing':valid?'verified':'mismatch',
  reason:!present?'not-returned':valid?full?'same-scoped-build-resource':'same-build-uuid':full||bare?'different-build-or-scope':'unsupported-reference-not-printed'};
}
function countField(annotations,key,defaultValue){
 const present=!!annotations&&Object.hasOwn(annotations,key),v=annotations?.[key];
 const valid=!present||typeof v==='string'&&/^(0|[1-9]\d{0,9})$/.test(v)&&Number(v)<=2147483647;
 return {present,observed:present&&valid?v:null,value:present?(valid?Number(v):null):defaultValue,
  representation:!present?'absent-default':valid?'integer-string':'unsupported-not-printed',valid};
}
function scaling(service,revision,config,singleRevision){
 const a=service?.metadata?.annotations,r=revision?.metadata?.annotations;
 const min=countField(a,'run.googleapis.com/minScale',0),max=countField(a,'run.googleapis.com/maxScale',null);
 const manual=countField(a,'run.googleapis.com/manualInstanceCount',0),rmin=countField(r,'autoscaling.knative.dev/minScale',0),rmax=countField(r,'autoscaling.knative.dev/maxScale',null);
 const modePresent=!!a&&Object.hasOwn(a,'run.googleapis.com/scalingMode'),mode=a?.['run.googleapis.com/scalingMode'];
 const automatic=!modePresent||mode==='automatic',issues=[];
 if(!a||typeof a!=='object'||Array.isArray(a))issues.push('service-annotations-not-observed');
 if(!r||typeof r!=='object'||Array.isArray(r))issues.push('revision-annotations-not-observed');
 if(!automatic)issues.push('manual-or-unrecognized-scaling-mode');
 if(!manual.valid||manual.value!==0)issues.push('unexpected-manual-instance-count');
 if(!min.valid||min.value!==0)issues.push('service-minimum-not-zero');
 // No inferred meaning for an explicit service max=0. Keep it blocked until
 // the actual representation and its documented semantics have been reviewed.
 if(!max.valid||max.present&&max.value!==1)issues.push('service-maximum-not-approved');
 if(!rmin.valid||rmin.value!==0||!rmax.valid||rmax.value!==1)issues.push('revision-limits-not-min0-max1');
 if((config?.minInstanceCount??0)!==0||config?.maxInstanceCount!==1)issues.push('function-limits-not-min0-max1');
 if(!singleRevision)issues.push('single-serving-revision-not-proven');
 const verified=issues.length===0;
 return {status:verified?'verified':'mismatch',
  service:{'run.googleapis.com/minScale':min,'run.googleapis.com/maxScale':max,
   'run.googleapis.com/manualInstanceCount':manual,
   'run.googleapis.com/scalingMode':{present:modePresent,observed:['automatic','manual','session'].includes(mode)?mode:null,classification:!modePresent?'default-automatic':automatic?'explicit-automatic':'unsupported-or-manual'}},
  revision:{'autoscaling.knative.dev/minScale':rmin,'autoscaling.knative.dev/maxScale':rmax},
  effective:{automatic,minInstances:verified?0:null,maxInstances:verified?1:null,
   basis:verified?'automatic + function/revision min0/max1 + absent-or-equal service cap + single serving revision':'not-proven'},issues};
}
function environment(entries,expected,revision){
 const formatValid=Array.isArray(entries),rows=formatValid?entries:[],counts=new Map(),variables=[];
 const platform={GCLOUD_PROJECT:id.PROJECT,GOOGLE_CLOUD_PROJECT:id.PROJECT,GCP_PROJECT:id.PROJECT,
  FUNCTION_TARGET:'remoteV1',FUNCTION_SIGNATURE_TYPE:'http',K_SERVICE:'remotev1',K_CONFIGURATION:'remotev1',K_REVISION:revision,PORT:'8080'};
 for(const row of rows)if(row&&typeof row.name==='string')counts.set(row.name,(counts.get(row.name)||0)+1);
 const safeName=name=>typeof name==='string'&&/^[A-Za-z_][A-Za-z0-9_]{0,127}$/.test(name);
 for(let index=0;index<rows.length;index++){
  const row=rows[index],name=safeName(row?.name)?row.name:null;
  let classification='invalid-entry',comparison='mismatch',representation='not-examined',reason='invalid-name-or-entry';
  if(name){
   const indirect=Object.hasOwn(row,'valueFrom'),literal=!indirect&&Object.keys(row).every(k=>['name','value'].includes(k))&&(!Object.hasOwn(row,'value')||typeof row.value==='string');
   // Run v1 EnvVar.value defaults to "". This is distinct from a missing row.
   const value=Object.hasOwn(row,'value')?row.value:'';
   classification=Object.hasOwn(expected,name)?'expected':Object.hasOwn(platform,name)?'platform':'unknown';
   const forbidden=/EMULATOR|^FIREBASE_DEBUG|^CLOUDSDK_AUTH_|^CLOUDSDK_API_ENDPOINT_OVERRIDES_|^GOOGLE_APPLICATION_CREDENTIALS$|^FIREBASE_TOKEN$|^NODE_OPTIONS$|^NODE_TLS_REJECT_UNAUTHORIZED$/.test(name);
   if(forbidden)classification='forbidden';
   if(indirect)classification='indirect-value';
   const target=Object.hasOwn(expected,name)?expected[name]:platform[name];
   let equivalent=false;
   if(literal&&name==='FIREBASE_CONFIG'&&typeof value==='string'&&value!==target){
    try{
     const actual=JSON.parse(value),wanted=JSON.parse(target);
     equivalent=actual&&typeof actual==='object'&&!Array.isArray(actual)&&Object.keys(actual).length===Object.keys(wanted).length&&Object.entries(wanted).every(([k,v])=>Object.hasOwn(actual,k)&&actual[k]===v);
    }catch{/* No raw value or parser error is ever included in the report. */}
   }
   const matches=literal&&!forbidden&&counts.get(name)===1&&['expected','platform'].includes(classification)&&typeof target==='string'&&(value===target||equivalent);
   comparison=matches?'match':'mismatch';
   representation=equivalent?'equivalent-inline-json':!Object.hasOwn(row,'value')&&literal?'default-empty-string':'literal-or-invalid';
   reason=!literal?'indirect-or-malformed-value':counts.get(name)!==1?'duplicate-name':forbidden?'forbidden-variable':classification==='unknown'?'unrecognized-addition':matches?'expected-value-matches':'unexpected-value';
  }
  variables.push({index,name,classification,comparison,representation,reason});
 }
 const missing=Object.keys(expected).filter(name=>!counts.has(name));
 return {status:formatValid&&!missing.length&&variables.every(v=>v.comparison==='match')?'verified':'mismatch',formatValid,
  variables,missing,privacy:'Names and comparison results only. No environment values, lengths or hashes.'};
}
module.exports={buildAnnotation,scaling,environment};
