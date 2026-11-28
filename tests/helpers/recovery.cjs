'use strict';
const r=require('../../scripts/remote-staging-recovery.cjs'),id=require('../../scripts/remote-staging-build-identity.cjs'),fixture=require('./gcloud-closed.cjs');
function snapshot(){
 const readback=fixture.readback({releaseHash:'7'.repeat(64)}),fn=readback.fn,previousBuild=readback.build,audit=fixture.audit();
 fn.state='FAILED';fn.createTime='2026-11-27T10:00:00Z';fn.updateTime='2026-11-27T12:00:00.123456Z';fn.labels['firebase-functions-codebase']='remote-staging-v1';fn.buildConfig.build=`projects/${id.PROJECT}/locations/${id.REGION}/builds/${r.PREVIOUS_BUILD}`;fn.buildConfig.environmentVariables={GOOGLE_NODE_RUN_SCRIPTS:''};
 previousBuild.name=fn.buildConfig.build;previousBuild.id=r.PREVIOUS_BUILD;previousBuild.projectId=id.PROJECT;
 audit.function={name:id.FUNCTION,runtime:'nodejs22',runtimeServiceAccount:id.RUNTIME,buildServiceAccount:id.BUILD_RESOURCE};audit.observations=[{name:'function',status:'observed'}];audit.recoveryPermissions=[...r.REQUIRED];
 return {audit,fn,previousBuild,run:{resource:r.RUN,http:404,rpcStatus:'NOT_FOUND'},operations:[{name:'previous-operation',done:true,metadata:{target:id.FUNCTION}}]};
}
module.exports={snapshot};
