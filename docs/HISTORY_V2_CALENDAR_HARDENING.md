# BUG-05 · B.3a.1: alternativas y garantías locales

Base `beff90843ea46e7ca97b28309502167c6d0403ce` (PR #15).
Rama `fix/history-calendar-alternative-safety-v2`. Producción v1 intacta.

## Checkpoint A · alternativas

Antes de corregir, `node --test tests/history-contract.alternative-safety.test.cjs`
falló en sus tres casos iniciales: 0 aprobados/3 fallidos. El catálogo devolvía dos
veces `{s:'__base'}` en vez de `{}` y `{s:'__base'}`. La operación completa fallaba
antes, con «Rutina inválida», debido al rechazo global del codec: el informe B.3a
mostraba una omisión real del catálogo, pero no había demostrado un commit inválido.

La base de planificación ahora se representa por ausencia de clave. Variantes
reales conservan sus IDs. Se mantienen el producto cartesiano y sus límites;
se rechazan pasos duplicados e IDs de variantes ambiguos dentro del mismo paso,
no IDs iguales de variantes pertenecientes a pasos distintos.

El codec distingue plantilla editable y definición histórica: permite `__base`
en plantillas compatibles con v1, pero conserva su rechazo en revisiones capturadas.
Allí el formato existente usa ese string como elección base explícita. No cambia
el significado de decisiones anteriores ni introduce un formato nuevo.
**Capturar/adoptar una definición que contenga esa variante sigue bloqueado** hasta
aprobar una representación histórica inequívoca. Crear/editar/eliminar su plantilla
y validar su calendario sí es posible; no se declara compatibilidad de ejecución
completa ni se activa esta diferencia en la interfaz pública.

Verificado en Node: catálogo, base/variante inválidas, combinaciones, ramas anidadas,
días, flexibilidad, 24:00 y cadenas; codec/roundtrip conserva decisiones y revisiones.
Chromium 156, 1280/390: rechazo no altera control/cabeza/autoridad/recibos; borrador
preservado; abortar TX conserva confirmado; exportar/recuperar/reintentar conserva
ID; acuse perdido no duplica; dos pestañas rechazan obsolescencia; hashes de
ejecuciones/revisiones/evidencias/fotos y archivo completo iguales. Sin errores JS.

La auditoría temporal, mediciones grandes y verificaciones finales quedan pendientes
del checkpoint B. No se autoriza B.3b ni se extrapolan pruebas UTC a calendarios locales.
