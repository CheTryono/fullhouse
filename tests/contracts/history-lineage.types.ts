import {createLineageDatabase,CAPS,verifyAuthority} from '../../history/storage-lineage.cjs';
const db=createLineageDatabase({factory:indexedDB,name:'fullhouse-lab-types',legacy:()=>true,readSources:()=>({main:null,alias:null}),writerCapabilities:CAPS});
void db.auditLineage();void db.sourceRecovery();void verifyAuthority;
// @ts-expect-error No default port reading public storage.
createLineageDatabase({factory:indexedDB,name:'fullhouse-lab-types',legacy:()=>true});
// @ts-expect-error No public database names.
createLineageDatabase({factory:indexedDB,name:'fullhouse-v02',legacy:()=>true,readSources:()=>({main:null,alias:null})});
