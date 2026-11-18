# BUG-05 · fase 4B.3: preparación técnica experimental

**Evaluación: NO preparado para comenzar 4C con los criterios actuales.**
Hay mejoras comprobadas de rendimiento, recuperación y capacidad. Permanecen
bloqueos concretos de fuentes antiguas, escrituras de planificación a gran escala,
paridad React, privacidad y navegadores. Esta entrega no activa v2, migra usuarios,
modifica Planner ni publica laboratorios. Base `origin/main` **35ca45c**, PR #10.
Rama `feature/history-readiness-v2`.

## 1. Arquitectura y límites de la optimización

El formato lógico Data `version: 2`, las claves v1 y el formato `.fharchive` se
conservan. `createLabDatabase({factory,name,legacy,schedule})` puede preparar el
acceso opcional `incremental`; exige nombres `fullhouse-lab-*`. La aplicación pública
no importa estos módulos. El despliegue mantiene la lista cerrada de recursos.

`storage-incremental.cjs` entrega capacidades opacas, locales a la conexión:

1. `openWindow` lee y verifica íntegramente metadatos, referencias, originales y bytes
   de fotos. Conserva una base profundamente congelada y catálogos por clave/hash.
   No convierte fotografías a dataURL ni construye un Data2 completo con base64.
2. `prepareExecution` trabaja sobre la ejecución afectada, enlaces de adopción y
   revisión original. Permite cambios nativos y ediciones del legado sin inventar
   correspondencias. Las fotos anteriores son referencias: la proyección mínima con
   AA== es exclusivamente de validación, jamás un respaldo ni un DTO de fotografía.
3. La primera marca, nota, alternativa, completado o foto incluye programación
   vigente, registros del día necesarios para dependencias y revisiones referenciadas.
   Reutiliza definiciones iguales y prepara captura + revisión + foto + identidad de
   evento conjuntamente. No recorre los años de logs para construir su contexto.
4. Los hashes de valores se calculan para el subconjunto; se reutilizan los de filas
   verificadas sin cambio. La raíz sigue siendo SHA-256 del catálogo completo,
   compatible con formato físico 1: **O(N) de descriptores**, no un árbol Merkle ni
   coste constante. Se conserva el orden original de encabezados y se anexan IDs nuevos.
5. `commitExecution` compara cabeza/recibo, registros y referencias del alcance en
   una transacción readwrite. Comprueba ausencia de IDs nuevos, índices únicos y
   conflicto/cuarentena. Escribe solo filas nuevas/modificadas y blobs nuevos.
6. Espera complete y lee recibo, cabeza, filas modificadas y bytes de fotos nuevas.
   Solo entonces devuelve confirmed. Un recibo anterior superado devuelve
   committed-but-superseded sin sobrescribirlo. Un acuse perdido permite reintentar
   la misma capacidad/ID; nunca reconstruir otra identidad durante el retry.

Se validan estructura efectiva, progreso, cronología y retención con motor/codec
existentes. Las duraciones congeladas no se reasignan desde plantillas actuales.
Se omite revalidar otros años **solo porque pertenecen a la base verificada** y los
escritores participantes cambian cabeza de forma transaccional. No es autenticación
contra JavaScript malicioso del mismo origen ni detección inmediata de corrupción
en una fila ajena al alcance. Antes de editar se comprueban las referencias tocadas;
la verificación completa vuelve a hacerse al abrir, importar, exportar y solicitar
revisión de integridad. Debe definirse su frecuencia de fondo antes de producción.

Una corrupción conocida pone `control/integrity-block` y detiene escritores nuevos,
incluso al reabrir. Lecturas por alcance/foto detectan referencias o bytes corruptos.
No se limpia el bloqueo automáticamente: restaurar una copia válida en destino nuevo.
Los prototipos antiguos que no conocen este flag no son escritores compatibles;
la activación futura necesita barrera de versión/capacidades, no solo avisos.

`page` usa cursor/clave e índice byDay; `readExecution` lee el alcance sin fotos;
`readPhoto` verifica y devuelve solo el blob solicitado. `statistics` agrega hechos
sobre el catálogo verificado, separando legado/adoptado, sin recalcular recetas.
No se añaden índices redundantes para cada nota: se consulta por ejecución.
La agregación y reconstrucción de mapas aún son O(N) de metadatos; no son un motor
analítico ilimitado. Las páginas están acotadas a 1–1000 filas.

