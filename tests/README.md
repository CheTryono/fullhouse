# Base de regresión de Fullhouse

Estas pruebas protegen la aplicación existente sin refactorizar `app.tsx`, cambiar
`app.js` ni modificar el esquema de datos. Todos los ejemplos son sintéticos.

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
  Actualmente debe fallar por los cinco casos documentados abajo.

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

## Cobertura inicial: 24 pruebas que pasan

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

## Cinco pruebas que fallan por errores existentes

| Identificador | Contrato comprobado | Resultado actual |
| --- | --- | --- |
| BUG-01 | Un fallo de escritura conserva el último estado guardado mientras no exista una recuperación explícita del estado pendiente. | `save` conserva los bytes previos pero sustituye los datos en memoria; una recarga pierde esos cambios. La corrección puede diseñar un estado pendiente explícito en lugar de rollback, adaptando este contrato de forma justificada. |
| BUG-02 | El validador rechaza entidades internas malformadas. | Acepta `goals: [null]` porque solo valida la estructura superior. |
| BUG-03 | Importar entidades malformadas conserva el contenido previo. | `routines: [null]` sustituye los datos actuales en memoria y almacenamiento. |
| BUG-04 | Un desplazamiento que excede el final del día se rechaza y mantiene visible la actividad. | Una actividad de 23:00 a 24:00 movida 15 minutos guarda 23:15; luego desaparece de `eventsOn` porque su marco es inválido. |
| BUG-05 | Editar una plantilla no cambia los pasos ni minutos interpretados de una ejecución histórica completada. | El historial usa la plantilla actual y muestra los pasos y tiempos nuevos. |

Tras corregir cada defecto en una tarea separada, mover su prueba a la suite de
regresión. No eliminar aserciones, añadir omisiones ni aceptar como correcto el
comportamiento defectuoso para obtener una suite verde.

## Limitaciones y siguientes ampliaciones

No se comprueban DOM, estilos, cinco paletas, móvil, foco, arrastre, interacción
real con los selectores, React ni su agrupación de actualizaciones. Tampoco la
cuota real del navegador, varias pestañas concurrentes, exportación descargada,
fallos de lectura de archivos, compresión de imágenes, zonas horarias o cambios
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
| `npm ci --ignore-scripts --no-audit --no-fund --cache /workspace/.fullhouse-tools/npm-cache` | Instalación correcta desde el lockfile. La caché externa es propia del entorno; `npm ci` es suficiente normalmente. |
| `npm run check` | Código 0; TypeScript y sintaxis correctos, compilación en memoria idéntica a `app.js`. |
| `npm run test:regression` | Código 0; 24 aprobadas, ninguna fallida ni omitida. |
| `npm run test:known-bugs` | Código 1; 5 fallidas por los defectos documentados, ninguna omitida. |
| `npm test` | Código 1; 29 ejecutadas, 24 aprobadas y 5 fallidas, ninguna omitida. |

No se realizaron pruebas nuevas de navegador en esta entrega. No se modificó el
código de la aplicación, las bibliotecas incluidas, la configuración TypeScript ni
el formato de almacenamiento.
