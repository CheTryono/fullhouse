# Base de regresión de Fullhouse

## Recuperación cerrada de la función FAILED

Revisión PR33: `commercial-recovery-diagnostic.test.cjs` añade once regresiones
para runtime ausente, omisión completa de serviceConfig, múltiples bloqueos,
contradicciones, secretos no impresos, 403/paginación/estado inciertos, JSON
estructurado con salida2 y propuesta de recreación no ejecutable. Se conserva el
validador original de actualización; diagnosticar nunca rellena hechos ni emite
una huella aprobable. `--diagnose` sustituye la secuencia de parches uno por uno.

`npm run test:remote-staging:recovery`: veinticinco pruebas Node (catorce originales
y once de diagnóstico) de los controles de
inspección, consentimiento, hashes de código/metadata, IAM, doble lectura, éxito,
interrupción, acuse perdido y ausencia de reintentos/limpieza. Artefactos aislados
por archivo para no interferir con suites paralelas. APIs y ejecución simuladas.
`test:remote-staging:recovery-sdk`, con FULLHOUSE_GCLOUD_SDK_ROOT del SDK592, ejecuta
el Run y PATCH originales con clientes sintéticos/sockets bloqueados; no demuestra
recuperación real en el servidor. [Contrato y procedimiento](../docs/COMMERCIAL_FAILED_FUNCTION_RECOVERY.md).

## Primer ensayo cerrado gcloud, todavía bloqueado

`npm run test:remote-staging:gcloud`: dieciséis pruebas con metadata y ejecutor
simulados, artefactos locales, preflight, hashes, rechazo de fallback, pérdida de
acuse/lectura y ausencia de reintento. PR #30 prepara `deploymentAuthorized:true`
en el repositorio; los consentimientos independientes siguen siendo obligatorios.
Se prueban también la reversión de esa barrera a false en copia temporal y el modo
CLI que solo genera el plan, sin ejecutar procesos externos aun con ambas variables.

Corrección de arranque: `commercial-runtime-project.test.cjs` cubre identidad
Firebase inline, aliases ausentes/coherentes/contradictorios, JSON/bucket inválidos
y bloqueo de emulación/depuración. `npm run test:remote-staging:startup` exige
**Node 22** y lanza Functions Framework **5.0.5** real contra la release copiada;
no hereda aliases/ADC y bloquea conexiones salientes y clientes de datos. La suite
está fuera del glob general porque no puede ejecutarse bajo el runtime web Node24.
`check:remote-staging:gcloud-node22` la incluye y conserva la prueba HTTP callable
con JWT sintéticos, ahora sin inyectar GCLOUD_PROJECT. La regresión gcloud adicional
impide tratar una función existente FAILED como primer deploy o limpieza.
Alcance, reproducción y comandos: [arranque cerrado](../docs/COMMERCIAL_STAGING_RUNTIME_STARTUP.md).

Incluye cuatro regresiones de PR #29: Functions exige exactamente el rol actual
`roles/cloudfunctions.standardServiceAgent` sin condición. Se rechazan ausencia,
legacy por sí solo, roles amplios/parecidos, asignación a otro agente y falta de
los roles independientes Build/Run. El informe real corresponde al propietario;
estos casos usan metadata sintética, sin cambios IAM.

`npm run test:remote-staging:gcloud-sdk` requiere `FULLHOUSE_GCLOUD_SDK_ROOT`
del SDK oficial 592.0.0. Ejecuta parser/helpers originales con Run/subida
sustituidos, configuración vacía y sockets bloqueados; compara todos los bytes
del ZIP por hash y la petición generada. Sin SDK falla, no simula aprobación.
`npm run check:remote-staging:gcloud-node22`, con Node 22, prueba el artefacto
callable real por loopback con puertos JWT sintéticos: App Check obligatorio,
Auth inválida rechazada, CORS y backend UNAVAILABLE, sin clientes de datos.
No demuestra tokens reales, IAM efectivo ni aceptación del servidor.
[Ensayo, prerrequisitos y recuperación](../docs/COMMERCIAL_GCLOUD_CLOSED_DEPLOY.md).

## Ejecutor dedicado de Cloud Build, sin deploy