La congelación con estructura compartida solo omite subárboles ya congelados por
la apertura completa; los nodos nuevos se congelan antes de publicar la capacidad.
La verificación completa mantiene todos los controles, con hashes por lotes de 128
promesas y conjuntos para pertenencia, evitando await serial y búsquedas cuadráticas.

## 2. Mediciones antes/después reproducibles

[Resultados brutos](HISTORY_V2_READINESS_MEASUREMENTS.json). Mismo entorno virtual,
CPU AMD EPYC 9V74, Linux x64, Node 24.22.1 y Chromium 156.0.8078.79. Viewports
1280 y 390 en la misma máquina, sin simular CPU de móvil. No son Android/iPhone.
El benchmark obtiene modelo/repositorio/archivo anteriores directamente de Git
`35ca45c`, en memoria y solo con `start({baseline:true})`. Requiere ese objeto Git.
No reconstruye retrospectivamente cifras ni utiliza fixtures de resultados esperados.
Antes y después comparten los mismos bytes y comprueban igualdad de raíces tras cada
acción; el archivo comparable también tiene exactamente el mismo tamaño.

```sh
PLAYWRIGHT_BROWSERS_PATH=/tmp/fullhouse-readiness-browsers NODE_PATH=/workspace/.fullhouse-tools/node_modules node tests/browser/history-readiness.cjs
NODE_PATH=/workspace/.fullhouse-tools/node_modules node tests/browser/history-photo-capacity.cjs
NODE_PATH=/workspace/.fullhouse-tools/node_modules node tests/browser/history-readiness-ui.cjs
```

Se generan 5.000 ejecuciones diarias, 501 revisiones y **42.175.847 bytes** de
65 imágenes únicas, con JPEG de ruido 1100×1100 y PNG multimegabyte. Después se
ensayan foto nueva, referencia deduplicada, captura número 5001 y 100 ediciones
repetidas de la misma actividad; su diario acaba con 104 entradas. El rango de fechas
abarca unos 13,7 años: no implica 13,7 años de fotos diarias o uso intensivo real.

Milisegundos. Antes: preparación completa y commit/verificación combinados; no se
presenta su agregado como tiempo exclusivo de disco. Después: preparación medida
externamente, transacción/complete y confirmación posterior separadas.

| Viewport | Acción | Antes preparar | Antes commit+verificar | Después preparar | Después TX | Después confirmar |
| --- | --- | --- | --- | --- | --- | --- |
| 1280 | step | 4776.7 | 2425.1 | 10.9 | 3.6 | 2.3 |
| 1280 | note | 4850.1 | 2397.6 | 10.8 | 3.6 | 2.3 |
| 1280 | photo | 4707.9 | 2372.9 | 84.3 | 4.2 | 5.3 |
| 1280 | photo-deduplicated | 4835.4 | 2601.1 | 443.3 | 36.1 | 2.8 |
| 1280 | first-capture | 5286.4 | 2477.4 | 13.7 | 3.8 | 2.3 |
| 390 | step | 4668.7 | 2323.8 | 10.6 | 3.6 | 2.2 |
| 390 | note | 4617.7 | 2335.9 | 10.5 | 3.9 | 2.4 |
| 390 | photo | 4903.1 | 2653.2 | 84.2 | 4.3 | 3.8 |
| 390 | photo-deduplicated | 5371.1 | 2603.2 | 393.9 | 5.1 | 2.2 |
| 390 | first-capture | 5054.4 | 2510.5 | 16.0 | 4.3 | 2.2 |

Apertura completa (base ya escrita, no arranque frío de dispositivo): antes
1055.5/885.9 ms; después
797.8/844.4 ms. Lectura de ejecución:
3.9/2.9 ms; estadísticas:
5.8/4.8 ms; página de 50:
8.2/10.0 ms. No se hidrataron fotos en esas consultas.

