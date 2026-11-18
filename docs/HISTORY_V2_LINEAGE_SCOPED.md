# BUG-05 · 4B.3b: autoridad persistente y planificación por alcance

Base `origin/main` **d1dae11** (PR #11). Rama
`feature/history-lineage-scoped-v2`. Solo laboratorio y datos sintéticos.
**Entrega: hito A; hito B pendiente. NO preparado para 4C.**
No cambia Planner, Data2, `.fharchive`, la clave pública v1 ni su alias.

## 1. Contrato persistente implementado

`history/storage-lineage.cjs` ofrece `createLineageDatabase` con factory, nombre
`fullhouse-lab-*` y puerto `readSources` obligatorios. No abre una base al importar;
no contiene acceso implícito a localStorage. Separa tres versiones:

- IndexedDB física **2**, barrera frente a los escritores experimentales anteriores.
- Registros/planes y archivos físicos **1**, sin modificación del formato portable.
- Documento lógico **2**; sin activación ni migración pública.

Stores e índices existentes se conservan. `control/authority` contiene:

| Campo | Regla |
| --- | --- |
| key / protocol | `authority` / 1; manifiesto cerrado, campos desconocidos rechazados |
| databaseVersion / recordFormat / documentVersion | 2 / 1 / 2 |
| requiredCapabilities | `authority-v1`, `source-watch-v1`, `receipt-chain-v1` |
| id | `authority:` + ID de la primera operación; estable en reintentos, ámbito de la base |
| origin | `native`, `migration` o `restored`; selección explícita y migrationId cuando corresponde |
| origin.keys | nombres canónicos de principal y alias; nombres descriptivos, no acceso público |
| origin.fingerprints | SHA-256 de las unidades UTF-16LE exactas de cada cadena; null significa ausencia |
| genesis / tip | ID, generación, raíz y hash del recibo inicial/actual |
| identityHash | sella origen, génesis sin receiptHash y versiones/capacidades |
| checksum | SHA-256 de JSON canónico del manifiesto sin checksum |

La huella distingue ausencia, bytes distintos e ilegibilidad. La igualdad de hechos
es informativa: **no autoriza reemplazar una fuente con otros bytes** tras migrar.
En presencia de dos fuentes divergentes se conserva/exporta cada una y se exige
selección explícita para preparar un candidato; no se combinan historiales.

Cada recibo incluye `lineage` (protocolo, authorityId, authorityHash, génesis y
parent) y `receiptHash`. El hash enlaza ID, generación, raíz, operationHash y linaje.
La cadena debe ser contigua desde generación 1, sin recibos ajenos, y coincidir con
head y authority. Cambiar solo origen y checksum no reconstruye la identidad.
No se usan fechas como autoridad. Estos hashes detectan inconsistencias; **no son
firmas ni autentican frente a código malicioso del mismo origen**.

## 2. Migración, escritura y confirmación

1. Inspección de ambas copias; selección voluntaria; reconstrucción v1 → candidato
   Data2, sin inventar capturas. Se congelan los argumentos antes de esperar.
2. Preparación persistente con copias originales, selección, fingerprint e ID.
   Relectura antes y después de preparar; si cambió una fuente, se bloquea.
3. Primera confirmación verifica candidato, equivalencia y fuentes. En una sola TX
   se vinculan originales, candidato confirmado, filas/fotos, head, receipt y authority.
4. Escrituras posteriores verifican cadena, fuentes y cabeza esperada; dentro de la
   TX se comparan exactamente authority/head y filas del alcance. Se actualizan
   datos, manifiesto y recibo conjuntamente. Una operación obsoleta se rechaza.
5. Solo después de `transaction.oncomplete`, lectura de recibo/filas/fotos y sonda
   posterior puede devolverse confirmado. La lectura también comprueba la autoridad
   esperada. Un fallo de acuse conserva la operación/ID para inspección y reintento.
   Un recibo anterior no se presenta como cabeza actual aunque las raíces coincidan.

La ruta incremental admite ahora bases migradas **únicamente a través del wrapper
con linaje**. El factory anterior mantiene su bloqueo de migradas. No se elimina
ninguna validación para habilitar la ruta nueva. Apertura y exportación conservan
verificación completa; la apertura de una autoridad migrada vuelve a comprobar el
candidato original contra la génesis.

## 3. Vigilancia, carreras y límites reales

`readSources(): {main: string|null, alias: string|null}` puede ser asíncrono. Debe
copiar ambas fuentes sin sustituir errores por null. El laboratorio visual usa mapas
sintéticos; la prueba entre pestañas usa solo claves `fullhouse-lab-lineage-source-*`
en un origen loopback desechable. Nunca se accede a las claves públicas.

Se consulta al abrir, antes/después de preparar migración y antes/después de cada
commit; `auditLineage()` permite vigilancia explícita. La lectura de dos claves tampoco es una instantánea atómica entre ellas: una
observación híbrida se trata de forma conservadora, sin elegir rama.
No hay temporizador global ni
servicio de vigilancia pública en esta fase. Cambios mientras la ventana está cerrada
se detectan al reabrir. Aparición, desaparición, cambio de bytes y acceso ilegible
bloquean, incluso si la fuente reaparece después de varios commits v2.

**No hay transacción común localStorage–IndexedDB.** Una escritura v1 durante la TX
puede coexistir con un commit v2 durable. La sonda posterior rechaza el acuse, guarda
conflicto y conserva ambas ramas. Una escritura posterior a la última sonda solo se
detectará en la siguiente vigilancia/apertura/escritura. Un cambio ABA que vuelve a
los mismos bytes entre sondas puede ser indetectable. BroadcastChannel, Web Locks
y Storage events no resuelven esto con escritores v1 no participantes.

La cadena se comprueba completa antes de cada commit: O(número de recibos), además
de O(bytes de las fuentes) por sonda. El catálogo incremental ya era O(descriptores).
No se afirma coste constante ni cobertura de corrupción ajena al alcance en cada
escritura: se exige apertura íntegra antes de emitir una capacidad de trabajo y una
revisión completa para importación/exportación/diagnóstico. Falta medir cadenas
largas y fuentes v1 con fotografías voluminosas antes de activación.

## 4. Conflicto y recuperación

`control/lineage-conflict` guarda razón, huellas y copias observadas, con checksum.
Si la discrepancia aparece antes de guardar el candidato, también conserva las copias
esperadas. Los originales ya preparados no se sustituyen. La primera observación
persistente no se sobrescribe ni se limpia al volver a los bytes iniciales.

Si no cabe el registro completo se intenta un marcador pequeño; si tampoco cabe,
la conexión queda bloqueada en memoria. **No se promete persistencia de cuarentena
cuando el almacenamiento rechaza ambas escrituras.** Las fuentes no se borran;
se ofrece exportación de diagnóstico antes de cerrar. Una nueva conexión volverá a
comparar fuentes; no puede garantizar recordar una observación no persistida tras
un cambio ABA y cierre forzado.

`sourceRecovery()` devuelve originales, fuentes actuales, manifiesto, recibos y
conflicto. Es **paquete de fuentes/diagnóstico, no respaldo completo de fotos y
registros**. Para datos válidos se mantiene `.fharchive`; para corrupción puede
exportarse `.fhdiagnostic` sin presentarlo como respaldo validado. No existe operación
que borre el bloqueo o combine ramas automáticamente. La recuperación exige revisar
copias y restaurar explícitamente en un destino nuevo, conservando el origen.

Una restauración portable confirmada en destino vacío y sin fuentes locales crea
una autoridad **nueva** `restored`. Conserva hechos, revisiones, fotos y originales
archivados; `.fharchive` no contiene la cadena operacional de la base anterior y no
se finge reconstruirla. Una autoridad activa no admite `replace`. La reconciliación
pública y su experiencia siguen pendientes; no se pide borrar v1 para continuar.

## 5. Barrera de compatibilidad

Los escritores experimentales anteriores abren versión física 1: tras actualizar a
2 reciben VersionError. `versionchange` cierra conexiones participantes; una conexión
que lo ignora bloquea el upgrade. El intento bloqueado se rechaza y, aunque después
se libere, aborta la actualización pendiente. No se elimina la base para forzarla.

Una base física 1 con datos no recibe un linaje inferido al abrirse con el wrapper:
se conserva en recuperación por ausencia de authority. Hace falta exportar/validar y
restaurar expresamente en otro destino; no hay migrador de bases experimentales viejas.
Versiones físicas futuras, manifiestos/capacidades desconocidos o datos incompletos
entran en recuperación. Un lector que entiende el protocolo pero declara capacidades
de escritura insuficientes puede abrir en solo lectura y no crea/modifica stores.

La barrera protege a los escritores conocidos que solicitan versión 1 y al wrapper
participante. No impide que código que abre sin versión, usa directamente los stores
o es malicioso ignore el contrato; no es una frontera de seguridad. No hay fallback
silencioso a una versión antigua ni rollback transparente a v1.

## 6. Operaciones y hito B

Implementado A: preparación/confirmación de migración, commits completos con linaje,
edición incremental de ejecuciones nativas y legado, primera captura existente,
reintento, inspección de recibo, consulta y exportación. No se altera la semántica de
adopción, propiedad de fotos, marcas desconocidas ni correcciones de 4B.2.

**B no implementado en esta entrega.** No se considera rápido un método por existir
su equivalente en Planner. Siguen usando documento completo los flujos experimentales
de planificación/metas de `compat-session`, adopción y preparación/restauración/exportación
completas. La aplicación pública sigue en v1 y conserva BUG-05 conocido.

Plan mínimo de B, después de revisar A:

1. Puertos de lectura de rutinas/eventos/metas y catálogo de relaciones; comandos
   inmutables con CAS por entidad, sin cargar logs/fotos de años anteriores.
2. `saveGoal`, `saveProgress`, `saveDayReview`, `toggleMilestone`: meta, revisión,
   hitos y enlaces afectados en una TX; preservar ejecuciones de metas eliminadas.
3. `saveRoutine`/`deleteRoutine`: plantilla actual y referencias futuras; revisiones
   históricas y registros permanecen inmutables/consultables.
4. `saveEvent`, `shiftEvent`, `deleteEvent`: serie, excepciones, dependencias encadenadas
   y fechas afectadas. Reutilizar reglas reales y BUG-04; 24:00 válido, excesos rechazados.
   Si no se puede enumerar/verificar el alcance temporal, rechazar con límite explícito,
   sin truncar ni aceptar recurrencias no verificadas. El límite requiere diseño y pruebas.
5. Adopción explícita: validar fuente legada y definición elegida, crear tramo nuevo
   sin transferir progreso ni propietario de fotografías; conservar auditoría y CAS de
   ambas entidades. Mantener ruta completa hasta demostrar equivalencia.
6. Equivalencia contra funciones actuales en corpus pequeño/grande, excepciones y
   series; fallos/reintentos/cuota entre pestañas; mediciones preparación/TX/confirmación.

No se empieza B mientras A tenga un fallo crítico de integridad; el checkpoint de A
se entrega de forma independiente para revisión. Privacidad y paridad React no se
consideran resueltas por este protocolo.

## 7. Medición reproducible

Comandos y resultados en las secciones siguientes. El benchmark nuevo compara la
ruta incremental nativa anterior (sin autoridad) y la migrada con autoridad usando
los mismos hechos/bytes en el mismo Chromium. No compara métodos B que no existen.
Una muestra por operación, sin afirmación estadística ni prueba de hardware móvil.
El tiempo de confirmación incluye la sonda posterior; `lineageAfterMs` permite
separarla. `transactionMs` incluye espera de IDB y acceso, no solo escritura de disco;
`lineagePrepareMs` incluye lectura/verificación de cadena y fuentes. La memoria de
la página compartida no permite atribuir consumo separado a cada ruta.

Chromium 156.0.8078.79; Node v24.22.1, equipo de nube compartido, viewport de escritorio.
5.000 ejecuciones + un registro legado, 501 revisiones, 65 blobs únicos,
42.175.847 bytes de fotografías. Las fuentes de esta medición solo tienen 280 bytes UTF-16;
**no demuestra la latencia con fuentes v1 grandes ni miles de recibos**.
[Medición íntegra](HISTORY_V2_LINEAGE_MEASUREMENTS.json).

| Operación | Preparación anterior / linaje | TX anterior / linaje | Linaje antes / después | Confirmación anterior / linaje | Lectura anterior / linaje |
| --- | --- | --- | --- | --- | --- |
| step | 23.6 / 19.6 | 6.1 / 6.4 | 4.1 / 0.3 | 3.7 / 4.6 | 5.8 / 4.9 |
| note | 13.1 / 13.4 | 4.7 / 5.8 | 2.9 / 0.2 | 4.6 / 2.8 | 3.2 / 3.0 |
| photo | 140.7 / 113.4 | 6.3 / 6.9 | 3.4 / 0.4 | 5.3 / 6.0 | 3.4 / 3.0 |

Tiempos en ms. Apertura completa: 1469.8 ms anterior / 1214.5 ms con linaje; auditoría de cadena y fuentes: 1.7 ms. Estadísticas: 6.3 ms.
Raíces de hechos iguales en las tres operaciones y hashes de foto iguales.
Heap compartido al finalizar: 148.9 MB; contiene corpus, ambas bases de trabajo y
objetos del ensayo. No es memoria retenida atribuible a cada ruta ni memoria total
del navegador. No sustituye la medición separada de memoria de 4B.3 ni acredita móvil.
La variabilidad/JIT impide atribuir diferencias de preparación a una mejora nueva:
esta fase incorpora autoridad, no una optimización de planificación.

## 8. Pruebas de esta entrega

```sh
npm run check
npm run check:history-contract
npm run test:regression
npm run test:history-contract
npm test
NODE_PATH=/workspace/.fullhouse-tools/node_modules node tests/browser/history-lineage.cjs
NODE_PATH=/workspace/.fullhouse-tools/node_modules node tests/browser/history-lineage-performance.cjs
NODE_PATH=/workspace/.fullhouse-tools/node_modules node tests/browser/history-readiness.cjs
NODE_PATH=/workspace/.fullhouse-tools/node_modules node tests/browser/history-storage.cjs
NODE_PATH=/workspace/.fullhouse-tools/node_modules node tests/browser/history-view.cjs
NODE_PATH=/workspace/.fullhouse-tools/node_modules node tests/browser/history-integration.cjs
NODE_PATH=/workspace/.fullhouse-tools/node_modules node tests/browser/history-legacy.cjs
NODE_PATH=/workspace/.fullhouse-tools/node_modules node tests/browser/pending-save.cjs
NODE_PATH=/workspace/.fullhouse-tools/node_modules node tests/browser/day-shifts.cjs
```

| Comprobación | Resultado verificado |
| --- | --- |
| check / check:history-contract | Correctas; TypeScript y JS público sincronizados sin cambios |
| test:regression | 164 aprobadas |
| test:history-contract | 154 aprobadas, 6 TODO, cero fallos |
| npm test | 318 aprobadas, 6 TODO, único fallo conocido BUG-05 (salida 1) |
| history-lineage | 101 grupos aprobados, 1280/390 px, cuota en perfil desechable |
| history-lineage-performance | Corpus completo, equivalencia de raíces/fotos, medición adjunta |
| history-readiness | 78 grupos aprobados; corpus completo, Firefox/WebKit ausentes |
| history-readiness reducido | 58 grupos aprobados; no sustituye el corpus completo |
| history-storage | 65 casos aprobados; cuota/crash/denegación reales y nueve respaldos históricos |
| history-view | 120 combinaciones aprobadas |
| history-integration | 28 casos aprobados |
| history-legacy | 186 casos aprobados |
| pending-save | 4 combinaciones públicas sintéticas aprobadas |
| day-shifts | 2 viewports públicos sintéticos aprobados |

La suite nueva cubre las doce situaciones de fuentes solicitadas: matriz de presencia,
igualdad de bytes/hechos y divergencia; cambio tras preparar, durante escritura,
tras varios commits y mientras cerrado; desaparición, ilegibilidad y reaparición.
Incluye conflicto persistente después de restaurar bytes/reiniciar; conexiones viejas,
upgrade bloqueado, manifiesto corrupto, capacidades insuficientes, abortos antes/durante
TX, cuota inyectada y real, cierre de página, acuse perdido, CAS entre conexiones v2,
restauración en destino nuevo y lectura de fotografía. Se añade comprobación explícita de cambio después de preparar y antes de confirmar
la migración, y rechazo de una base física futura de versión 3.
El ensayo v1/v2 usa **dos
páginas reales**; el CAS entre escritores v2 usa dos conexiones independientes.

La primera ejecución de almacenamiento se interrumpió; el diagnóstico posterior
con instrumentación temporal agotó 180 segundos. Se repitió la suite original sin
instrumentación, con margen de 600 segundos y sin otro benchmark grande simultáneo:
terminó correctamente (65 casos, salida 0). No se modificó ni redujo esa suite.

La primera tentativa de cuota en contexto privado no produjo rechazo y falló la
aserción: se corrigió el ensayo para usar un perfil persistente desechable, donde
el navegador sí devuelve QuotaExceededError y conserva generación/autoridad/fotos.
No se debilitó la aserción ni el protocolo para hacerla pasar. La paleta Medianoche
y Océano se verifican en /lineage; la suite de legado conserva sus cinco paletas.
No hay errores JavaScript inesperados en los flujos nuevos ni acceso a claves públicas.

Firefox y WebKit no están instalados: la suite registra Executable doesn't exist.
No se intentó repetir aquí la descarga previamente bloqueada con 403. No se probaron
Safari, Android/iPhone ni dispositivos físicos. El cierre nuevo es de página, no
simula pérdida física de energía ni garantiza fsync fuera de lo ofrecido por IDB.
No se marca resuelto BUG-05 porque Planner todavía interpreta plantillas v1 actuales.

## 9. Riesgos y garantías pendientes

- Coste de verificar todas las fuentes y cadena completa; faltan ensayos extremos
  de cadena y de originales v1 voluminosos con el wrapper. No activar sobre esta
  única muestra ni atribuir al protocolo una garantía de latencia universal.
- La cuarentena requiere espacio; el fallback de doble fallo de cuota se conserva
  solo en memoria. Faltan pruebas de cuota precisamente durante ambos intentos de
  persistir el conflicto. No se promete persistencia de esa observación.
- Restaurar no mantiene la cadena operacional original; para investigación se debe
  conservar diagnóstico además de respaldo de hechos. Falta la experiencia pública
  de reconciliación y selección de destino sin tocar fuentes originales.
- No se implementó bloqueo exclusivo de pestañas v1 no participantes; es imposible
  obtenerlo solo con estos puertos. Debe explicarse el riesgo residual al usuario.
- No hay política aprobada de borrado físico; referencias, retirada reversible,
  propiedad de fotos, legado y adopción conservan las reglas existentes.
- No se implementa verificación criptográfica frente a código malicioso del origen.

## 10. Matriz de preparación para 4C

| Requisito | Estado |
| --- | --- |
| Autoridad persistente, cadena, transacción, CAS y confirmación | Aprobado/verificado en laboratorio, requiere revisión antes de uso público |
| Fuentes antiguas, conflicto y reapertura | Aprobado en escenarios probados; carrera/ABA residual explícita |
| Barrera física y capacidades | Aprobado para escritores conocidos; no es control de acceso frente a código arbitrario |
| Recuperación y respaldo de hechos | Implementado/probado; UX pública y reconciliación pendientes |
| Rendimiento de ejecuciones migradas | Implementado, medición de referencia aprobada; fuentes/cadenas grandes pendientes |
| Planificación, metas y adopción por alcance (B) | No implementado; plan de la sección 6 |
| Paridad con todos los controles React reales | No implementada completamente; inventario 4B.2/4B.3 vigente |
| Privacidad y borrado físico | Bloqueado por decisión del propietario |
| Firefox/WebKit y dispositivos físicos | Pendiente de pruebas |
| Activación/migración pública y autorización | No implementada ni autorizada |

Siguiente intervención mínima: revisar el checkpoint A, ampliar estrés de fuentes/
recibos y preparar B por grupos de entidades. Conservar fallback completo cuando
el alcance no pueda probarse; rechazar programaciones no verificables. Tras B,
completar paridad React/privacidad/navegadores y aprobar expresamente integración
pública, migración y recuperación. **Esta entrega no habilita 4C.**

## Checkpoint de entrega

El commit `d01d33d` del hito A fue subido a origin antes de continuar el cierre
de documentación y los casos adicionales; B no se inició. La creación de PR en
borrador mediante `gh pr create` recibió `Post https://api.github.com/graphql: Forbidden`.
La rama remota está disponible para crear la PR desde ChatGPT. No se fusionó ni
se publicó. La copia de trabajo final conserva el checkpoint y el commit de cierre.