`npm run test:remote-staging:build`: ocho casos con el conversor y esquema reales
del CLI 15.37.0, peticiones IAM simuladas y hook con autorización abierta solo en
memoria. Demuestra que esa ruta no selecciona builder y permanece bloqueada.
Incluye rechazo de default Compute/legacy, runtime como builder, 403/404,
separación de identidades y plan no ejecutable. No representa un build real.

`npm run plan:remote-staging:build` es solo local; `--run` se rechaza. El auditor
readonly añade metadata/política/actAs de la SA propuesta y distingue default con
Editor de selección explícita. El propietario informó siete APIs ENABLED, sin
repetición de consultas reales de Codex. [Procedimiento manual y garantías](../docs/COMMERCIAL_DEDICATED_BUILD.md).

## Comercial 3C.3: IAM y deploy cerrado, sin ejecutar en Firebase real

`npm run test:remote-staging:iam`: 20 casos de políticas HTTP/puertos simulados,
precondiciones, identidad SDK explícita sin red, TX/recibos/rollback y rechazos
fuera del prefijo. No demuestra permisos IAM reales. Auditor por defecto solo plan;
`--run` de auditor es de lectura. La prueba runtime hace escrituras sintéticas y
requiere autorización separada explícita. El propietario informó su ejecución real
aprobada en `f196350`, run `c955a4a6-a4ac-4138-a415-51efb2ce3cc9`, y retiro del
binding temporal. Codex no se atribuye esa ejecución; no prueba Auth/App Check ni
IAM global. No repetir el probe para ampliar registros de diagnóstico.
`npm run prepare:remote-staging:closed` prepara un artefacto local sin cambiar gates.
[Procedimiento y límites](../docs/COMMERCIAL_IAM_CLOSED_DEPLOY.md).

La preparación siguiente añade GET de Service Usage (ENABLED/DISABLED/UNKNOWN) y
una prueba del CLI fijado que sustituye sus puertos de habilitación: gcfv2 HTTP
también prepara Eventarc/PubSub. No hay habilitación ni autorización implícita.
`tests/storage-listeners.test.cjs` añade dos regresiones con servidor loopback y
SDK Storage real, bytes/CRC y cierre; `npm run diagnose:storage-listeners` reproduce
la firma `PassThrough` con cuerpos retrasados. Usa datos/token sintéticos, rechaza
`STORAGE_EMULATOR_HOST` y no cambia límites ni suprime advertencias. Requiere
dependencias de `remote/`. GC es observación, no contrato temporal.
[Evidencia y primer deploy aún bloqueado](../docs/COMMERCIAL_CLOSED_FUNCTIONS.md).

Regresiones de la revisión de Cloud Shell: clase heredada REGIONAL regional,
getIamPolicy de SA mediante POST y códigos ErrorInfo sin exposición de mensajes.
`tests/install-contract.test.cjs` añade dos comprobaciones de engines del grafo.
Instalar raíz con Node 24.15+ (rama 24)/npm 10.9.9 y backend con Node 22 por
separado; las instalaciones limpias se verifican con `npm ci --engine-strict`.

## Comercial 3C.2: preflight y medios, desactivados

`npm run test:commercial-preflight`: 22 casos (18 política servidor con puertos
en memoria, cuatro inventario HTTP inyectado), incluidos en `npm test`. No son
pruebas Firebase reales. El propietario informó desde Cloud Shell **4/4** para
`npm run test:remote-staging:media:emulator` y **3/3** para
`npm run test:remote-staging:rules`, incluidos los intentos nuevos sobre
derechos/inventario; salida 0, sin fallos, canceladas, omitidas ni TODO en ambos.
No proporcionó SHA/Node/Java. Es evidencia posterior y distinta del 3/3 previo de
3C.1. Codex conserva su intento bloqueado por la descarga del JAR y no se atribuye
esas ejecuciones. Proyecto demo fijo, sin desplegar ni usar servicios reales.
Mediciones sintéticas y orden manual: [ensayo 3C.2](../docs/COMMERCIAL_STAGING_TRIAL.md).

## Preparación real comercial 3C.1, desactivada

`npm run test:remote-staging`: diecisiete casos con puertos de servicio simulados y
fake-indexeddb: gates, UID/proyecto, Auth/App Check simulado, cuotas, CAS, reservas,
modo de recuperación, fotografías y reintentos. No representa App Check/IAM reales.

