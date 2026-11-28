# Fullhouse · PR de preparación para el primer despliegue cerrado

**Estado de esta PR:** propuesta en borrador. **No es una aprobación para ejecutar un despliegue.** No se ha creado una función, build, fuente, imagen ni binding de invocación mediante esta PR.

## Alcance exacto

- `remote-staging/settings.json`: `deploymentAuthorized:true` es únicamente la primera barrera de autorización **en el código** para el transporte gcloud revisado.
- `remoteEnabled:false` y cliente `enabled:false` siguen cerrados; `FULLHOUSE_REMOTE_STAGING_ENABLED=0` y lista de UIDs vacía permanecen fijados por el plan.
- Firebase CLI 15.37.0 **sigue bloqueado** por `assertFirebaseTransport()`. No se usa como alternativa para desplegar con Compute/Editor.
- No se cambian IAM, reglas, Hosting/Pages, autenticación, backend de datos, operadores, servicio, cuenta de build o variables del entorno real.
- No hay invocación a `gcloud functions deploy` en GitHub Actions. El workflow `.github/workflows/pages.yml` solo publica la interfaz estática.

## Barreras que siguen siendo obligatorias

`scripts/remote-staging-gcloud.cjs --deploy` exige **además del flag del repositorio**:

1. Autorización **independiente y posterior** del propietario para un despliegue facturable y para la creación de una función GEN_2 HTTPS con `roles/run.invoker` para `allUsers` **solo en ese servicio**.
2. Node 22, gcloud SDK **592.0.0**, proyecto `fullhouse-staging`, ninguna credencial de archivo/override, ni emuladores ni activación remota.
3. `FULLHOUSE_AUTHORIZE_GCLOUD_CLOSED_DEPLOY=fullhouse-staging` suministrada expresamente en la sesión autorizada.
4. `FULLHOUSE_APPROVED_GCLOUD_RELEASE` igual al **hash SHA-256 completo y actual** del artefacto; no usar el hash antiguo generado con `deploymentAuthorized:false`.
5. Auditoría IAM en tiempo real y `gcloudResources.basicInputsVerified:true`, identidades y permisos exactos, ausencia de una función previa detectada y validación de los agentes administrados.
6. ZIP de once archivos, variables de entorno cerradas, identidad dedicada de build, repositorio y bucket exclusivos, cuenta runtime separada; verificación del job/servicio tras el ensayo, sin reintento automático.

### Revisión manual antes de fusionar

La revisión de Codex comprobó el diff completo de PR #30 contra `origin/main`
`df5a740`: autorización del repositorio, pruebas y este documento; ningún cambio
al ejecutor o al backend de datos. La página pública de GitHub mostró **Draft**.
No se solicitó pasarla a revisión lista, fusionar o ejecutar servicios.

El primer `npm test` sobre `040e43b` produjo **615 aprobados, tres fallos y seis
TODO** (624 casos). Fallaban la expectativa antigua de `deploymentAuthorized:false`
en medios y dos expresiones que aún esperaban el mensaje de esa antigua barrera.
Se corrigieron para exigir la autorización de repositorio preparada y el rechazo
**específico del transporte Firebase**, manteniendo el backend/cliente cerrados.

Se amplían las regresiones: consentimiento ausente/otro proyecto, hash ausente o
malformado, Node incorrecto, barrera del repositorio false en copia temporal y
entrada CLI sin `--deploy` incluso con ambas variables presentes. Los puertos de
ejecución están sustituidos o bloqueados; ningún test lanza un despliegue real.

En Cloud Shell, con árbol limpio y sin ejecutar `--deploy`:

