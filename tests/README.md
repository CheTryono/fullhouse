# Base de regresión de Fullhouse

Estas pruebas ejecutan el JavaScript servido de la aplicación en aislamiento.
El arnés no requiere refactorizar producción ni cambiar el esquema de datos.
Todos los ejemplos son sintéticos.

## Instalación y comandos

Requiere Node.js 20 o posterior y npm. Desde la raíz del repositorio:

```sh
npm ci
npm run check
npm run test:regression
npm run test:known-bugs
npm test
```

- `npm ci` instala únicamente TypeScript 5.9.3 como dependencia de desarrollo,
  usando el lockfile y su comprobación de integridad. No hay dependencias nuevas
  de ejecución para la aplicación.
- `npm run check` comprueba TypeScript sin emitir archivos, la sintaxis del
  JavaScript servido y su correspondencia exacta con una compilación en memoria.
  Falla si la fuente y `app.js` divergen; no sobrescribe archivos para hacerlo pasar.
- `npm run test:regression` ejecuta la base que pasa actualmente.
- `npm run test:known-bugs` ejecuta contratos deseados que fallan por problemas
  existentes. Termina con código 1; no son pruebas omitidas ni fallos convertidos
  en éxitos.
- `npm test` ejecuta ambas suites y conserva el código de fallo del ejecutor.
  Actualmente debe fallar por los dos casos documentados abajo.

No es necesario iniciar un servidor ni acceder a servicios externos para ejecutar
las pruebas. Cada caso obtiene su propio contexto, almacenamiento y controlador.
No se lee ni se escribe el almacenamiento de ningún navegador real.

## Diseño y alcance

`helpers/app.cjs` carga el `app.js` real con `node:vm` y accede a las funciones y
al controlador `Planner` sin añadir exportaciones a producción. La fecha está
fijada al lunes 7 de enero de 2030 a mediodía local. El adaptador de React solo
implementa estado síncrono; no renderiza elementos ni ejecuta ciclos de vida.
El almacenamiento es un `Map`, con errores de lectura/escritura configurables.
`FileReader` entrega texto de forma asíncrona para ejercitar el método real de
importación, incluida la confirmación y cancelación.

Las pruebas comprueban resultados observables: bytes persistidos, estado
restaurado, apariciones por fecha, marcos horarios, pasos activos y registros
históricos. El control de compilación evita probar un JavaScript que haya quedado
desactualizado respecto a TypeScript. Ejecutar `npm run check` junto con las suites.

Este arnés depende de los nombres internos actuales; renombrar o modularizar las
funciones requerirá adaptar el arnés. Cuando se extraigan módulos, podrán
importarse directamente conservando los mismos casos y datos.

## Cobertura: 126 pruebas que pasan

| Área | Comportamientos comprobados |
| --- | --- |
| Persistencia | Guardado y recarga de registros, alternativas, notas y evidencia sintética; aviso y bytes previos ante error de escritura; lectura fallida; migración del almacén anterior. |
| Respaldos | Rechazo de raíces inválidas y versiones incompatibles; importación válida, cancelación, JSON roto y conservación de los datos ante rechazo. |
| Rutinas y programación | Creación con subpasos; rechazo de duración fija inválida; programación y rechazo de otra programación futura de la misma rutina. |
| Reprogramación | División pasado/futuro; traslado de registros futuros al nuevo identificador; conservación de registros y horario anteriores. |
| Dependencias | Reajuste al mover límites; rechazo de un movimiento sin intervalo; ausencia de límites y ciclos; cancelación futura conservando registros anteriores. |
| Alternativas | Selección por día con subpasos anidados; alternativas manuales obligatorias; selección limitada a una fecha; reinicio de marcas solo en la ejecución afectada. |
| Duraciones | Reparto ponderado con redondeo y suma exacta; hojas dentro de contenedores; exceso de tiempos fijos y tiempo sobrante sin contenidos flexibles. |
| Límites e historial | Rechazo de marcos fuera del día, final exacto a medianoche, ajuste inferior a 00:00; eliminación de programación conservando ejecuciones anteriores y la ejecución de hoy ya registrada. |