`npm run check:remote-staging:node22`, ejecutado con Node 22 y dependencias de
`remote/` instaladas: carga el SDK Functions real y comprueba backend apagado y
rechazo HTTP de App Check ausente, sin llamadas a Firebase real.

`npm run test:remote-staging:rules`: Auth/Firestore/Storage emulados, proyecto demo;
propietario y otra cuenta verificados, sin privilegios, no pueden leer/escribir
directamente ni elevar permisos. Su descarga de Firestore está bloqueada en Codex;
no se declara aprobada. No ejecutar suites que comparten puertos simultáneamente.
[Resultados y límites](../docs/COMMERCIAL_REAL_STAGING.md).

## Recuperación comercial 3B.2, aislada

`npm test`: 534 aprobadas, cero fallos y seis TODO previos en 3B.2.
`npm run test:remote-durable`: 15 pruebas Node con fake-indexeddb y el Planner real
para candidatos, abortos, CAS, formularios/notas, días distintos, aislamiento y
recuperación explícita. Son distintas de las pruebas de navegador con IndexedDB
real y de las pruebas contra emuladores Firebase completos.

`npm run test:remote:durable:browser:simulated` utiliza Auth emulado y backend de
datos simulado, más IndexedDB real en Chromium. Prueba candidato de unos 12 MB,
PNG grande real, cierre/reapertura, recuperación explícita e aislamiento. El
ensayo de cuota usa un origen separado y perfil temporal persistente, reiniciado
antes de reducir la cuota por CDP: `node tests/browser/durable-quota.cjs`.

`npm run test:remote:durable:browser` usa los emuladores completos; requiere Java 21,
Playwright y descargas de Firebase disponibles. No ejecutar simultáneamente suites
de emuladores que comparten puertos. [Evidencia, límites y comandos](../docs/COMMERCIAL_DURABLE_WORK.md).

## Cliente remoto comercial 3B, aislado

`npm run test:remote-client`: 13 aprobadas. `npm test`: 519 aprobadas y seis TODO
previos, cero fallos. `check:remote-client` comprueba TypeScript del adaptador.
`test:remote:planner` ejecuta el Planner real con Auth/Firestore/Storage/Functions
emulados; su ejecución local queda bloqueada por la descarga del JAR de Firestore.
Las nueve pruebas 3A informadas por el propietario no son una ejecución de esta suite.

`test:remote:planner:simulated`: seis recorridos HTTP con Auth en emulador y datos
simulados, sin probar reglas/transacciones de Firestore. El equivalente Chromium
`test:remote:planner:browser:simulated` pasa en 1280/390 con Playwright disponible.
También pasan los drivers públicos pending-save, day-shifts y commercial-history.
[Comandos completos, estados y evidencia](../docs/COMMERCIAL_REMOTE_PLANNER.md).

## Backend comercial 3A aislado

`npm run check:remote` mantiene el validador de servidor idéntico al público.
`npm run test:remote` ejecuta 8 casos de contrato/servicio con puertos simulados,
incluidos los respaldos de los nueve escritores históricos. También se incluyen
en `npm test`: 506 aprobadas y seis TODO previos, sin fallos.

Para servicios reales de emulador, instalar también `npm ci --prefix remote` y
ejecutar `npm run test:remote:emulator` (Java 21). El runner fuerza proyecto demo,
loopback y elimina credenciales heredadas. Su ejecución local en Codex quedó
**bloqueada** por 403 al descargar el JAR de Firestore. El propietario informó
9/9 aprobadas de 3A en Cloud Shell; se distingue esa evidencia de la ejecución local.
Auth + Functions sí se ejecutaron: `node scripts/test-remote-emulators.cjs --auth-only`,
1 prueba HTTP aprobada. [Contrato, límites y resultados](../docs/COMMERCIAL_REMOTE_STORAGE.md).

## Regresión de la aplicación

Estas pruebas ejecutan el JavaScript servido de la aplicación en aislamiento.
El arnés no requiere refactorizar producción ni cambiar el esquema de datos.
Todos los ejemplos son sintéticos.

