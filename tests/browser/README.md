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

## Integración y guardado simulados · fase 4A

```sh
NODE_PATH=/workspace/.fullhouse-tools/node_modules node tests/browser/history-integration.cjs
```

El mismo servidor ofrece `/integration`; el bundle incluye controlador descartable
con métodos de planificación reales extraídos por AST, motor, lector, codec y
repositorio. Solo se inyecta un Map y una cola compartida. Storage se intercepta
como error: se exige cero llamadas, incluyendo preferencias. No se monta Planner.

En Chromium 1280/390 px, Medianoche: nota/primer registro, escritura/readback fallidos,
cuota, aviso beforeunload cancelando recarga con pendientes, reintento sin duplicar
fotos, dos clientes, cliente antiguo v1, interrupción
antes/después de manifiesto y recuperación explícita, importación inválida, descarga
y restauración de fotos en destino simulado vacío, completado/edición/reapertura/
continuidad, reprogramación/dependencias, legado bloqueado y alternativas auditadas.
Son 28 casos (14 por tamaño). No hay errores JS/consola ni desbordamiento horizontal.
El test del lector conserva aparte sus 120 combinaciones con cinco paletas.

Los botones de fallo/restablecimiento afectan únicamente al Map sintético. No se
publican, no reemplazan guardado v1 ni prueban un adapter nativo aún no implementado.
Los paquetes de recuperación contienen borradores y ramas separadas; no se presentan
como un respaldo ordinario ni se restauran ciegamente sobre claves existentes.


## Laboratorio de almacenamiento · fase 4B.1

Prototipo IndexedDB aislado, no disponible en Planner. Iniciar con
`node scripts/serve-history-lab.cjs` y abrir `/storage` en el puerto indicado.
Solo fuentes sintéticas, selección/confirmación explícitas y bases `fullhouse-lab-*`.
No abrir en el origen público ni cargar información personal.

```sh
NODE_PATH=/workspace/.fullhouse-tools/node_modules node tests/browser/history-storage.cjs
```

65 casos Chromium con IndexedDB real, escritorio/móvil; cuota nativa, interrupción,
crash de proceso descartable, concurrencia, archivo completo y nueve respaldos antiguos.
Playwright externo y Chromium son requisitos de desarrollo; sin dependencias nuevas.
9 pruebas Node nuevas en `tests/history-contract.storage.test.cjs`, incluidas por
`npm run test:history-contract`; cinco TODO de integración pública permanecen.
La reproducción pública BUG-05 debe seguir fallando hasta integrar las pantallas.
[Decisión, medidas e inventario pendiente](../../docs/HISTORY_V2_STORAGE_DECISION.md).


## Compatibilidad experimental del legado · 4B.2

`node scripts/serve-history-lab.cjs`: abrir `/compat` en el origen loopback indicado.
Crear una base sintética; permite notas, marcas, adopción explícita, fotografías,
formularios y fallos/reintentos. No cargar datos personales ni usar origen público.
La retirada de fotos es reversible y conserva bytes; el borrado físico NO está aprobado.

```sh
NODE_PATH=/workspace/.fullhouse-tools/node_modules node tests/browser/history-legacy.cjs
```

Pruebas Node incluidas en `npm run test:history-contract`, con contratos de tipos.
Pruebas Chromium adicionales requieren Playwright externo y Chromium; usan IndexedDB
real, cinco paletas, 1280/390 px, entradas de archivo y diálogos. Verifican acciones
DOM, pendientes/recarga, destino asíncrono, conflictos, exportación/restauración y
adopción sin transferir marcas antiguas. No equivalen a probar cada control React
público, un teléfono físico o toda la accesibilidad.
[Contrato, inventario y decisiones abiertas](../../docs/HISTORY_V2_LEGACY_COMPAT.md).


## Preparación técnica histórica · 4B.3

