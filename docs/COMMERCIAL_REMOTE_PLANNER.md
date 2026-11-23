# Comercial 3B · integración asíncrona v1, solo laboratorio

Base `89540d8` (PR #21 / 3A fusionada). Rama de revisión `feat/commercial-remote-planner-v1`.
El planificador publicado y el acceso de staging conservan su almacenamiento
local. La nueva integración se ejecuta solo en loopback, proyecto fijo
`demo-fullhouse-remote`; no incorpora el motor histórico v2.

## Modelo de trabajo

`remote-client/session.ts` separa última revisión confirmada, copia de trabajo y
candidato inmutable por identidad. Antes de enviar conserva un journal local por
proyecto/UID/operación. El Planner muestra el candidato como pendiente; un recibo
compatible con su ID/base/hash permite anunciar confirmación. La ruta local
original sigue siendo síncrona. Los únicos cambios compartidos son hooks opcionales
de mensajes, bloqueo, aviso de cierre y espera de sesión en fotografías.

El laboratorio pausa nuevas acciones mientras hay un candidato pendiente o una
foto procesándose. No hay cola de múltiples ediciones ni mezclas automáticas.

## Estados y confirmación

| Estado | Qué significa y qué conserva |
| --- | --- |
| Pendiente | Candidato v1 conservado localmente, con ID/base/UID; aún sin confirmación remota |
| Confirmando | Calcula hash, inspecciona recibo y, si no existe, envía el mismo comando |
| Confirmado | Lectura o recibo verificado; ID, base, secuencia y SHA-256 corresponden al candidato |
| Error | Red, respuesta, integridad o sesión no comprobables; conserva candidato y última confirmación |
| Conflicto | Base obsoleta, identidad reutilizada o varios candidatos locales; no elige ni mezcla automáticamente |

`Planner.state.data` es la **copia de trabajo** en el laboratorio. La revisión
confirmada se conserva separadamente en `RemoteSession.confirmed`. Aceptar un
formulario significa preparar un candidato local; el mensaje dice «pendiente de
confirmación remota», no «guardado». El iframe queda inerte hasta resolverlo y no
emite el sonido de completado mientras hay pendiente. La ruta publicada sin este
puerto conserva sus mensajes y guardado local anteriores.

La confirmación es de una revisión conocida, no una promesa de vista siempre
actualizada entre dispositivos. No hay listeners ni sincronización automática:
la siguiente escritura usa CAS y detecta cambios de otra sesión. Cargar la versión
del servidor es siempre una acción explícita, con confirmación y sin borradores
locales abiertos. Las lecturas que sustituyen datos también pausan nuevas ediciones.

## Identidad, fallos y recuperación

- El journal vive en `fullhouse-remote-lab-v1:<proyecto>:<uid>:pending:<operación>`.
  Se conserva antes de enviar y se elimina solo tras comprobar el recibo. No lee
  `fullhouse-v01`, su alias ni los espacios locales de staging anteriores.
- Cada petición captura el token del usuario original antes de enviar. Si cambia
  la sesión durante un await, no usa el token de la siguiente cuenta ni aplica la
  respuesta allí. Puede existir un commit de la cuenta original: queda pendiente
  de inspección. Los tokens no se escriben en journals o exportaciones.
- Un reintento inspecciona primero el recibo. Recupera el mismo ID tras recarga o
  acuse perdido, sin repetir hechos. Una lectura/respuesta fallida no se anuncia
  como rollback. El servidor conserva CAS y revisiones de 3A, sin cambios.
- Si hay varios candidatos locales, pide seleccionarlos por ID. Ordenar sus IDs
  solo sirve para mostrarlos; ninguna fecha decide cuál prevalece.
- «Exportar candidato v1» produce un respaldo portable de los datos enviados,
  marcado en la interfaz como candidato sin confirmar. No incluye formularios que
  aún no se enviaron. Un journal corrupto conserva su exportación como **paquete
  local de recuperación**, no se presenta como un respaldo v1 válido.
- «Usar versión del servidor» archiva primero el candidato local y permite
  exportarlo posteriormente. No reenvía ni rebasa ese candidato y no cancela una
  petición que ya se esté procesando en el servidor.
- Consultar una revisión propia permite exportarla. Restaurarla exige confirmación
  y prepara una operación nueva contra la base conocida; 3A conserva las revisiones
  anteriores. Si otra sesión guardó entretanto, se obtiene conflicto.

Los formularios/notas sin enviar y fotografías aún procesándose permanecen en su
iframe original cuando cambia inesperadamente la cuenta. Se oculta y bloquea ese
iframe; solo la misma cuenta verificada puede recuperarlo. Una foto procesada
espera a que vuelva esa sesión antes de añadirse a su actividad original. Al cerrar
una sesión limpia se destruye su iframe; no se reutiliza su vista para otra cuenta.
La salida voluntaria se bloquea con pendientes/borradores y el cierre/recarga se
advierte. **RAM no es persistencia:** un cierre forzado puede perder formularios
sin enviar o una foto todavía procesándose. Solo el candidato ya conservado tiene
recuperación local demostrada tras recarga.

Los journals contienen datos personales y fotos sin cifrado adicional: los prefijos
separan la aplicación, no a alguien con acceso al perfil/DevTools del navegador.
Se conserva la política de equipos compartidos de 3A. No hay borrado físico ni
retención irreversible nueva.

## Compatibilidad e integración

`planner-port.ts` ofrece carga síncrona de una revisión ya obtenida asíncronamente
y preparación local de guardados; `session.ts` y `transport.ts` gestionan el
servidor. Se reutilizan los formularios y acciones reales de Planner. Los hooks
opcionales en app.tsx/app.js no importan código del cliente remoto en Pages.
Las guardas de PR #19 se ejecutan antes de preparar cada candidato. Importar un
archivo continúa siendo un reemplazo confirmado; se detiene si los datos cambian
mientras se lee. No hay migración, adopción automática o historia v2.

El primer intento de tests detectó que acceder directamente al puerto global
desde saveEvidence contaminaba el extractor puro de acciones históricas. Se
resolvió mediante un hook de instancia opcional: no se cambió el extractor ni se
relajó su rechazo de dependencias con efectos. Todos sus tests vuelven a pasar.

La consulta/restauración requiere un ID propio conocido; todavía no hay un
explorador paginado de revisiones. No se presenta como paridad completa de una
interfaz cloud ni sincronización en tiempo real.

`build:remote-lab` genera solo `dist-remote-lab` ignorado por Git. Su servidor escucha
en 127.0.0.1:5012 y el cliente rechaza proyectos reales/orígenes no locales. No forma
parte del build de staging ni del allowlist de GitHub Pages. El backend mantiene
la barrera demo y no se cambian reglas, esquema, Functions ni configuración Hosting.
El bundle del laboratorio expone `FullhouseRemoteLab.simulateSessionLoss` para
ensayar la pérdida inesperada de sesión; esa función no existe en los bundles públicos.

## Ejecución

Node 22+ y Java 21 para la suite completa. En este entorno se usó Node 24.22.1.

```sh
npm ci
npm ci --prefix remote
npm run check:remote-client
npm run test:remote-client
npm run test:remote:planner
npm run dev:remote
```

El laboratorio crea solo dos cuentas sintéticas verificadas del emulador:
`lab_A@example.test` y `lab_B@example.test`, contraseña `Synthetic-Password-2030!`.
Abrir http://127.0.0.1:5012. No usar datos reales. `dev:remote` no publica ni necesita
facturación. Las pruebas Node usan el Planner real con su arnés, sin renderizar DOM.

Para Chromium, Playwright debe estar disponible; en Codex se usa el NODE_PATH de
las herramientas externas ya instaladas:

```sh
NODE_PATH=/workspace/.fullhouse-tools/node_modules npm run test:remote:planner:browser
```

Si Firestore/Storage no pueden descargarse, existen recorridos explícitamente
distintos con **Auth real en emulador y datos simulados**, no equivalentes a la
validación de Firestore/Storage:

```sh
npm run test:remote:planner:simulated
NODE_PATH=/workspace/.fullhouse-tools/node_modules npm run test:remote:planner:browser:simulated
```

No ejecutar suites de emuladores simultáneamente: comparten puertos. El runner
quita credenciales heredadas y fuerza el proyecto demo y endpoints loopback.

## Resultados y pendientes

- Cliente asíncrono: 13 pruebas Node (estados, cuota local, hash/recibo inválido,
  ID estable, acuse perdido, dos cuentas/sesiones, recuperación, PR19 e importación
  asíncrona obsoleta): 13 aprobadas.
- `npm test`: 519 aprobadas, cero fallos y los seis TODO previos (525 casos).
  `check`, `check:remote`, `check:remote-client`, `check:auth` y
  `check:history-contract`: correctos. El build de staging se comprobó configurado
  para fullhouse-staging sin emulador ni código del laboratorio; no se desplegó.
- Integración HTTP con Auth real en emulador y almacenamiento simulado: 6 aprobadas.
- Chromium 156: escritorio 1280 y viewport 390; pendiente antes del acuse, exportación,
  recarga/reintento, conflicto, recuperación explícita y cuentas A/B; también pérdida
  forzada de sesión con formulario sin enviar y foto retenida hasta volver al UID
  original. Sin errores JS.
  El contenedor del laboratorio permite desplazamiento normal para alcanzar botones.
- Regresiones públicas Chromium: guardado pendiente (cuota/acceso, 1280/390), límites
  del día/dependencias (1280/390) y guardas/copia histórica (cinco paletas, 1280/390)
  aprobadas. No son pruebas de teléfonos físicos, Firefox ni WebKit.
- La nueva suite completa `test:remote:planner` no arrancó: la descarga del JAR de
  Firestore sigue bloqueada por la red del entorno. Se debe ejecutar en Cloud Shell
  antes de declarar comprobada 3B con Firestore/Storage. Las 9 pruebas de **3A**
  comunicadas por el propietario son evidencia heredada, no una ejecución de 3B.
- No se oculta el bloqueo con TODO ni se atribuye al BUG-05 conocido. La reproducción
  pública original de BUG-05 conserva su comprobación y pasa por las guardas v1.

Antes del lanzamiento faltan: suite completa 3B, runtime Node 22, IAM y App Check/
antiabuso, cuotas reales, retención y privacidad aprobadas, configuración/Blaze
autorizados, y adaptación final del cliente remoto fuera del laboratorio.

El outbox usa localStorage y conserva también la base: puede requerir casi el doble
del respaldo. El límite servidor de 8 MiB **no garantiza** espacio local disponible.
Si no puede conservarse el candidato, no lo envía y mantiene la pantalla RAM de
BUG-01 con exportación/reintento. Antes de fotografías reales se debe medir capacidad
y decidir un outbox durable adecuado y limpieza explícita de copias archivadas.
No hay cola de múltiples acciones, merge de conflictos ni pruebas de escalabilidad.
La PR no activa almacenamiento remoto en usuarios ni autoriza servicios/despliegue.