**Referencia del cierre de PR comercial 2:** regresión 194; autenticación 12; contratos 291 + seis TODO;
npm test 498 aprobadas + seis TODO, sin fallos. La reproducción original BUG-05
permanece intacta y pasa por rechazo de la edición insegura, sin activar v2.
Las cifras/fallos de las fases anteriores que siguen abajo son su registro histórico.
[Alcance de la mitigación](../docs/COMMERCIAL_V1_HISTORY_GUARDRAILS.md).

## Instalación y comandos

Requiere Node.js 22 o posterior y npm para las herramientas comerciales actuales. Desde la raíz del repositorio:

```sh
npm ci
npm run check
npm run test:regression
npm run test:known-bugs
npm test
```

- `npm ci` usa el lockfile: TypeScript y herramientas de staging/emuladores; el
  SDK Firebase solo se empaqueta en la entrada de staging. Pages continúa usando
  los recursos locales de React y app.js, sin SDK ni cambio de framework.
- `npm run check` comprueba TypeScript sin emitir archivos, la sintaxis del
  JavaScript servido y su correspondencia exacta con una compilación en memoria.
  Falla si la fuente y `app.js` divergen; no sobrescribe archivos para hacerlo pasar.
- `npm run test:regression` ejecuta la base que pasa actualmente.
- `npm run test:known-bugs` conserva la reproducción original de BUG-05. Con las
  guardas comerciales v1 pasa sin cambiar su aserción; no implica capturas históricas.
- `npm test` ejecuta todas las suites y conserva cualquier fallo real. Actualmente
  termina con código 0, con seis TODO todavía explícitos.

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

## Cobertura pública: 194 pruebas que pasan

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
confirmados y las importaciones conservan el formato existente. En la PR de BUG-01 no se modificaron BUG-04 ni BUG-05. La corrección de BUG-04
se documenta a continuación; BUG-05 continúa pendiente.

## BUG-04 corregido: movimientos dentro del día

La reproducción original se trasladó a regresión sin cambiar sus aserciones.
`shiftEvent` conserva el ajuste inferior a 00:00, pero rechaza un comienzo fuera
del día antes de convertirlo a texto. A continuación calcula el intervalo efectivo
completo con `eventFrame` y solo permite guardarlo si cabe en el día. Así evita
tanto un final posterior a 24:00 como el antiguo ajuste superior a 23:59 que podía
ocultar el desbordamiento pedido en actividades de un minuto. El final exacto a
24:00 sigue siendo válido y se representa como 24:00 en el acercamiento y la
previsión; los minutos fraccionarios históricos se conservan.

`dependentMovementIssue` comprueba todos los intervalos dependientes cambiados en
esa fecha, no solo los vecinos directos: detecta desapariciones, dependencias
encadenadas y repartos inválidos de pasos fijos/flexibles. La comprobación se
comparte con los desplazamientos automáticos de «Posponer bloques». Un intervalo
preexistente que no cambie no se reescribe ni se repara en esta corrección.
El formulario de actividades sin rutina ahora también rechaza un intervalo fuera
del día, usando la previsión que ya existía para las rutinas.

Las pruebas cubren: rechazo 23:00–24:00 +15; finales exactos y un minuto antes del
límite; desplazamientos positivos/negativos y ajuste inferior; duración real de
rutinas y alternativas elegidas; dependencias directas y transitivas; insuficiencia
de pasos fijos, sobrante sin contenido flexible y reparto flexible válido; ocho
patrones de repetición; excepciones, registros y horas de término conservados;
postergación automática; y cuota/permisos con exportación/reintento de BUG-01.
Los rechazos se comprueban contra los bytes originales completos, con ninguna
entrada en la cola de pendientes. Solo se modifica la excepción de la fecha
aceptada: no se cambia la recurrencia ni otras fechas o registros.

La prueba de Chromium mantenida en `browser/day-shifts.cjs` comprueba un cambio
inválido mediante el editor real, movimientos del controlador real y su resultado
en el horario renderizado, tanto a 1280 como a 390 px con Medianoche. También
comprueba dependencias, excepciones del día siguiente, historial y cola de
pendientes tras un fallo de cuota. La interfaz actual no renderiza los botones
±15: no se añadieron para esta tarea; la prueba captura la instancia mediante el
retorno público de `ReactDOM.render`, sin introducir hooks en producción.

