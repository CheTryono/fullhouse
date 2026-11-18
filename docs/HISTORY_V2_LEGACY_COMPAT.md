# BUG-05 · fase 4B.2: compatibilidad experimental

Base `52dbe4d` (PR #9). No activa v2, IndexedDB ni cambios de Planner público.

## Diseño previo a la extensión

Se añade `logs.*.recordEdits?`, un diario opcional formato 1, más los enlaces
de adopción y la razón explícita detallados abajo.
Los logs sin este campo siguen siendo válidos. El log mantiene su estado editable;
el diario conserva una proyección de los hechos originales y una cadena de cambios
explícitos con ID, instante, motivo, estado anterior y posterior. Las proyecciones
usan IDs de fotos, nunca src ni copias binarias. Las imágenes continúan bajo su
propietario original. Los campos ausentes permanecen ausentes en las proyecciones.
El instante del diario es el momento de edición, no una fecha inventada del pasado.

Las ediciones de legado no crean history ni resolución. Solo se puede actuar sobre
IDs existentes para marcas/notas/alternativas, o escribir una nota general. Añadir
una evidencia a un ID desconocido se rechaza. Nunca se busca por nombre ni se toma
una plantilla actual como denominador. El completado legado sigue siendo manual.

Adopción: exige confirmar fuente, definición actual y fecha nueva. Crea un tramo
independiente, bajo otra clave/serie/ejecución, con `adopted-current` y un enlace
recíproco en el diario del legado. La definición actual queda congelada desde ese
momento, con progreso vacío. La fuente conserva hechos, notas, fotos y su identidad.
Un enlace en captura identifica la clave de origen; no se copian fotos ni marcas.
No otorga crédito verificable retrospectivo. No se adopta automáticamente ni se
admiten segundos tramos de adopción ambiguos. El diálogo muestra ambas fechas y
explica que los IDs coincidentes NO trasladan progreso.

Compatibilidad: lectores nuevos aceptan v2 anterior y v1. Lectores v2 estrictos
anteriores rechazarán campos nuevos: no hay compatibilidad hacia adelante prometida.
Como v2 sigue aislado, se puede introducir esta extensión sin migración pública.
Se validarán los enlaces en documento completo, no como referencias sueltas.

## Política propuesta de fotografías (pendiente de aprobación)

Diferenciar «retirar de la vista» (reversible) de «borrar bytes definitivamente».
Esta fase implementa SOLO retirada/restauración explícitas y auditadas. El diálogo
advierte que conserva los bytes en base y respaldos; no llama a esto borrado final.
No se introduce GC ni retención indefinida obligatoria como regla de producto.

Propuesta antes de producción: borrado confirmado elimina referencia/bytes cuando
no haya otros propietarios; auditoría conserva solo ID, instante y motivo, sin foto.
Copias originales de migración que contienen la foto necesitan una política explícita
(exportación previa, redacción o eliminación voluntaria); no se pueden prometer ambas
cosas a la vez. Archivos ya descargados no pueden revocarse; una restauración antigua
puede volver a introducir fotos, lo que debe advertirse. Definir alcance de borrado,
plazo de recuperación y tratamiento de respaldos con el propietario antes de habilitar
borrado físico. La retirada reversible no resuelve todavía `deleteEvidence` público.

## Contrato implementado y consecuencias

- `recordEdits.original`: proyección exacta de campos presentes, reemplaza `evidences`
  por `evidenceIds`. Su ausencia inicial no se confunde con una fecha pasada conocida.
- `entries[]`: ID, instante explícito, motivo, tipo, before/after y hiddenBefore/After.
  La cadena es acumulativa y termina en los hechos actuales. El almacenamiento impide
  reescribir el original o la parte ya confirmada. Las fotos referenciadas no se pierden.
- `recordEdits.adoption?`: clave/ejecución del tramo nuevo, fecha registrada y revisión
  elegida. `capture.adoption.legacyKey` enlaza recíprocamente el origen. Se validan ambos
  lados y la referencia a la versión inmutable, también en almacenamiento y archivos.
- `captureReason: 'adopt'` expresa la adopción, en lugar de inventar una nota o marca.
  La captura tiene procedencia `adopted-current`. La duración real permanece null.
- `annotate`: acción explícita limitada a nota/evidencia; permite anotar una ejecución
  cerrada sin cambiar su completado. El comando antiguo `note` conserva su precondición
  original en el motor; el adaptador de compatibilidad solicita `annotate` cuando procede.
- Los checkpoints anteriores y todos los v1/v2 sin estas extensiones siguen aceptados.
  Los IDs, claves originales, series de programación y fotos no se normalizan.

La adopción construye un evento efímero con la fecha seleccionada y usa el adaptador
real de horario/dependencias; no guarda ese evento ni modifica la recurrencia original.
Con dependencias, ambas rutinas límite deben existir en la fecha elegida. No se promete
adoptar una programación cuyo intervalo no pueda resolverse sin una decisión del usuario.
Las ejecuciones adoptadas se muestran separadas de las verificadas desde el origen;
no entran en el porcentaje verificado anterior ni trasladan marcas por coincidencia.

El diario permite explicar cambios, pero no demuestra autenticidad histórica de un
respaldo arbitrario. Conserva notas anteriores, lo que también exige comunicar retención
y privacidad. Puede crecer por cada edición: aún no hay compactación ni presupuesto
final de años de auditoría; no se recorta silenciosamente al alcanzar límites.

## Componentes y confirmación

`record-journal.cjs` valida/proyecta el diario sin DOM ni almacenamiento.
`legacy-compat.cjs` prepara ediciones, adopción y operaciones nativas.
`compat-session.cjs` conecta candidatos con el IndexedDB inyectado de 4B.1:
solo tras commit y verificación cambia el confirmado. Cuota o lectura posterior
fallida conservan candidato, ID, último confirmado y borradores. Reintento reconoce
el recibo durable sin duplicar ejecución ni evidencia; operación obsoleta queda
pendiente para exportar/reconciliar, nunca se aplica sobre una cabeza nueva.

La foto reserva destino y comando ANTES del await. Cambiar selección o fecha de
consulta no la redirige. Ediciones concurrentes locales quedan bloqueadas durante
el procesamiento; cambios desde otra pestaña son rechazados por CAS al persistir.
Si FileReader/canvas falla antes de producir bytes, se informa y hay que volver a
seleccionar el archivo; no se promete conservar un File no persistido.

Paquete de recuperación explícito: confirmado, cabeza esperada, candidato y
borradores. Descargar no demuestra que el archivo se haya conservado. Tras recargar,
se abre la base confirmada y se importa manualmente el paquete; requiere que la
cabeza siga coincidiendo. Si se perdió solo el ACK y el documento e ID coinciden
exactamente con el confirmado, reconoce ese recibo sin volver a escribir. En los
demás casos, reintentar sigue siendo otra acción explícita. El aviso
beforeunload cubre pendientes, borradores y procesamiento, condicionado al navegador;
no protege frente a crash, cierre forzado o descarte del proceso móvil. No se escribe
un borrador automáticamente en almacenamiento público ni se promete recuperar memoria.

El laboratorio `/compat` ofrece formularios DOM, diálogo modal propio, archivo/foto
real, confirmación de adopción/retirada, temas de Fullhouse y navegación por teclado.
Solo bases `fullhouse-lab-*`; Pages mantiene su lista de recursos públicos sin cambios.
No existe selector de activación ni importación desde `app.tsx`.

## Inventario de rutas inspeccionadas

| Ruta pública / experiencia | Preparación comprobada | Diferencia o pendiente |
| --- | --- | --- |
| toggleStep / pasos y subpasos | Marca/desmarca IDs antiguos conocidos; nativo usa revisión congelada y última unidad completa atómicamente | Legado sin denominador NO auto-completa usando plantilla actual; requiere completado manual/adopción |
| toggleEvent / completar-reabrir | Completado manual legado; reapertura nativa con checkpoint/motivo | Desmarcar nativo ya completo requiere reapertura explícita antes; simplificar UX sin perder auditoría sigue pendiente |
| saveOccurrenceNote / NoteEditor | Trim de texto, notas generales y por ID desaparecido; diario conserva anterior | No se ha conectado el componente React ni carry/upcomingNote a este laboratorio |
| saveEvidence / FileReader-Image-canvas | Foto real comprimida JPEG .66/1100 px, límites 12 MiB/600000 caracteres, destino reservado y candidato reintentable | No reintento del archivo de entrada si falla antes de conversión; volver a seleccionar |
| deleteEvidence / confirmación | Retirada y restauración reversibles con texto explícito | **Borrado físico público NO equivalente aún**; política pendiente del propietario |
| selectVariant / alternativas | Corrección de tokens heredados explícitos sin inferir correspondencias; nativo usa revisión y checkpoint | No borra marcas como hace v1; UI futura distingue ramas inactivas. No crear decisiones de pasos desconocidos |
| saveRoutine / formulario | Método real extraído; plantilla nueva no reinterpreta capturas ni borra logs | Editor completo de árbol React y arrastre aún requieren conexión futura |
| saveEvent / fechas y recurrencias | Método real y validación de nuevos conflictos; conserva logs/versiones; formulario de hora/repetición | Prueba existente cubre excepciones/divisiones; editor avanzado visual no replicado íntegramente |
| shiftEvent / horario/dependencias | Método real con BUG-04 y validación de cadena; rechaza programación inválida sin escribir | No introduce cruce de medianoche |
| deleteRoutine/deleteEvent | Métodos reales, conservación del archivo y definiciones; consulta huérfanos | No eliminación física de historial por borrar plantilla |
| saveGoal / revisión recurrente | Método real y formulario; revisión semanal derivada, referencias históricas congeladas | No reconstruye etiqueta de meta eliminada desconocida |
| saveProgress / numérica-cualitativa | Método real y estado de formulario inyectado; historial preservado | Laboratorio visual numérico; controles cualitativos/hitos React no replicados por completo |
| saveDayReview | Método real con borrador e historial independiente | Actualmente sigue la semántica de fecha de hoy del controlador, no la fecha consultada |
| Importación/exportación | Codec/archivo completo conserva diario, enlaces y fotos; importación inválida no escribe | Paquete de recuperación solo sobre cabeza igual; no fusión automática ni controles públicos nuevos |
| Formularios, modales y pendientes | Contenidos retenidos, confirmaciones cancelables, descarga/reanudación y aviso de salida | UI de conflictos/rollback final pendiente; borradores grandes sujetos al codec actual |

Las funciones de Planner se extraen por AST en `scripts/planner-actions.cjs`, sin
constructor/load/save público. El controlador descartable intercepta save y aplica
la candidatura solo mediante la sesión. Los métodos no se dan por probados solo por
existir: hay comparaciones de acciones equivalentes y pruebas DOM con IndexedDB.
No se ha demostrado equivalencia de CADA control React público: esa limitación es
un bloqueo explícito de activación y debe conservarse en la revisión.

## Riesgos para 4B.3 y condiciones para 4C

1. Aprobar borrado físico/retención, fotos compartidas y fuentes/respaldos con fotos;
   el prototipo reversible no satisface aún la eliminación pública definitiva.
2. Resolver UX de legado sin IDs suficientes: explicar límites, permitir consulta,
   nota general y adopción voluntaria; nunca fabricar correspondencias. Definir si se
   ofrecerá registrar un ID nuevo opaco y cómo se distinguirá del pasado.
3. Validar modales/formularios React completos, carry de notas, hitos, editor de árbol,
   alternativas inactivas y referencias al editar metas. Ampliar pruebas de accesibilidad.
4. Optimizar diario/preparación/verificación y memoria, medir años de edición y fotos
   en móviles reales, Safari/Firefox, cuotas y evicción. El coste completo de 4B.1
   sigue sin resolverse. No declarar capacidad ilimitada ni latencia lista para usuarios.
5. Recuperación de conflictos, pestañas antiguas, fuentes divergentes, versiones
   incompatibles y rollback: no seleccionar por fecha, no volver a v1 silenciosamente.
6. Antes de 4C: todos los bloqueos funcionales resueltos, BUG-05 real pasa en Planner,
   copias externas/restauración completas verificadas, pruebas de fallos y rendimiento,
   contrato y política de privacidad revisados, pendientes exportables, exclusión del
   laboratorio del despliegue y autorización separada del propietario. Nada se activa
   automáticamente como consecuencia de fusionar esta fase.

## Verificación realizada

| Comando / suite | Resultado |
| --- | --- |
| `npm run check` | Correcto; TypeScript y app.js coinciden, sin reescritura |
| `npm run check:history-contract` | Correcto; incluye tipos de compatibilidad/sesión |
| `npm run test:regression` | 164 aprobadas |
| `npm run test:history-contract` | 143 aprobadas, 6 TODO, cero fallos |
| `npm test` | 307 aprobadas, 6 TODO y único fallo conocido BUG-05; salida 1 |
| Chromium `history-legacy.cjs` | 186 casos; cinco paletas × 1280/390 px |
| Chromium `history-storage.cjs` | 65 casos, IndexedDB real y carga sintética grande |
| Chromium `history-integration.cjs` | 28 casos anteriores |
| Chromium `history-view.cjs` | 120 combinaciones del lector |
| Chromium `pending-save.cjs` | 4 combinaciones: cuota/acceso denegado × escritorio/móvil |
| Chromium `day-shifts.cjs` | 2 viewports, límites/dependencias y guardado pendiente |

21 tests Node nuevos aprobados y un TODO nuevo de borrado físico. Los cinco TODO
anteriores de integración/activación pública permanecen sin fingir que han pasado.
Las pruebas comprueban inmutabilidad, diarios malformados, adopción rechazada/cancelada,
fecha nueva, conservación tras borrar plantillas, roundtrip completo con bytes,
notas en ejecución completa, paridad de acciones equivalentes, metas numéricas y
cualitativas, revisiones, cuota/readback, paquetes de recuperación, fallo de construcción
y destino asíncrono reservado. Chromium prueba además archivos reales procesados por
FileReader/canvas, dos pestañas obsoletas, recuperación tras recarga, ACK perdido,
restauración completa, importación inválida, cancelación/modal/teclado y no desbordamiento.

No se detectaron errores JavaScript inesperados en esas suites. Storage público se
intercepta como error en laboratorios nuevos. Las suites públicas usan exclusivamente
perfiles/orígenes desechables y datos sintéticos. Chromium con viewport móvil no
sustituye pruebas de dispositivo real ni una auditoría WCAG completa.

Recuperación JSON experimental tiene presupuesto de 32 millones de caracteres y
los límites de complejidad de json.cjs; exportar rechaza paquetes que su recuperación
no podría copiar. Para cargas mayores debe diseñarse paquete binario con candidato
y borradores en 4B.3; no se degrada ni descarta el pendiente para hacer espacio.
