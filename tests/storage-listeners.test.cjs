'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{execFile}=require('node:child_process'),{promisify}=require('node:util'),path=require('node:path');
const run=promisify(execFile),diagnostic=path.resolve(__dirname,'diagnostics/storage-listeners.cjs');
test('Storage SDK delayed loopback responses preserve bytes; warnings are bounded to completed request streams',async()=>{
 const {stdout}=await run(process.execPath,['--expose-gc',diagnostic],{maxBuffer:256*1024,timeout:30000});const r=JSON.parse(stdout);
 assert.equal(r.calls,60);assert.equal(r.dataAndCRCVerified,true);assert.equal(r.openObservedStreams,0);assert.equal(r.listenerLimitBefore,r.listenerLimitAfter);
 // A future SDK/Node fix may remove warnings. Do not require a defect to persist.
 assert(r.warnings<=2*r.rounds);assert(r.warningStreams<=r.rounds);assert(r.maxWarningCount<=11);assert(r.maxListenersOnCompletedStream<=11);
 if(r.warnings){assert.deepEqual(r.warningKinds,['close','error']);assert.equal(r.firstWarning.emitter,'PassThrough');assert.match(r.firstWarning.origin,/^teeny-request\//);}
 // GC is observed, not asserted: collection timing is not a correctness contract.
 assert.equal(r.gcExposed,true);
});
test('Storage SDK loopback control without delayed body has no data/closure regression',async()=>{
 const source=`require(${JSON.stringify(diagnostic)}).diagnose({rounds:4,delayBodyMs:0}).then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(e);process.exitCode=1;});`;
 const {stdout}=await run(process.execPath,['-e',source],{maxBuffer:128*1024,timeout:30000});const r=JSON.parse(stdout);assert.equal(r.calls,12);assert.equal(r.dataAndCRCVerified,true);assert.equal(r.openObservedStreams,0);assert.equal(r.listenerLimitBefore,r.listenerLimitAfter);
});