No se introduce soporte para cruzar medianoche ni una reparación automática de
excepciones inválidas anteriores. La validación de dependencias descrita se aplica
a movimientos de una fecha (manuales y «Posponer bloques»), sin rediseñar la
reprogramación recurrente general ni el contenido histórico de BUG-05.

## Una prueba que falla por un error existente

| Identificador | Contrato comprobado | Resultado actual |
| --- | --- | --- |
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
| `npm run test:regression` | Código 0; 164 aprobadas, ninguna fallida ni omitida. |
| `npm run test:known-bugs` | Código 1; 1 fallida por BUG-05, ninguna omitida. |
| `npm test` | Código 1; 165 ejecutadas, 164 aprobadas y 1 fallida, ninguna omitida. |

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


BUG-04 comprobado con:

```sh
NODE_PATH=/workspace/.fullhouse-tools/node_modules node tests/browser/day-shifts.cjs
```

Resultado: escritorio 1280 px y móvil 390 px aprobados, Medianoche, sin errores
JavaScript. Interacción con el editor real, visibilidad/posición de bloques,
comprobación de las 24:00, dependencias, excepciones e historial, y rechazo de
cuota con exportación/reintento correctos. No se utilizaron datos personales.

## Contrato histórico v2 · fase 1

```sh
npm run check:history-contract
npm run test:history-contract
```

- `contracts/history-v2.d.ts` declara el formato propuesto. La comprobación de
  tipos incluye aserciones negativas `@ts-expect-error` de inmutabilidad y versión.
- `contracts/history-v2.cjs` valida documentos/transiciones **offline** con el
  validador v1 real inyectado por el arnés. No es un codec de importación aprobado.
- `tests/fixtures/history-v2.cjs` crea exclusivamente datos sintéticos. Se prueban
  parciales, completados manuales/por pasos, duración real diferenciada, continuidad,
  corrección de alternativa sin borrar marcas ni duplicar fotos, cambios de plantilla,
  eliminación, reprogramación y referencias inválidas. Se reutilizan las exportaciones
  históricas reales sintéticas 0.1–0.9 sin alterarlas.
- Una prueba ejecuta la importación actual y verifica que v2 siga siendo rechazado
  sin cambiar memoria ni `fullhouse-v01` y sin crear `fullhouse-v02`.
- `history-contract.pending.test.cjs` contiene requisitos `test.todo` de integración.
  El ejecutor los cuenta como TODO, **no como pruebas aprobadas**. Todavía faltan
  captura real, vistas/estadísticas v2, migración y concurrencia, entre otros.
- `known-bugs.test.cjs` conserva BUG-05 con su fallo real. Ni este contrato ni los
  TODO permiten afirmar que el historial de producción ya esté corregido.

No hay cambios de interfaz; no se ha realizado una nueva verificación visual de
Chromium en esta fase. Las pruebas actuales del controlador no sustituyen esa
verificación al integrar las nuevas rutas.

Resultados de fase 1, base `7a05350`:

| Comando | Resultado |
| --- | --- |
| `npm run check` | Correcto: TypeScript, sintaxis y app.js sincronizado |
| `npm run check:history-contract` | Correcto: tipos y aserciones negativas |
| `npm run test:regression` | 164 aprobadas |
| `npm run test:history-contract` | 22 aprobadas, 13 TODO, 0 fallidas |
| `npm test` | 186 aprobadas, 13 TODO, 1 fallida (BUG-05), salida 1 |

Los TODO no incrementan las aprobadas. BUG-05 sigue mostrando que la definición
actual reemplaza los pasos/minutos originales de una ejecución ya completada.

## Motor histórico v2 · fase 2 (aislado)

La API y sus límites están en [HISTORY_V2_ENGINE.md](../docs/HISTORY_V2_ENGINE.md).
Se ejecuta con los mismos comandos `check:history-contract` y `test:history-contract`;
no requiere nuevas dependencias ni modifica el JavaScript público.

- `history-contract.engine.test.cjs` ejecuta operaciones reales del motor: captura
  por primera marca, nota, foto, elección y completado; versiones compartidas,
  alternativas automáticas/manuales y anidadas, asignación fija/flexible, parciales,
  continuidad, reapertura, corrección, evidencias y modificaciones posteriores de
  plantillas. Comprueba pureza ante errores y operaciones obsoletas.
