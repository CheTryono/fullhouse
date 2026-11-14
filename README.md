# FULLHOUSE — Prototipo web v0.9

**Fullhouse** es una herramienta independiente de organización integral: metas, rutinas, calendario propio y progreso. Es la versión ligera para prueba e iteraciones, sin sincronización con calendarios ni servicios externos.

## Cómo empezar

### Abrir en tu equipo

1. Descomprime el ZIP.
2. Si tienes Python, abre una terminal en esta carpeta y ejecuta `python -m http.server 5500`. Abre `http://127.0.0.1:5500` en tu navegador.
3. También puedes abrir `index.html` directamente para inspeccionar el diseño, pero para conservar datos con mayor fiabilidad usa un servidor local.

### Tener una página web permanente y actualizarla como Prisma

Incluimos el archivo `.github/workflows/pages.yml` para que **cada cambio subido a la rama `main` publique automáticamente una nueva versión del sitio** en GitHub Pages, sin tener que subir ZIP nuevos a mano.

1. Crea un repositorio **nuevo y separado** en GitHub, por ejemplo `fullhouse`, y sube el contenido de esta carpeta (los archivos, no la carpeta ZIP).
2. Desde `Settings → Pages → Build and deployment → Source`, selecciona **GitHub Actions**.
3. En la pestaña `Actions` aparecerá el despliegue al subir cambios a `main`.
4. El sitio quedará en una URL tipo `https://TU-USUARIO.github.io/fullhouse/` (la URL exacta se confirmará en el apartado Pages del repositorio).
5. Para actualizarlo, sustituimos los archivos modificados en ese repositorio y hacemos `git push` a `main`.

*GitHub Pages en el plan gratuito requiere un repositorio público. Es útil para esta fase de prototipo, pero no está destinado a alojar un SaaS comercial. Para una versión de pago elegiremos otro alojamiento.*


## Novedades de Fullhouse 0.9

- **Mi día sin ventanas:** reloj y progreso en vivo, rutina actual expandida en la misma página, ejecución de pasos y subpasos, notas y evidencias sin abandonar la jornada. Se puede abrir otra rutina pendiente manualmente. El avance tiene en cuenta las tareas realizadas parcialmente.
- **Horario de 24 horas:** incluye indicador móvil de la hora actual y acercamiento a los pasos con bloques proporcionales dentro de la misma página. Se trasladó a «Uso y seguimiento».
- **Sueño visual:** horario fijo diario configurable desde Ajustes, con una duración obligatoria de 7, 8 o 9 horas. La franja es informativa y no impide programar rutinas ni eventos que se solapen.
- **Sonidos opcionales:** respuesta sonora breve al completar rutinas o pasos, controlada desde Ajustes. Dependiendo del navegador puede requerir interacción previa y autorización de sonido.
- **Diseño adaptable:** barra lateral desplazable en ventanas bajas, modales horizontales distribuidos en columnas, contenido de ejecución estable al desplazarse y tarjetas más coloridas. Las alternativas no tienen jerarquía visual.
- **Rutinas configurables:** color propio para cada rutina, herencia cromática en sus subpasos excepto cuando se vinculan a una meta, y resaltado del destino al reordenar tarjetas con arrastre.
- **Ayudas movibles:** arrastra la barra superior de una ayuda para moverla a un lugar que no estorbe. Se admite ratón y control táctil.
- **Dependencias semanales:** al programar una rutina entre otras dos se marcan los días sin límites adecuados y se bloquea su selección, con un aviso contextual. La validación se hace con la programación disponible en cada día, incluyendo suficiencia de tiempo.
- **Estados vacíos:** mensajes de «Agenda libre» y accesos rápidos a programar actividades si el día no tiene bloques.

**Compatibilidad:** los registros históricos y la clave `fullhouse-v01` se conservan. Los nuevos ajustes de sueño y sonido se guardan separadamente en el navegador. No hay sincronización entre dispositivos. Usa «Exportar respaldo» periódicamente, especialmente antes de editar horarios y rutinas.

