# BUG-05 fase 3 · lector, adaptador y vistas aisladas

Base: `origin/main` `31f2ae3` (PR #6). No se activa v2 en Planner.
Las vistas son una integración preparatoria real del motor/lector con interfaces
**de laboratorio**, no una modificación de las pantallas públicas. La publicación
Pages existente copia solo index.html, app.js, styles.css, logo y vendor: no incluye
este laboratorio, los módulos ni el servidor de pruebas. No se añade ningún enlace
experimental ni opción de activación en la aplicación pública.

## Arquitectura

- `history/reader.cjs` y tipos `.d.cts`: lectura central e inmutable por clave de log,
  índice completo, timeline por fecha y progreso. Devuelve DTOs discriminados:
  `historical`, `legacy`, `estimated`, `incomplete` y `missing`.
- `history/adapter.cjs` y tipos: identidad/contexto de captura y programación. Usa
  `occurs` y `eventFrame` de producción para recurrencias, excepciones, dependencias
  encadenadas y final a 24:00. Una ocurrencia cancelada o sin intervalo no se captura.
- `scripts/history-browser.cjs`: empaqueta los módulos CommonJS existentes y extrae
  por AST de TypeScript funciones puras específicas de app.tsx y DAYS. No copia ni
  ejecuta Planner/load/save ni utiliza Node en el navegador. Una prueba VM sin APIs
  Node comprueba el bundle. Los tests de adaptador también ejecutan un evento de
  revisión producido realmente por saveGoal sobre almacenamiento sintético del arnés.
- `scripts/serve-history-lab.cjs`: servidor efímero solo en 127.0.0.1, recursos en
  lista permitida y CSP sin red externa. El bundle se construye en memoria; no hay
  artefacto público nuevo ni dependencia añadida.
- `tests/history-lab/`: escenarios sintéticos y vistas DOM con las cinco paletas
  reales de styles.css. Se inyectan motor, codec, programación y lector reales.

## Lectura histórica y superficies

`reader.read(doc, key)` valida captura, definición y referencias necesarias del
registro. No necesita un evento ni plantilla vivos. El árbol se reconstruye de la
revisión y resolución guardadas; los minutos no se recalculan. Devuelve títulos e
instrucciones originales, decisiones elegidas/pendientes, minutos fijos/flexibles,
progreso, notas, metas, ciclo de vida y continuaciones. Las evidencias viven una vez
en `facts.evidences`; árbol y auditorías contienen IDs. El índice encuentra huérfanos.

Una referencia faltante devuelve `incomplete` con aviso de recuperación y los hechos
conservables, sin fallback a la plantilla actual, incluso pidiendo estimación.
Las identidades duplicadas no se contabilizan como verificadas. El código no escribe
ni repara datos. Ante un documento totalmente ilegible se necesita el flujo de
recuperación de fase 4, no un sembrado de ejemplos.

Las vistas preparadas son:

- **Mi día:** árbol, progreso parcial, pendientes, notas y galería.
- **Horario/Calendario:** programa actual y ejecuciones históricas diferenciados;
  captura por fecha/serie sustituye su entrada de programación, sin duplicación por
  aparecer en el archivo. Una continuación se muestra etiquetada en su nueva fecha,
  preservando fecha original y sin volver a otorgar crédito.
- **Detalle de actividad/rutina:** contexto congelado, definición, marcas de ramas
  inactivas, notas, fotos enlazadas y auditoría desplegable, aunque se eliminen fuentes.
- **Archivo:** índice de todos los logs, incluidos legado, huérfanos e incompletos.
- **Progreso:** pasos de denominador congelado, actividades completas/capturadas y
  completas/programadas actualmente como métricas separadas. Los denominadores aún
  pendientes se declaran desconocidos. Legado/estimaciones no se mezclan con porcentajes
  verificados. La programación actual puede variar; el porcentaje verificable no.

Las pantallas del laboratorio son de consulta: los escenarios se construyen con
acciones reales del motor antes de renderizar. No hay formularios conectados al
escritor público. La integración y activación de estas superficies en Planner queda
condicionada al lector/escritor v2 y recuperación de fase 4. No se sustituye el CSS
ni la experiencia de la app pública en esta entrega.

## Legado y propuesta de adopción (sin implementar)

Por defecto se muestran hechos e IDs originales con «Registro heredado · contexto
 desconocido». La reconstrucción solo se solicita mediante una casilla explícita;
se etiqueta «Reconstrucción estimada · plantilla actual» y no genera captura, marcas
nuevas ni estadísticas verificadas. Si la definición ya no permite estimar, se
conserva el registro heredado; no se busca otro paso por título.

Continuar legado requiere una ampliación explícita aún no aplicada al esquema:
propuesta de un archivo inmutable de hechos originales, conservando propietario
único de fotos y referencias desde la ejecución nueva con `adopted-current`.
Separar IDs/denominadores del tramo nuevo de marcas antiguas, sin reutilizar pasos
por similitud. La UX deberá mostrar hechos anteriores y captura posterior separados,
confirmar qué definición actual se adopta y explicar el crédito de progreso.

Riesgos antes de implementarlo: relaciones/propiedad de evidencias, exportación
completa, espacio, cancelación y rollback. No insertar hoy campos improvisados en
el documento ni asociar marcas antiguas a pasos actuales. El motor sigue rechazando
sobrescribir una clave heredada. El laboratorio explica esta limitación, sin botón
de conversión ni operación de adopción silenciosa.

## Ampliación mínima de auditoría implementada

`ProgressCheckpoint.lifecycle?` copia únicamente el estado ya conocido antes de la
corrección: status, completionSource, lastRecordedAt, completedRecordedAt.
Esto permite mostrar cuándo se completó, cuándo se reabrió (correction.recordedAt),
estado anterior y origen del completado. Las elecciones cambiadas se obtienen del
checkpoint y el siguiente checkpoint/estado actual. Marcas, notas y IDs de fotos
previos ya estaban conservados; no se duplican imágenes.

- Es opcional para leer checkpoints de fase 2 sin alterar sus bytes.
- Las nuevas correcciones del motor lo incluyen; se valida coherencia y cronología.
- Si falta, la UI dice «fecha/metadatos desconocidos». No se deduce de capturedAt ni
  del instante de reapertura. No se reescribe ni backfillea el documento leído.
- El codec nuevo lee v2 anteriores y v1. El codec estricto de fase 2 puede rechazar
  esta extensión nueva: no se promete lectura hacia adelante en lectores antiguos.
  Antes de activar v2 hay que desplegar el lector compatible y resolver pestañas
  antiguas según el protocolo de fase 4. Ningún usuario público usa v2 todavía.

## Uso y verificación

```sh
node scripts/serve-history-lab.cjs
# Abrir la URL loopback que imprime; Ctrl+C para cerrar.
NODE_PATH=/workspace/.fullhouse-tools/node_modules node tests/browser/history-view.cjs
```

Las doce fixtures incluyen plantilla editada, duraciones/alternativas modificadas,
eliminación, parcial, alternativa pendiente, continuidad, reapertura/corrección,
legado, estadísticas, serie dividida con excepción, revisión de meta y referencia
faltante. Chromium prueba cada una en escritorio/móvil y cinco paletas, con lecturas
/escrituras de Storage interceptadas como error y perfiles desechables. Opcional:
`FULLHOUSE_HISTORY_SCREENSHOTS=/tmp/fullhouse-history-view` guarda capturas sintéticas.
No son pruebas en dispositivo iOS/Android real ni auditoría completa de accesibilidad.

## Pendientes de fase 4

Confirmación atómica de captura/progreso con BUG-01, importación/exportación pública
v1/v2, espacio/cuotas y fotos, claves v01/v02, concurrencia/pestañas antiguas, lectura
fallida y recuperación/reversión. Validar el protocolo antes de activar cualquier
escritor v2. BUG-05 público sigue explícitamente fallido mientras use plantillas v1.

## Laboratorio de integración 4A

La ruta loopback `/integration` del mismo servidor añade formularios/acciones
experimentales y fallos de un Map inyectado. Usa el lector exclusivamente sobre
confirmado; muestra pendiente/recuperación aparte. Véase el [protocolo y límites](HISTORY_V2_PERSISTENCE.md).
El laboratorio de lectura y sus 120 combinaciones siguen cubiertos por separado.