`node scripts/serve-history-lab.cjs`: abrir `/readiness` en su origen loopback.
Exclusivamente datos sintéticos/bases `fullhouse-lab-*`; no publicar ni abrir en
el origen de usuarios. El laboratorio distingue confirmado, pendiente, respaldo
completo, recuperación y diagnóstico sin validar. No modifica Planner.

```sh
PLAYWRIGHT_BROWSERS_PATH=/tmp/fullhouse-readiness-browsers NODE_PATH=/workspace/.fullhouse-tools/node_modules node tests/browser/history-readiness.cjs
NODE_PATH=/workspace/.fullhouse-tools/node_modules node tests/browser/history-readiness-ui.cjs
NODE_PATH=/workspace/.fullhouse-tools/node_modules node tests/browser/history-photo-capacity.cjs
```

Requieren Playwright externo/Chromium, sin dependencias nuevas. El benchmark necesita
el objeto Git `35ca45c` para comparar implementación anterior y actual sobre iguales
hechos/bytes; no modifica el checkout ni escribe fixtures grandes. Chromium es
obligatorio; Firefox/WebKit opcionales se reportan ausentes si no pueden arrancar.
En este entorno su instalación en /tmp fue rechazada con 403 Domain forbidden.
No interpretar un viewport móvil como Android/iPhone.

`FULLHOUSE_READINESS_SMALL=1` omite solo el corpus grande para depurar protocolo;
la medición entregada usa el comando completo. Las suites anteriores siguen siendo
obligatorias para esta etapa. [Informe, resultados y bloqueos de 4C](../../docs/HISTORY_V2_READINESS.md).


## Autoridad persistente experimental · 4B.3b, hito A

```sh
NODE_PATH=/workspace/.fullhouse-tools/node_modules node tests/browser/history-lineage.cjs
NODE_PATH=/workspace/.fullhouse-tools/node_modules node tests/browser/history-lineage-performance.cjs
```

`node scripts/serve-history-lab.cjs`: `/lineage`, solo origen loopback y datos
sintéticos. No se publica en Pages. Puerto readSources obligatorio; prueba entre
pestañas con claves reservadas de laboratorio. IndexedDB física 2 distinta del
factory anterior; una base vieja sin autoridad queda en recuperación, no se infiere
linaje. El ensayo de cuota usa un perfil persistente desechable; un viewport de
390 px no acredita Android/iPhone. Firefox/WebKit no están instalados.

101 grupos Chromium: matriz de fuentes, cierre/reapertura, conflictos persistentes,
dos pestañas, barreras físicas/capacidades, abortos/cuota real, acuse perdido,
operaciones obsoletas, restauración/fotos y UI. Node añade cuatro contratos reales;
los seis TODO y BUG-05 público permanecen. El benchmark no mide las operaciones B
que siguen pendientes. [Contrato, límites y resultados](../../docs/HISTORY_V2_LINEAGE_SCOPED.md).


## Metas incrementales · 4B.3b B.1

```sh
NODE_PATH=/workspace/.fullhouse-tools/node_modules node tests/browser/history-scoped-goals.cjs
NODE_PATH=/workspace/.fullhouse-tools/node_modules node tests/browser/history-scoped-goals-faults.cjs
NODE_PATH=/workspace/.fullhouse-tools/node_modules node tests/browser/history-scoped-goals-performance.cjs
NODE_PATH=/workspace/.fullhouse-tools/node_modules node tests/browser/history-goals-lineage-stress.cjs
```

Solo orígenes loopback, bases fullhouse-lab-* y datos sintéticos. El benchmark grande
y las suites grandes de almacenamiento deben ejecutarse secuencialmente para evitar
competencia entre corpus y presión de memoria. No se añaden dependencias al proyecto.
Las nueve pruebas Node nuevas se incluyen en test:history-contract; tipos incluidos
en check:history-contract. Los seis TODO y BUG-05 público se mantienen.