El ajuste a 00:00 al intentar mover una actividad antes del comienzo del día es
el comportamiento actual y produce un intervalo válido. No se clasifica aquí
como defecto confirmado. El desbordamiento al final del día sí puede ocultar la
actividad y tiene un caso fallido separado.

## BUG-02 y BUG-03 corregidos

Sus reproducciones ahora forman parte de `regression.test.cjs` y pasan. El
validador examina las entidades internas y los campos conocidos: metas e
historiales, rutinas, pasos y alternativas recursivos, eventos y excepciones,
registros, notas, fotografías y revisiones diarias. Rechaza identificadores
duplicados, tipos incorrectos, fechas/horas inválidas y cantidades no finitas o
negativas. Los árboles de pasos se recorren de forma iterativa.

Se mantienen la versión `1` y la clave `fullhouse-v01`. Los campos añadidos en
revisiones posteriores siguen siendo opcionales; los campos desconocidos se
conservan. No se exige que referencias históricas apunten a elementos todavía
existentes. No hay normalización, eliminación de campos ni migración de datos.

Además de las fixtures mínimas de `fixtures/backups.cjs`, se prueban nueve
exportaciones generadas por los escritores reales de las versiones 0.1–0.9.
Consulta [su procedencia y reproducción](fixtures/historical/README.md). La
comparación encontró un caso real inicialmente rechazado: horas con minutos
fraccionarios calculadas al programar desde la hora de término. Ahora se conservan
sin normalización. La cobertura es representativa, no una garantía sobre toda
combinación histórica posible; cualquier rechazo restante activa la protección.

La importación valida antes de escribir y solo actualiza el estado tras una
escritura correcta. Las pruebas comprueban igualdad del estado anterior y de los
bytes originales ante entidades malformadas y falta de espacio, además de
lectura fallida, abortada o lanzada como excepción. Los mensajes distinguen
formato incompatible, JSON ilegible y almacenamiento bloqueado/lleno. Se conserva
la referencia al selector antes de esperar confirmación, porque React 16 libera
el evento; hay casos para aceptar y cancelar con el evento ya liberado.

La fixture inicial de evidencia se ajustó para incluir `caption`, como el formato
que exporta la aplicación. No se ha cambiado el formato de datos de producción.

## Protección adicional de la carga local

`load()` distingue una instalación nueva, datos válidos y un fallo de carga. Solo
la ausencia confirmada de ambos almacenes permite ejemplos. Un valor existente,
incluso la cadena vacía, JSON roto o versión desconocida, nunca se interpreta como
una instalación nueva. Un almacén actual inválido tampoco permite recurrir al
anterior ni copiarlo sobre el actual. Un error de acceso o de copia no destructiva
del almacén anterior activa la misma protección.

El estado de recuperación conserva la clave y el texto original capturado. La
interfaz persistente ofrece descargar ese texto sin parsearlo y reintentar la
lectura; bloquea guardar, importar y restablecer. Descargar no desbloquea las
escrituras. Si el almacenamiento no se pudo leer, no se inventa un respaldo y la
descarga queda desactivada. Una lectura fallida posterior o la desaparición externa
del original no elimina la captura disponible.

Las pruebas comprueban bytes y memoria tras intentos de escritura, importación,
restablecimiento, reapertura y reintentos; la descarga reproduce el original
exacto, incluso si está malformado. Se comprueban tanto la clave actual como la
antigua, acceso bloqueado y copia antigua fallida. No existe recuperación que
reemplace deliberadamente el contenido desde esta pantalla: el original se
conserva para revisión y un reintento solo desbloquea con datos legibles y válidos.

## BUG-01 corregido: estado confirmado y copia pendiente