- El reintento usa una operación retenida y un escritor sintético que lanza error
  antes de confirmar. No afirma probar persistencia v2 en el navegador: esa ruta
  todavía no existe. Sus IDs y el documento confirmado no cambian tras el fallo.
- `history-contract.codec.test.cjs` cubre modelo completo, datos arbitrarios,
  getters/ciclos/profundidad, referencias/IDs inválidos, checkpoints anidados,
  transiciones incorrectas, JSON duplicado/malformado y roundtrip v1/v2. Los nueve
  respaldos históricos de origen real sintético conservan exactamente sus hechos.
- Las declaraciones de `history/engine.d.cts` y las aserciones negativas adicionales
  verifican la API de TypeScript y candidatos inmutables. El código CJS se ejecuta
  directamente en estas pruebas; no se ha convertido la aplicación a módulos.
- Los seis TODO P2 de fase 1 ya tienen cobertura de motor. La confirmación mediante
  el escritor público sigue como TODO P4; los TODO P3/P4 continúan explícitos.
- Se corrigió el fixture de continuación de fase 1 para actualizar `lastRecordedAt`
  al instante de continuación: ahora el codec también verifica esa cronología.
  No se alteró ninguna aserción de la reproducción original de BUG-05.

Resultados de fase 2 (base `5e1f683`):

| Comando | Resultado |
| --- | --- |
| `npm run check` | Correcto; TypeScript y app.js público idénticos |
| `npm run check:history-contract` | Correcto; contrato y API tipada |
| `npm run test:regression` | 164 aprobadas |
| `npm run test:history-contract` | 66 aprobadas, 8 TODO, 0 fallidas |
| `npm test` | 230 aprobadas, 8 TODO, 1 fallida (BUG-05); salida 1 |

No hay pruebas omitidas mediante `skip`. Los TODO no cuentan como aprobados.
BUG-05 continúa fallando porque Planner todavía usa plantillas actuales al leer
historial. No se realizó verificación visual nueva: no cambia ninguna pantalla.

## Lectura histórica y vistas · fase 3 (laboratorio)

`history-contract.reader.test.cjs` amplía el mismo comando de contrato con lectura
central, huérfanos, deduplicación por serie/fecha, continuidad, alternativas pendientes,
denominadores congelados, metas/revisiones, errores y estimaciones explícitas.
El bundle se prueba en VM sin APIs Node; el adaptador también captura una revisión
generada por saveGoal real sobre el arnés sintético. Las aserciones de tipos incluyen
los DTOs de lectura y la imposibilidad de tratar un registro incompleto como árbol
verificado. No se modifican las pruebas originales de BUG-05.

Los nuevos checkpoints conservan `lifecycle?`. Se comprueba que el codec acepta los
anteriores sin rellenarlos y rechaza cronologías incoherentes. El fixture antiguo
sin metadatos se presenta con fecha desconocida. No se altera ningún respaldo real.

Los tres TODO P3 se sustituyeron por pruebas reales; permanecen cinco TODO P4.
La [prueba Chromium](browser/README.md) utiliza doce fixtures con el motor real en
una página aislada. Ningún resultado implica activación en las pantallas públicas.

| Comando | Resultado de fase 3 (base 31f2ae3) |
| --- | --- |
| `npm run check` | Correcto; app.tsx/app.js sin cambios y sincronizados |
| `npm run check:history-contract` | Correcto; tipos de motor/lector/adaptador |
| `npm run test:regression` | 164 aprobadas |
| `npm run test:history-contract` | 83 aprobadas, 5 TODO, 0 fallidas |
| `npm test` | 247 aprobadas, 5 TODO, 1 fallo conocido BUG-05; salida 1 |
| Chromium `history-view.cjs` | 120 combinaciones; sin errores JS ni intentos de Storage |

Los TODO no cuentan como aprobados y no hay pruebas omitidas con `skip`.

## Integración y persistencia simuladas · fase 4A