## Novedades de Fullhouse 0.8

- **Mi día:** sección nueva para ejecutar las actividades del día, marcar tareas, acceder a los procedimientos, adjuntar fotografías y notas, observar progreso por ámbito y guardar una revisión nocturna.
- **Recuerdos e historial:** álbum de imágenes comprimidas en el navegador, evidencias por actividad y por paso, y revisiones anteriores en Progreso. Las fotografías siempre son opcionales, incluso cuando un procedimiento sugiere documentarlo.
- **Calendario ampliado:** vista mensual de ancho completo, detalle de un día en inspector flotante, etiquetas de eventos coloreadas por su meta y títulos más legibles.
- **Fechas elegantes:** selector de fecha propio para eventos, eventos únicos explícitos, rangos de varios días visibles, fecha de término opcional para rutinas y repeticiones, y reinicio de la fecha final al cambiar la inicial.
- **Edición más clara:** colores y espaciado mejorados, ajustes avanzados desplegables con preferencia persistente, ayuda general por ventana arrastrable y protección contra el cierre al arrastrar texto fuera del modal.
- **Mapa de metas:** estructura jerárquica recalculada para alinear padres con sus hijos y permitir que el scroll continúe en la página cuando se agota el espacio interior.
- **Duración flexible:** escalas deslizantes para repartir pesos en pasos y alternativas, con porcentajes y una estimación de tiempo, más una referencia fija visible mientras editas una rutina.
- **Horario:** controles de navegación entre días con ancho estable y tarjetas que conservan sus funciones.

**Importante sobre las imágenes:** la aplicación todavía guarda todo en `localStorage` y no sincroniza dispositivos. Aunque las imágenes se reducen de tamaño, el espacio disponible es limitado. Exporta respaldos con frecuencia; para un álbum grande se necesitará migrar a almacenamiento local más robusto (IndexedDB) o a la arquitectura definitiva.

**Compatibilidad:** se conserva el almacén `fullhouse-v01` y la estructura `version: 1` para mantener los datos existentes. Se agregaron campos opcionales y registros diarios, sin reemplazar automáticamente tus datos actuales.

## Novedades de Fullhouse 0.5

- Metas con distribución de columnas independientes para aprovechar la altura de cada rama; metas y rutinas reordenables al arrastrar desde el asa.
- Tarjetas de rutinas rediseñadas para legibilidad, especialmente en tema Medianoche; icono seleccionable para cada rutina.
- Pasos de rutina normales, que aparecen solo ciertos días o que alternan entre varias opciones. La opción original se conserva como alternativa de base; se usa «Mié» para miércoles.
- Programa una rutina desde la hora de inicio o la hora de término. Para una rutina existente se usa **Reprogramar**, con confirmación y fecha de aplicación. Se conserva el historial pasado.
- Repeticiones agrupadas por días de la semana, intervalos periódicos o fechas concretas con selector de calendario.
- Eventos especiales y ocasiones de varios días (viajes, ceremonias, citas), destacados en la agenda y calendario.

**Regla de programación:** una rutina tiene una programación vigente por vez. La reprogramación conserva los registros del pasado y aplica los cambios desde la fecha de corte. Los eventos de varios días no se repiten automáticamente; crea otro evento cuando sea necesario.

## Funciones actuales

- Panel de inicio con resumen.
- Metas y sub-metas, progreso medido por valor actual/objetivo, historial.
- Rutinas con pasos editables y duración estimada.
- Calendario mensual y agenda diaria, eventos recurrentes y actividades vinculadas a metas/rutinas.
- Registro de actividades, ejecución de pasos y ajustes de horario por fecha.
- Exportación/restauración de datos JSON.
- Adaptación para pantallas móviles y de escritorio.

## Datos y seguridad

