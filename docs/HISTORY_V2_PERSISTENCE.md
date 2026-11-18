# BUG-05 fase 4A · integración y persistencia simuladas

Base `origin/main` **4324abc**, después de PR #7. Todo lo descrito como implementado
funciona en módulos aislados y un Map inyectado. **No hay adaptador a Storage real,
activación pública, migración de usuarios ni importación nueva en Planner.**

## Arquitectura y vínculo con operaciones reales

`history/integration.cjs` mantiene confirmado, candidato pendiente, borradores y
recuperación. Usa motor/lector/codec previos, `history/persistence.cjs` y puertos de
almacenamiento/exclusión obligatorios. No genera IDs ni tiempos al reintentar.

`scripts/planner-actions.cjs` extrae por AST estos métodos reales de app.tsx:
saveRoutine, saveEvent, shiftEvent, deleteRoutine, deleteEvent y sus auxiliares.
Se ejecutan sobre un controlador descartable con datos copiados, IDs reservados,
fecha explícita, confirmación inyectada y un sink save que solo produce el candidato.
No se ejecuta constructor, load, save público ni preferencias. El extractor rechaza
dependencias de DOM/red/Storage; cambios de fuente se verifican en pruebas.

| Ruta | Preparación 4A | Límite antes de uso público |
| --- | --- | --- |
| Crear/editar rutina o actividad | Métodos reales, limpieza JSON igual al save v1, validación v2 | Los formularios nuevos usan id vacío e IDs reservados; ningún selector público |
| Primera marca, nota, foto, elección o completado | Motor real vía adaptador; copia captura + hechos juntos | Compresión de FileReader/Canvas y ciclo de formularios públicos pendientes |
| Última marca | Marca + completado automático por unidades se agrupan en un candidato | Desmarcar cerrada exige reapertura explícita |
| Alternativas por día/manuales | Motor y revisión congelada; corregir requiere motivo/ID | UI pública de corrección pendiente |
| Recurrencia, excepción, reprogramación y dependencia | Métodos reales y funciones de intervalos; conserva serie al dividir | No se mueven logs ni hechos por cambiar programación |
| Cierre parcial, reapertura, continuación | Operaciones confirmables del motor | Misma ejecución/día original, sin crédito duplicado |
| Modificar/eliminar plantilla | Programación cambia, revisiones/logs permanecen | No se limpia automáticamente evidencia ni definiciones |
| Progreso y consulta | Lector sobre último documento confirmado | No se muestran pendientes como completados guardados |

La nueva política de planificación conserva exactamente `logs` y `recipeRevisions`
del documento anterior. Reprogramar no remapea ni duplica claves de hechos, aunque
el método v1 lo haga con logs futuros. Las decisiones UX pendientes se detallan abajo.
Se valida con schedulePreview real antes de persistir para no introducir intervalos
inválidos ni dependientes imposibles en sus fechas comprobadas. Ese preview examina
hasta ocho ocurrencias/370 días: **no demuestra validez de una recurrencia infinita**.
Ampliar la estrategia de fechas afectadas/excepciones es una puerta previa a activar.

## Protocolo de dos ranuras (implementado solo en simulación)

| Clave conceptual | Contenido |
| --- | --- |
| botanica-planificador-v01 | Alias usado por load v1; su presencia bloquea el protocolo hasta revisión explícita |
| fullhouse-v01 | Fuente anterior; el repositorio nunca la escribe ni elimina |
| fullhouse-v02 | Ranura A: un documento v2 completo |
| fullhouse-v02-slot-b | Ranura B: otro documento v2 completo |
| fullhouse-v02-manifest | Puntero confirmado con protocolo, versión, generación, ID, ranura, hashes SHA-256 de documento/fuente/anterior y checksum de metadatos |
| fullhouse-v02-intent | Intento: manifiesto base y manifiesto candidato; no otra copia de fotografías |

La revisión de load confirmó el fallback histórico a botanica-planificador-v01.
El protocolo no lo convierte ni elige entre alias y v01: si existe, se detiene y
conserva ambos originales. Resolver esa compatibilidad sin borrar datos es requisito 4B.

