import type {IncrementalAccess,VerifiedWindow} from '../../history/storage-incremental.cjs';
import {createEventsSession} from '../../history/events-session.cjs';
declare const access:IncrementalAccess,token:VerifiedWindow,payload:import('../../history/storage-events.cjs').EventDraftCreate;
const ctx={operationId:'create',today:'2030-01-07',at:'2030-01-07T12:00:00Z'};
void access.reserveEvent(token,'create').then(r=>access.prepareEvent(token,r,payload,ctx));
const session=createEventsSession(access);void session.save('createEvent',payload,ctx);
// @ts-expect-error B.3b.1 no permite editar eventos.
session.save('saveEvent',payload,ctx);
// @ts-expect-error La reserva tiene identidad opaca.
access.prepareEvent(token,{eventId:'invented'},payload,ctx);
