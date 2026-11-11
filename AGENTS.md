# Fullhouse — instrucciones para agentes de programación

## Proyecto
Fullhouse es un prototipo web independiente para metas, submetas, rutinas, pasos y alternativas, calendario propio, eventos, horario, ejecución en «Mi día», progreso e historial. Se desarrolla por iteraciones con retroalimentación del usuario. No forma parte aún de Botánica/Stellar Warriors ni de Prisma; **no modifiques otros repositorios**.

## Arquitectura actual
- `app.tsx`: fuente principal React + TypeScript.
- `app.js`: JavaScript servido en producción. Mantén este archivo sincronizado con `app.tsx` al cambiar código; `tsconfig.json` configura `outFile: "app.js"`. Verifica con `tsc -p tsconfig.json` si el compilador está disponible; si no, informa qué falta sin afirmar que compiló.
- `index.html`, `styles.css`, `logo.svg`, `vendor/`: interfaz, estilos y bibliotecas locales.
- `.github/workflows/pages.yml`: publicar en GitHub Pages mediante cambios a `main`.
- `README.md` y `CAMBIOS.md`: contexto funcional y registro de decisiones. Consúltalos antes de modificar algo.

## Restricciones importantes
- Preserva las funcionalidades existentes y las cinco paletas actuales: Aurora, Océano, Atardecer, Bosque y Medianoche.
- Calendario y programación **propios**, sin sincronización con Google Calendar, Apple Calendar ni otros servicios externos, salvo solicitud explícita.
- Los datos personales se almacenan **localmente en el navegador**, hoy en `localStorage` con la clave histórica `fullhouse-v01`; el respaldo usa esquema `version: 1`. No borres, reinicies ni migres silenciosamente información. Si cambias persistencia, diseña migración y recuperación compatibles y explica el riesgo antes de implementarlo.
- No publiques datos de usuario, archivos de respaldo reales ni credenciales en GitHub.
- Cuida accesibilidad, manejo táctil, comportamiento de modales, legibilidad, responsividad y compatibilidad de horario/fecha.
- Evita cambios arquitectónicos amplios, nuevos servicios o dependencias innecesarias sin acuerdo previo.

## Forma de trabajo
1. Lee el código, `README.md` y `CAMBIOS.md`; confirma el comportamiento real antes de proponer cambios.
2. Limita cada tarea al alcance solicitado. Comunica incertidumbres o contradicciones; no elimines funciones por simplificar.
3. Trabaja en una rama y prepara cambios revisables. No hagas merge, push a `main`, despliegues ni cambios externos sin aprobación explícita: cualquier push a `main` activa GitHub Pages.
4. Comprueba TypeScript, sintaxis y flujos afectados. Si es posible, prueba interfaces en navegador, incluyendo móvil y tema Medianoche. Informa las pruebas realmente ejecutadas y sus resultados; no inventes verificaciones.
5. Si corresponde, actualiza `CAMBIOS.md` con un resumen verificable del cambio. Distingue propuestas de funcionalidades implementadas.
6. Antes de una versión con modificaciones en almacenamiento o calendario, recuerda realizar un respaldo JSON desde Ajustes.

## Primera tarea recomendada para Codex
Solo inspeccionar y resumir arquitectura, estados, persistencia, compilación, pruebas disponibles y riesgos. No modificar código en esa tarea. Presentar un plan incremental para mejorar testabilidad y seguridad de cambios, conservando el prototipo funcional.