La reproducción original pasa ahora en `regression.test.cjs`, sin cambiar su
aserción sobre el último estado confirmado. `state.data` contiene únicamente un
estado aceptado por `localStorage`; `state.pending` es un metadato de interfaz,
fuera del esquema exportado. Guarda una cadena JSON independiente de referencias
mutables, sujeta al mismo validador de respaldos. Una escritura rechazada no
sustituye `data` ni los bytes originales y no muestra éxito ni emite el sonido de
completado. No se escriben claves nuevas ni se cambia `version: 1`.

Mientras hay pendientes, una pantalla persistente bloquea nuevas ediciones,
importaciones y restablecimientos para no reemplazar esa copia. Los reintentos
conservan la misma acción y solo confirman tras escribir correctamente. Exportar
prepara un respaldo válido con la acción pendiente y los borradores de notas y
revisión diaria aún escritos; no los confirma ni elimina. Reintentar solo confirma
la acción original: otros borradores siguen independientes. Si la información
no es serializable o válida, nunca se escribe como estado confirmado; el texto
serializable incompatible se ofrece como `.txt` para revisión, no como respaldo.

Las pruebas cubren cuota llena y rechazo por permisos, fallos repetidos, reintento
exitoso, inmutabilidad de la copia pendiente, exportación/restauración después de
recargar, rechazo de datos inválidos y descarte confirmado/cancelado. Comprueban
acciones reales: metas, rutinas, eventos, pasos, actividades, notas y subnotas,
avances, hitos, alternativas, revisión diaria y eliminación de metas. Se mantiene
la protección de PR #2 y se detiene una importación en curso si aparece un
pendiente antes de terminar la lectura.

El aviso `beforeunload` se registra y retira con el componente. También cubre
borradores sin enviar, incluyendo campos numéricos aún enfocados; la navegación
interna no los descarta. Los borradores de notas viven en el controlador para
sobrevivir a desmontajes temporales de su editor, y cerrar un editor de nota
modificada solicita confirmación. Se conserva también el borrador de programación al abrir el editor de su rutina
y volver, incluso después de un reintento fallido. Las pruebas de navegador reutilizables están
en [browser/pending-save.cjs](browser/pending-save.cjs); sus requisitos y ejecución
se explican en [browser/README.md](browser/README.md).

### Decisión y límites de esta corrección

Se eligió una copia pendiente en memoria con edición pausada. Volver atrás sin
conservar el intento perdería el trabajo; tratarlo como guardado sería engañoso;
seguir editando exigiría fusionar varias operaciones y resolver conflictos. Una
segunda base local (por ejemplo IndexedDB) ampliaría esta tarea y también podría
fallar por cuota o permisos. Por eso la exportación es la recuperación durable
cuando el almacenamiento no funciona.

No hay garantía de aviso ante cierre forzado, fallo del proceso o terminación por
el sistema operativo, especialmente en móviles. No se implementa coordinación de
escrituras entre varias pestañas. Las preferencias visuales siguen usando sus
claves independientes; esta corrección protege los datos principales guardados
por `save()`. Los borradores de formularios no enviados se protegen al salir,
pero no se convierten automáticamente en entidades del respaldo. Los datos
confirmados y las importaciones conservan el formato existente. BUG-04 y BUG-05
permanecen deliberadamente fuera de alcance.

## Dos pruebas que fallan por errores existentes

| Identificador | Contrato comprobado | Resultado actual |
| --- | --- | --- |
| BUG-04 | Un desplazamiento que excede el final del día se rechaza y mantiene visible la actividad. | Una actividad de 23:00 a 24:00 movida 15 minutos guarda 23:15; luego desaparece de `eventsOn` porque su marco es inválido. |
| BUG-05 | Editar una plantilla no cambia los pasos ni minutos interpretados de una ejecución histórica completada. | El historial usa la plantilla actual y muestra los pasos y tiempos nuevos. |

Tras corregir cada defecto en una tarea separada, mover su prueba a la suite de
regresión. No eliminar aserciones, añadir omisiones ni aceptar como correcto el
comportamiento defectuoso para obtener una suite verde.

