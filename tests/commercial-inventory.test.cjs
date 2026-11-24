'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{plan,inspect}=require('../scripts/inspect-remote-staging.cjs');
const response=x=>({ok:true,json:async()=>x});
test('inventory plan is pinned, read-only and excludes data, IAM and billing-account details',()=>{
 const p=plan();assert.equal(p.project,'fullhouse-staging');assert(p.endpoints.every(e=>e.method==='GET'&&e.url.includes('fullhouse-staging')));assert.equal(/token|serviceAccounts|documents|objects\//.test(JSON.stringify(p.endpoints)),false);
});
test('authenticated inventory makes GETs only and never follows redirects or enables an API',async()=>{
 const calls=[],result=await inspect({token:'synthetic-private-token',fetcher:async(url,options)=>{calls.push({url,options});return response(url.includes('cloudresourcemanager')?{projectId:'fullhouse-staging',name:'projects/123'}:{databases:[{name:'projects/fullhouse-staging/databases/(default)',locationId:'us-central1',databaseEdition:'STANDARD'}]});}});
 assert.equal(result.complete,true);assert.equal(calls.length,11);for(const {url,options}of calls){assert.equal(options.method,'GET');assert.equal(options.redirect,'error');assert.equal(options.credentials,'omit');assert.equal(options.headers.Authorization,'Bearer synthetic-private-token');assert.equal(/:enable|:create|:delete/.test(url),false);}assert.equal(JSON.stringify(result).includes('synthetic-private-token'),false);
});
test('denied/disabled services and truncation are unknown/incomplete, never claimed absent',async()=>{
 const r=await inspect({token:'local',fetcher:async url=>url.includes('cloudresourcemanager')?response({projectId:'fullhouse-staging',name:'projects/123'}):url.includes('firestore')?{ok:false,status:403}:url.includes('storage.googleapis')?response({items:[],nextPageToken:'do-not-follow'}):response({})});assert.equal(r.complete,false);assert.equal(r.resources.find(x=>x.name==='databases').status,'unknown');assert.equal(r.resources.find(x=>x.name==='buckets').status,'incomplete');
});
test('wrong or unverified project stops inventory; errors cannot expose credentials',async()=>{
 let calls=0;const r=await inspect({token:'secret',fetcher:async()=>{calls++;throw Error('secret credential');}});assert.equal(calls,1);assert.equal(JSON.stringify(r).includes('secret'),false);assert.equal(r.complete,false);
 const wrong=await inspect({token:'local',fetcher:async()=>response({projectId:'other',name:'projects/123'})});assert.equal(wrong.resources.length,1);await assert.rejects(inspect({token:'bad\nheader'}));
});
