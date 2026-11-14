# Motor histórico v2 · fase 2

Implementado **fuera de Planner**. Base: `origin/main` `5e1f683` (PR #5).
No hay acceso a DOM, reloj, aleatoriedad, red, `localStorage` ni migración.
`app.tsx`, `app.js`, flujo de carga, importación y exportación públicos siguen iguales.

## Módulos y uso

- `history/json.cjs`: copia JSON segura, comparación canónica y congelación profunda.
- `history/resolution.cjs`: selección por fecha/elección y reparto previsto ponderado,
  independiente de la vista. Las fechas usan el día civil explícito, sin depender de
  la zona horaria de la máquina que ejecuta las pruebas.
- `history/codec.cjs`: validación del modelo y referencias, auditorías, transiciones;
  decode/encode puros v1/v2. Requiere inyectar el validador v1 existente, sin cargar
  React. El arnés de pruebas aporta ese validador desde el JavaScript real.
- `history/engine.cjs` y `.d.cts`: API de revisiones y operaciones con tipos. No existe
  importación de estos módulos desde el HTML o los archivos de producción.
  Son CommonJS: la fase 3 necesitará un adaptador/build para navegador, sin
  introducirlo implícitamente en esta entrega.
- `contracts/history-v2.cjs`: fachada de compatibilidad de los tests de fase 1.

```js
const { createEngine } = require('../history/engine.cjs');
const engine = createEngine(validateLegacy); // función pura, validación v1 actual
const operation = engine.prepare(documentV2, {
  executionId: 'synthetic-execution',
  at: '2030-01-07T12:00:00Z',
  context: { eventId: 'synthetic-event', date: '2030-01-07',
    seriesId: 'synthetic-series', revisionId: 'synthetic-revision' },
  action: { type: 'note', text: 'Synthetic observation' }
});
// operation.after es un candidato; NO se ha guardado ni confirmado nada.
// La fase de integración deberá escribir/leer/verificar ese candidato.
// Solo tras confirmarlo: confirmed = engine.accept(confirmed, operation).
```

`prepare` copia y valida entrada, construye la acción y valida el resultado y la
transición. Devuelve `before/after` profundamente congelados. Ante un error lanza
sin modificar el original. `view`, nota vacía o desmarcado sin ejecución no crean
capturas; continuar/reabrir/cerrar una identidad inexistente es un error.

`createRevision(document, routineId, {revisionId, at})` devuelve documento y referencia;
reutiliza una revisión de la misma rutina y contenido idéntico, independientemente
del orden de propiedades. Cambios reales requieren otro ID. No hay borrado de
revisiones ni de evidencias en esta API. El codec compara estados para impedir
mutaciones de definiciones/capturas; un documento aislado no puede demostrar por sí
solo que una definición nunca fue modificada en otro momento.

## Acciones reales y límites

| Acción | Comportamiento |
| --- | --- |
| `step` | Marca/desmarca explícitamente una unidad aplicable; primer marcado captura |
| `note` | Nota general o de un paso de la revisión; texto no vacío captura |
| `evidence` | Añade imagen una vez por ID; el mismo ID con contenido distinto falla |
| `choice` | Resuelve una elección manual; si cambia una ya registrada exige motivo y correctionId |
| `complete` | Manual sin inventar marcas, o por pasos solo con todas las unidades y decisiones resueltas |
| `close-partial` | Cierra sin completar ni borrar progreso |
| `reopen` | Exige motivo/ID y guarda checkpoint previo antes de volver a activa |
| `continue` | Agrega fecha local y desfase a la misma ejecución, conservando fecha/denominador originales |
| `view` | Lectura sin captura |

Los timestamps/IDs se proporcionan explícitamente: no hay generación durante un
reintento. Debe retenerse **la misma operación preparada** mientras esté pendiente.
`accept` admite solo operaciones de esa instancia, compara documento completo con
`before` o `after`, y rechaza cambios concurrentes. Reaceptar el mismo resultado es
idempotente. Esta protección es local al proceso, **no un bloqueo entre pestañas**
ni un recibo persistido. No reproducir comandos antiguos sobre un estado arbitrario.
Tras reiniciar la app se necesitará el protocolo de recuperación de fase 4.

Para recurrencias y excepciones el adaptador proporciona identidad de serie y fecha;
el motor no divide programaciones ni mueve logs. El adaptador futuro deberá comprobar que
la fecha sea una ocurrencia aplicable y adaptar las revisiones/eventos derivados de
metas; el motor exige un evento explícito y rechaza excepciones canceladas. Para `between` exige intervalo
resuelto y presupuesto; valida su coherencia. Los demás casos admiten intervalo
resuelto o lo derivan de hora/excepción y presupuesto. No se recalculan dependencias
con el horario actual al continuar una captura. El algoritmo de asignación no
modifica minutos ya capturados al registrar progreso ordinario.

Las rutinas eliminadas o editadas no afectan al motor de una ejecución capturada:
solo usa su revisión. La descripción capturada prioriza las instrucciones del evento;
las instrucciones de la rutina permanecen en la definición congelada. Las operaciones
de programación reales y sus pantallas siguen
pendientes de fase 3. Completar por pasos es una acción explícita del motor; la
futura interfaz decidirá cuándo invocarla. `actualTiming` continúa en `null`; el
codec admite información real declarada/medida con procedencia, pero no se añade
un cronómetro ni una acción de registro de duración en esta fase.

## Codec y entradas adversas

Validación de la base v1 por el validador existente y esquema cerrado para el
modelo v2: campos, árboles, identidades, referencias, evidencias, topología según
la fecha congelada, sumas, denominadores, estados y cronología. La asignación
histórica se verifica por coherencia; no se reemplaza con un reparto recalculado.
Los checkpoints reciben validación de referencias/topología igual que la resolución
actual. Las auditorías no admiten bytes de fotos, solo IDs de evidencias presentes.

`validateV2` devuelve errores ante entradas inválidas; `decode` devuelve un resultado
con `ok`, y `encode` lanza si el documento no es válido. No se ejecutan getters ni
`toJSON`. Se rechazan ciclos, arrays dispersos, tipos ajenos a JSON, profundidad
superior a 64, más de 200000 nodos, strings de más de 16 millones de caracteres y
JSON serializado de más de 32 millones de caracteres. Son límites defensivos del
codec aislado, no un presupuesto ni cuota garantizada del navegador. Se rechazan
claves duplicadas en JSON y claves reservadas de diccionarios v2 (`__proto__`,
`constructor`, `prototype`). No se normalizan silenciosamente datos rechazados.
La interfaz futura debe permitir conservar/exportar bytes originales ante límites.

`validateTransition` opera sobre una sola ejecución por acción; una revisión de
plantilla puede compararse aparte. Se rechazan cambios ajenos, eliminación de
hechos heredados, revisiones alteradas, evidencias perdidas y correcciones sin
checkpoint. No es autenticación ni prueba criptográfica de que un respaldo sea real.

## Compatibilidad y decisiones pendientes

El codec hace roundtrip exacto de los nueve respaldos históricos sintéticos 0.1–0.9,
conservando sus hechos. Los registros sin captura permanecen legado. Intentar usar
una acción sobre una clave heredada no la sustituye ni la adopta automáticamente.
La adopción `adopted-current` necesita un flujo específico posterior; no se implementa
conversión de registros antiguos. V2 no relaja el validador público ni escribe claves.

No se cambia el contrato aprobado. Dos límites requieren revisión antes de UI:

1. El checkpoint actual conserva `completed`, marcas, elecciones, notas y resolución,
   pero no todos los timestamps ni el origen de completado anteriores. Las reaperturas
   preservan el hecho previo, sin prometer una auditoría cronológica completa de inicio
   y fin. Propuesta para discutir: ampliar explícitamente el checkpoint con ciclo de
   vida previo si se quiere mostrar ese detalle; no se ha cambiado silenciosamente.
2. La adopción de legado con pasos desaparecidos necesita conservar hechos antiguos
   separados de la nueva revisión. El motor la rechaza por ahora, en lugar de inventar
   referencias verificables. Definir UX y representación antes de implementar adopción.

Faltan integrar captura/lectura/progreso en Planner, accesibilidad y Chromium, y las
barreras de guardado pendiente. Fase 4 seguirá encargándose de migración, cuota real,
conflictos de pestañas y reversión. BUG-05 de la aplicación sigue fallando en su prueba
original hasta integrar y verificar sus rutas reales.

## Integración de fase 3 (sigue fuera de producción)

El [lector, adaptador y laboratorio](HISTORY_V2_VIEWS.md) reutilizan este motor en
el navegador sin APIs Node. Los checkpoints nuevos incorporan `lifecycle?` para
mostrar completado/reapertura; se siguen leyendo los anteriores sin ese campo.
No se implementa todavía adopción ni persistencia v2. La limitación sobre el ciclo
de vida descrita en fase 2 queda resuelta para nuevas correcciones; no se rellena
información que falte en checkpoints ya existentes.

## Puente experimental de fase 4A

[Persistencia e integración](HISTORY_V2_PERSISTENCE.md) añaden preparado/confirmado,
puertos inyectables y un controlador descartable con operaciones reales de Planner.
La última marca y su completado se agrupan en un candidato. Confirmación/reintento,
respaldos completos y recuperación se prueban en Map, no en almacenamiento público.
No hay adopción implícita ni eliminación automática de fotografías/revisiones.