Paridad pequeña con la sesión anterior: 12 operaciones por viewport 1280/390, legado,
adopción, dos pestañas reales, corrupción, fuentes y respaldo completo. Fallos:
cuota real antes de abrir DB en perfil desechable, lectura posterior inyectada,
reintento y cierre durante TX de meta/review. El viewport de 390 px no es un teléfono.

El corpus grande conserva 5.000 capturas completadas, 501 versiones y 42,2 MB de fotos.
La sesión anterior rechaza ese corpus por complejidad: el benchmark separa ese rechazo
del comparador de validación física completa, cuya igualdad de raíz sí comprueba.
No confundir heap informado con memoria total ni atribuir reducciones no demostradas.
El estrés de linaje usa fuentes de 8,4 MB UTF-16 y 500 ediciones antes de crear una
meta con revisión; no afirma que ambas fuentes quepan en localStorage real.

[Arquitectura, resultados y límites](../../docs/HISTORY_V2_SCOPED_GOALS.md).


## Rutinas incrementales · B.2

```sh
NODE_PATH=/workspace/.fullhouse-tools/node_modules node tests/browser/history-scoped-routines.cjs
NODE_PATH=/workspace/.fullhouse-tools/node_modules node tests/browser/history-scoped-routines-faults.cjs
NODE_PATH=/workspace/.fullhouse-tools/node_modules node tests/browser/history-scoped-routines-performance.cjs
```

Solo laboratorios fullhouse-lab-* y datos sintéticos; no publicar. Ejecutar benchmarks
y suites grandes secuencialmente. FULLHOUSE_ROUTINES_STAGE=edit comprueba únicamente
el checkpoint de creación/edición; no sustituye la suite completa predeterminada.
Las doce pruebas Node nuevas se incluyen en test:history-contract; se mantienen seis
TODO y el fallo conocido público BUG-05. Los logs conservados de la tarea interrumpida
terminaron completos y siguieron siendo válidos: no se volvieron a medir sin necesidad.

La demostración usa segmentos/clases semanales o enumeración finita; bloquea otras
recurrencias indefinidas y presupuestos excedidos. Compara hechos con métodos reales,
preserva hashes históricos por clave y verifica fotos al restaurar. No presenta el
rechazo por complejidad de la sesión anterior como latencia de una escritura válida.
No se probaron Firefox/WebKit ni dispositivos físicos; viewport estrecho es Chromium.
[Contrato, resultados y limitaciones](../../docs/HISTORY_V2_SCOPED_ROUTINES.md).


## Motor puro de calendario · B.3a

```sh
NODE_PATH=/workspace/.fullhouse-tools/node_modules node tests/browser/history-calendar-proof.cjs
```

Servidor efímero loopback, perfiles desechables y planificación sintética. No cambia
ninguna base de datos. La prueba principal prohíbe Storage e IndexedDB desde la ventana.
Compara certificados directos/Worker para diario y mensual; comprueba respuesta del
hilo principal, cancelación, reuso, replay, overflow e indeterminado por presupuesto.
Ensaya 1280/390 px UTC y rangos finitos de tres zonas locales, incluido el salto de fecha
de Samoa. No se usó un teléfono físico ni Firefox/WebKit.

Una muestra por viewport, motor/Worker calentados antes de medir; exporta máquina,
versión del navegador y hashes de implementación. La memoria es heap retenido de ventana,
no pico/Worker/memoria total. No es una comparación de capacidad ni de fotografías.
El mensual puede tardar segundos: usar Worker/cancelación, no autorizar un prefijo.
El puerto rechaza antes de enviar entradas que no sean snapshots JSON acotados.
No se modifican controles React ni se publica el laboratorio en Pages.

[Resultados medidos](../../docs/measurements/history-calendar-proof.chromium.json) ·
[Demostraciones, límites y compatibilidad B.2](../../docs/HISTORY_V2_CALENDAR_PROOF.md).


## Seguridad de alternativas y cobertura semanal local · B.3a.1

