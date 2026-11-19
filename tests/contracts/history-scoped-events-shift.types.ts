import type {IncrementalAccess,VerifiedWindow} from '../../history/storage-incremental.cjs';
import type {EventShiftRequest,EventShiftContext} from '../../history/storage-events-shift.cjs';
declare const access:IncrementalAccess, token:VerifiedWindow, request:EventShiftRequest, context:EventShiftContext;
void access.reserveEventShift(token,request,context).then(reservation=>access.prepareEventShift(token,reservation));
void access.reserveEvent(token,'create').then(reservation=>{
 // @ts-expect-error Creation cannot authorize a shift.
 void access.prepareEventShift(token,reservation);
});
void access.reserveEventEdit(token,'e','edit').then(reservation=>{
 // @ts-expect-error Edit cannot authorize a shift.
 void access.prepareEventShift(token,reservation);
});