En 100 ediciones, p95 de preparación+TX+confirmación:
48.1/48.3 ms.
Archivo comparable idéntico: 50,299,234 bytes. Exportación antes/después:
901.1/933.5 ms en 1280;
importación 3722.0/4183.3 ms;
commit de restore 2805.9/1980.9 ms.
El JSON conserva los valores de 390 por separado. Construcción inicial Worker:
5147.3/5326.1 ms.
Mayor intervalo observado en el sondeo de UI: antes
767.9/834.0 ms;
Worker 140.6/92.8 ms.

El Worker no acelera mágicamente la construcción inicial: incorpora arranque y
structuredClone. Ejecuta preparación/verificación/importación/exportación fuera del
hilo de interfaz. El sondeo de intervalos de 16 ms registra pausas, no una auditoría
completa de long tasks ni un máximo universal. La copia inicial sigue pudiendo
bloquear perceptiblemente. La apertura IndexedDB aún valida en el hilo principal;
el Worker disponible no implica que esa ruta ya esté trasladada. La exportación nueva es ligeramente más lenta en esta
prueba por snapshot/validación defensiva; no se presenta como mejora de throughput.

Objetivos propuestos, no compromisos: cambios pequeños p95 <100 ms escritorio y
<250 ms teléfono real; foto comprimida <500/<1000 ms después de decodificación;
lectura/página/estadísticas <50/<100 ms; apertura de este corpus <2/<3 s, con estado
de verificación visible; operaciones masivas cancelables y sin pausas habituales
>50 ms de interfaz. Solo se ha comprobado el entorno de escritorio: viewport 390
no demuestra la meta de teléfono. Importaciones masivas y copia de mensajes todavía
requieren trabajo de memoria/respuesta y cancelación.

## 3. Memoria, diarios y capacidad

Sondeo en ventanas nuevas, sobre la MISMA raíz, conservando cada sesión y solicitando
GC: sesión Data2 hidratada 65,489,533/
65,489,569 bytes de heap JS retenido;
ventana incremental 9,763,657/
9,763,753. Es un descenso de heap retenido,
no memoria total del navegador, RSS ni pico de importación. Los blobs y backing
stores no se contabilizan necesariamente en esa cifra. El benchmark registra además
muestras acumulativas de heap: incluyen corpus, copias y archivos simultáneos y NO
se presentan como consumo normal de una app. Falta un perfil de picos en teléfono.

No se compactan ni borran diarios. La estructura compartida reduce copia de las
otras ejecuciones, no el coste de validar el diario de la ejecución editada. Cien
ediciones son una prueba concreta, no una garantía de millones. Los límites de
json.cjs por entidad siguen siendo defensivos: al alcanzarlos se rechaza sin
reescribir el confirmado y deben conservarse los borradores. Hace falta diseñar
internado/compactación física y auditoría paginada antes de prometer años de edición
intensiva; no aumentar límites o truncar originales para ocultar el problema.

Además, `history-photo-capacity.cjs` verifica 1.095 ejecuciones/501 revisiones durante
tres años, con 365 fotos diarias JPEG 320×320 en el último año, 13 fotos 1100×1100 y
una PNG 640×640: **379 imágenes / 27.239.457 bytes**, archivo 29.213.469 bytes.
Exporta/restaura y verifica todos los hashes binarios y hechos. Este conjunto no usa
un JPEG mínimo como sustituto del almacenamiento real. Tampoco demuestra todavía
una década de fotos diarias a resolución máxima.

## 4. Navegadores y dispositivos

Chromium obligatorio: 78 grupos de comprobaciones nuevas de protocolo/rendimiento,
70 de UI (cinco paletas × escritorio/móvil) y 4 de capacidad fotográfica adicional.
Las suites existentes siguen ejecutándose aparte. Firefox y WebKit no estaban
instalados; se intentó descargarlos en /tmp, pero los mirrors respondieron
**403 Domain forbidden**. Sus lanzamientos se registran como no disponibles,
no como pruebas superadas. Si Chromium falta, el harness falla; no permite cero
navegadores aprobados. WebKit de Playwright tampoco sería una prueba de Safari/iOS.

