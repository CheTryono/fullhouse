'use strict';
const {chromium}=require('playwright'),{buildSync}=require('esbuild'),http=require('node:http'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
// A separate origin avoids quota reservations from Firebase SDK/background writes.
async function quotaTest(){
 const server=http.createServer((req,res)=>{res.setHeader('content-type','text/html');res.end('<!doctype html><title>Disposable quota test</title>');});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port,profile=fs.mkdtempSync(path.join(os.tmpdir(),'fullhouse-quota-'));
 const bundle=buildSync({entryPoints:[path.resolve(__dirname,'../../remote-client/durable-store.ts')],bundle:true,format:'iife',globalName:'DurableModule',write:false}).outputFiles[0].text;
 const open=()=>chromium.launchPersistentContext(profile,{headless:true,executablePath:process.env.FULLHOUSE_CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox']});let context;
 try{
  context=await open();let page=await context.newPage();await page.goto(origin);await page.addScriptTag({content:bundle});
  await page.evaluate(async()=>{window.store=new DurableModule.DurableWorkStore('quota',undefined,'fullhouse-lab-quota');await store.persist(store.prefix+'keeper','previous');});
  // Restart releases earlier quota reservations, while retaining confirmed disk data.
  await context.close();context=await open();page=await context.newPage();await page.goto(origin);await page.addScriptTag({content:bundle});
  const cdp=await context.newCDPSession(page);await cdp.send('Storage.overrideQuotaForOrigin',{origin,quotaSize:1024});assert.equal((await cdp.send('Storage.getUsageAndQuota',{origin})).overrideActive,true);
  const result=await page.evaluate(async()=>{
   window.store=new DurableModule.DurableWorkStore('quota',undefined,'fullhouse-lab-quota');await store.ready();
   const bytes=new Uint8Array(12*1024*1024);for(let n=0;n<bytes.length;n+=65536)crypto.getRandomValues(bytes.subarray(n,n+65536));
   let error='none';try{await store.savePhoto('large',{eventId:'quota-event',date:'2030-01-07',stepId:'',baseRevision:null},new File([bytes],'synthetic-random.png',{type:'image/png'}));}catch(e){error=e.name;}
   return {error,keeper:store.getItem(store.prefix+'keeper'),photos:(await store.photos()).length};
  });
  assert.deepEqual(result,{error:'QuotaExceededError',keeper:'previous',photos:0});return result;
 }finally{await context?.close();await new Promise(resolve=>server.close(resolve));fs.rmSync(profile,{recursive:true,force:true});}
}
module.exports={quotaTest};if(require.main===module)quotaTest().then(result=>console.log(JSON.stringify(result))).catch(e=>{console.error(e);process.exitCode=1;});
