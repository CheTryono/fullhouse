'use strict';
const {growth}=require('../tests/fixtures/history-growth.cjs'),{schedule}=require('../tests/helpers/history-integration.cjs');
const {footprint,exportV2}=require('../history/backups.cjs');
for(const [name,count,revisions,photos] of [['small',1,1,0],['executions',2000,1,0],['versions',2000,500,0],['compressed-images',1000,50,1]]){
  const d=growth(count,revisions,photos),start=performance.now();exportV2(d,schedule.validData);console.log(JSON.stringify({case:name,executions:count,revisions,photosPerExecution:photos,...footprint(d),validationMs:Math.round(performance.now()-start)}));
}