- Los datos de uso se guardan **solo en el navegador** (`localStorage`). No hay cuentas ni sincronización entre dispositivos.
- El sitio que publiques no expone automáticamente tu información guardada en el navegador. Sin embargo, los archivos del repositorio público sí son públicos y **no debes poner contraseñas ni datos personales dentro del código o del repositorio**.
- Borrar los datos del navegador o cambiar de dominio puede hacer que no veas tus registros. Exporta un JSON regularmente y restáuralo en el nuevo sitio cuando sea necesario.
- Al actualizar desde el prototipo inicial de Botánica dentro del **mismo origen del navegador**, se conserva el acceso al almacenamiento anterior mediante migración. En un dominio nuevo tendrás que exportar/importar JSON.
- Usa `Respaldo y ajustes → Exportar` para proteger registros importantes. No guardes datos especialmente sensibles en esta fase.

## Modificar el código

- `app.tsx`: código fuente React + TypeScript.
- `app.js`: versión compilada que el navegador carga.
- `styles.css`: diseño.
- `index.html`: estructura de página.
- `vendor/`: React y ReactDOM empaquetados localmente.
- `tsconfig.json`: configuración de TypeScript.

Si modificas `app.tsx`, debes recompilar con `tsc --project tsconfig.json` **antes de subir los cambios**, porque este prototipo no ejecuta TypeScript en el navegador. El archivo `app.js` generado también debe incluirse en el commit.

Este código conserva React 16 por continuidad con el prototipo previo; antes de comercializarlo conviene migrar a React moderno y actualizar el esquema de almacenamiento. Mantendremos esa migración separada del trabajo de diseño para evitar pérdidas de datos.

## Acuerdo de trabajo

**Un único producto, versiones sucesivas, retroalimentación continua.**

- Este repositorio queda dedicado a Fullhouse; Prisma sigue en su proyecto independiente.
- Cada cambio visual/funcional se desarrolla como una nueva revisión de Fullhouse.
- Mantendremos el registro de decisiones y mejoras en `CAMBIOS.md` y comprobamos que la información persistida siga siendo compatible.
- No habrá sincronización con Google Calendar, Apple Calendar ni otros calendarios externos.


## Novedades 0.2
- Guía paso a paso, ayuda contextual, cinco temas y logo/favicíono propio.
- Metas numéricas, cualitativas e hitos, con colores libres.
- Horario vertical de mañana a noche con bloques y desglose de subpasos.
- Modales en orientación vertical u horizontal, selectores mejorados, textos más legibles.

Los datos existentes de 0.1 se conservan al actualizar porque seguimos usando la misma clave de almacenamiento, y los campos nuevos son opcionales.


## Novedades de la versión 0.3

- Una guía **interactiva** para la primera entrada: crea un plan real mediante acciones que deben completarse; permite saltar el recorrido.
- Un mapa de metas editable con conexiones de jerarquía y dependencia, fechas de inicio y fecha objetivo, y organización alternativa por tiempo.
- Rutinas con reordenación de pasos y subpasos mediante arrastre táctil o ratón (flechas del teclado sobre el tirador para accesibilidad). Tiempos de pasos contenedores calculados automáticamente.
- Ventanas y campos más estables, selects en portales superpuestos, selector de hora propio y colores personalizados sin diálogos nativos.
- Bloques compactos según duración. Los apartados Calendario y Horario ya no tienen accesos cruzados.
- Validación de conflictos para impedir rutinas duplicadas en un día. Al cambiar una rutina recurrente, puede aplicarse el horario a partir de una fecha determinada conservando los registros anteriores.
- Un logo abstracto Fullhouse sin referencias a Botánica.

**Compatibilidad:** no se cambia la clave de almacenamiento `fullhouse-v01` ni el esquema base del archivo JSON. Se recomienda exportar respaldo antes de realizar modificaciones importantes en tus metas o rutinas.

**Limitaciones de esta etapa:** los datos son locales a cada navegador. Esta versión es un prototipo sin cuentas ni sincronización; el mapa es interactivo pero no admite reordenación libre de nodos. Los vínculos del mapa se crean desde la ficha de cada meta. La aplicación no calcula automáticamente el cumplimiento personal a partir de metas sin números.


