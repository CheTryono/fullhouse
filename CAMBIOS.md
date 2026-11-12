# BUG-04 — desplazamientos válidos dentro del día

- Se valida el intervalo completo antes de guardar un desplazamiento. Terminar a las 24:00 es válido; exceder el día se rechaza conservando el horario anterior, las excepciones y los registros. Se mantiene el ajuste inferior a 00:00; el final exacto se muestra como 24:00 en el acercamiento y la previsión.
- Validación de dependientes directos y encadenados, incluidos sus pasos fijos/flexibles. Se comparte con los movimientos automáticos de «Posponer bloques».
- El formulario de una actividad sin rutina también rechaza intervalos fuera del día; no se permite guardar una actividad que luego quede oculta por su duración.
- Reproducción BUG-04 trasladada sin modificar sus aserciones: 164 pruebas de regresión aprobadas. Solo BUG-05 permanece fallido, sin alterar su lógica histórica.
- TypeScript, sintaxis y compilado sincronizado verificados. Chromium a 1280/390 px con Medianoche: editor real, controlador de desplazamiento, horario visible, excepciones/historial y pendientes de BUG-01, sin errores JavaScript.
- Sin cambios en esquema, claves, dependencias, estilos ni despliegue. No se introduce cruce de medianoche, reparación automática de horarios previos ni nuevos botones en la interfaz.

---

# BUG-01 — guardado confirmado y recuperación de pendientes

- Ante un fallo de `localStorage`, se conserva el último estado confirmado y una copia JSON independiente del intento pendiente, sin anunciar éxito ni marcar completados como guardados.
- Pantalla persistente con edición pausada, reintento, exportación y descarte con confirmación. La exportación incluye también notas/revisión diaria escritas sin guardar; el reintento confirma solo la acción original.
- Validación de datos antes de guardarlos o reintentarlos. Importaciones y recuperación de PR #2 conservadas, con protección adicional ante una importación que termine mientras hay pendientes.
- Protección de borradores, notas y campos numéricos aún en edición al navegar o salir. Aviso `beforeunload`; el cierre forzado sigue requiriendo una exportación previa para conservar pendientes.
- Reproducción BUG-01 trasladada a regresión: 126 aprobadas; permanecen dos fallos explícitos correspondientes a BUG-04 y BUG-05, sin corregirlos en esta tarea.
- Chromium, escritorio y vista móvil con Medianoche: cuatro combinaciones de cuota/permisos verificadas, incluidos reintentos, exportación y avisos de salida. Prueba reutilizable en `tests/browser/`.
- Se mantienen `version: 1`, `fullhouse-v01`, respaldos históricos y bibliotecas. Sin cambios en despliegue ni nuevas dependencias.

---

# Protección de datos locales durante la carga — ampliación de PR #2

- Revisión de tipos y escritores históricos; nueve respaldos sintéticos generados con los métodos originales de guardado/exportación de Fullhouse 0.1–0.9, con commits y generador reproducible.
- Corregida una incompatibilidad real del validador: horas con minutos fraccionarios escritas por 0.5–0.9 al calcular el comienzo desde la hora de término. No se redondea ni migra la información.
- Un fallo de lectura o validación local activa una pantalla persistente de protección. No carga ejemplos ni sobrescribe con datos del almacén anterior; bloquea guardar, importar y restablecer.
- Descarga del texto original exacto y reintento seguro de lectura. La captura se conserva ante fallos posteriores o desaparición externa del original; descargar no desbloquea escrituras.
- 93 pruebas de regresión aprobadas y tres defectos anteriores todavía fallidos. TypeScript, sintaxis y compilado sincronizado verificados.
- Recuperación comprobada en Chromium, escritorio y móvil con las cinco paletas, sin errores JavaScript. No hay migraciones destructivas ni cambios de publicación.

---

# Restauración segura de respaldos — BUG-02 y BUG-03

