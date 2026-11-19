# Punto de reanudación · BUG-05 B.3c.1 (PAUSADO)

Cierre solicitado por el propietario para cambiar temporalmente prioridades.
No iniciar desarrollo, más pruebas, B.3c.2/B.4/4C ni preparar activación automáticamente.
Esta rama no contiene trabajo comercial; se comenzará en otra cuando se solicite.

## Estado Git conservado

- Rama: `feature/history-scoped-events-shift-v2`.
- Base y main remoto comprobado: `721ce2dc9597a25b20dff45327f32fbde174061b`.
- A publicado: `2650dc0`, contrato/reserva/shift individual/recovery básico.
- B publicado: `88d17dd`, componente completo, dependencias e historial bloqueado.
- C publicado: `0b64885`, transacciones/fallos y corpus de capacidad.
- El commit cuyo mensaje empieza `chore(history): pause B.3c.1` conserva el cierre,
  los diez archivos locales pendientes y los resultados de las ejecuciones terminadas.
  Consultar `git log` para su SHA exacto; no hay que reconstruir estos archivos.
- No había archivos sin seguimiento antes de cerrar. Los nuevos manifiestos/este
  punto de reanudación son documentación sintética, sin perfiles, blobs ni temporales.

## Implementado y verificado

Puerto `storage-events-shift.cjs`, reservas privadas en incremental, API tipada y
sesión experimental. Cambia exclusivamente override.time del evento/fecha, sin
segmentos nuevos. Conserva clamp inferior, end-anchor, límite 24:00 y solapamientos.
Demuestra el componente completo ese día antes/después y la invariancia estructural
de otras fechas. Reajusta between por lectura, no por escrituras a terceros.

Capturas actuales/futuras, legado y dependencias registradas ese día bloquean.
No mueve notas, marcas, revisiones ni fotos. CommandHash distingue comandos distintos
con la misma raíz por clamp. CAS/linaje/fuentes, TX, recibos, pendientes y replay.

## Pruebas que realmente terminaron

- `npm run check`: exit 0, TypeScript y app.js coinciden, sin escribir archivos.
- `npm run check:history-contract`: exit 0.
- `npm run test:regression`: 164 aprobadas.
- `npm run test:history-contract`: 321 aprobadas, seis TODO, cero fallos.
- `npm test`: 485 aprobadas, seis TODO, un fallo público conocido BUG-05 (exit 1).
- 30 pruebas nuevas de shift (25 grupos funcionales + cinco zonas), incluidas arriba.
- 25 suites Chromium terminaron exit 0; inventario exacto en verification.json.
- Último driver faults repetido con rutina **límite** concurrente real: exit 0.
  Se corrigió solo su fixture que había heredado una revisión incompatible al copiar
  el evento para otro límite. No se cambió el motor ni se ocultó ese fallo del driver.
- Corpus separado: 5000 ejecuciones, 501 revisiones, 65 fotos, 42.175.847 bytes.
  Una fila cambiada, raíces iguales al comparador físico completo, hashes históricos
  y bytes restaurados de todas las fotos iguales. Preparación 19,9–23,8 ms, sin
  confundirla con latencia total. Medición no repetida al cerrar la pausa.
- No quedan procesos Node de pruebas activos ni resultados en curso.

Artefactos guardados: `docs/measurements/history-scoped-events-shift.*.json`.
Fuentes medidas por SHA, tiempos separados y límites de memoria en capacity.json.
No se guardan perfiles de navegador ni fotografías en Git. Firefox/WebKit no
estaban disponibles; no se probaron teléfonos físicos. Viewport móvil ≠ teléfono.

## Limitaciones y trabajo pendiente al retomar

No quedan suites iniciadas por finalizar. Falta revisión técnica final de la entrega
y decidir si se prepara una PR; la pausa no equivale a aprobar/activar la funcionalidad.

Persisten bloqueos de serie desconocida/ambigua, fecha pasada/normalizada,
allDay/between directo, rutina principal con variante real __base, calendarios
inválidos/indeterminados y presupuestos agotados. No hay política para desplazar
capturas congeladas. Sin movimientos físicos de terceros, eliminación ni adopción
incremental. Paquetes grandes/apertura todavía son globales; no se demuestra una
reducción de memoria ni rendimiento en teléfonos. No hay exclusión perfecta entre
localStorage e IndexedDB ni barrera completa para todos los escritores antiguos.
Privacidad/borrado físico y paridad React siguen pendientes. BUG-05 público sigue abierto.

Para retomar: recuperar esta rama y este commit, revisar status/diff respecto de
main (que puede haber avanzado comercialmente), leer SCOPED_EVENTS_SHIFT y sus
manifiestos. Las suites ya terminadas siguen como evidencia de estas fuentes;
repetir únicamente las afectadas si después cambia el código. Cualquier nueva
implementación, fusión o activación requiere el encargo posterior del propietario.

## Aislamiento comprobado

`app.tsx`, `app.js` y `.github/workflows/` sin diferencias respecto de la base.
Planner sigue usando esquema version:1 / fullhouse-v01. Laboratorio excluido por
la lista de recursos de Pages. No se modificó main, no se hizo merge/despliegue,
no se migraron datos personales y no se inició almacenamiento público v2.
