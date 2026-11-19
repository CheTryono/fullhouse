# PR comercial 1 · protección mínima del historial v1

Base origin/main 721ce2d. Rama fix/commercial-v1-history-guardrails.
No usa history/* ni código de B.3c.1. Sin cambios de esquema, claves, carga,
importación ni infraestructura. app.tsx y app.js compilado permanecen sincronizados.

## Qué se protege

Planner.save comprueba los cambios de planificación antes de escribir. Cuando hay
una clave en logs (completa, parcial, nota, foto o registro vacío), su fecha puede
ser pasada, de hoy o futura: no se decide por completed ni por «ya pasó».

Una operación de planificación debe conservar las claves y todos los hechos de los
logs anteriores, el evento propietario y su identidad/contenido, su definición de
rutina, la aparición en esa fecha, su intervalo efectivo y los primeros límites
seleccionados por las dependencias. Las cadenas se comparan con las funciones reales.
También se impide eliminar metas enlazadas a eventos/pasos registrados.

No se confunde una longitud positiva con preservación: un intervalo registrado
que cambie también bloquea, aunque el nuevo horario resulte válido. Un límite nuevo
con el mismo horario no puede sustituir silenciosamente al primero anterior.

Un registro huérfano no se adjunta a un evento nuevo con el mismo ID. Si una fecha
antigua no puede interpretarse, solo se permiten cambios que mantengan idéntico su
componente potencial de planificación. Las rutinas ajenas siguen siendo editables.
No se inventan asociaciones ni fechas para corregir registros antiguos.

## Rutas públicas revisadas

| Ruta | Comportamiento |
| --- | --- |
| saveRoutine / editor de pasos, variantes y reordenación | Una plantilla utilizada se conserva; el guardado que cambie su definición se bloquea. Una plantilla sin registros afectados se edita normalmente. |
| deleteRoutine | No elimina la definición de actividades registradas ni cancela dependencias que cambien su interpretación. |
| saveEvent | Permite cambios futuros si las fechas ya registradas quedan intactas. Bloquea cortes que trasladarían logs, incluidos los futuros. |
| shiftEvent / withOverlap | Cambios de otras fechas permitidos; desplazamiento directo o indirecto de registros bloqueado. Conservar BUG-04. |
| deleteEvent / cancelFutureDependencies | Cancelación futura permitida cuando conserva todos los registros y sus dependencias; otros casos se bloquean enteros. |
| saveGoal / deleteGoal | Un cambio de revisión/evento o eliminación de referencias registradas se bloquea; el formulario permanece abierto. |
| selectVariant | La primera elección sigue disponible. Corregir una elección existente o una actividad completa pide confirmación, conserva marcas/notas/fotos y deja la actividad pendiente de revisión. |
| Notas, pasos, completar/reabrir, fotos, progreso e hitos | Correcciones explícitas existentes siguen disponibles; no se convierten en versiones inmutables. |

La elección anterior puede sustituirse por una corrección voluntaria en v1: no hay
una auditoría de versiones de elecciones. Sí se mantienen marcas de ramas inactivas,
notas y evidencias; dejan de borrarse todas las marcas al cambiar de alternativa.
Cancelar la confirmación no cambia ningún dato. Se relee el registro tras confirmar
para conservar notas/fotos añadidas mientras tanto y detectar otra elección concurrente.

Un bloqueo de planificación devuelve false, explica el motivo y no crea un pendiente
ficticio de almacenamiento. Los métodos de formularios no fuerzan el cierre en ese
caso; el borrador permanece. El fallo real de cuota/permisos conserva la protección
BUG-01: candidato exportable, confirmado anterior y reintento. La vuelta desde edición
de rutina a su programación pendiente mantiene el comportamiento previo ante cuota.

## Crear una copia independiente

Botón «Crear copia» en la tarjeta y «Continuar estos cambios en una copia» en el
editor de una rutina utilizada. En el editor utiliza el borrador actual, incluidos
sus cambios aún no guardados. Prepara un formulario, no guarda ni programa solo.

Copia instrucciones, condiciones/días, alternativas, estructura, duración, color,
flexibilidad y enlaces de metas. Renueva IDs de pasos/subpasos/variantes y reserva
un ID de rutina nuevo al guardar. Comprueba colisiones con identidades y referencias
conocidas, incluidos logs huérfanos. Si no puede reservarlos, deja intactos origen y
borrador. La copia queda sucia para que cerrar/recargar advierta de que falta guardarla.

No copia registros, marcas, elecciones, fotos ni eventos. Tampoco cancela la rutina
original. Después de guardar, se programa la copia como una rutina nueva. Se puede
cancelar la programación futura original cuando la guarda comprueba que todo lo
registrado sigue siendo consultable. Un registro futuro puede impedir esa cancelación.

Si se llegó al editor desde «editar rutina para programarla», se conservan ambos
borradores y se bloquea convertir esa ruta en una copia con reasignación automática.
Hay que volver al formulario y preparar la copia desde Rutinas. No se simula una
migración ni se cambia de rutina una programación existente a escondidas.

## Límites explícitos

Esto impide nuevas reinterpretaciones por las rutas protegidas; no congela capturas
por ejecución ni recupera plantillas que ya fueron alteradas/eliminadas antes.
Los indicadores/etiquetas de metas siguen siendo los actuales, no instantáneas de
sus valores pasados. No se ha implementado una solución completa de BUG-05.

Importar un respaldo y restablecer ejemplos siguen siendo reemplazos completos
**explícitamente confirmados**. No se aplica la guarda de edición a esos reemplazos;
se conservan validación/atomicidad/recuperación previas. Exportar un respaldo antes
de realizarlos, como ya indica la aplicación. No hay nuevas políticas de borrado.

Se mantiene localStorage, fullhouse-v01, alias y version:1. No hay cuentas ni acceso
remoto todavía. Una pestaña antigua, una escritura externa o una importación pueden
introducir datos fuera de estas guardas; la concurrencia entre dispositivos y el
servidor deberán resolverla las siguientes PR. No se afirma una prueba completa de
recurrencias indefinidas: el calendario público conserva sus límites anteriores.
El motor v2 experimental sigue aislado y B.3c.1 permanece en su rama pausada.

## Pruebas y cambios deliberados en la base

- La reproducción original tests/known-bugs.test.cjs permanece sin cambios: pasa
  porque la edición peligrosa se rechaza, no porque ahora existan capturas v2.
- El test que exigía trasladar logs futuros se reemplaza por una aserción más fuerte:
  operación bloqueada, mismos bytes, datos, claves y borrador. Otro caso comprueba
  que el corte futuro sin registros futuros sigue permitido.
- La expectativa antigua de borrar marcas al cambiar de alternativa se cambia por
  confirmación + conservación. No se elimina la prueba.
- Las pruebas BUG-01 que intentaban reemplazar plantillas utilizadas ahora usan
  cambios válidos de nota/progreso o una entidad sin uso. Conservan todas las
  aserciones de cuota, bytes previos, candidato, exportación, reintento y borradores.
- 30 casos nuevos en tests/commercial-history.cjs, incluidos desde regresión.
- npm run check y check:history-contract: salida 0.
- npm run test:regression: 194 aprobadas, cero fallos.
- npm run test:history-contract: 291 aprobadas + seis TODO, cero fallos.
- npm test: 486 aprobadas + seis TODO, cero fallos (492 casos).
- Chromium 156: interfaz real a 1280/390 px y las cinco paletas, zona México;
  bloqueo/borrador/copia/programación/foto conservada/registro futuro/teclado y cero
  errores JS. También pending-save y day-shifts, escritorio/viewport móvil.
- No se probaron Firefox, WebKit ni teléfonos físicos. Viewport móvil no es teléfono.

No bloquea comenzar la PR de cuentas. Antes de cobrar siguen siendo obligatorios
el aislamiento por usuario, guardado remoto confirmado, conflictos, respaldos y
restauración, además de la revisión comercial. Esta PR no los implementa ni los activa.