- Validación de entidades y campos internos antes de cargar/importar respaldos, con campos opcionales antiguos y desconocidos conservados. Se mantiene `version: 1` y `fullhouse-v01`.
- Una importación fallida por formato, lectura o escritura conserva los datos anteriores en memoria y almacenamiento. Los mensajes explican el problema sin anunciar una restauración exitosa.
- Captura del selector antes de esperar confirmación, compatible con la liberación de eventos de React 16.
- BUG-02 y BUG-03 pasan a la suite de regresión: 74 pruebas aprobadas. Las tres reproducciones pendientes (BUG-01 general, BUG-04 y BUG-05) siguen fallando explícitamente.
- TypeScript, sintaxis JavaScript y correspondencia del compilado verificados. Importación comprobada en Chromium, escritorio y móvil con Medianoche, sin errores JavaScript.
- Fixtures exclusivamente sintéticas; no hay migración, refactorización general ni cambios al despliegue.

---

# Base inicial de pruebas de regresión

- Ejecutor nativo de Node, TypeScript 5.9.3 y lockfile reproducible.
- 24 pruebas de regresión sobre datos sintéticos y 5 pruebas fallidas que reproducen problemas existentes de guardado, respaldos, límites horarios e interpretación histórica.
- Comprobación de tipos y sintaxis, y compilación en memoria para verificar que `app.js` coincide con `app.tsx` sin sobrescribirlo.
- Cobertura, comandos, resultados y limitaciones documentados en `tests/README.md`.
- No se corrigieron defectos ni se modificó el código de producción, el almacenamiento o el despliegue. No se ejecutaron nuevas pruebas de navegador.

---

# Fullhouse 0.9 — Ejecución directa y horario visual (09/11/2026)

1. La navegación lateral se adapta a ventanas de menor altura con desplazamiento propio para evitar contenido recortado.
2. El editor de ejecución y las ventanas emergentes estabilizan el ancho y evitan movimientos al desplazar su contenido. En horizontal, los formularios aprovechan columnas completas y separaciones consistentes.
3. Notificación sonora corta y opcional al marcar un paso, subpaso o actividad.
4. «Mi día» muestra hora actual, rutina en curso expandida en línea, iconos de rutina, desglose de pasos, alternativas, evidencias, notas y progreso parcial acumulado. Puedes abrir cualquier otra actividad.
5. Estados de agenda vacía con invitación a crear eventos o rutinas.
6. Colores más presentes y armoniosos en metas, rutinas y pasos; los elementos heredan el color de rutina salvo vinculación con una meta diferente.
7. «Horario» se mueve a uso cotidiano, se extiende a las 24 horas e incorpora una línea de hora actual y exploración progresiva de rutinas y pasos dentro de la página, sin ventanas.
8. Las alternativas aparecen con títulos y tipografía homogéneos, sin opción favorecida por el diseño.
9. Sueño fijo configurable (entre 7 y 9 horas) representado como fondo tenue del horario, sin bloquear actividades en ese período.
10. Tarjetas reordenables con indicador visual del destino mientras arrastras.
11. Las alternativas flexibles se sincronizan y se comprueba que cada alternativa con subpasos contenga al menos un subpaso flexible antes de guardar.
12. Etiquetado correcto de «Alternativa 1» incluso dentro de subpasos.
13. Color personalizable en rutinas, junto al icono.
14. Paneles de ayuda arrastrables mediante ratón o tacto, sin tapar permanentemente los controles.
15. Programaciones entre dos rutinas verifican días con límites presentes, orden válido y tiempo suficiente; se informa por qué un día no puede seleccionarse.
16. Se conserva el almacenamiento local y la compatibilidad de datos con las versiones anteriores.

**Pruebas:** compilación TypeScript y sintaxis JavaScript válidas. Pruebas funcionales en Chromium: incremento de progreso por paso aislado, vista directa de Mi día, acercamiento sin modal en Horario, franja de sueño, editor horizontal, ajustes, barra lateral en ventana baja y movimiento real del panel de ayuda. Sin errores de JavaScript detectados en las pruebas descritas.

---

# Fullhouse 0.8 — Jornada práctica y mejoras visuales

