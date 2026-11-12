# Regresión opcional de guardados en Chromium

`pending-save.cjs` sirve los recursos reales de Fullhouse en un puerto efímero de
loopback y usa perfiles de navegador desechables. No utiliza datos personales ni
un servidor de desarrollo ya abierto. Cierra sus procesos al terminar y devuelve
un código de error si falla una aserción.

Requiere Playwright (probado con 1.56.1) y Chromium instalado. Se mantiene separado
de `npm test` para que la suite de reglas siga necesitando solo Node y TypeScript.
No se han añadido dependencias a la aplicación ni al lockfile.

En el entorno de Fullhouse publicado, Playwright ya está disponible externamente:

```sh
NODE_PATH=/workspace/.fullhouse-tools/node_modules node tests/browser/pending-save.cjs
```

Fuera de ese entorno, instala Playwright en una ubicación de desarrollo y apunta
`NODE_PATH` a su `node_modules`. Chromium se busca en `/usr/bin/chromium`; puedes
indicar otro ejecutable mediante `FULLHOUSE_CHROMIUM`. Para guardar una captura
móvil del aviso, añade `FULLHOUSE_PENDING_SCREENSHOT=/tmp/fullhouse-pending.png`.

Se ejecutan cuatro combinaciones: escritorio de 1280 px y vista móvil de 390 px,
con rechazos `QuotaExceededError` y `SecurityError`, usando Medianoche y fecha
sintética fija. Se comprueban:

- Formulario de meta, pasos, notas y revisión diaria ante escrituras fallidas.
- Original almacenado intacto, exportación del pendiente, reintento fallido y
  posterior reintento exitoso; recarga de la información confirmada.
- Avisos nativos `beforeunload` al recargar, salir del sitio y cerrar la página,
  con cancelación de la salida para conservar los cambios.
- Borrador de formulario y campo numérico todavía enfocado, navegación bloqueada
  con notas sin guardar y cancelación del descarte de una nota.
- Confirmación de descarte de pendientes y conservación al cancelarla.
- Ausencia de errores JavaScript.

Las dimensiones móviles corresponden a Chromium en modo adaptable, no a un
Android/iOS físico. El navegador puede no emitir `beforeunload` ante un cierre
forzado o cuando el sistema operativo elimina el proceso. La recuperación durable
de pendientes requiere comprobar una exportación antes de salir.