`history-contract.integration.test.cjs` usa métodos reales de Planner extraídos por
AST, con save como sink de candidato y constructor/load/Storage excluidos. Comprueba
creación/edición, captura, completado automático agrupado, reprogramación/serie,
desplazamientos, límites, borrado de plantilla, cierre/reapertura/continuación y
conservación del legado. Se utilizan IDs reservados, fecha y confirmación explícitos.

`history-contract.persistence.test.cjs` prueba puertos Map/cola compartida: fallos de
escritura/readback, cuotas, errores antes/después del manifiesto, ACK perdido,
recuperación por journal, corruptos, cambios v1, dos clientes, operaciones obsoletas,
importación, fotos y borradores. Incluye 2.000 ejecuciones/500 revisiones y un patrón
JPEG 256×256 sintético comprimido. No es una medición de cuota del navegador real.

Los cinco TODO se conservan y etiquetan **P4B público**: las simulaciones aprobadas
no prueban un escritor v2 público que todavía no existe. BUG-05 original no cambia.

| Comando | Resultado (base 4324abc) |
| --- | --- |
| `npm run check` | Correcto; TypeScript/app.js público sincronizados |
| `npm run check:history-contract` | Correcto; contratos de puertos/tokens/candidatos |
| `npm run test:regression` | 164 aprobadas |
| `npm run test:history-contract` | 113 aprobadas, 5 TODO, 0 fallidas |
| `npm test` | 277 aprobadas, 5 TODO, 1 fallo conocido BUG-05; salida 1 |
| Chromium `history-integration.cjs` | 28 casos (14 × escritorio/móvil), sin Storage público ni errores JS |
| Chromium `history-view.cjs` | 120 combinaciones de escenarios/paletas/tamaños conservadas |
| `node scripts/measure-history-storage.cjs` | Cuatro modelos validados; tamaños en documento de persistencia |

No hay `skip`; los TODO no cuentan como aprobados. Los registros reales no se usan.
El [protocolo](../docs/HISTORY_V2_PERSISTENCE.md) enumera limitaciones: puertos nativos,
resolución manual completa, capacidad, legado y formularios/adjuntos públicos.


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
[Decisión, medidas e inventario pendiente](../docs/HISTORY_V2_STORAGE_DECISION.md).


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
[Contrato, inventario y decisiones abiertas](../docs/HISTORY_V2_LEGACY_COMPAT.md).


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
obligatorias para esta etapa. [Informe, resultados y bloqueos de 4C](../docs/HISTORY_V2_READINESS.md).


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
que siguen pendientes. [Contrato, límites y resultados](../docs/HISTORY_V2_LINEAGE_SCOPED.md).


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

[Arquitectura, resultados y límites](../docs/HISTORY_V2_SCOPED_GOALS.md).


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
[Contrato, resultados y limitaciones](../docs/HISTORY_V2_SCOPED_ROUTINES.md).


## B.3a · demostración experimental del calendario

```sh
node --test tests/history-contract.calendar*.test.cjs
npm run check:history-contract
NODE_PATH=/workspace/.fullhouse-tools/node_modules node tests/browser/history-calendar-proof.cjs
```

40 pruebas nuevas reales, incluidas en test:history-contract y npm test. Los archivos
fijan UTC en su proceso node:test; las zonas locales se ensayan en subprocesos y
contextos Chromium separados. Prueban helpers reales extraídos por AST, períodos
Gregorianos/MCM, grafos y calendarios finitos, alternativas, certificados y presupuestos.
No sustituyen la reproducción pública BUG-05 ni sus seis TODO de fases posteriores.

Resultado de cierre: check/tipos aprobados; regresión 164; contratos 215 aprobadas
+ 6 TODO; npm test 379 aprobadas + 6 TODO y único fallo conocido BUG-05. Las limitaciones
compartidas reproducidas (años 00–99, búsqueda limitada de repeatCollision y centinela
__base de B.2) no se presentan como correcciones públicas. El motor nuevo no se integra
en las operaciones de persistencia B.2 ni en Planner.

Chromium: certificados directos/Worker iguales, cancelación y reuso del Worker,
almacenamiento prohibido, proyección sin fotos/logs/revisiones, presupuestos y overflow.
Prueba UTC en 1280/390 px y rangos finitos New York/Madrid/Apia; no es Android/iPhone.
Firefox/WebKit no probados. También se reverificaron Chromium rutinas B.2, fallos,
guardado público pendiente y límites/dependencias de horarios, sin errores JavaScript.