## Novedades 0.4 (4 de noviembre de 2026)

- Logo reformulado para representar **avance en distintas áreas y plenitud**, sin símbolos botánicos; también es el favicon.
- Guía de aprendizaje con mayor contraste y explicaciones sobre el porqué de cada paso; en la primera acción se invita a crear una meta nueva. La ayuda contextual no cierra la ventana que estás editando.
- Metas agrupadas en un árbol visual de **ramas conectadas**; clasificación por ámbitos: Mente, Físico, Propósito, Social y Otro. Filtros por ámbito para árbol y mapa.
- **Revisiones de metas**: una sola vez, cada semana o cada mes. Al guardar la meta, se mantiene un evento vinculado en el calendario. Los eventos de revisión se editan desde la meta.
- **Calendario** centrado en fechas importantes; muestra el nombre de eventos especiales y únicamente puntos de color para rutinas recurrentes. La agenda de la derecha distingue compromisos especiales y rutinas del día.
- **Repeticiones**: diaria, lunes a viernes, semanal, días personalizados, mensual, anual, intervalos en días y fechas concretas. Se impide duplicar la misma rutina en un día.
- **Variantes de pasos por día de la semana**: cada variante admite su propio nombre, duración, instrucciones y subpasos; en la ejecución y el horario se toma la correspondiente al día.
- Horario con bloques **completamente coloreados**, y densidades de información micro, compacta y extendida según tamaño/espacio disponible.
- Campos de minutos de edición libre: no aparece un 0 adicional al borrar, ni se ajustan cantidades por la rueda del ratón.
- Avisos que desaparecen tras 3,5 segundos o pueden cerrarse. Protección frente a cerrar involuntariamente un formulario con cambios no guardados.
- Se suprimió el acceso a paletas en la barra superior; permanecen en **Ajustes**, conservando las cinco combinaciones anteriores.

### Notas sobre repeticiones y variantes

- Una repetición mensual conserva el mismo número de día (por ejemplo, el 31 **no** se presenta en meses sin día 31). Una anual conserva día y mes.
- Las variantes de un paso se aplican según el día de la semana. Los pasos que no tienen una variante para ese día utilizan la versión base. Puedes asignar distintos subpasos dentro de cada variante.
- Los cambios en plantillas de rutinas se reflejan en futuras ejecuciones; los registros previos de pasos guardan sus identificadores, por lo que si reestructuras una rutina mucho después conviene exportar un respaldo.

### Compatibilidad y límites

El almacén `fullhouse-v01` y la versión base JSON `1` permanecen iguales; los nuevos atributos son opcionales. La herramienta continúa guardando **solo localmente** y sin cuentas, sincronización o copias automáticas. Antes de modificar muchas rutinas o metas, exporta un JSON desde Ajustes. No publiques datos personales en el repositorio.

## Fullhouse 0.7 — planificación enlazada, ejecución y notas

