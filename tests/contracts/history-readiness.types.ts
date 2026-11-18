import type {IncrementalAccess,VerifiedWindow} from '../../history/storage-incremental.cjs';
import {inspectRecovery} from '../../history/recovery-binary.cjs';
import {photoRemovalReport} from '../../history/photo-privacy.cjs';
import {createWorkerPort} from '../../history/worker-port.cjs';
declare const access:IncrementalAccess,window:VerifiedWindow;
access.page(window,{limit:50});
// @ts-expect-error La capacidad no puede fabricarse con la generación.
access.page({generation:1,rootHash:'invented'},{limit:50});
// @ts-expect-error No aceptar un candidato no preparado.
access.commitExecution({id:'invented'});
void inspectRecovery;void photoRemovalReport;void createWorkerPort;
