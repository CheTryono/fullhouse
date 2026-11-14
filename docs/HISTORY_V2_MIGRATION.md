# BUG-05 · compatibilidad, activación y recuperación propuestas

**Diseño únicamente. No existe migración activada en esta entrega.**
El formato nuevo es `version: 2`; no se disfraza como una extensión v1 que un
lector anterior podría interpretar incompletamente.

## Alternativas de persistencia

| Opción | Ventajas | Riesgos / coste |
| --- | --- | --- |
| Migrar dentro de `fullhouse-v01` | Una ubicación, menor duplicación permanente | Una pestaña antigua puede escribir v1 encima de v2; rollback antiguo puede rechazarlo. No recomendable |
| Nueva `fullhouse-v02` | Aísla escrituras antiguas, conserva v1 intacto para recuperación | Cuota compartida por origen, doble documento, dos líneas divergentes si se usa una pestaña vieja |
| IndexedDB | Transacciones y blobs; mayor capacidad habitual | API asíncrona, más rutas de error y cambio arquitectónico; no autorizar en esta fase |

Recomendación para la activación posterior: **clave nueva `fullhouse-v02`**,
conservando la original sin sincronización bidireccional ni sustitución automática.
No cambia el formato del respaldo ni la clave que usa hoy la aplicación.
El tamaño depende de textos, cantidad de ejecuciones y fotos: medir `JSON.stringify`
y su longitud UTF-16; `2 * length` es una aproximación de memoria, no una cuota
portable. La base64 cuesta aproximadamente 4/3 del binario, antes del coste de strings.

Ejemplo orientativo: una revisión de 5 KB con 100 ejecuciones de 1 KB son ~105 KB
frente a ~500 KB de copiar la receta completa por ejecución. Una foto de 300 KB
binarios ronda 400 KB base64 y domina esos costes. La migración duplica temporalmente
el documento anterior más las nuevas capturas; no prometer que una cuota nominal
alcanzará. Las cifras son supuestos, no medidas sobre datos personales.

## Compatibilidad

Importar v1 de Fullhouse 0.1–0.9 mediante validación actual y fixtures producidos
por esas versiones; también admitir v1 actuales. No añadir contexto histórico
sintético durante conversión. Mantener logs originales sin `history`. Validar
v2 completo, referencias y fotos antes de confirmar cualquier importación.
Rechazar versiones desconocidas conservando memoria, bytes y pendientes existentes.
No ofrecer una exportación v1 con pérdida como respaldo completo de v2.
Exportar v2 debe incluir definiciones referenciadas, capturas, auditorías y fotos.
No hay exportación ni importación v2 implementada en esta fase.

## Protocolo de activación propuesto

1. Bloquear activación si hay pendientes/borradores, lectura fallida o recuperación
   abierta. Resolverlos/exportarlos con BUG-01/PR #2 antes de continuar.
2. Leer la fuente sin modificarla; conservar sus bytes originales y producir una
   copia descargable. La descarga solicitada no demuestra por sí sola que el archivo
   quedó guardado: pedir confirmación informada en el flujo futuro.
3. Comprobar formato, espacio orientativo y conflictos. Calcular una huella de la
   fuente exacta para detectar cambios; no usarla como prueba de autenticidad.
4. Construir candidato en memoria sin modificar el origen; validar estructura y
   relaciones, preservar hechos y fotos. Mostrar errores sin cambiar datos activos.
5. Con exclusión cooperativa entre lectores nuevos, volver a verificar huella y
   escribir la clave destino completa; leerla de nuevo y verificar integridad y
   equivalencia del candidato antes de activarla. No borrar primero para hacer sitio.
6. Un manifiesto pequeño de activación con huellas/versión ayuda a distinguir un
   candidato de una activación confirmada. Es otra escritura, no una transacción:
   interrupciones o manifiesto fallido deben llevar a recuperación de solo lectura,
   nunca a fallback automático a v1 ni a ejemplos. Diseñar y probar el protocolo
   exacto antes de implementarlo; no afirmar atomicidad entre claves.
7. Conservar v1 y copia externa. No recoger basura ni eliminar respaldos/revisiones
   para ahorrar espacio sin decisión explícita. Si no cabe, cancelar manteniendo
   origen y pendientes, ofrecer exportación y reintento.

Ante cualquier ambigüedad (destino sin manifiesto, huellas distintas, dos documentos
válidos divergentes), mostrar recuperación: descargar originales por separado,
identificar versión/fecha sin elegir el más nuevo por reloj y permitir una selección
consciente. Un error al exportar no autoriza descartar el original.

## Pestañas antiguas y concurrencia

`BroadcastChannel`, heartbeats y Web Locks solo coordinan código que participa.
No pueden demostrar que no existe una pestaña antigua. `storage` permite detectar
cambios en v1 desde otra pestaña, pero no impedirlos ni detectarlos mientras todas
las pestañas nuevas estén cerradas. Persistir huella original y compararla al abrir.

La clave v02 impide que el código antiguo sobrescriba v2, pero no que el usuario
trabaje en dos historiales divergentes. Advertir que debe cerrar/recargar pestañas
viejas; si cambia v1 tras activación, pausar escrituras nuevas y ofrecer exportar
ambas ramas. No mezclar automáticamente, no importar v1 sobre v2 por fecha.
La misma precaución aplica a dos pestañas nuevas: necesitarán bloqueo cooperativo,
revisión del documento y revalidación antes de escribir para evitar última escritura.
Una marca en v1 no protege frente a código viejo que la ignora o reescribe.

## Recuperación y reversión

- Fallo antes de activación: conservar fuente intacta y candidato identificable;
  recuperación de solo lectura si hay ambigüedad, nunca datos de ejemplo guardables.
- Fallo después: exportar v2 y cualquier pendiente; preferir volver a una versión de
  la app que entienda v2. No desplegar un lector v1 como rollback transparente.
- Volver a v1 exige elegir el respaldo anterior y aceptar explícitamente que no
  contiene nuevos registros v2. Guardar primero v2; no convertirlo con pérdida en
  silencio. Conservar ambas claves hasta resolución verificada.
- Probar cuota llena, escritura/lectura denegada, cierre entre cada paso, importación
  concurrente, bytes corruptos, manifiesto perdido y cambios de pestaña antigua.
- Mantener BUG-01 (confirmado/pendiente, reintento/exportación), BUG-02/03 (validación
  y recuperación sin reemplazo) y BUG-04 (intervalos y dependencias) como barreras.

## Decisiones y puertas de entrada a fase 2

El diseño híbrido, v2 y la captura significativa ya están aprobados. Falta concretar
el protocolo de activación/manifiesto y concurrencia, presupuesto de espacio y UX
cuando no cabe; adopción de legado, presentación de ramas corregidas y agregados
mixtos. La implementación puede empezar con codec y acciones aisladas sin activar
persistencia. La activación y cualquier migración de producción necesitan revisión
propia, pruebas de fallos y autorización posterior.