- Nueva pestaña **Mi día** para completar el día, registrar notas, revisar ámbitos y cerrar la jornada con una reflexión.
- Evidencias fotográficas opcionales en actividades y pasos. Se reducen en el cliente, se guardan por fecha y aparecen en la galería diaria y el historial.
- Calendario más ancho; inspector de fecha flotante; eventos coloreados por meta; selector de fecha personalizado, rangos y límites de repetición.
- Mejora de reprogramaciones futuras sin duplicar un evento puntual en la fecha antigua; conservar registros pasados cuando corresponda.
- Navegación dividida entre uso, planificación y análisis. Flechas del horario estabilizadas.
- Mapa de metas alineado con la jerarquía y desplazamiento de página al llegar al borde interior.
- Escalas visuales para distribuir tiempo flexible, estimaciones por contenido y barra fija de balance temporal.
- Ayuda por ventana y arrastrable, opciones avanzadas persistentes, más espacio y color en formularios, prevención de cierres accidentales tras seleccionar texto.
- Pruebas: compilación TypeScript, análisis CSS y pruebas sintéticas de recurrencia, rangos, jerarquía y renderizado virtual. **No se pudo ejecutar Chromium en este entorno** por una restricción del navegador, por lo que la revisión visual en un navegador real queda pendiente.
- Compatibilidad: se conserva la misma clave de almacenamiento local y se incorporan solamente campos opcionales.

---

# Fullhouse 0.7 — 6 de noviembre de 2026

1. Confirmaciones personalizadas, integradas con los cinco temas, para salir sin guardar, borrar, reprogramar, restaurar y restablecer.
2. Rutinas de duración fija o duración derivada de sus pasos; validaciones visuales y bloqueo de guardado si la suma fija no encaja y no hay elementos flexibles.
3. Reparto proporcional configurable de contenidos flexibles en pasos, subpasos y alternativas (por ejemplo, pesos 9/1 para 90/10).
4. Editor de rutinas organizado en identidad, duración, pasos y distribución; opciones avanzadas desplegables.
5. Vista previa de la programación de una rutina durante las siguientes ocho apariciones, con conflictos y minutos disponibles.
6. Edición de la rutina desde la programación y regreso a los datos de planificación sin pérdida del borrador.
7. Asistencia contextual cuando no hay tiempo suficiente o sobra tiempo en rutinas entre bloques.
8. Programación de rutina y creación de eventos tratadas por separado; eliminada la selección contradictoria de tipo dentro de la edición de rutina.
9. Opción en Ajustes para mostrar horas y minutos o solo minutos, con horas predeterminadas.
10. Vinculación de metas a pasos y alternativas, con identificación cromática tanto en edición como ejecución.
11. Cierre haciendo clic en el fondo con advertencia cuando existen cambios pendientes.

### Compatibilidad y límites
- `fullhouse-v01` y `version:1` conservados. No es necesario convertir los respaldos anteriores.
- Los horarios dependientes continúan siendo del mismo día, y la vista previa muestra solo hasta ocho fechas futuras; los días con límites no presentes se omiten.
- Guardar cambios sobre una plantilla de rutina puede afectar cómo se calculan sus duraciones al revisar jornadas anteriores. Los registros de ejecución se conservan, pero aún no hay versiones históricas de plantillas. Exporta respaldos antes de cambios importantes.

---

## 0.6 — Bloques dependientes, alternativas manuales y notas

1. Editor de actividad dividido en cuatro grupos con jerarquía visual más clara.
2. Alternativas de pasos presentadas sin jerarquía «principal/secundaria».
3. Nueva programación «entre dos rutinas» por identificador estable de rutina; duración y comienzo se recalculan dinámicamente y se advierte antes de modificar límites con dependientes.
4. Pasos de duración flexible y reparto del tiempo disponible entre ellos, preservando pasos de duración fija.
5. Eventos de una sola fecha con elección entre mantener solapamiento o posponer bloques del día; protección contra perder intervalos dependientes.
6. Alternativas que se deciden durante la ejecución y se guardan solo en esa fecha.
7. Colores y contraste reforzados en editores de pasos, alternativas y notas.
8. Notas por actividad/rutina y paso, con indicador en horario, consulta histórica y recordatorio únicamente en la siguiente aparición.
9. Eliminación conservadora: las programaciones dependientes se cancelan desde hoy o mañana si hoy ya tiene registros; nunca se borran registros históricos.
10. Corregida la publicación del favicon vectorial al incluir logo.svg en GitHub Pages.

