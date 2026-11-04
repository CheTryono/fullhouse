# FULLHOUSE — Prototipo web v0.1

**Fullhouse** es una herramienta independiente de organización integral: metas, rutinas, calendario propio y progreso. Es la versión ligera para prueba e iteraciones, sin sincronización con calendarios ni servicios externos.

## Cómo empezar

### Abrir en tu equipo

1. Descomprime el ZIP.
2. En Windows, ejecuta `iniciar-windows.bat` (requiere Python). Se abrirá `http://127.0.0.1:5500`.
3. También puedes abrir `index.html` directamente para inspeccionar el diseño, pero para conservar datos con mayor fiabilidad usa un servidor local.

### Tener una página web permanente y actualizarla como Prisma

Incluimos el archivo `.github/workflows/pages.yml` para que **cada cambio subido a la rama `main` publique automáticamente una nueva versión del sitio** en GitHub Pages, sin tener que subir ZIP nuevos a mano.

1. Crea un repositorio **nuevo y separado** en GitHub, por ejemplo `fullhouse`, y sube el contenido de esta carpeta (los archivos, no la carpeta ZIP).
2. Desde `Settings → Pages → Build and deployment → Source`, selecciona **GitHub Actions**.
3. En la pestaña `Actions` aparecerá el despliegue al subir cambios a `main`.
4. El sitio quedará en una URL tipo `https://TU-USUARIO.github.io/fullhouse/` (la URL exacta se confirmará en el apartado Pages del repositorio).
5. Para actualizarlo, sustituimos los archivos modificados en ese repositorio y hacemos `git push` a `main`.

*GitHub Pages en el plan gratuito requiere un repositorio público. Es útil para esta fase de prototipo, pero no está destinado a alojar un SaaS comercial. Para una versión de pago elegiremos otro alojamiento.*

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