La prueba Chromium observó IndexedDB, Web Locks y BroadcastChannel disponibles;
persisted y persist() devolvieron false en perfiles efímeros. estimate informó
~10 GB, sin reserva de espacio garantizada. La suite de cuota nativa demuestra que
ese valor puede no reflejar un límite impuesto. Ninguna de estas APIs demuestra la
ausencia de pestañas antiguas. IndexedDB serializa transacciones participantes, pero
no crea una transacción con localStorage v1.

Entre motores deben comprobarse soporte/fallback de durabilidad strict, permisos,
cuotas y evicción, modo privado, bloqueo de upgrades y cierre móvil. No hay cifras
ni garantías Firefox/WebKit deducidas de Chromium. El navegador/SO pueden descartar
memoria, borrar perfiles o perder datos: ni strict ni persist() prometen sobrevivir
a todos los fallos de disco/energía. Mantener respaldos externos comprobados.

## 5. Recuperación, concurrencia y reversión

| Escenario | Evidencia / resultado |
| --- | --- |
| Fallo dentro de TX / cuota | Abort conserva cabeza y registros; pruebas nativas de cuota de 4B.1 siguen vigentes |
| Acceso denegado | Factoría ausente y SecurityError de origen opaco bloquean; no fallback a ejemplos/v1 |
| Cierre forzado | Suite existente fuerza crash en Chromium desechable, reabre perfil y verifica estado íntegro; no garantía universal |
| Dos conexiones/pestañas | Una gana; otra conserva candidato obsoleto sin sobrescribir |
| Pestaña v1 / fuente modificada / alias divergente | Protocolo de migración detecta cambio antes/después de confirmar; la ruta rápida RECHAZA bases con fuentes heredadas hasta resolver autoridad persistente |
| Acuse perdido | Recibo durable permite retry; al recuperar, raíz+ID confirmados evitan otra escritura |
| Pendiente y commit posterior | Se identifica superado; preservar/exportar, nunca elegir por timestamp |
| Versión incompatible / upgrade bloqueado | VersionError y onblocked reales; conexiones se cierran por versionchange o se requiere intervención explícita |
| Corrupción/referencia rota | Apertura/revisión/lectura detecta y pone cuarentena; no sobrescribe para reparar |
| Migración interrumpida | Candidato y fuentes exactas conservados, verificación y confirmación explícitas; pruebas de nueve versiones |
| Respaldo completo | Restaura en destino nuevo y comprueba raíz, referencias y bytes |

Artefactos distintos:

- **.fharchive:** Data2 completo verificado y originales incluidos; no es copia
  forense de recibos/candidatos no confirmados ni de todos los stores internos.
- **.fhrecovery:** candidato completo, ID/base, comando y borradores; etiqueta
  pending-not-confirmed. El comando de foto usa referencia: no duplica sus bytes.
  Recuperar revalida/reproduce el comando sobre la misma base y exige igualdad de raíz.
  Si cambió la base, detenerse; se puede restaurar aparte solo con confirmación.
  Si raíz+ID ya están confirmados, reconocerlo sin repetir la escritura.
- **.fhdiagnostic:** JSON de stores reconocidos y blobs actuales, incluyendo
  cuarentena/candidatos. Conserva información interpretable aunque el modelo sea
  inválido, pero NO es respaldo validado/restaurable automáticamente. Los importadores
  completos lo rechazan. Tipos no JSON o presupuestos excesivos abortan sin emitirlo.
  Un esquema de DB desconocido puede requerir un lector de diagnóstico compatible.

La interfaz `/readiness` muestra generación confirmada y pendiente por separado,
permite descargar/examinar, reintentar con ID estable, cancelar candidato con diálogo,
restaurar en destino nuevo y olvidar un paquete en memoria. Cancelar no revierte un
commit que ya tiene recibo. Olvidar memoria no elimina archivos descargados ni bases.
Un beforeunload ayuda con interacción previa; no rescata cambios en RAM tras crash,
cierre forzado o descarte móvil. Ni una descarga solicitada acredita que se conservó.

