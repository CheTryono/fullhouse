# Comercial 3B.2 · recuperación durable (solo laboratorio)

Base: PR #22 / `5955fb9`. No activa almacenamiento remoto ni IndexedDB en el planificador publicado o en Staging.

## Contrato mínimo

`fullhouse-lab-work-v1` utiliza IndexedDB, separado por proyecto demo y UID. Un candidato conserva el contrato remoto y respaldo v1, la base confirmada y el ID de operación. La transacción local debe completar antes de cualquier petición remota. Un fallo mantiene el candidato en memoria y ofrece exportación; no equivale a una copia durable ni a una confirmación del servidor.

Los almacenes `journals`, `drafts` y `photos` conservan candidatos, checkpoints de formularios y originales fotográficos respectivamente. No importan `fullhouse-v01`, su alias ni datos de otras cuentas. Las copias 3B de localStorage se pueden copiar explícitamente, conservando el original y la identidad. No se purga trabajo automáticamente.

## Checkpoint inicial

Pruebas Node con `fake-indexeddb`: seis aprobadas (cierre/reapertura, aborto, reintento, aislamiento, blobs, CAS de borrador, copia explícita e incompatibilidad). Las trece regresiones previas del cliente siguen aprobadas. Esto no representa pruebas contra Firestore/Storage reales ni emulados. Integración visual, borradores y pruebas Chromium en preparación en esta rama.

La durabilidad depende del navegador: IndexedDB no protege contra borrado del sitio, expulsión por cuota, modo privado ni fallos físicos. No puede garantizar los últimos cambios antes de una transacción completada. Esta entrega no modifica los límites del contrato remoto (8 MiB por respaldo).
