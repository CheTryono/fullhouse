# Comercial 3C.2 · contrato Gratis/Premium inactivo

`remote-staging/media.cjs` envuelve el servicio v1 solo en el backend staging
cerrado. No cambia Planner, claves locales, formato de respaldo v1 ni backend 3A.
No hay pagos, migración, borrado ni plan comercial disponible al público todavía.

## Cuotas propuestas y aplicadas en código desactivado

| Recurso | Gratis | Premium |
| --- | --- | --- |
| Metas/rutinas/calendario/notas/revisiones | Funciones actuales de texto | Igual |
| Documento de texto UTF-8, excluyendo solo `evidences[].src` | 1 MiB | 2 MiB |
| Nuevas imágenes/referencias en nube | No | JPEG/PNG/WebP, hasta **600.000 bytes de data URL** por imagen (~450 KB binarios) |
| Inventario histórico por UID | Conservar lo confirmado | Hasta **100 fuentes únicas**, **200 referencias**, **50 MiB** de fuentes data URL acumuladas |
| Respaldo v1 completo actual | **8 MiB incluyendo imágenes** | **8 MiB incluyendo imágenes** |
| Leer/exportar imágenes propias tras una baja | Sí, sin Premium | Sí |

Requieren aprobación antes de publicitarse. Son cotas, no capacidad simultánea
garantizada: el límite v1/controles de ensayo pueden alcanzarse antes. No se eleva
ningún límite defensivo 3A. Texto confirmado por encima de la cuota tras una baja
puede conservarse/editarse si no crece; no se trunca ni exige borrar fotografías.

## Derecho confiable

Documento privado `billingEntitlements/{uid}` con esquema exacto:

```json
{
  "version": 1,
  "uid": "synthetic-A",
  "tier": "premium",
  "source": "payments-backend",
  "status": "active",
  "revision": "server-verified-payment-event",
  "validFromMs": 1900000000000,
  "validUntilMs": 1900003600000
}
```

El servidor verifica UID, estado, intervalo de enteros seguros y reloj propio.
Ausencia/caducidad/revocación/forma inválida no conceden imágenes nuevas; lectura,
exportación y texto no requieren Premium. Fallo al consultar el derecho detiene
el guardado, sin inventar permiso. No se usan claims ni flags Premium del navegador.

`payments-backend` identifica el futuro escritor confiable que deberá verificar
webhooks, usuario/suscripción, periodos y revocaciones idempotentes. **No existe
todavía**; el string no autentica nada por sí solo. La confianza proviene de la ruta
privada leída por Admin. Reglas deny-all rechazan cliente; IAM de Firestore no aísla
colecciones del Admin, por lo que el operador/backend son frontera de confianza.
No se expone una API para escribir derechos. En el ensayo se admite
`staging-owner` solo para UID autorizado por servidor y vigencia **máxima 24 h**;
el propietario lo registrará tras autorizar el ensayo, nunca desde el formulario.

## Imagen nueva frente a referencia conservada

Inventario inmutable por `SHA256(JSON.stringify([logKey,id]))`:
`{logKey,id,kind,stepId,createdAt,sha256,bytes}`. El contenido se identifica por bytes
UTF-8 exactos de la data URL; no acredita autenticidad contra código malicioso.
Deduplicación solo dentro del UID; cada referencia conserva su identidad/propietario.

- Misma vinculación/contenido/contexto: conservación sin Premium. Caption y notas
  son editables como texto; no se renumeran IDs/pasos.
- Otro ID/registro/contexto: incorporación nueva, aunque el blob ya exista.
- Reutilizar ID en el mismo registro para otro contenido/contexto se bloquea para
  ambos niveles. El futuro formulario deberá crear un ID nuevo para reemplazos;
  no se reescriben hechos. Duplicados en un registro se rechazan.
- Evidencia previa proviene de la **base confirmada propia** y del inventario.
  Restaurar consulta además la revisión propia elegida, con validación de hashes;
  permite recuperar su referencia original sin Premium. Un respaldo v1 inicial
  con fotos necesita Premium: timestamps y declaraciones del cliente no prueban
  propiedad. La revisión de otra cuenta no sirve como autorización.

Los campos de extensión v1 se preservan, pero data URLs de imagen fuera de
`logs.*.evidences[].src` se rechazan, incluso en notas. No hay otra ruta de imágenes
ocultas. No es posible impedir toda codificación arbitraria de bytes como texto;
la política cubre imágenes interpretadas por Fullhouse y acota el resto como texto.

Nuevas imágenes: tamaño, base64 canónica y firma inicial compatible con MIME.
No es decodificador completo, antivirus ni sanitizador. Objetos privados de texto,
sin URL pública ni respuesta HTML. Imágenes ya confirmadas válidas v1 (incluido
GIF) se conservan sin reconvertir bytes ni aplicar retroactivamente el límite nuevo.
Un GIF nuevo requiere conversión explícita a un formato admitido; no se transforma
un respaldo automáticamente.

## Inventario, transacción y recuperación