**Bloqueo deliberado:** no hay todavía autoridad persistente que identifique qué
fuente/alias sigue vinculada a todos los commits posteriores de una migración.
No es seguro deducirla de la fecha o de cualquiera de los candidatos. Por eso no se
habilita incremental sobre fuentes migradas. Cada transacción incremental vuelve
a comprobar la presencia de fuentes/candidatos: si aparecen después de abrir la
ventana, también se detiene sin sobrescribir el confirmado. Hace falta un contrato de linaje,
readSources inyectado, vigilancia antes/después de escritura, cuarentena y barrera
contra escritores incompatibles. La carrera entre localStorage e IndexedDB no puede
eliminarse con BroadcastChannel/Web Locks. Mantener fuente v1 intacta y ofrecer
reconciliación; nunca seleccionar automáticamente la más reciente.

Rollback no significa abrir la app antigua y esperar que comprenda v2. Conservar
lector compatible de recuperación, exportar ambas ramas, restaurar aparte y pedir
revisión. Volver a v1 descarta representación de hechos v2; no hacerlo silenciosamente.

## 6. Fotografías y propuesta de privacidad (sin aprobar política)

| Alternativa | Consecuencias |
| --- | --- |
| Retirar de la vista | Reversible; bytes permanecen en datos, candidatos y respaldos; no llamarlo borrado |
| Borrar de datos activos | Quitar referencias seleccionadas; borrar blob solo cuando no quedan propietarios. Los originales/archivos previos pueden conservar la foto y debe advertirse |
| Borrar de todas las copias locales gestionadas | Enumerar activos, candidatos, recuperaciones y originales. Requiere decisión explícita de eliminar/redactar originales; ya no son copias intactas. No puede revocar descargas externas |

Recomendación para aprobación: borrado activo inmediato tras confirmación clara,
sin retención indefinida obligatoria; preservar solo ID local/instante/motivo en
la auditoría. Un propietario no autoriza borrar evidencias de otros propietarios
que compartan hash. Una restauración antigua puede reintroducir fotografías y debe
advertirse. Eliminar una entrada IndexedDB no garantiza borrado seguro de sectores
físicos ni del backup del dispositivo. No prometer desaparición de todas las copias.

`photoRemovalReport` cuenta referencias y propietarios, distingue si se podría
retirar el blob activo y advierte revisión de originales/candidatos/descargas. No
borra nada. Una prueba de vault sintético independiente elimina físicamente un blob
solo al retirar su última referencia. **No es implementación de purga histórica**:
el contrato actual de auditoría exige fotos presentes. Tombstones/redacción de
fuentes y lectura de auditoría necesitan propuesta y aprobación antes de ampliar
el esquema. No se cambia ahora retención de fotos, notas, versiones o fuentes.

## 7. Respaldos grandes y compatibilidad

`writeArchive` entrega chunks a un sink con write/close/abort. Solo anuncia complete
tras close; cualquier fallo aborta. Requiere destino provisional y publicación final
por el adaptador de filesystem: no se ha probado un picker/stream de disco nativo.
El camino de descarga Blob recopila referencias a chunks, no una gran cadena base64.
La importación usa slices para fotos y valida todos los metadatos/hashes antes del
commit de destino. No hidrata cada fotografía a dataURL para restaurar.

Siguen los límites: 8 MiB/imagen, 16 MiB/frame, 512 MiB/archivo/paquete de recuperación,
100.000 registros, 10.000 imágenes y 1.000 fuentes; codec JSON mantiene sus presupuestos.
Un archivo incompleto, truncado, corrupto, duplicado o de versión desconocida se
rechaza sin reemplazar el origen. No se amplían límites por conveniencia. El paquete
pendiente grande medido ronda 50,4 MB sin duplicar fotos en el comando.

Los nueve respaldos sintéticos históricos 0.1–0.9 siguen cubiertos; legado permanece
sin captura verificable y adopted-current no se mezcla con progreso recorded. No
hay downgrade con pérdida presentado como respaldo completo. Las extensiones de
esta fase son capacidades/control/artefactos experimentales, no nueva escritura Data2
pública. Los lectores experimentales anteriores no conocen todas las barreras nuevas.

## 8. Paridad funcional: rutas pendientes exactas