La ranura activa la decide el manifiesto íntegro, no el nombre de archivo ni un reloj.
La primera confirmación (generación 1) sería la activación de este protocolo. Su
implementación no equivale a habilitarlo en la app. SHA-256 se calcula sobre unidades UTF-16LE exactas, sin normalización ni pérdida de
surrogates aislados. Los hashes detectan alteraciones;
no autentican un respaldo contra alguien capaz de cambiar datos y manifiesto.

1. **Abrir bajo exclusión:** leer claves sin modificarlas. Validar v1 como v1 y
   documentos v2 como v2. Verificar hash de fuente y ranura activa/anterior. Un
   intento existente, metadatos incompatibles, versión desconocida, copia sin
   manifiesto o divergencia llevan a recuperación, nunca ejemplos ni fallback v1.
2. **Preparar:** token opaco del estado leído, ID reservado, documento validado y
   serializado, hash y generación siguiente. El candidato es inmutable. Una
   inicialización con fuente v1 presente debe preservar todos sus hechos exactamente;
   no se permite inicializar con un documento distinto y ocultar esa pérdida.
3. **Escribir bajo la misma exclusión:** volver a comprobar manifiesto/fuente. Un
   token obsoleto no gana a otra pestaña. Registrar/verificar intento; escribir la
   ranura inactiva; leer y comparar bytes. La última activa sigue intacta.
4. **Publicar puntero:** volver a comprobar candidato, fuente, manifiesto base e
   intento. Escribir/leer manifiesto nuevo y validar hash/documento. Borrar solo el
   intento, verificar cierre y ambas ranuras. Solo entonces actualizar confirmado
   en memoria y quitar pendiente. No borrar datos para hacer sitio.
5. **Reintentar:** reutilizar exactamente la misma operación. Si ya se publicó ese
   manifiesto, verificar/terminar en vez de duplicar capturas o IDs. Un ACK perdido
   tras limpiar intento puede verificarse sin repetir la acción de negocio.

Una escritura de ranura se asume atómica por el puerto (como setItem), pero **no hay
transacción atómica entre claves**. El intento y las dos copias hacen visible la
interrupción; no la ocultan. Un cierre antes de escribir el candidato puede dejar
solo la copia pendiente en memoria: se mantiene el aviso/exportación, no se promete
recuperación durable de algo que el almacenamiento rechazó.

## Concurrencia, pestañas antiguas y divergencias

El puerto lock.exclusive es obligatorio; todas las pestañas compatibles deben usar
el mismo dominio de exclusión. El laboratorio usa una cola compartida entre clientes.
No se ha implementado ni asumido un adaptador real de Web Locks, BroadcastChannel
o eventos Storage. Sin un puerto de exclusión probado no se puede activar el escritor.

Se vuelve a comparar generación/manifiesto y hash de bytes v1 al abrir y escribir.
Un cambio v1, incluso de formato sin alterar el significado, causa conflicto
conservador. No se fusiona ni se selecciona la copia más reciente. Un cliente
obsoleto conserva su candidato y debe exportarlo y revisar el estado confirmado.

Ninguno de estos mecanismos demuestra ausencia de pestañas antiguas. Un escritor
v1 solo toca su clave, por lo que no sustituye v2, pero puede generar otra rama.
Un cambio justo después de la última comprobación se detectará en la siguiente
lectura/operación: no hay atomicidad entre v1 y v2. Un escritor v2 no cooperativo o
un puerto sin exclusión puede violar las garantías; no se promete protección frente
a código arbitrario escribiendo directamente esas claves. Coordinar capacidades,
recargas y política de conflicto antes del despliegue.

## Interrupción, recuperación y reversión

- Antes del intento: disco sin cambios; el candidato vivo sigue exportable.
- Intento sin candidato íntegro: parar y exportar originales/copia en memoria. No
  sobrescribir el último confirmado, limpiar journal automáticamente ni inventar notas.
- Candidato verificado antes/después del manifiesto: abrir en recuperación. Solo la
  acción explícita recover valida cadena, fuente, hashes y datos para terminarlo.
