# FULLHOUSE — Prototipo web v0.5

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