| Ruta | Estado y falta antes de conexión pública |
| --- | --- |
| Marcas/notas/fotos/completado/alternativas | Motor, primera captura y cambios posteriores atómicos por alcance probados. Aún sin puerto a los controles React reales |
| Legado y adopción | Semántica/archivo y diario de 4B.2 conservados. Adopción multi-registro sigue en sesión completa; no ruta incremental especializada |
| NoteEditor y carry/upcomingNote | Borradores probados en lab y v1; falta transportar identidad, carry, confirmación y descartes del componente React a v2 |
| Editor de árboles, arrastre/subpasos | saveRoutine puro preparado; falta paridad visual/teclado y actualización por alcance con corpus grande |
| Metas/hitos/revisiones | Se añadió extracción/puerto de toggleMilestone real y regresión. saveGoal/saveProgress/saveDayReview siguen en sesión completa |
| Calendario/horario/recurrencias/dependencias | Funciones reales, límites y excepciones probados. Falta puerto incremental de cambios de planificación y segmentación |
| Fotos asíncronas | Reserva de destino en 4B.2 y foto nueva/compartida/primera foto probadas; falta ciclo completo de inputs/modales React |
| Alternativas y ramas inactivas | Correcciones preservan marcas/notas/fotos; falta UX pública de ramas inactivas y simplificación de reapertura explícita |
| Importación/exportación/modal de recuperación | Laboratorios completos; no sustituyen Ajustes/recuperación públicos ni activan un destino |
| Progreso/accesibilidad | Catálogo verificado/páginas probados; faltan todos los agregados públicos, WCAG completa y tecnologías asistivas/dispositivo real |

La sesión completa anterior no debe conectarse sin más a 5.000 logs: los límites
JSON globales del codec/controlador pueden impedir escrituras de planificación.
La ruta por alcance elimina esa limitación para ejecuciones, no para todas las
operaciones multi-entidad. No se presentan métodos existentes como paridad React.

## 9. Matriz de preparación para 4C

| Requisito | Clasificación | Evidencia / bloqueo |
| --- | --- | --- |
| v1 y BUG-01–04 | Aprobado y verificado | App sin cambios; regresión y Chromium públicos pasan |
| Atomicidad de captura/progreso/revisión/foto | Aprobado y verificado | TX, abort/reintento, primera foto y nueva revisión |
| Rendimiento de ejecuciones | Implementado, pendiente de pruebas adicionales | Mejora medida en Chromium; faltan dispositivos reales y carga sostenida |
| Apertura/memoria/diarios | Implementado, pendiente de pruebas adicionales | Heap retenido medido, no RSS/peak; falta compactación segura y presupuesto intensivo |
| Consultas por alcance/página | Aprobado y verificado | Sin hidratar fotos; referencias comprobadas |
| Paridad funcional React | No implementado | Rutas de la tabla anterior sin conectar |
| Planificación/metas/adopción incremental | No implementado | Sesión completa no escala automáticamente a todos los documentos grandes |
| Migración y pestañas antiguas | No implementado para activación | Falta autoridad/linaje persistente y barrera de escritores; ruta rápida migrada bloqueada |
| Respaldos/recuperación | Implementado, pendiente de pruebas adicionales | Integridad y restore completos; streaming de filesystem, versión desconocida y otros motores pendientes |
| Concurrencia participante/ACK | Aprobado y verificado | CAS, dos páginas, recibos y no sobrescritura de pendientes |
| Cuota/corrupción/versión | Aprobado y verificado en Chromium | Aborts/cuarentena/versionchange; no garantía frente a todo fallo de SO |
| Firefox/WebKit/móvil físico | No implementado/verificado | Binarios bloqueados, dispositivos no disponibles |
| Borrado físico y retención | Bloqueado por decisión de producto | Alternativas y consecuencias de originales/respaldos por aprobar |
| Adopción ambigua/correcciones UX | Bloqueado por decisión de producto | IDs desconocidos y desmarcado de cerradas requieren reglas visibles |
| Activación/migración pública | No implementado, por restricción | Requiere autorización separada; BUG-05 real sigue fallando |

## 10. Intervención mínima y plan de conexión

1. **4B.3b:** contrato de autoridad de fuentes/linaje y barrera de versión, con pruebas
   de v1/alias modificados después de commits nativos y bloqueo persistente. Completar
   puertos por alcance para planificación, metas y adopción con 5.000 logs; no relajar
   el codec global. Es la siguiente intervención técnica mínima recomendada.
