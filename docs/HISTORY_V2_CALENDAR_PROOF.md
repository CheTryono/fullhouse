# BUG-05 · B.3a: contrato del motor de demostración de calendario

Base 33bd80a, PR #14. Rama feature/history-calendar-proof-v2. Tres checkpoints:
investigación/contrato, motor, validación/documentación. Producción sigue en v1.
No se implementan saveEvent, shiftEvent ni deleteEvent incrementales.

## Inventario de semántica real

- parseDay: `new Date(y,m-1,d)` a medianoche **local**. Años 00–99 remapean a
  1900–1999; días locales pueden normalizarse por zona. No es una fecha UTC abstracta.
- occurs: compara strings date/endDate inclusivos; override.skip vence todas las reglas.
  occasion + none + endDate ocupa todos los días del intervalo. none es puntual;
  dates incluye siempre date además de specificDates. applyFrom NO interviene.
- daily, weekdays (lunes–viernes), weekly (weekday del origen), custom (repeatDays).
  monthly coincide con el número de día, sin ajustar 31 al final de meses cortos;
  yearly coincide mes/día del origen, incluyendo 29 de febrero solo cuando existe.
- every usa `round((localMidnight-localOrigin)/86400000) % max(1,everyDays||1)`.
  No es correcto reemplazarlo universalmente por diferencia de fechas UTC: DST,
  cambios de línea de fecha y valores fraccionarios requieren análisis separado.
- activeStep: selected filtra weekday; modo ausente se infiere por variantes, pero
  la rama de días base comprueba mode explícito. La primera variante de weekday gana.
  Manual desconocida/no resuelta usa la base en planificación. Hijos y variante
  seleccionada determinan mínimos, flexibilidad, peso, metas y evidencia requerida.
- eventFrame: allDay da [0,1440]. between selecciona el **primer** evento aplicable
  de cada rutina límite, excluyendo su propio ID y conservando el orden del array.
  Rechaza ciclos de visita, límites iguales/ausentes y huecos no positivos. Otros
  bloques usan override.time, anchor=end o time; 24:00 exacto válido, exceso inválido.
- baseLength: duración fija positiva (sin redondear) o suma activa por día/choices;
  sin rutina usa max(1,minutes). routineBalance usa hojas fijas/flexibles y exige
  suma exacta cuando no hay flexibles; el redondeo de routineMinutesOn no debe
  confundirse con la longitud de eventFrame.
- schedulePreview: hasta ocho resultados dentro de 370 días; between sin límites
  puede marcarse skipped. No es certificado de validez global.
- dependentMovementIssue comprueba frames dependientes modificados en una fecha.
- repeatCollision compara coocurrencia de una misma rutina, NO solapamiento horario;
  su búsqueda de 1462 días puede devolver false aunque exista coincidencia posterior.
  Actualmente es helper definido sin llamadas públicas. No se impone como prohibición
  nueva por defecto. overlapMode=move no autoriza al verificador a mover actividades.

Las dos reproducciones (años 00–99 y coincidencia posterior a 1462 días) se mantienen
como pruebas explícitas de limitaciones, sin modificar app.tsx/app.js.

## Modelo y criterios de prueba

Dominio experimental conservador: fechas Gregorianas 0100-01-01…9999-12-31, subconjunto
del formato de cuatro dígitos de los respaldos. 0000…0099 y fechas fuera de rango
son indeterminadas, no normalizadas ni migradas. Un resultado siempre declara dominio,
from y through; «indefinido» no significa extrapolar al infinito o más allá del contrato.

En UTC, para ese dominio parseDay es medianoche UTC, sin DST; el cociente de milisegundos
es exactamente el número entero de días. La periodicidad de weekdays/selecciones es 7.
Un every de N efectivo entero seguro tiene período N y fase definida por su origen.
400 años Gregorianos suman 146097 días (divisible por 7), preservan mes/día y bisiestos.
Una componente con reglas mixtas exige MCM(7,146097 si aplica,N1,…), usando BigInt.
Ejemplo monthly + every365: 53325405 días, no 146097. Grandes MCM pueden hacer la
prueba impracticable; jamás se recorta un ciclo y se declara válido.

Inicios, finales inclusivos, dates y overrides se separan en puntos de transición
(día y sucesor). Dentro de cada segmento estable se comprueba min(longitud,período)
días consecutivos y todas las elecciones manuales independientes por evento. La
traslación por el período conserva ocurrencia, weekday, elección y frames seleccionados.
Si se agota un presupuesto, se devuelve indeterminado; un contraejemplo real basta
para invalidar sin terminar toda la exploración. Componentes independientes no requieren
un MCM global: el calendario es válido si cada componente queda completamente probada.

La reducción periódica se admitirá inicialmente SOLO en entorno UTC reconocido y con
las funciones reales de semántica fijada. En otras zonas se permite enumeración finita
explícita con las funciones reales; no se extrapola una muestra de offsets al futuro.
Fracciones every y otros supuestos no demostrados serán indeterminados salvo exploración
finita completa. Estas restricciones son deliberadas, no equivalencia universal de JS Date.

## Contrato previsto del certificado y protección

Tres resultados: valid, invalid (fecha/actividad/regla/choices y límites seleccionados),
indeterminate (razón y presupuesto/alcance incompleto). Algoritmo versionado, hashes del
snapshot ordenado y de la semántica, entorno temporal, componentes, segmentos/períodos,
cantidades examinadas y restricciones. Hashes son integridad, no autenticación.
Verificar un certificado exige los mismos datos/semántica y repetir el algoritmo;
no autoriza escrituras ni sustituye validación de modelo, autoridad, linaje, CAS,
confirmación o recuperación. No se almacenan certificados en el documento de usuario.

El motor recibirá solo planificación, no logs, revisiones ni fotografías. Sus presupuestos
y cancelación deberán acotar trabajo y memoria y permitir ejecución Worker. No se
reemplaza el verificador B.2 en esta fase antes de demostrar paridad de casos admitidos.