- **Editor de actividades** organizado en cuatro secciones visuales: identidad, horarios, repeticiones, relaciones.
- **Bloques entre rutinas:** edita una actividad, vincúlala a su rutina y elige «Entre dos rutinas». Debes seleccionar una rutina límite anterior y una posterior que tengan programación ese día. El bloque comenzará al terminar la primera y acabará al iniciar la segunda. Cada rutina puede seguir usando una sola programación futura.
- **Pasos flexibles:** en el editor de rutinas marca «Tiempo flexible». Los pasos fijos se descuentan del intervalo y el tiempo restante se reparte entre los pasos flexibles. Fuera de intervalos, estos pasos utilizan una estimación inicial de 30 minutos. Los intervalos se calculan **dentro del mismo día**; no hay gestión de bloques que crucen medianoche.
- **Reprogramación y dependencias:** al mover una rutina que define un límite, se avisa que otros bloques se reajustarán. Se conservan las versiones pasadas. Al eliminar una programación límite, se cancelan las programaciones futuras dependientes, se mantienen registros históricos y la rutina dependiente se puede volver a programar manualmente. Los días en los que falte un límite válido no muestran el bloque flexible.
- **Eventos imprevistos:** en una actividad de una sola fecha con horario, elige «Mantener solapamiento» o «Posponer bloques ese día». La segunda opción requiere confirmación y crea excepciones horarias solo para la fecha afectada. Si algún bloque flexible se quedara sin intervalo, no se aplica el desplazamiento.
- **Alternativas por ejecución:** en el editor de pasos elige «Alternativas → Al ejecutar la rutina» para decidir qué opción hacer en ese momento. Todas las alternativas son equivalentes. La elección se guarda por fecha y no impone preferencias a otros días.
- **Notas de día:** desde la ejecución o el detalle del horario se pueden escribir notas para una actividad o cada paso. Permanecen en el historial del día y se vuelven a mostrar únicamente en la siguiente aparición del mismo bloque/paso. El horario indica con ✎ los bloques que tienen notas o una nota pendiente de la ocasión anterior.

**Datos y compatibilidad:** mantiene `version: 1`, `localStorage` con clave `fullhouse-v01` y los respaldos JSON anteriores. Los nuevos campos son opcionales. Sigue siendo una aplicación local y no sincroniza calendarios ni otros servicios. Exporta respaldos antes de hacer cambios importantes.



## Fullhouse 0.7: distribución de tiempo y vista previa

- Todas las confirmaciones de borrado, restablecimiento, restauración y cambios con impacto se muestran dentro de Fullhouse; no se usan los diálogos nativos `confirm()` del navegador.
- En **Rutinas → Editar**, elige **Según mis pasos** o **Tiempo fijo**. En tiempo fijo, la duración total se debe ocupar exactamente con pasos fijos o completarse con pasos flexibles; una rutina inválida no puede guardarse.
- Los pasos flexibles, detalles y alternativas admiten pesos proporcionales: dos pesos de 9 y 1 reparten el remanente 90 % / 10 %. El reparto se realiza en minutos enteros, conservando la suma total.
- En **Programar/Reprogramar rutina** hay una previsión de hasta ocho apariciones futuras (en los próximos 370 días), con horarios, solapamientos y advertencias. Es una muestra: no sustituye revisar casos mucho más lejanos o cambios futuros.
- Cuando la programación no cabe en el intervalo entre dos rutinas, puedes pasar al editor, corregirla y regresar al formulario conservando tus datos de programación aún no guardados.
- Las metas se pueden asociar a pasos, detalles y alternativas desde sus opciones avanzadas. Su color aparece en el editor y durante la ejecución.
- En **Ajustes** elige horas y minutos (predeterminado) o solo minutos para los tiempos que se muestran.
- Los datos continúan en `localStorage` bajo la clave histórica `fullhouse-v01`; los respaldos anteriores siguen teniendo versión de esquema `1`, y los nuevos campos son opcionales.
## Pruebas automatizadas de regresión

Con Node.js 20 o posterior, ejecuta desde la raíz `npm ci`, `npm run check` y
`npm run test:regression`. La infraestructura usa el ejecutor nativo de Node y
TypeScript fijado en el lockfile; no añade dependencias a la aplicación servida.

`npm test` incluye también una reproducción de error existente y termina
actualmente con código 1. No son pruebas omitidas: la base estable pasa por
separado y los fallos quedan visibles en `npm run test:known-bugs`.
Consulta [tests/README.md](tests/README.md) para cobertura, resultados,
limitaciones y criterios para corregir esos defectos en tareas posteriores.


## Protección cuando los datos locales no pueden abrirse

Si Fullhouse no puede leer o validar información ya almacenada, muestra «Tu
información está protegida». No carga ejemplos ni sustituye el original por un
almacén anterior. Mientras dure el problema, bloquea el guardado, la importación
y el restablecimiento.