2. Resolver con el propietario política de fotos/originales/respaldos y UX de legado;
   diseñar tombstones antes de tocar purga. Conseguir Firefox/WebKit y móviles reales,
   medir memoria pico y latencia sostenida con diarios mayores.
3. Solo tras cerrar la matriz, autorizar 4C por pasos: primero lector en previsualización,
   después controles React con almacenamiento sintético aislado y paridad de cada
   formulario, luego ensayo de migración/recuperación con copias y rollback compatible.
4. Antes de activar: respaldo externo verificado, pendientes resueltos, pruebas reales
   de BUG-05 pasan sobre la integración, concurrencia antigua comprendida y bloqueada,
   presupuesto de capacidad cumplido y aprobación explícita. No desplegar activación
   por el mero hecho de fusionar esta PR.

## Verificación de esta entrega

| Comando/suite | Resultado |
| --- | --- |
| npm run check | Correcto; TypeScript y app.js coinciden, sin escribir archivos |
| npm run check:history-contract | Correcto |
| npm run test:regression | 164 aprobadas |
| npm run test:history-contract | 150 aprobadas, 6 TODO, cero fallos |
| npm test | 314 aprobadas, 6 TODO, un fallo conocido BUG-05; salida 1 |
| history-readiness.cjs | 78 grupos nuevos, más registro explícito de navegadores no disponibles |
| history-readiness-ui.cjs | 70 grupos DOM, cinco paletas/escritorio/móvil |
| history-photo-capacity.cjs | 4 grupos, 379 imágenes reales sintéticas |
| history-storage.cjs | 65 casos de IndexedDB existentes |
| history-integration.cjs | 28 casos existentes |
| history-view.cjs | 120 combinaciones existentes |
| history-legacy.cjs | 186 casos existentes |
| pending-save.cjs | 4 combinaciones públicas sintéticas |
| day-shifts.cjs | 2 viewports públicos sintéticos |

Sin errores JavaScript inesperados. Los laboratorios nuevos interceptan Storage
público; las suites de app pública usan sus propias claves en orígenes/perfiles
desechables. Los siete tests Node nuevos comprueban streaming abortado/completo,
recuperación binaria, referencias de privacidad, Worker cancelado, corrupción,
diagnóstico sin validar y el método real de hitos. No hay dependencias nuevas.

El fallo conocido BUG-05 permanece intacto en tests/known-bugs.test.cjs. Los seis
TODO se mantienen, incluidos integración pública y purga histórica no aprobada.
No se convierten ausencias de navegador o funciones pendientes en pruebas aprobadas.

## Recuperación y cierre de la tarea interrumpida

Se recuperaron la rama local y los 43 archivos de trabajo sin descartar cambios.
Punto de recuperación: commit `aedfacf`. No había procesos de prueba activos al
retomar. Se recuperó completa la última ejecución de comparación: 78 grupos,
posterior al cambio de fuentes/candidatos y al código medido. Sus registros JSON
terminaron correctamente y los módulos relevantes no habían cambiado después.
Se sustituyó el informe anterior de 76 grupos; no se mezclan sus cifras como finales.
La ejecución completa conservada aporta la comparación antes/después; al retomar
se volvieron a ejecutar las comprobaciones generales y las suites afectadas, sin
alterar el motor medido. No se reanuda ni autoriza 4C.

Reverificación tras recuperar: check/check:history-contract correctos; 164 regresiones
y 150 contratos aprobados; npm test conserva 314 aprobados, 6 TODO y únicamente
BUG-05. Protocolo reducido 58 grupos (incluye aparición tardía de fuentes/candidatos),
UI 70, IndexedDB 65, lector 120, integración 28, legado 186, guardado público 4 y
horarios en 2 viewports: aprobados. La comparación completa de 78 grupos y el ensayo
fotográfico de 4 grupos son ejecuciones completas recuperadas, no nuevas mediciones
de rendimiento bajo la carga paralela de la reverificación. Firefox/WebKit no
disponibles y dispositivos físicos no probados se mantienen como limitaciones.