```sh
NODE_PATH=/workspace/.fullhouse-tools/node_modules node tests/browser/history-alternative-safety.cjs
NODE_PATH=/workspace/.fullhouse-tools/node_modules node tests/browser/history-calendar-local.cjs
FULLHOUSE_ROUTINES_ALTERNATIVE_SAFETY=1 NODE_PATH=/workspace/.fullhouse-tools/node_modules node tests/browser/history-scoped-routines-performance.cjs
```

Primera suite: rechazo antes de TX, controles/recibos intactos, borradores, recuperación
binaria, aborto, acuse perdido, dos pestañas y cambio de zona por CDP. Recuperar exige
una preparación local nueva antes de confirmar. Compara hashes por clave y fotos.

Segunda: cuatro zonas reales de Chromium (Mexico City, New York, Madrid, Apia), estados
semanales completos y rangos finitos frente a helpers reales, igualdad con Worker,
indefinido general indeterminado y bloqueo de captura normalizada. Cero Storage público.
390 px es viewport adaptable, no Android/iOS físico. No Firefox/WebKit.

El modo opcional de capacidad conserva el corpus 5000/501/42175847 bytes y añade una
variante real __base sobre un paso fijo. Compara raíz con reconstrucción física completa;
la sesión completa anterior rechaza el corpus por complejidad. Lectura cero bytes de
fotos y recibos cero imágenes nuevas; archivo completo restaurable. Una muestra, sin
SLO físico móvil, pico de memoria ni atribución de mejora al cambio de centinela.

[Garantías y restricciones](../../docs/HISTORY_V2_CALENDAR_HARDENING.md).


## Creación incremental de eventos · B.3b.1

```sh
NODE_PATH=/workspace/.fullhouse-tools/node_modules node tests/browser/history-scoped-events-create.cjs
NODE_PATH=/workspace/.fullhouse-tools/node_modules node tests/browser/history-scoped-events-calendar.cjs
NODE_PATH=/workspace/.fullhouse-tools/node_modules node tests/browser/history-scoped-events-faults.cjs
NODE_PATH=/workspace/.fullhouse-tools/node_modules node tests/browser/history-scoped-events-performance.cjs
```

Origen loopback y bases fullhouse-lab-*. Storage público prohibido desde los tests;
fuentes v1 inyectadas. `faults` usa un perfil temporal propio, presión binaria y cuota
CDP configurada antes del primer acceso al origen: una modificación posterior puede
no invalidar reservas de cuota ya concedidas. Sus bytes solo son sintéticos.

- `create`: 1280/390 px, aborto, paquete pendiente, acuse perdido y reintento estable.
- `calendar`: UTC y cuatro zonas locales; colisión preview, between, recurrencias
  finitas y bloqueo de indefinidos no demostrados. No usa un certificado UTC localmente.
- `faults`: cuota real, lectura tras commit, cierre dentro de TX, dos pestañas,
  formulario reservado antes de await, corrupción, fuentes v1 y cambio de zona por CDP.
  Si cambia tras escribir, inspecciona el recibo: no asume ausencia de commit.
- `performance`: mismo corpus 5000/501/42175847 bytes de B.2, creación puntual/ocasión/
  diaria con rutina, comparación de raíces, hashes por clave, archivo y recuperación
  binaria grandes, restauración de todos los blobs y heap de una ventana separada.
  La sesión anterior puede rechazar por complejidad: se informa como rechazo.

Las filas físicas se ordenan por clave; el orden funcional de inserción se consulta
mediante header.eventIds. Los tests no suponen que la última fila física es el nuevo ID.
No hay pruebas en teléfonos físicos ni Firefox/WebKit. Una muestra no es un SLO.
[Contrato y resultados](../../docs/HISTORY_V2_SCOPED_EVENTS_CREATE.md).


## Edición y segmentación experimental · B.3b.2

