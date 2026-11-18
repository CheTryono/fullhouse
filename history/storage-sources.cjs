'use strict';
const {canonical}=require('./json.cjs');
const {readBackup,prepareLegacyDocument}=require('./backups.cjs');
const {sha256}=require('./persistence.cjs');
const {prepareDocument}=require('./storage-model.cjs');
async function inspectSources(sources,legacy){
  if(!sources || Object.keys(sources).length!==2 || !Object.hasOwn(sources,'main') || !Object.hasOwn(sources,'alias'))throw Error('Se requieren copias explícitas de ambas fuentes');
  const result={};for(const key of ['main','alias']){const raw=sources[key];if(raw===null){result[key]={raw:null,hash:null,valid:false};continue;}if(typeof raw!=='string')throw Error('Fuente no textual');const parsed=readBackup(raw,legacy);result[key]={raw,hash:await sha256(raw),valid:parsed.ok&&parsed.kind==='legacy',factsHash:parsed.ok&&parsed.kind==='legacy'?await sha256(canonical(parsed.document)):null};}
  const a=result.main,b=result.alias;
  const status=a.raw===null&&b.raw===null?'missing':a.raw!==null&&b.raw!==null?(a.hash===b.hash?'same-bytes':a.valid&&b.valid&&a.factsHash===b.factsHash?'same-facts':'divergent'):'single';
  return {status,...result};
}
function fingerprint(inspection){return {main:inspection.main.hash,alias:inspection.alias.hash};}
async function proposeMigration(sources,selection,legacy){
  const inspected=await inspectSources(sources,legacy);if(!['main','alias'].includes(selection) || !inspected[selection].valid)throw Error('Selecciona explícitamente una fuente v1 válida');
  const document=prepareLegacyDocument(inspected[selection].raw,legacy),plan=await prepareDocument(document,legacy);
  return {selection,sources:{main:sources.main,alias:sources.alias},fingerprint:fingerprint(inspected),sourceStatus:inspected.status,plan};
}
module.exports={inspectSources,fingerprint,proposeMigration};
