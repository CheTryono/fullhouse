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

En Cloud Shell, en una rama limpia, sin ejecutar `--deploy`:

```sh
cd ~/fullhouse
git status --short
git fetch origin
git switch --detach origin/release/closed-staging-deploy-authorization
nvm use 24
npm run test:remote-staging:gcloud-sdk
node scripts/remote-staging-gcloud.cjs > /tmp/fullhouse-gcloud-release-candidate.json
node -e 'const p=require("/tmp/fullhouse-gcloud-release-candidate.json");console.log(JSON.stringify({mode:p.mode,releaseHash:p.releaseHash,deploymentAuthorized:p.deploymentAuthorized,remoteEnabled:p.remoteEnabled,clientEnabled:p.clientEnabled},null,2))'
npm run audit:remote-staging:iam -- --run
nvm use 22
npm run check:remote-staging:gcloud-node22
```

Reglas para decidir: todas las comprobaciones deben pasar, no se ejecuta ninguna compilación ni subida. Ejecutar también `npm test` y `npm run check` en la versión raíz de Node requerida; la modificación de la barrera hace que algunos tests deban esperar `true` **solo** para `deploymentAuthorized`, mientras prueban que sin autorización externa y hash el transporte no realiza ninguna operación. Revisar cada cambio de archivo antes de fusionar.

El **hash candidato generado en esta rama** no supone permiso para desplegar; compartirlo para la aprobación posterior. Si se modifica cualquier archivo fuente/control o configuración, regenerarlo. Después de fusionar, verificar que el mismo conjunto de archivos produce el hash aprobado antes de cualquier ejecución.

## Riesgos, gastos y recuperación

El despliegue real posterior puede crear Cloud Functions, Cloud Run, Cloud Build, objetos de fuentes, imágenes en Artifact Registry, logs y un endpoint HTTPS que permita invocación anónima a nivel de red. La lógica backend debe continuar apagada y devolver `UNAVAILABLE` para tokens válidos; Auth/App Check deben verificarse con ensayos reales después. Incluso un endpoint cerrado puede generar cargos. Alertas de ~100 MXN **no constituyen un límite duro de gasto**.

El primer deploy puede fallar por copias internas de fuentes u otros permisos no comprobados; **no ampliar IAM automáticamente** ni recurrir a Compute/Editor. Detenerse, conservar identificadores/hashes, inspeccionar los recursos y solicitar autorización antes de reintentar o eliminar algo. Volver a `deploymentAuthorized:false` en el repositorio solo bloquea **futuros** despliegues, no revierte recursos ya creados.

**Hasta nueva aprobación explícita del propietario: no ejecutar `--deploy`, no habilitar usuarios ni cambiar permisos, reglas o cuentas.**
