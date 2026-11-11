# Base de regresión de Fullhouse

Estas pruebas ejecutan el JavaScript servido de la aplicación en aislamiento.
El arnés no requiere refactorizar producción ni cambiar el esquema de datos.
Todos los ejemplos son sintéticos.

## Instalación y comandos

Requiere Node.js 20 o posterior y npm. Desde la raíz del repositorio:

```sh
npm ci
npm run check
npm run test:regression
npm run test:known-bugs
npm test
```

- `npm ci` instala únicamente TypeScript 5.9.3 como dependencia de desarrollo,
  usando el lockfile y su comprobación de integridad. No hay dependencias nuevas
  de ejecución para la aplicación.
- `npm run check` comprueba TypeScript sin emitir archivos, la sintaxis del
  JavaScript servido y su correspondencia exacta con una compilación en memoria.
  Falla si la fuente y `app.js` divergen; no sobrescribe archivos para hacerlo pasar.
- `npm run test:regression` ejecuta la base que pasa actualmente.
- `npm run test:known-bugs` ejecuta contratos deseados que fallan por problemas
  existentes. Termina con código 1; no son pruebas omitidas ni fallos convertidos
  en éxitos.
- `npm test` ejecuta ambas suites y conserva el código de fallo del ejecutor.
  Actualmente debe fallar por los tres casos documentados abajo.

No es necesario iniciar un servidor ni acceder a servicios externos para ejecutar
las pruebas. Cada caso obtiene su propio contexto, almacenamiento y controlador.
No se lee ni se escribe el almacenamiento de ningún navegador real.

## Diseño y alcance

`helpers/app.cjs` carga el `app.js` real con `node:vm` y accede a las funciones y
al controlador `Planner` sin añadir exportaciones a producción. La fecha está
fijada al lunes 7 de enero de 2030 a mediodía local. El adaptador de React solo
implementa estado síncrono; no renderiza elementos ni ejecuta ciclos de vida.
El almacenamiento es un `Map`, con errores de lectura/escritura configurables.
`FileReader` entrega texto de forma asíncrona para ejercitar el método real de
importación, incluida la confirmación y cancelación.

Las pruebas comprueban resultados observables: bytes persistidos, estado
restaurado, apariciones por fecha, marcos horarios, pasos activos y registros
históricos. El control de compilación evita probar un JavaScript que haya quedado
desactualizado respecto a TypeScript. Ejecutar `npm run check` junto con las suites.

Este arnés depende de los nombres internos actuales; renombrar o modularizar las
funciones requerirá adaptar el arnés. Cuando se extraigan módulos, podrán
importarse directamente conservando los mismos casos y datos.

## Cobertura: 74 pruebas que pasan

| Área | Comportamientos comprobados |
| --- | --- |
| Persistencia | Guardado y recarga de registros, alternativas, notas y evidencia sintética; aviso y bytes previos ante error de escritura; lectura fallida; migración del almacén anterior. |
| Respaldos | Rechazo de raíces inválidas y versiones incompatibles; importación válida, cancelación, JSON roto y conservación de los datos ante rechazo. |
| Rutinas y programación | Creación con subpasos; rechazo de duración fija inválida; programación y rechazo de otra programación futura de la misma rutina. |
| Reprogramación | División pasado/futuro; traslado de registros futuros al nuevo identificador; conservación de registros y horario anteriores. |
| Dependencias | Reajuste al mover límites; rechazo de un movimiento sin intervalo; ausencia de límites y ciclos; cancelación futura conservando registros anteriores. |
| Alternativas | Selección por día con subpasos anidados; alternativas manuales obligatorias; selección limitada a una fecha; reinicio de marcas solo en la ejecución afectada. |
| Duraciones | Reparto ponderado con redondeo y suma exacta; hojas dentro de contenedores; exceso de tiempos fijos y tiempo sobrante sin contenidos flexibles. |
| Límites e historial | Rechazo de marcos fuera del día, final exacto a medianoche, ajuste inferior a 00:00; eliminación de programación conservando ejecuciones anteriores y la ejecución de hoy ya registrada. |

El ajuste a 00:00 al intentar mover una actividad antes del comienzo del día es
el comportamiento actual y produce un intervalo válido. No se clasifica aquí
como defecto confirmado. El desbordamiento al final del día sí puede ocultar la
actividad y tiene un caso fallido separado.

## BUG-02 y BUG-03 corregidos

Sus reproducciones ahora forman parte de `regression.test.cjs` y pasan. El
validador examina las entidades internas y los campos conocidos: metas e
historiales, rutinas, pasos y alternativas recursivos, eventos y excepciones,
registros, notas, fotografías y revisiones diarias. Rechaza identificadores
duplicados, tipos incorrectos, fechas/horas inválidas y cantidades no finitas o
negativas. Los árboles de pasos se recorren de forma iterativa.

Se mantienen la versión `1` y la clave `fullhouse-v01`. Los campos añadidos en
revisiones posteriores siguen siendo opcionales; los campos desconocidos se
conservan. No se exige que referencias históricas apunten a elementos todavía
existentes. No hay normalización, eliminación de campos ni migración de datos.