**Pruebas:** compilación TypeScript, sintaxis JS, renderizado real de HTML/React en Chromium y comprobaciones funcionales de dependencia, desplazamiento, alternativas manuales, notas de la siguiente ocasión, cambios futuros, historia anterior y eliminación en cascada.

---

# Cambios de Fullhouse

## 0.5 — Metas, rutinas y eventos mejorados

1. Distribución de metas sin filas rígidas para evitar huecos entre tarjetas.
2. Vista general de rutinas con mejor legibilidad y contraste en Medianoche.
3. Arrastrar para reordenar metas y rutinas, sin selección accidental de textos en tarjetas.
4. Iconos individuales en cada rutina.
5. Programación por hora de inicio o de término.
6. Pasos siempre activos, opcionales por día o con alternativas diarias. Miércoles muestra «Mié» y las opciones tienen nombres genéricos, no solo ejercicios.
7. Repeticiones agrupadas por días, períodos o fechas específicas mediante calendario.
8. Eventos especiales de uno o varios días y mejor presentación de fechas importantes.
9. Una sola programación vigente por rutina, con confirmación al reprogramar y conservación del pasado.

Se conserva el almacenamiento `fullhouse-v01`, las cinco paletas y las funciones previas. La versión sigue siendo un prototipo sin cuentas ni sincronización.

---

# Registro de cambios de Fullhouse

## v0.4 · 2026-11-04

1. **Logo** rediseñado como órbita de cuatro secciones con una trayectoria de avance ascendente; favicon actualizado. No hay elementos de Botánica.
2. **Guía** con contraste, justificaciones breves de cada paso y creación de una meta nueva como acción principal. Se mantiene la opción de saltar.
3. **Desplazamiento de modales** más estable al dejar de recalcular alturas de áreas de texto en cada actualización; las ventanas ya no cierran por clic accidental en el fondo.
4. **Metas** en árbol con submetas visualmente vinculadas.
5. **Avisos** temporales y cerrables.
6. **Horario** con bloques totalmente coloreados y variantes visuales según el tamaño efectivo.
7. **Calendario** distingue fechas importantes de actividades recurrentes. Quita los textos de conteo de actividades y conserva puntos de rutinas.
8. **Revisiones de metas** únicas, semanales o mensuales; se guardan en la agenda con referencia a su meta.
9. **Ámbitos**: mente, físico, propósito, social y otro; filtros de vista.
10. **Variantes diarias de rutina** para pasos distintos según el día, con instrucciones, duración y subpasos particulares.
11. **Campos de duración** permiten vaciarse sin que aparezca un cero hasta confirmar.
12. **Ayuda contextual flotante** abierta simultáneamente con la ventana de trabajo.
13. **Repetición ampliada** por días personalizados, semanal, mensual, anual, intervalos y fechas específicas.
14. **Prevención de cierre involuntario** del editor y confirmación ante cambios no guardados.
15. **Títulos correctos de submeta** en creación y edición.
16. **Selector de paleta** retirado de la barra superior; continúa en ajustes.

### Verificaciones locales

- `tsc -p tsconfig.json` y `node --check app.js` sin errores.
- Pruebas interactivas de creación de metas y submetas, guardado de revisión, calendario, formulario de rutina con variante y subpaso, menú de ayuda simultáneo, estilos de horario y desaparición del aviso completadas sin errores de JavaScript.
- Validación específica de patrones de repetición y resolución de la variante por día.

### Persistencia

Se conserva la clave `fullhouse-v01` y los datos anteriores con campos opcionales nuevos. Un respaldo JSON sigue siendo necesario antes de modificaciones importantes.

---

# Historial de Fullhouse

## v0.1 — Inicio del desarrollo web

- Nombre temporal establecido: **Fullhouse**.
- Conservamos el prototipo funcional de metas, rutinas, calendario y progreso.
- Marca y títulos actualizados.
- Almacenamiento local aislado y migración desde el prototipo anterior cuando el origen es el mismo.
- Preparación de publicación web con GitHub Actions + GitHub Pages.
- Sin sincronización con calendarios ni aplicaciones de terceros.

