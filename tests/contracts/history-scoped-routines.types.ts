import type {IncrementalAccess,VerifiedWindow} from '../../history/storage-incremental.cjs';
import {createRoutinesSession} from '../../history/routines-session.cjs';
declare const access:IncrementalAccess,token:VerifiedWindow;
void access.readRoutine(token,'r',{limit:50});
const session=createRoutinesSession(access),ctx={operationId:'delete',today:'2030-01-07',at:'2030-01-07T12:00:00Z',ids:[],confirm:true};
void session.save('deleteRoutine',{id:'r'},ctx);
// @ts-expect-error B.3 no pertenece al puerto B.2.
session.save('saveEvent',{},ctx);
// @ts-expect-error La ventana debe estar verificada.
access.readRoutine({generation:1,rootHash:'invented'},'r');
