import type {IncrementalAccess,VerifiedWindow} from '../../history/storage-incremental.cjs';
import {createGoalsSession} from '../../history/goals-session.cjs';
declare const access:IncrementalAccess,token:VerifiedWindow;
const session=createGoalsSession(access),ctx={operationId:'op',today:'2030-01-07',at:'2030-01-07T12:00:00Z',ids:[]};
void access.preparePlanning(token,'toggleMilestone',{goalId:'g',milestoneId:'m'},ctx);
void session.save('saveDayReview',{}, {...ctx,state:{reviewDraft:'Synthetic'}});
// @ts-expect-error B.2/B.3 quedan fuera del puerto B.1.
access.preparePlanning(token,'saveRoutine',{},ctx);
// @ts-expect-error No fabricar un token confirmado.
access.readGoal({generation:1,rootHash:'invented'},'g');
// @ts-expect-error Reservar instante explícito.
session.save('saveProgress',{}, {operationId:'op',today:'2030-01-07',ids:[]});
