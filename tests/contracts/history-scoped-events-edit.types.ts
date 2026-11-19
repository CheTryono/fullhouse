import type {IncrementalAccess,VerifiedWindow} from '../../history/storage-incremental.cjs';
import type {EventDraftEdit,EventEditContext} from '../../history/storage-events-edit.cjs';
declare const access:IncrementalAccess, token:VerifiedWindow, draft:EventDraftEdit, context:EventEditContext;
void access.reserveEventEdit(token,draft.id,context.operationId).then(reservation=>access.prepareEventEdit(token,reservation,draft,context));
void access.reserveEvent(token,'create').then(reservation=>{
 // @ts-expect-error Creation and edit capabilities have different brands.
 void access.prepareEventEdit(token,reservation,draft,context);
});