`users/{uid}/mediaUsage/head`: `{version:1,complete,bindings:{hash:descriptor}}`,
metadata sin fotos. Límite defensivo 512 KiB/2.000 referencias heredadas; nuevas,
200. Inventario corrupto bloquea escrituras, no reinicia datos ni bloquea por sí
solo lectura/exportación mediante el servicio v1.

Cuenta nueva sin head: inventario completo vacío. Cuenta anterior con revisiones
sin inventario: **incompleto**, conserva referencias verificadas en sus revisiones
sin acumularlas en el inventario durante un guardado de texto; permite texto/restauración y bloquea imágenes nuevas incluso con
Premium. Completarlo requiere un procedimiento separado de reconciliación de todas
sus revisiones. No hay barrido/migración automática ni inferencia de que la última
revisión contenga todas las fotos históricas. Los IDs antiguos largos no fuerzan una
conversión de inventario para poder editar texto. Referencias antiguas contradictorias
con el mismo propietario/ID requieren conciliación, no una sustitución automática.

1. Mantener Auth verificado/App Check/UID/allowlist/controles/cuotas 3C.1.
2. Verificar comando/base y cargar base/restauración desde servidor. Aplicar política
   antes de subir bytes; no aceptar afirmaciones históricas del navegador.
3. Reutilizar fuentes confirmadas **sin save**, verificando bytes existentes para
   no recrear silenciosamente un blob antiguo faltante. Si falta, error de integridad.
4. Subir nuevos objetos inmutables v1. En la **misma TX Firestore** de
   head/revisión/recibo, releer derecho/inventario, verificar CAS/cuotas y confirmar
   la metadata relacionada. No hay confirmación parcial de Firestore.
5. Confirmar mediante lectura/recibo v1. Acuse perdido exige inspección; recibo del
   mismo comando no cobra otra vinculación, aunque Premium termine. ID reutilizado
   con otro comando sigue rechazado.

**Storage y Firestore no comparten TX.** Revocación/CAS/fallo tras subir objetos
puede dejar huérfanos privados sin revisión. No otorgan derecho ni aparecen como
confirmados. Las reservas 3C.1 los acotan conservadoramente, sin liberarlos solos.
Aborto TX no cambia head/revisión/recibo/inventario; fallo posterior puede haber
confirmado todo y no debe presentarse como rollback. No hay limpieza física nueva.

La baja no elimina fotos ni bloquea lectura/exportación/restauración propia.
Retirar de la revisión actual conserva revisiones anteriores y no libera cuota
histórica. Antes de usuarios reales debe aprobarse retención/eliminación de cuenta,
revisiones, huérfanos, soft delete y copias descargadas: no se promete borrado de
todas las copias ni retención ilimitada. No se introducen periodos de gracia/cobros.

## Mediciones y pruebas

Reproducir: `NODE_PATH=/ruta/a/node_modules node scripts/measure-commercial-media.cjs`.
Playwright externo, Chromium **156.0.8078.79**, Node 24.22.1, semilla fija, canvas
sintético JPEG .66, sin cuentas/red/archivos de fotos. Backend probado con Node 22.

| Tamaño / escena | JPEG binario, bytes | Data URL, bytes |
| --- | ---: | ---: |
| 320×240 gradiente | 2.896 | 3.887 |
| 320×240 ruido | 38.511 | 51.371 |
| 800×600 gradiente | 8.510 | 11.371 |
| 800×600 ruido | 236.616 | 315.511 |
| 1100×825 gradiente | 10.518 | 14.047 |
| 1100×825 ruido | 449.406 | 599.231 |

600.000 coincide con el rechazo del compresor público v1. 100 imágenes del último
caso excederían los 50 MiB: ambas cotas se aplican. Los 50 MiB son una propuesta
conservadora, **no validación económica con tarifas vigentes** (web oficial bloqueada).
Con 1 MiB de texto y 300 bytes estimados de metadata/evidencia, el respaldo de 8 MiB
admitiría aproximadamente **12** imágenes del último caso o **23** del ruido 800×600.
Es aritmética sobre muestras, no una capacidad prometida de cuenta.

18 casos nuevos con puertos simulados: permisos, cuotas, baja, importación manipulada,
aislamiento/restauración, inventario corrupto/incompleto, blobs faltantes, revocación
concurrente, CAS, TX y acuse perdido. Cuatro casos GET completan **22/22**.
Se conservan **17/17** previos 3C.1; suite general **573 aprobadas + 6 TODO**.
Cuatro casos nuevos con Firestore/Storage emulados y reglas ampliadas quedan
pendientes por descarga bloqueada del JAR; no se cuentan como aprobados.

No hay evidencia de IAM/App Check positivo reales, pagos, coste observado o
dispositivos físicos. Antes de usuarios: aprobar cuotas/política y ejecutar el
[ensayo autorizado](COMMERCIAL_STAGING_TRIAL.md). Futura interfaz debe explicar
rechazos/límites y preservar borradores; esta PR no cambia controles públicos.