Usa **Descargar original sin cambios** para guardar el texto exacto, incluso si
no es JSON válido. Comprueba que el archivo se descargó y consérvalo para revisar
el problema; no borres los datos del sitio. **Volver a intentar la lectura**
permite recuperarse de un bloqueo temporal o volver a leer datos compatibles.
Si el navegador no permite leer el almacenamiento, la descarga estará desactivada
hasta recuperar el acceso. No hay reparación automática ni migración destructiva.


## Si no se pueden guardar tus cambios

Fullhouse mantiene separado el último estado guardado de los cambios pendientes.
Si el navegador rechaza una escritura, muestra una pantalla persistente y pausa
las nuevas ediciones para proteger la copia pendiente. No anuncia un guardado
exitoso ni sustituye el estado confirmado.

- **Reintentar guardado:** vuelve a intentar la misma acción. Solo pasa al estado
  guardado cuando el navegador acepta la escritura.
- **Exportar cambios pendientes:** descarga un respaldo JSON compatible, incluidas
  las notas y la revisión diaria escritas sin guardar. Comprueba la descarga;
  puedes restaurarla desde Ajustes después de recargar. Exportar no confirma el
  guardado local ni elimina la copia pendiente.
- **Descartar cambios pendientes:** requiere confirmación explícita y conserva el
  último estado guardado. Los borradores independientes de notas/revisión pueden
  seguir necesitando guardarse o descartarse por separado.

Los borradores de formularios, notas y revisión diaria impiden navegar sin
resolverlos. Se solicita la advertencia del navegador al recargar, salir o cerrar
con cambios sin guardar. Los pendientes viven en memoria: un cierre forzado o la
terminación del proceso por el sistema operativo puede impedir la advertencia y
perderlos. La exportación comprobada es la vía segura de conservación si el
almacenamiento continúa rechazando escrituras.


## Límites de los desplazamientos horarios

Los desplazamientos de una fecha se comprueban antes de guardar: terminar
exactamente a las **24:00** es válido; salir del día se rechaza con un mensaje y
se conserva el horario anterior. Se mantiene el ajuste a **00:00** cuando se
intenta mover antes del comienzo del día. No hay soporte para cruzar medianoche.

También se comprueban los intervalos dependientes, incluidos los encadenados, y
su reparto entre pasos fijos/flexibles. La misma comprobación protege «Posponer
bloques». Los movimientos aceptados cambian solo la excepción de la fecha
seleccionada; los rechazados no crean pendientes de guardado ni modifican las
actividades o registros. Un movimiento válido cuyo guardado falle conserva la
protección de pendientes de BUG-01.

No se corrigen automáticamente horarios inválidos que ya estuvieran almacenados,
ni se añaden controles nuevos a la interfaz. La prueba de Chromium y sus límites
están documentados en `tests/browser/README.md`.

## Plan de desarrollo e historial v2 (propuesta)

El [ROADMAP](ROADMAP.md) distingue avances comprobados de trabajo pendiente.
La fase 1 de BUG-05 formaliza el [contrato histórico](docs/HISTORY_V2_CONTRACT.md)
y el [diseño de migración y recuperación](docs/HISTORY_V2_MIGRATION.md).
La fase 2 añade un [motor histórico aislado](docs/HISTORY_V2_ENGINE.md) con codec,
capturas y correcciones probadas sobre documentos sintéticos. Los módulos de
`history/` y `contracts/` siguen fuera de la aplicación pública:
la aplicación continúa usando `version: 1` y `fullhouse-v01`, sin migración activada.
Véanse [comandos y límites de las pruebas](tests/README.md).

La fase 3 incorpora un [lector histórico y laboratorio visual](docs/HISTORY_V2_VIEWS.md).
Para revisar únicamente los escenarios sintéticos: `node scripts/serve-history-lab.cjs`.
El laboratorio no accede al almacenamiento del navegador y no se incluye en Pages.
Las pantallas públicas siguen en v1; BUG-05 todavía no se considera corregido allí.