- Después de limpieza efectiva con ACK perdido: manifiesto íntegro y sin intento
  representa un commit válido; el reintento del mismo candidato solo lo confirma.
- Fuente divergente/corrupta o metadatos incongruentes: exportar ambas ramas/bytes
  y bloquear. No existe un botón de «elegir la más nueva».

`exportRecovery` incluye confirmado, candidato, borradores no enviados, bytes leídos
por clave y errores de lectura. Es un **paquete de recuperación**, no un respaldo
ordinario v2 ni una afirmación de que los borradores se guardaron. readRecovery lo
valida; restaurar en el laboratorio crea un destino simulado vacío elegido de forma
explícita. Nunca reinyecta ciegamente sus claves en un almacenamiento existente.

La resolución manual de un intento irrecuperable y el rollback sobre un origen real
siguen pendientes. Propuesta 4B: exportar ambas ranuras + v1, validar una copia elegida
por el usuario y confirmarla como una nueva operación/generación, sin rebobinar
metadatos ni descartar la rama reciente sin advertencia. Volver a un binario v1 no
es un rollback transparente de v2. Conservar las copias externas hasta verificación.

## Respaldos y compatibilidad

`history/backups.cjs` ofrece readBackup, exportV2, prepareLegacyDocument, readRecovery
y footprint, sin I/O. V1 y v2 se leen con el codec real; exportV2 exige v2 completo,
incluyendo definiciones, notas, auditorías, fotos y referencias. No exporta un v1
con pérdida llamado «completo». Se evita producir archivos mayores que el límite
de lectura del codec (32 millones de caracteres); JSON duplicado no se acepta.

prepareLegacyDocument es una propuesta **explícita en memoria**, utilizada solo por
tests/laboratorio. Cambia versión y agrega el diccionario vacío de revisiones;
conserva los hechos originales, sin capturas ni inferencias. Si hay extensiones
incompatibles, por ejemplo history en un log o recipeRevisions en la raíz v1, se rechaza la propuesta
conservando el original. Se prueban los nueve respaldos sintéticos exportados por
las versiones reales 0.1–0.9. No se ha migrado ni importado ningún archivo personal.

La importación experimental de v2 pide confirmación explícita y pasa por el mismo
candidato/guardado; inválidos no tocan disco. V1 se devuelve para revisión, sin
reemplazar ni convertir automáticamente. Los controles públicos siguen intactos.

## Legado: incompatibilidades que bloquean activación

| Acción disponible hoy en v1 | Situación experimental sobre un log legado | Resolución necesaria |
| --- | --- | --- |
| Alias botanica-planificador-v01 presente | Se bloquea todo el escritor experimental, incluso si v01 también existe | Reconciliar origen y respaldos explícitamente, sin borrar el alias por defecto |
| Marcar/desmarcar pasos o completar | Motor rechaza sustituir una clave con legado | Ruta compatible de edición de hechos o adopción explícita |
| Guardar notas generales/de paso | No se captura automáticamente sobre legado | Conservar editor legado y diferenciar hechos nuevos |
| Añadir/quitar fotos | Añadir sobre legado bloqueado; eliminación no existe en motor v2 | Diseñar propiedad, referencias y eliminación explícita/archivo sin pérdida |
| Cambiar alternativa | Bloqueado sobre legado; en nativas exige corrección con motivo | Explicar hechos previos y rama nueva sin borrado de marcas |
| Reabrir o continuar | Legado no tiene identidad/ciclo verificable | Adopción con procedencia e identidad del tramo nuevo |
| Reprogramar con notas futuras | Puente conserva claves originales en vez de mover hechos | Confirmar traslado/enlace explícito sin inventar historia |
| Editar notas o pasos de una nativa cerrada | Requiere reapertura, a diferencia de v1 | UX clara para reapertura/corrección |
| Eliminar evidencias nativas | No hay API de eliminación todavía | Decidir archivo/tombstone y referencias de auditoría |
| Revisiones diarias, saveGoal/saveProgress y formularios completos | No conectados al nuevo escritor | Mapear todas las rutas antes de reemplazar save público |