```sh
cd ~/fullhouse
git status --short
git fetch origin release/closed-staging-deploy-authorization
git switch --detach FETCH_HEAD
nvm use 24
npm test
npm run check
FULLHOUSE_GCLOUD_SDK_ROOT="$(gcloud info --format='value(installation.sdk_root)')" npm run test:remote-staging:gcloud-sdk
env -u GOOGLE_APPLICATION_CREDENTIALS node scripts/remote-staging-gcloud.cjs > /tmp/fullhouse-gcloud-release-candidate.json
node -e 'const g=require("./scripts/remote-staging-gcloud.cjs"),p=require("/tmp/fullhouse-gcloud-release-candidate.json");g.verifyPlan(p);console.log(JSON.stringify({mode:p.mode,releaseHash:p.releaseHash,deploymentAuthorized:p.deploymentAuthorized,remoteEnabled:p.remoteEnabled,clientEnabled:p.clientEnabled},null,2))'
npm run audit:remote-staging:iam -- --run
nvm use 22
npm run check:remote-staging:gcloud-node22
```

Hay compilación/preparación **local**, no Cloud Build ni subida a la nube.
Herramientas y suite general requieren Node 24.15+ de la rama 24; backend y pruebas
específicas se verifican por separado con Node 22. No instalar el SDK web de raíz
como si sus engines fueran los del runtime Functions. Dependencias/locks intactos.

La auditoría real sigue siendo un paso del propietario: Codex no la ejecutó.
**No exigir `complete:true` o salida 0 por crear antes la función**: un 404 de
`function` mantiene el inventario incompleto/salida 2 por diseño. No se ignoran los
errores: inspeccionar los campos exigidos por `assertAudit`, especialmente
`operatorCanUpload`, `serviceusage.services.use`, actAs, agentes y scopes.
Un 403/404 no prueba ausencia y no justifica ampliar IAM. La comprobación previa
tampoco elimina la carrera con otro deploy: congelar cambios concurrentes.

El **hash candidato generado en esta rama** no supone permiso para desplegar; compartirlo para la aprobación posterior. Si se modifica cualquier archivo fuente/control o configuración, regenerarlo. Después de fusionar, verificar que el mismo conjunto de archivos produce el hash aprobado antes de cualquier ejecución.

No copiar un plan JSON de otra máquina: contiene rutas locales. Regenerarlo con
los mismos bytes y comprobarlo con `verifyPlan`; el hash de release no depende de
esas rutas ni del SHA del merge, pero sí del artefacto/configuración y del control.
Si el hash difiere, detenerse y revisar; no aprobar automáticamente el nuevo.
Los comandos anteriores **no exportan** variables de consentimiento o aprobación.

### Destino verificado en el código

| Campo | Valor |
| --- | --- |
| Proyecto / región / función | `fullhouse-staging` / `us-central1` / `remoteV1` |
| Runtime | Node 22; `fullhouse-remote-runtime@fullhouse-staging.iam.gserviceaccount.com` |
| Builder | `projects/fullhouse-staging/serviceAccounts/fullhouse-remote-build@fullhouse-staging.iam.gserviceaccount.com` |
| Repositorio | `projects/fullhouse-staging/locations/us-central1/repositories/fullhouse-remote-functions` |
| Fuentes | `fullhouse-staging-build-sources-664973716762` |

Ninguna identidad se sustituye por Compute/Editor. Firebase y configuraciones de
emuladores conservan hooks de rechazo. Actions contiene únicamente `pages.yml`,
sin comando Firebase/gcloud, autenticación Google o job de Functions; su allowlist
copia solo HTML/JS/CSS/logo/vendor. Cambiar el flag no conecta usuarios ni modifica
ese workflow. Estos controles cubren las rutas del repositorio, no impiden que un
administrador ejecute herramientas manuales fuera de este procedimiento.

### Verificaciones de la revisión

Resultados ejecutados por Codex sobre las correcciones conservadas de PR #30
(27 de noviembre de 2026):

