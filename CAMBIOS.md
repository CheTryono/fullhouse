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