**No activar mientras estas rutas generen regresiones funcionales.** Propuesta UX:
consultar hechos heredados siempre; ofrecer seguir editando hechos como legado o
«continuar con definición actual» con confirmación. Conservar los hechos previos en
un archivo inmutable separado del tramo nuevo, fotos con propietario único y solo
IDs de referencia, procedencia adopted-current, sin emparejar pasos por nombre.
Esto necesita ampliar el esquema; aquí solo se propone, no se implementa. Aprobar
primero propiedad de fotos, estadísticas mixtas, deshacer adopción y respaldo completo.

## Capacidad medida con datos sintéticos

`node scripts/measure-history-storage.cjs`. Bytes estimados como UTF-16 (no una cuota
portable). Excluye claves/manifiestos/otros ajustes del origen. Fuente v1 en la última
columna se supone del mismo tamaño que el documento, no es una migración medida.

| Modelo | Documento | Dos ranuras | V1 similar + ranuras |
| --- | ---: | ---: | ---: |
| 1 ejecución, 1 revisión | 3.484 B | 6.968 B | 10.452 B |
| 2.000 ejecuciones, 1 revisión | 4.167.186 B | 8.334.372 B | 12.501.558 B |
| 2.000 ejecuciones, 500 revisiones | 4.436.160 B | 8.872.320 B | 13.308.480 B |
| 1.000 ejecuciones, 50 revisiones, 1 JPEG por ejecución | 5.938.258 B | 11.876.516 B | 17.814.774 B |

El JPEG es un patrón sintético 256×256 generado por canvas con calidad .66, de solo
1.783 caracteres: no representa el peso típico de una fotografía. El límite actual
público permite hasta 600.000 caracteres por foto; las imágenes reales pueden dominar
mucho más. Exportar recuperación duplica temporalmente documentos en el archivo y
memoria para conservar ambas ramas; dentro de cada documento no se duplican fotos
en capturas ni auditorías. Se prueba cuota durante esa duplicación sin limpiar nada.

La validación medida tardó aproximadamente 3–414 ms en estos modelos del entorno;
no es una garantía de rendimiento móvil y un commit valida varias veces. El codec
mantiene límites defensivos de profundidad/nodos; miles adicionales pueden excederlos.
No truncar ni bajar controles para hacerlo pasar. Una migración que no quepa debe
abortar y conservar el flujo v1 y respaldos, sin prometer recuperación de nuevas
escrituras que no fueron aceptadas. No se estima capacidad restante con certeza.

Evaluar IndexedDB antes de activar si el objetivo requiere muchas fotos o años de
registros: blobs binarios, IDs únicos y transacciones para metadatos/referencias.
Conviene estudiar mover el documento también para evitar atomicidad entre stores.
No se introduce esa migración ni limpieza/deduplicación automática en 4A.

## Plan 4B y condiciones previas a activación

1. Resolver/aprobar esquema y UX de legado/adopción, eliminación explícita y rutas
   cerradas; mantener todas las acciones existentes o una alternativa comprensible.
2. Fijar capacidad objetivo, portabilidad/cuota y rendimiento móvil. Decidir IndexedDB
   o límites de un protocolo localStorage; no activar con presupuestos incompatibles.
3. Construir y probar puertos reales de almacenamiento/exclusión en un origen de
   previsualización separado, con perfiles sintéticos y fallo/interrupción por paso.
4. Mapear todas las acciones/borradores de Planner y fotos asíncronas al puente;
   pruebas de igualdad v1 por defecto y de retorno inequívoco tras confirmar.
5. Ampliar validación de fechas afectadas/dependencias y revisiones; probar coexistencia
   de versiones, paquetes grandes, importación, rollback y recuperación manual.
6. Revisar manifiesto/capacidades, avisos de pestañas antiguas y respaldo externo
   verificado. Resolver divergencias explícitamente; no seleccionar por timestamp.
7. Revisión independiente y autorización del propietario antes de desplegar cualquier
   activación/migración. BUG-05 público sigue conocido hasta comprobar sus rutas reales.

Los puertos nativos, migración real, selección manual de copias y conexión pública
no están implementados. Esta entrega prepara y prueba el mecanismo, no los declara
resueltos mediante simulación.