## Limitaciones y siguientes ampliaciones

La suite de Node no comprueba DOM, estilos, cinco paletas, móvil, foco, arrastre, interacción
real con los selectores, React ni su agrupación de actualizaciones. Tampoco la
cuota real del navegador, varias pestañas concurrentes, exportación descargada,
fallos de lectura de archivos en navegadores específicos, compresión de imágenes, zonas horarias o cambios
de horario estacional. Las evidencias de la prueba son cadenas sintéticas; no se
ejercita su decodificación.

Estos flujos se pueden cubrir posteriormente con pruebas de navegador y perfiles
desechables, sin cambiar la arquitectura. El estado síncrono del adaptador no
sustituye esas pruebas. Las combinaciones de alternativas anidadas, calendarios
lejanos y eliminación en cascada de más de un nivel también merecen ampliar los
casos. Esta es una base inicial, no una afirmación de cobertura completa.

No se ha añadido ni alterado el flujo de GitHub Pages. La automatización en CI
queda para una tarea posterior; al incorporarla, separar explícitamente la base
obligatoria de las reproducciones de errores conocidos sin ocultar sus fallos.

## Resultados verificados en esta entrega

Node.js 24.22.1, npm 11.9.0 y TypeScript 5.9.3:

| Comando | Resultado |
| --- | --- |
| `npm run check` | Código 0; TypeScript y sintaxis correctos, compilación en memoria idéntica a `app.js`. |
| `npm run test:regression` | Código 0; 126 aprobadas, ninguna fallida ni omitida. |
| `npm run test:known-bugs` | Código 1; 2 fallidas por los defectos documentados, ninguna omitida. |
| `npm test` | Código 1; 128 ejecutadas, 126 aprobadas y 2 fallidas, ninguna omitida. |

También se ejecutó una comprobación puntual en Chromium con Playwright del
entorno: escritorio 1280×900 y móvil 390×844, ambos con Medianoche. Se comprobó
selección real de archivos, confirmación, rechazo de JSON roto/entidades nulas,
escritura con cuota simulada y restauración/recarga correctas, sin errores JS.
En móvil se abrió Ajustes en escritorio antes de reducir la ventana, porque la
navegación móvil actual no incluye ese acceso. Esta comprobación no implica
cobertura completa de navegación móvil ni de las cinco paletas.

Comandos de la comprobación puntual: `python3 -m http.server 5500 --bind 127.0.0.1` desde la raíz y `node /tmp/fullhouse-backup-browser.cjs`. El script fue
una comprobación temporal del entorno, no parte de la suite reutilizable del
repositorio. No se añaden dependencias de navegador al proyecto. Las
bibliotecas incluidas, la configuración TypeScript y el esquema de almacenamiento
no cambiaron; `app.js` fue recompilado desde `app.tsx`.


Protección adicional comprobada en Chromium con
`node /tmp/fullhouse-recovery-browser.cjs`: escritorio de 1280 px y móvil de 390 px
con Aurora, Océano, Atardecer, Bosque y Medianoche (10 combinaciones). Se verificó
la advertencia persistente, ausencia de ejemplos/tutorial, conservación frente a
reintentos, descarga exacta del original y recuperación al volver a leer una
exportación histórica válida con minutos fraccionarios. No hubo errores JS.
El script de navegador fue una verificación temporal del entorno.


BUG-01 comprobado con la nueva prueba de navegador mantenida en el repositorio:

```sh
NODE_PATH=/workspace/.fullhouse-tools/node_modules node tests/browser/pending-save.cjs
```

Resultado: cuatro combinaciones aprobadas (1280/390 px × cuota/permisos), con
Medianoche. Se verificaron guardado pendiente de meta/paso/nota/revisión,
exportación, reintentos, avisos al recargar/navegar/cerrar, borradores numéricos y
cancelación de descartes, sin errores JavaScript. Son perfiles desechables con
datos sintéticos; no se probaron dispositivos móviles físicos.