| Comprobación | Entorno | Resultado |
| --- | --- | --- |
| `npm test` | Node 24.22.1 | 626 casos: 620 aprobados, 0 fallos, 0 omitidos, 6 TODO previos |
| Pruebas `commercial-gcloud`, `commercial-build`, `commercial-iam`, `commercial-staging` y `commercial-media` | Node 22.23.5 | 78/78 aprobadas; también cubiertas en la suite general Node 24 |
| `test:remote-staging:gcloud` | Node 24.22.1 | 15/15 aprobadas; incluidas igualmente en las 78 de Node 22 |
| `check`, `check:remote`, `check:remote-client`, `check:auth`, `check:history-contract` | Node 24.22.1 | Aprobadas; `app.tsx` y `app.js` coinciden, sin regenerarlos |
| `check:remote-staging:gcloud-node22` | Node 22.23.5 | Callable real del artefacto en loopback: capacidad/CORS, rechazo de tokens inválidos, App Check y backend `UNAVAILABLE`; verificadores JWT sintéticos, sin clientes de datos |
| `test:remote-staging:gcloud-sdk` | SDK oficial 592.0.0 | Aprobado offline: parser, solicitud, ZIP y hashes; **0 intentos de red**, ejecución/subida sustituidas |
| `prepare` + `verifyPlan` | Node 22.23.5 y 24.22.1 | Mismo hash y plan cerrado válido en ambos entornos |

Hash SHA-256 de referencia para **estos bytes revisados** (64 caracteres):

```text
703cb1a4aaebc9ba72118ce56c82d429f87c9c45b348e45bddf7078bfa2f15ef
```

Los comandos de regeneración anteriores deben devolver exactamente este valor.
Es el hash del candidato revisado, **no una autorización de ejecución**. Si cambia
el artefacto/control/configuración, deja de ser definitivo: detenerse, revisar y
solicitar aprobación del nuevo valor. No se configura ni exporta automáticamente
`FULLHOUSE_APPROVED_GCLOUD_RELEASE` a partir de la salida de preparación.

Las pruebas completas previas conservan validez porque después solo se completó
documentación. Al reanudar se comprobaron diff, registros y ausencia de procesos,
se repitieron las comprobaciones de compilación y se comparó el hash entre Node
22/24; no se duplicaron las suites ya terminadas.

Los resultados reales anteriores del propietario y de PR #29 no se atribuyen a
esta revisión. No se ejecutaron auditorías reales, emuladores o navegador: UI,
reglas y backend de datos permanecen intactos. La PR permanece en borrador.

**Pendiente antes de desplegar:** auditoría ampliada real del propietario para
`operatorCanUpload`, `serviceusage.services.use`, actAs y agentes/scopes exigidos;
las copias internas de fuentes y los permisos efectivos de Build solo podrán
confirmarse durante el ensayo autorizado. No hay evidencia nueva que justifique
conceder roles adicionales. El estado del código permite revisar/fusionar esta
preparación; no equivale a aprobación del ensayo facturable.

## Riesgos, gastos y recuperación

El despliegue real posterior puede crear Cloud Functions, Cloud Run, Cloud Build, objetos de fuentes, imágenes en Artifact Registry, logs y un endpoint HTTPS que permita invocación anónima a nivel de red. La lógica backend debe continuar apagada y devolver `UNAVAILABLE` para tokens válidos; Auth/App Check deben verificarse con ensayos reales después. Incluso un endpoint cerrado puede generar cargos. Alertas de ~100 MXN **no constituyen un límite duro de gasto**.

El primer deploy puede fallar por copias internas de fuentes u otros permisos no comprobados; **no ampliar IAM automáticamente** ni recurrir a Compute/Editor. Detenerse, conservar identificadores/hashes, inspeccionar los recursos y solicitar autorización antes de reintentar o eliminar algo. Volver a `deploymentAuthorized:false` en el repositorio solo bloquea **futuros** despliegues, no revierte recursos ya creados.

**Hasta nueva aprobación explícita del propietario: no ejecutar `--deploy`, no habilitar usuarios ni cambiar permisos, reglas o cuentas.**