`fixtures/backups.cjs` contiene representaciones sintéticas de un respaldo
antiguo mínimo y otro con funcionalidades recientes, no archivos de personas.
La compatibilidad se comprueba sin campos opcionales modernos y con historial
huérfano, además de importar/recargar sin perder contenido. No se afirma haber
verificado archivos reales de todas las versiones anteriores.

La importación valida antes de escribir y solo actualiza el estado tras una
escritura correcta. Las pruebas comprueban igualdad del estado anterior y de los
bytes originales ante entidades malformadas y falta de espacio, además de
lectura fallida, abortada o lanzada como excepción. Los mensajes distinguen
formato incompatible, JSON ilegible y almacenamiento bloqueado/lleno. Se conserva
la referencia al selector antes de esperar confirmación, porque React 16 libera
el evento; hay casos para aceptar y cancelar con el evento ya liberado.

La fixture inicial de evidencia se ajustó para incluir `caption`, como el formato
que exporta la aplicación. No se ha cambiado el formato de datos de producción.

## Tres pruebas que fallan por errores existentes

| Identificador | Contrato comprobado | Resultado actual |
| --- | --- | --- |
| BUG-01 | Un fallo de escritura conserva el último estado guardado mientras no exista una recuperación explícita del estado pendiente. | El método general `save` conserva los bytes previos pero sustituye los datos en memoria. La restauración de respaldos ya evita ese método; el defecto sigue pendiente en otros guardados. |
| BUG-04 | Un desplazamiento que excede el final del día se rechaza y mantiene visible la actividad. | Una actividad de 23:00 a 24:00 movida 15 minutos guarda 23:15; luego desaparece de `eventsOn` porque su marco es inválido. |
| BUG-05 | Editar una plantilla no cambia los pasos ni minutos interpretados de una ejecución histórica completada. | El historial usa la plantilla actual y muestra los pasos y tiempos nuevos. |

Tras corregir cada defecto en una tarea separada, mover su prueba a la suite de
regresión. No eliminar aserciones, añadir omisiones ni aceptar como correcto el
comportamiento defectuoso para obtener una suite verde.

## Limitaciones y siguientes ampliaciones

La suite de Node no comprueba DOM, estilos, cinco paletas, móvil, foco, arrastre, interacción
real con los selectores, React ni su agrupación de actualizaciones. Tampoco la
cuota real del navegador, varias pestañas concurrentes, exportación descargada,
fallos de lectura de archivos en navegadores específicos, compresión de imágenes, zonas horarias o cambios
de horario estacional. Las evidencias de la prueba son cadenas sintéticas; no se
ejercita su decodificación.

Estos flujos se pueden cubrir posteriormente con pruebas de navegador y perfiles
desechables, sin cambiar la arquitectura. El estado síncrono del adaptador no
sustituye esas pruebas. Las combinaciones de alternativas anidadas, calendarios
lejanos y eliminación en cascada de más de un nivel también merecen ampliar los
casos. Esta es una base inicial, no una afirmación de cobertura completa.

No se ha añadido ni alterado el flujo de GitHub Pages. La automatización en CI
queda para una tarea posterior; al incorporarla, separar explícitamente la base
obligatoria de las reproducciones de errores conocidos sin ocultar sus fallos.

## Resultados verificados en esta entrega

Node.js 24.22.1, npm 11.9.0 y TypeScript 5.9.3:

| Comando | Resultado |
| --- | --- |
| `npm run check` | Código 0; TypeScript y sintaxis correctos, compilación en memoria idéntica a `app.js`. |
| `npm run test:regression` | Código 0; 74 aprobadas, ninguna fallida ni omitida. |
| `npm run test:known-bugs` | Código 1; 3 fallidas por los defectos documentados, ninguna omitida. |
| `npm test` | Código 1; 77 ejecutadas, 74 aprobadas y 3 fallidas, ninguna omitida. |

También se ejecutó una comprobación puntual en Chromium con Playwright del
entorno: escritorio 1280×900 y móvil 390×844, ambos con Medianoche. Se comprobó
selección real de archivos, confirmación, rechazo de JSON roto/entidades nulas,
escritura con cuota simulada y restauración/recarga correctas, sin errores JS.
En móvil se abrió Ajustes en escritorio antes de reducir la ventana, porque la
navegación móvil actual no incluye ese acceso. Esta comprobación no implica
cobertura completa de navegación móvil ni de las cinco paletas.

Comandos de la comprobación puntual: `python3 -m http.server 5500 --bind 127.0.0.1` desde la raíz y `node /tmp/fullhouse-backup-browser.cjs`. El script fue
una comprobación temporal del entorno, no parte de la suite reutilizable del
repositorio. No se añaden dependencias de navegador al proyecto. Las
bibliotecas incluidas, la configuración TypeScript y el esquema de almacenamiento
no cambiaron; `app.js` fue recompilado desde `app.tsx`.
