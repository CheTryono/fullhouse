# Comercial 3A · contrato mínimo de persistencia remota v1

Base: origin/main `0953ce3` (PR #20). Rama `feat/commercial-remote-storage-contract`.
**Backend aislado, solo emuladores; no disponible todavía en Planner.** No usa el
motor histórico v2 ni cambia los respaldos `version: 1`. No crea proyectos, bases,
buckets, cuentas reales, facturación, despliegues ni migraciones.

## Modelo y propiedad

Firestore Standard / Native en el laboratorio, proyecto fijo
`demo-fullhouse-remote`. No se ha consultado ni creado una base real. El documento
principal queda fuera de Firestore para evitar su límite de 1 MiB:

| Ruta Firestore | Contenido, siempre escrito por servidor |
| --- | --- |
| `users/{uid}/storage/head` | `uid`, `revisionId`, `sequence`, `format: 1` |
| `users/{uid}/revisions/{operationId}` | Recibo + `backupHash`, `snapshotHash`, `snapshotBytes`, `photoCount` |
| `users/{uid}/operations/{operationId}` | Recibo idempotente inmutable |

Recibo: `uid`, `operationId`, `revisionId`, `baseRevision` (ID o null), `sequence`,
`requestHash`, `kind` (save/restore), `restoredFrom` (ID o null), `createdAt`
(Timestamp del servidor). `revisionId = operationId`; IDs de operación de 16–80
caracteres `[A-Za-z0-9_-]`, reservados por el cliente antes del primer intento.
`sequence` aumenta exactamente una unidad por commit; las fechas no resuelven CAS.
No se necesita documento raíz `users/{uid}`: es un namespace privado, sin perfiles
públicos ni roles editables por clientes. No hay consultas de colección cliente,
listeners ni índices compuestos en esta entrega: únicamente get de IDs conocidos.

Cloud Storage, sin URLs públicas, tokens de descarga ni escrituras de clientes:

| Objeto privado | Contenido |
| --- | --- |
| `users/{uid}/revisions/{operationId}.json` | Sobre interno `fullhouse-remote-v1`, documento y referencias de fotos |
| `users/{uid}/photos/{sha256}.dataurl` | Bytes UTF-8 exactos del `src` de una fotografía v1 |

La deduplicación de fotos es **por UID y cadena data-URL exacta**, nunca entre
cuentas. En esta PR se conserva base64 para no reescribir imágenes legítimas:
consume aproximadamente un tercio más que el binario. No se decodifican imágenes,
no se solicitan URLs externas ni se inventan equivalencias entre codificaciones.
El hash de foto identifica la cadena original, no el binario JPEG decodificado.
Notas, marcas, elecciones, IDs de evidencia, propietarios y campos desconocidos
permanecen en su registro. El sobre lleva posiciones exactas `logKey/position`;
no reasigna datos por título o similitud. No es un esquema histórico v2.

## API callable y validación

`remote/index.cjs` exporta:

| Operación | Entrada |
| --- | --- |
| `saveRemoteV1` | `{operationId, baseRevision, backup}`; backup es texto JSON v1 |
| `readRemoteV1` | `{revisionId}`; null consulta la cabeza, null de respuesta indica cuenta sin revisión |
| `restoreRemoteV1` | `{operationId, baseRevision, restoreRevision}` |
| `inspectRemoteV1` | `{operationId}`; recibo confirmado o null |

Todas obtienen el UID exclusivamente del contexto Auth verificado por el middleware
callable, exigen `email_verified === true` y rechazan campos adicionales, incluido
`uid`. Los UID automáticos de Firebase son compatibles; UID personalizados fuera
de `[A-Za-z0-9_-]{1,128}` están fuera del contrato inicial. La prueba del emulador
no sustituye la validación de firma/audiencia de tokens del servicio real.

`remote/v1-validator.cjs` es una copia generada de la función autocontenida
`validData` **pública**, sin ejecutar Planner/VM ni importar `history/` o contratos
experimentales. `check:remote` detecta divergencias y obliga a regenerarla cuando
cambie producción. Se conservan las reglas para referencias históricas borradas,
minutos fraccionarios y campos desconocidos. No convierte legado en capturas.
Valida formato y estructura, no reemplaza las guardas funcionales de PR #19: la
integración posterior deberá seguir usándolas y confirmar importaciones/restauros.

Límites provisionales explícitos: respaldo 8 MiB UTF-8, revisión interna 9 MiB,
foto 2 MiB de data-URL, 2.000 referencias fotográficas, claves fotográficas 1.024
bytes, 100.000 nodos y profundidad 64. Rechazar un respaldo grande no lo modifica.
Se conservan las nueve versiones históricas 0.1–0.9 dentro de esos límites, no se
promete admitir cualquier tamaño de respaldo legítimo. No elevar límites sin
comprobar memoria, tiempos y límites de transporte de Functions.

## Guardado confirmado, concurrencia y recuperación

1. El cliente futuro conserva separado su confirmado, candidato y borrador, ligado
   a UID/proyecto/base. No entrega datos locales a una cuenta por iniciar sesión.
2. El servidor valida, calcula huellas SHA-256 y consulta recibo/base. El mismo ID
   con otro contenido se rechaza; con el mismo comando puede reintentarse.
3. Crea fotos y revisión con `ifGenerationMatch: 0`, sin sobrescribir objetos;
   verifica tamaño y hash mediante lectura antes de publicar metadatos.
4. Una transacción Firestore compara la base actual y crea revisión, recibo y
   cabeza juntos. Verifica también identidad/secuencia de la revisión padre.
   Otra pestaña con base obsoleta recibe conflicto y debe conservar su candidato.
5. Lee de nuevo recibo, revisión y fotos, valida hashes y reconstruye un v1 completo
   antes de responder con una confirmación. El cliente no anuncia éxito antes.

**Firestore y Storage no comparten una transacción.** Una interrupción previa al
commit puede dejar objetos privados huérfanos, pero no cambia la cabeza confirmada.
No se borran automáticamente; el mismo comando puede reutilizar bytes idénticos.
Un error de lectura posterior o un acuse perdido **no demuestra rollback**:
`inspectRemoteV1` verifica el recibo y su contenido. Un recibo ausente no elimina
archivos preparados ni permite reutilizar ese ID para otro comando.

Restaurar añade una revisión nueva desde otra revisión propia íntegra, usando CAS;
no borra la revisión que estaba activa. Leer reconstruye todas las fotos y vuelve
a validar v1. Una referencia faltante/hash incorrecto produce `data-loss`, nunca
datos de ejemplo ni una exportación incompleta presentada como respaldo completo.
La conservación de revisiones no protege frente a eliminación del proyecto/bucket,
fallos administrativos o pérdida de un blob compartido por varias revisiones.
Seguir exportando respaldos portables independientes es necesario.

Este contrato no implementa todavía la cola/borradores persistentes de la interfaz,
sincronización offline, descarga UI, resolución visual de conflictos ni cambios al
puerto síncrono local. Son trabajo de 3B; no deben conectarse cambiando simplemente
`localStorage.setItem` por una promesa. No promete recuperar RAM tras cierre forzado.

## Reglas, amenazas y privacidad

Firestore permite solo get de metadatos al mismo UID con correo verificado. Todas
las creaciones/actualizaciones/eliminaciones cliente están denegadas; no existen
validadores de escrituras permitidas en reglas porque no se permite ninguna.
Storage deniega también las lecturas cliente: el servidor autenticado realiza la
recuperación e integridad. Admin SDK omite las reglas; por eso cada operación del
servidor deriva la propiedad y valida sus entradas. Estas reglas no sustituyen IAM.

| Ataque o fallo | Protección / evidencia |
| --- | --- |
| UID ajeno en cuerpo, sesión ausente/no verificada | Rechazo, probado con Auth + Functions reales de emulador |
| Otra cuenta leyendo revisión | Namespace derivado de Auth; probado con puertos; reglas reales pendientes |
| Listado público, lectura entre UID o de subcolecciones, roles falsos | Denegaciones explícitas; suite Firestore pendiente de ejecutar |
| Crear/actualizar/borrar, omitir campos, tipos falsos, cambio de propietario o fecha | Ninguna escritura cliente permitida; suite Firestore pendiente |
| Foto privada/URL de descarga, sobrescritura/borrado cliente | Sin tokens, denegación total; suite Storage pendiente |
| Arreglos/cadenas enormes y JSON profundo | Límites previos a subidas; pruebas unitarias |
| Repetición, base obsoleta y acuse perdido | CAS, recibos/objetos inmutables; puertos probados, TX real pendiente |
| Hash corrupto o referencia duplicada/faltante | Bloqueo, sin respaldos degradados; puertos probados, Storage real pendiente |

No hay borrado físico, bloqueo legal de retención ni eliminación automática de
revisiones en esta PR. Antes de datos reales se debe aprobar retención, borrado de
cuenta/fotos y tratamiento de copias/exportaciones, sin prometer conservación
eterna y eliminación de todas las copias a la vez. Google administra el cifrado
del servicio; esto no es cifrado de extremo a extremo ni aislamiento del operador.

Las reglas son un prototipo que necesita revisión y ejecución completa antes de
compartir ampliamente la aplicación. Declaración de la guía aplicada:
"I've set up prototype Security Rules to keep the data in Firestore safe. They
are designed to be secure for owner-only verified reads and server-only writes.
However, you should review and verify them before broadly sharing your app.
If you'd like, I can help you harden these rules."

## Reproducción y resultados

Node 22 para el runtime previsto; pruebas ejecutadas con Node 24.22.1 y Java 21.
El emulador avisa que usa Node 24 del host, por lo que Node 22 queda por comprobar.

```sh
npm ci
npm ci --prefix remote
npm run check:remote
npm run test:remote
node scripts/test-remote-emulators.cjs --auth-only
npm run test:remote:emulator
```

El runner usa solo `demo-fullhouse-remote`, loopback y configuración temporal; no
hereda credenciales reales. El backend rechaza inicializar fuera del emulador demo.
No se toca `firebase.staging.json` ni el build/Hosting/Pages.

- Unitarias: 8 aprobadas, incluida ida/vuelta con fotos, fuentes 0.1–0.9, fallos,
  restauración, CAS e idempotencia con puertos simulados, sin prueba de reglas.
- Auth + Functions: 1 prueba HTTP aprobada, 3 rechazos reales comprobados. Los
  cuatro callables cargan. El CLI emite avisos de eventos Auth no disparados;
  no hay triggers Auth en este backend y las respuestas comprobadas son correctas.
- Suite completa: **bloqueada antes de ejecutar pruebas**. La descarga oficial de
  `cloud-firestore-emulator-v1.22.0.jar` desde `storage.googleapis.com` devuelve
  403. La política de red del entorno no incluye ese dominio. La descarga elevada
  también fue rechazada por la red; no fue un rechazo del auto-review.
  Es necesario permitir ese dominio o ejecutar la suite en un entorno con acceso.
- La suite preparada contiene 9 escenarios end-to-end (dos cuentas, reglas,
  transacciones, cuota simulada, interrupciones, corrupción y nueve respaldos).
  No son 9 pruebas aprobadas: Firestore/Storage, sus reglas y CAS real permanecen
  sin verificar. El emulador tampoco demuestra cuota real ni persistencia del
  proveedor ante caída física. No se añaden TODO para ocultar este bloqueo.
- `npm run check`, `check:auth`, `check:history-contract`, `check:remote`: correctos.
  `npm test`: 506 aprobadas, cero fallos y seis TODO previos (512 casos). Incluye
  regresiones locales/guardas comerciales sin modificar. No se repiten pruebas
  Chromium públicas porque no cambiaron controles, autenticación ni recursos web.
- Auditorías de dependencias de producción (`npm audit --omit=dev`): cero avisos
  en raíz y backend. Los avisos moderados conocidos del CLI de desarrollo no se
  corrigen ni se confunden con dependencias entregadas al navegador.

## Configuración humana y coste antes de integración real

No ejecutar deploy con `firebase.remote-emulators.json`. Para una PR posterior:

1. Decidir región y aprobar por separado Firestore Standard/Native, bucket privado,
   Functions y el paso a Blaze. Crear regiones requiere cuidado por residencia de
   datos y posibles costes; aquí no se ha habilitado nada.
2. Cloud Storage/Cloud Functions requieren facturación Blaze para el uso real.
   Revisar tarifas/cuotas vigentes y presupuesto; las alertas **no limitan gasto**.
   Se cobran según uso invocaciones/cómputo, operaciones Firestore, bytes guardados,
   operaciones Storage y transferencias. Fotografías y retención dominan crecimiento.
   Cada guardado conserva un JSON completo sin las fotos; no es un motor incremental.
   Antes de integración hay que medir frecuencia/tamaño y fijar límites por cuenta
   y retención aprobada. No prometer almacenamiento ilimitado ni borrar para ahorrar.
3. Proporcionar una identidad de ejecución con IAM mínimo (Firestore necesario y
   creación/lectura de objetos del bucket, sin borrado). No usar credenciales Admin
   en navegador ni cuentas de servicio/claves en Git.
4. Aprobar autenticación verificada, App Check/medidas antiabuso, cuotas por cuenta,
   límites de concurrencia y retención antes de aceptar datos/pagos reales. Dos
   instancias máximas del prototipo no equivalen a un límite monetario.
5. Ejecutar y revisar pruebas completas, ajustar región/runtime y retirar la barrera
   demo mediante una PR autorizada, con configuración real independiente y reversión.
6. Conectar la UI solo después: guardado pendiente, conflictos, importación explícita
   y backups. Ninguna lectura de `fullhouse-v01`/alias se incorpora automáticamente.

**No está listo para activar almacenamiento remoto ni para desplegar a staging.**
El siguiente paso mínimo es completar las pruebas Firestore/Storage; después,
revisar reglas/contrato y preparar la integración 3B sin activar servicios por defecto.
