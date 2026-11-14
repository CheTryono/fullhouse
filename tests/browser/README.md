# Regresión opcional de guardados en Chromium

`pending-save.cjs` sirve los recursos reales de Fullhouse en un puerto efímero de
loopback y usa perfiles de navegador desechables. No utiliza datos personales ni
un servidor de desarrollo ya abierto. Cierra sus procesos al terminar y devuelve
un código de error si falla una aserción.

Requiere Playwright (probado con 1.56.1) y Chromium instalado. Se mantiene separado
de `npm test` para que la suite de reglas siga necesitando solo Node y TypeScript.
No se han añadido dependencias a la aplicación ni al lockfile.

En el entorno de Fullhouse publicado, Playwright ya está disponible externamente:

```sh
NODE_PATH=/workspace/.fullhouse-tools/node_modules node tests/browser/pending-save.cjs
```

Fuera de ese entorno, instala Playwright en una ubicación de desarrollo y apunta
`NODE_PATH` a su `node_modules`. Chromium se busca en `/usr/bin/chromium`; puedes
indicar otro ejecutable mediante `FULLHOUSE_CHROMIUM`. Para guardar una captura
móvil del aviso, añade `FULLHOUSE_PENDING_SCREENSHOT=/tmp/fullhouse-pending.png`.

Se ejecutan cuatro combinaciones: escritorio de 1280 px y vista móvil de 390 px,
con rechazos `QuotaExceededError` y `SecurityError`, usando Medianoche y fecha
sintética fija. Se comprueban:

- Formulario de meta, pasos, notas y revisión diaria ante escrituras fallidas.
- Original almacenado intacto, exportación del pendiente, reintento fallido y
  posterior reintento exitoso; recarga de la información confirmada.
- Avisos nativos `beforeunload` al recargar, salir del sitio y cerrar la página,
  con cancelación de la salida para conservar los cambios.
- Borrador de formulario y campo numérico todavía enfocado, navegación bloqueada
  con notas sin guardar y cancelación del descarte de una nota.
- Confirmación de descarte de pendientes y conservación al cancelarla.
- Ausencia de errores JavaScript.

Las dimensiones móviles corresponden a Chromium en modo adaptable, no a un
Android/iOS físico. El navegador puede no emitir `beforeunload` ante un cierre
forzado o cuando el sistema operativo elimina el proceso. La recuperación durable
de pendientes requiere comprobar una exportación antes de salir.


## Límites del día y desplazamientos — BUG-04

```sh
NODE_PATH=/workspace/.fullhouse-tools/node_modules node tests/browser/day-shifts.cjs
```

Usa el mismo requisito opcional de Playwright/Chromium y un servidor efímero,
con perfiles sintéticos a 1280 y 390 px, Medianoche y fecha fija. Comprueba:

- Rechazo desde el editor visible al cambiar 23:00 a 23:15 para una actividad de
  60 minutos; el formulario permanece abierto y los bytes originales intactos.
- Movimiento del controlador real, conservación del bloque y su posición en el
  horario, final exacto a 24:00 y ajuste inferior a 00:00.
- Rechazo cuando un dependiente ya no puede realizar sus pasos.
- Excepciones futuras, saltos de fecha e historial sin cambios inesperados.
- Fallo de cuota, exportación, reintento y recarga de un movimiento válido.
- Ausencia de errores JavaScript.

Limitación explícita: los botones ±15 existen en `renderTodayList` no compacto,
pero esa variante no se usa actualmente en las pantallas. No se agregan controles
en esta PR. Para ejercitar esa acción, el script envuelve `ReactDOM.render` solo
en el navegador de prueba y captura su retorno público (la instancia real).
Después verifica el almacenamiento y el DOM del horario. El editor sí se prueba
con clics y selección reales. No hay hooks nuevos en el código de producción.

## Historial v2 — laboratorio aislado de fase 3

```sh
NODE_PATH=/workspace/.fullhouse-tools/node_modules node tests/browser/history-view.cjs
```

El servidor loopback y el bundle se crean en memoria y se cierran al terminar.
No se sirve app.js ni se monta Planner; sí se ejecuta el motor/codec/lector real y
funciones puras extraídas de app.tsx (ocurrencias, intervalos, validación y pasos).
Los eventos de revisión reales generados por saveGoal se verifican además en Node.

Se comprueban 120 combinaciones: doce escenarios × cinco paletas × escritorio
1280 px y móvil 390 px. Cada combinación visita Mi día, archivo, detalle, horario,
calendario y progreso, con aserciones específicas sobre datos históricos, auditoría,
notas, fotos cargadas, estimación explícita, pendientes, duplicación y estadísticas.
También verifica ausencia de errores JS/consola y desbordamiento horizontal.
Toda llamada de Storage se intercepta como error; se exige cero intentos.

`FULLHOUSE_HISTORY_SCREENSHOTS=/tmp/fullhouse-history-view` guarda capturas
sintéticas por paleta/tamaño. Revisión manual: iniciar
`node scripts/serve-history-lab.cjs` y abrir la URL impresa. Ningún archivo ni
control del laboratorio se incluye en el workflow de Pages. No se prueban aquí
migraciones, escrituras v2 ni dispositivos móviles físicos.