## Pendiente para futuras revisiones

- Arquitectura más modular para agilizar iteraciones.
- Vista semanal y organización de actividades arrastrando elementos.
- Dependencias más avanzadas entre metas y rutinas.
- Gestión de bloques fijos/flexibles y conflictos de tiempo.
- Mejores visualizaciones de progreso.
- Migración a React moderno y almacenamiento IndexedDB antes de uso intensivo.

## 0.2 — Fullhouse: experiencia guiada, temas y horario
- Guía de bienvenida con cinco pasos y acceso permanente a ayuda contextual por sección.
- Cinco paletas de colores guardadas localmente; Aurora pasa a ser el tema predeterminado.
- Logo vectorial original en la navegación y como favicon.
- Tipografía ampliada, botones, barras de desplazamiento, ventanas y selectores rediseñados.
- Ventanas emergentes verticales u horizontales, con scroll interno contenido y fondo bloqueado.
- Campos de texto multilínea que se expanden automáticamente.
- Colores ampliados y selector libre en metas.
- Metas numéricas, cualitativas con estados/reflexiones, y por hitos marcables.
- Horario diario continuo con bloques clicables y desglose recursivo de rutinas, pasos y subpasos.
- Respaldo compatible con archivos Fullhouse 0.1; los campos añadidos son opcionales.

## 0.3 — Mapa, aprendizaje guiado y rutinas flexibles (04/11/2026)

1. El acceso a paletas en la barra superior es más discreto. Se conservan intactas las cinco paletas existentes.
2. Mis metas incluye dos vistas: tarjetas y mapa. El mapa admite conexiones padre–hijo y dependencias, con organización por procesos o por tiempo. Las metas admiten fechas de inicio y objetivo.
3. Tutorial interactivo nuevo para primeras visitas: seleccionar o crear meta → crear submeta → programar revisión → programar/seleccionar rutina diaria → abrir el bloque del horario. Se puede saltar. Para usuarios que ya vieron la guía anterior se ofrece una sola vez este nuevo tutorial.
4. Nuevo logo abstracto de casa organizada, sin iconografía botánica. Se utiliza como favicon.
5. El aviso del calendario ya no navega al horario. Ambos apartados se abren desde navegación propia.
6. Tarjetas del horario compactas y micro para eventos cortos, sin contenido extra cortado; colisiones entre bloques visualmente mínimos se distribuyen en columnas.
7. Indicadores de Progreso con un tratamiento visual distinto de los indicadores de Inicio.
8. Editor de colores personalizado integrado, con controles de tono, saturación y luminosidad y valor hexadecimal editable.
9. Panel de edición de rutinas con estabilidad de anchura al hacer scroll, sin saltos provocados por el ancho de la barra.
10. Tarjetas de pasos remodeladas y reordenables arrastrando (ratón/táctil); con teclado, enfoca el tirador y usa ↑/↓.
11. Profundidad diferenciada: Paso → Subpaso → Detalle → Subdetalle → Nivel 5 y siguientes.
12. Opciones de selectores renderizadas como menú superpuesto, sin empujar contenido inferior, incluso dentro de modales.
13. El campo de duración por paso no tiene controles de incremento y pierde el foco al hacer scroll sobre él para prevenir cambios accidentales.
14. La duración de los pasos contenedores es automática: suma recursiva de hijos. Al guardar una rutina se actualiza la duración de sus actividades asociadas.
15. Selector de hora y minuto personalizado, acorde con el estilo de Fullhouse.
16. Una rutina no puede programarse dos veces el mismo día, incluso combinando repeticiones. Desde Rutinas se accede a la programación existente; puede modificarse solo desde una fecha futura manteniendo el historial anterior.

La estructura de datos mantiene `version: 1`, utiliza la clave de almacenamiento `fullhouse-v01` y es compatible con los datos de 0.1 y 0.2. Las nuevas propiedades son opcionales y el respaldo/restauración JSON sigue disponible.