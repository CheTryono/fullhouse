# BUG-05 · B.3b.1: creación incremental de eventos (experimental)

Base `13ee9d1b1da0c336c8f190d4cf50ec266da6ac50`, PR #16.
Rama `feature/history-scoped-events-create-v2`. No cambia Planner, v1 ni workflow.

## Checkpoint A · contrato y creación básica

Puertos reserveEvent/readEvent/prepareEvent/commitEvent y sesión createEvent, con
confirmado/candidato/borradores separados. Solo laboratorio fullhouse-lab-*.
La creación puntual, ocasión, día completo sin rutina, meta y ancla de término
se comprueban con los métodos reales; rutinas/recurrencias pendientes de B.

Los IDs son opacos, distintos para evento y serie, y derivados de recibo padre +
ID explícito de operación. No se usa reloj ni aleatoriedad en el reintento.
Se comprueban entidades actuales e identidades conservadas en capturas/legado,
además del namespace review-*. Una reserva pertenece a la conexión y base exactas.
No persiste nada por reservar: el ID solo se confirma con la fila y su recibo.

No se acepta un ID aportado para editar ni una serie/revisión histórica del formulario.
La nueva serie existe antes de su primera captura. Un nuevo commit usa otro recibo
padre, impidiendo reemitir el ID de un evento eliminado dentro de esa cadena.
Los IDs de una fuente antigua eliminada sin registro no pueden reconstruirse;
restaurar exige destino/autoridad nuevos, no un rollback transparente de la cadena.

La normalización reutiliza saveEvent real con draft.id vacío y uid reservado.
Desactiva **solo en el controlador descartable** la previsualización de ocho filas:
ningún prefijo certifica. Un puerto opcional de frames memoizados conserva la selección
real por orden y evita expandir recursivamente subgrafos. El candidato completo del
componente se valida antes de sellar el delta. App pública y extractor por defecto
mantienen su comportamiento. overlapMode move con movimientos queda bloqueado.

El delta contiene una fila events nueva y anexa header.eventIds, conserva todos los
hashes históricos y fotografías existentes. Raíz O(N) de descriptores, sin reconstruir
logs ni base64. Autoridad/cabeza/recibo se confirman juntos mediante el protocolo actual.
La recuperación reemite la reserva desde la misma base y reconstruye el comando;
un candidato obsoleto no se rebasea ni se reemplaza automáticamente.

Verificaciones de A: 6 pruebas Node aprobadas (paridad, forma, duración, solapamientos,
identidades y no hidratación); tipos correctos. Chromium 1280/390: creación, aborto
transaccional, recuperación, acuse perdido/reintento, orden e historial intactos,
sin errores JS. B y C todavía no se declaran completos.