[Fundamentos, restricciones, mediciones y diseño siguiente](../docs/HISTORY_V2_CALENDAR_PROOF.md).


## B.3a.1 · seguridad de alternativas y pruebas locales

```sh
node --test tests/history-contract.alternative-safety.test.cjs tests/history-contract.calendar-local.test.cjs
NODE_PATH=/workspace/.fullhouse-tools/node_modules node tests/browser/history-alternative-safety.cjs
NODE_PATH=/workspace/.fullhouse-tools/node_modules node tests/browser/history-calendar-local.cjs
FULLHOUSE_ROUTINES_ALTERNATIVE_SAFETY=1 NODE_PATH=/workspace/.fullhouse-tools/node_modules node tests/browser/history-scoped-routines-performance.cjs
```

16 pruebas nuevas reales; la reproducción anterior __base exige ahora base y variante
separadas. Primeros tres casos fallaron antes del arreglo, así como las reproducciones
locales de viernes omitido y captura normalizada. Los hallazgos públicos de preview y
addDays son observaciones explícitas sin corrección pública, no funcionalidades resueltas.

Cierre: check/tipos correctos, regresión 164, contratos 231 + 6 TODO; npm test 395
aprobadas + 6 TODO y único fallo conocido público BUG-05. Se ejecutaron también las
suites Chromium de rutinas/fallos, motor/Worker, almacenamiento/linaje, integración,
legado, guardado pendiente y horarios. Nueva cobertura Mexico City/New York/Madrid/Apia;
Firefox/WebKit y dispositivos físicos no probados. El benchmark grande es opcional y
se ejecuta aislado de otras mediciones, con fotografías sintéticas reales.

[Modelo, dominios, límites y resultados](../docs/HISTORY_V2_CALENDAR_HARDENING.md).


## B.3b.1 · creación experimental por alcance

21 escenarios Node adicionales de creación, paridad con Planner, identidades, anclas,
recurrencias, alternativas, legado/adopción y zonas locales. Se incluyen en
`npm run test:history-contract`; no modifican la suite pública ni resuelven BUG-05.
Véanse [las suites de navegador](browser/README.md) y
[el informe](../docs/HISTORY_V2_SCOPED_EVENTS_CREATE.md). Permanecen los seis TODO.


## B.3b.2 · edición experimental por alcance

39 escenarios Node de clasificación, identidades, cortes, capturas futuras, fases,
excepciones, dependencias y zonas; pruebas de IndexedDB/recuperación/capacidad en
[Chromium](browser/README.md). Reproducen los efectos inseguros del saveEvent real sin
modificarlo; las diferencias v2 se verifican separadamente. Un caso no representable
se prueba como bloqueo, no como una implementación aprobada. Los seis TODO y el
BUG-05 público permanecen. [Informe](../docs/HISTORY_V2_SCOPED_EVENTS_EDIT.md).


## Comercial · conservación mínima v1

30 casos adicionales en commercial-history.cjs, cargados por regression.test.cjs:
plantillas usadas/no usadas, corte con/sin registros futuros, dependencias indirectas,
identidad del primer límite, copia anidada, colisiones, cuota y borradores, correcciones
de alternativas sin borrar marcas y legado ambiguo. Los tests de guardado usan
candidatos autorizados; no se confunde rechazo histórico con error de almacenamiento.
La prueba original BUG-05 no cambia. [Informe](../docs/COMMERCIAL_V1_HISTORY_GUARDRAILS.md).


## Comercial · autenticación de pruebas

`npm run test:auth`: doce pruebas unitarias/de integración local (sesiones, revocación,
borradores/fotos, prefijos, importación explícita y recuperación). Los dobles de sesión
no se presentan como verificación de Firebase. `npm run test:auth:emulator` ejecuta
SDK Firebase real y emuladores Auth/Hosting: registro, correo, acceso, salida, contraseña
anterior/nueva y dos cuentas en 1280/390 px. No hay correo real ni proyecto real probado.
Consultar [configuración y límites](../docs/COMMERCIAL_AUTH_STAGING.md). Los seis TODO
de historia siguen explícitos. Las guardas comerciales v1 y su reproducción no cambian.