```sh
NODE_PATH=/workspace/.fullhouse-tools/node_modules node tests/browser/history-scoped-events-edit.cjs
NODE_PATH=/workspace/.fullhouse-tools/node_modules node tests/browser/history-scoped-events-edit-calendar.cjs
NODE_PATH=/workspace/.fullhouse-tools/node_modules node tests/browser/history-scoped-events-edit-faults.cjs
NODE_PATH=/workspace/.fullhouse-tools/node_modules node tests/browser/history-scoped-events-edit-performance.cjs
```

- edit: 1280/390 px, metadatos, marca de capacidad distinta de creación, aborto,
  recuperación y acuse perdido/reintento, identidad e historial conservados.
- calendar: UTC + México/Nueva York/Madrid/Apia; corte con captura futura congelada,
  timeline sin segunda pendiente, rechazo de segunda captura y archive portable.
  Mensual/anual/every finitos y bloqueo de indefinidos locales no demostrados.
- faults: cuota real configurada antes de usar el origen y presión binaria sintética,
  lectura fallida, dos páginas, rechazo de replay obsoleto, aborto de dos filas,
  paquete recuperado, cierre en TX, fuente v1 antes/durante, corrupción de captura
  futura y cambio de zona antes/después por CDP. Perfil temporal propio.
- performance: corpus idéntico 5000/501/65/42175847 bytes. Reconstrucción física
  independiente de los tres deltas esperados frente a puerto incremental; la sesión
  completa anterior puede rechazar por complejidad y no cuenta como escritura lenta.
  Archivo/pendiente grandes, comparación por clave/hash, todos los blobs y heap de
  ventana separada. No mide RSS/pico ni demuestra reducción de memoria.

No son teléfonos físicos, Firefox ni WebKit. Storage público bloqueado en laboratorio;
puertos readSources solo devuelven copias sintéticas. Las regresiones públicas usan
otro origen loopback desechable. No se publica este laboratorio en Pages.
[Contrato, casos bloqueados y mediciones](../../docs/HISTORY_V2_SCOPED_EVENTS_EDIT.md).

## Desplazamiento de apariciones · B.3c.1

```sh
NODE_PATH=/workspace/.fullhouse-tools/node_modules node tests/browser/history-scoped-events-shift.cjs
NODE_PATH=/workspace/.fullhouse-tools/node_modules node tests/browser/history-scoped-events-shift-calendar.cjs
NODE_PATH=/workspace/.fullhouse-tools/node_modules node tests/browser/history-scoped-events-shift-faults.cjs
NODE_PATH=/workspace/.fullhouse-tools/node_modules node tests/browser/history-scoped-events-shift-performance.cjs
```

- shift: 1280/390 px, reserva específica, una fila, aborto, pendiente, recibo perdido
  y reintento. Storage público bloqueado; usa únicamente bases fullhouse-lab-*.
- calendar: UTC/México/Nueva York/Madrid/Apia, cinco eventos conectados, reajuste
  between, rechazo de cadena inválida/captura, y resto de fechas sin cambios.
- faults: cuota real CDP con asignación binaria inyectada en la TX, fallos previos/
  durante/postlectura, borradores, dos páginas, IDs distintos con igual raíz por
  clamp, replay alterado, cierre de página, rutina concurrente/corrupta, fuentes y
  zona cambiantes antes/después. No es prueba de apagado físico del equipo.
- performance: 5000 ejecuciones/501 revisiones/65 imágenes/42175847 bytes. Tres
  desplazamientos comparados con Planner real y reconstrucción física independiente;
  igualdad de raíz y hashes, restauración en base nueva con todos los bytes de fotos.
  Incluye exportación/replay grandes y heap en ventana separada. Ejecutar sin otras
  mediciones pesadas para obtener una comparación reproducible. No afirma SLO,
  reducción de memoria ni rendimiento en teléfonos reales.

[Informe](../../docs/HISTORY_V2_SCOPED_EVENTS_SHIFT.md) y datos crudos en
`docs/measurements/history-scoped-events-shift.*.json`. Ninguna de estas rutas se
publica ni se importa desde Planner. Firefox/WebKit/dispositivos físicos no probados.
