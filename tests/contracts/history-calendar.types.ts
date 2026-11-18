import {createCalendarProof,CalendarInput,Result,projectPlan} from '../../history/calendar-proof.cjs';
import {createCalendarProofPort} from '../../history/calendar-proof-port.cjs';
void createCalendarProofPort(()=>new Worker('/calendar-proof-worker.js')).prove('job',{});
declare const schedule:Record<string,unknown>,plan:import('../../history/storage-model.cjs').StoragePlan;
const input:CalendarInput=projectPlan(plan,{from:'2030-01-01',budgets:{states:300000}});
const engine=createCalendarProof(schedule);
void engine.prove(input,{signal:new AbortController().signal});
declare const result:Result;
// @ts-expect-error El certificado es inmutable.
result.certificate.status='valid';
// @ts-expect-error El verificador no prepara ni confirma escrituras.
engine.saveEvent(input);
// @ts-expect-error No existe un horizonte silencioso.
input.horizon=8;
