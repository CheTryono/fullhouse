# Comercial 2 · cuentas y Hosting de pruebas

Base origin/main d159fe6 (PR #19). Rama feat/commercial-auth-staging.
No despliegue, proyecto real, migración, Firestore, Cloud Storage ni Stripe activados.
GitHub Pages y su workflow siguen iguales. El motor histórico no cambia.

## Funcionalidad y separación

Firebase Web SDK 13.4.0 real: registro/acceso por correo y contraseña, verificación,
reenvío/comprobación, cierre de sesión y recuperación/cambio de contraseña. Los enlaces
usan applyActionCode/verifyPasswordResetCode/confirmPasswordReset reales. Los éxitos
se anuncian tras la respuesta del servicio; un envío solicitado no prueba entrega.
Sin configuración no se ofrecen formularios operativos ni se abre el planificador.

El SDK usa browserSessionPersistence (sesión por pestaña). Un usuario no verificado
solo ve verificación y salida. En el servidor futuro también habrá que comprobar
email_verified/UID: el control cliente no es autorización de datos remotos.

La entrada de staging incorpora la interfaz existente en un iframe del mismo origen.
Esto da al script global Planner un ciclo de vida nuevo por cuenta, sin reconstruirlo
ni reejecutar sus constantes en la misma ventana. El puerto opcional de almacenamiento
es el único cambio funcional de integración en app.tsx. Sin puerto se usa el camino
local v1 original, incluida recuperación del alias. Se compila también app.js.

En staging el puerto añade el prefijo fullhouse-account-local-v1:<proyecto>:<uid>:
a datos y preferencias. Una cuenta nueva empieza vacía. Nunca lee, copia, elimina ni
asocia automáticamente fullhouse-v01, su alias o sus preferencias anteriores.
Importar JSON sigue siendo un acto explícito con confirmación, dirigido al espacio
de la cuenta actual. El formato exportable sigue version:1 y no incluye tokens.

La interfaz dice que **los datos de cuenta siguen siendo locales a este navegador**.
No hay sincronización ni copia remota de metas/fotos en esta PR. El puerto permite
preparar la siguiente integración sin mezclar identidades o prometer persistencia cloud.
Un cambio de proyecto/UID no adopta datos ajenos, aunque se reutilice el correo.

Cada lectura/escritura comprueba que la concesión de la sesión está activa y pertenece
al UID verificado actual del SDK. Al salir se destruye la ventana anterior. Un proceso
asíncrono antiguo no puede escribir en la cuenta siguiente. Se impide salir con
borradores/pendientes o procesamiento de fotos. Si cambia inesperadamente la sesión,
se oculta y bloquea la ventana con borradores; solo el mismo UID al autenticarse puede
recuperarla. Mientras tanto no se abre otro planificador. El cierre de la pestaña se
advierte, pero no se promete recuperar borradores en RAM después de cierre forzado.

**Límite de seguridad local:** prefijos y sesiones separan interfaz/operaciones;
no cifran localStorage ni aíslan a alguien con acceso al perfil del navegador,
DevTools o código malicioso del mismo origen. No usar datos sensibles/reales en el
laboratorio. En equipos compartidos usar perfiles separados. La autorización remota,
concurrencia del mismo UID entre pestañas y recuperación cloud pertenecen a la PR 3.
No se activa el historial v2, aunque Firebase use almacenamiento interno de su SDK.

## Desarrollo y pruebas sin proyecto real

Node 22+ (probado 24), npm ci; no claves privadas ni login de Firebase necesarios.

```sh
npm ci
npm run check
npm run check:auth
npm run test:auth
npm run dev:auth
```

Abrir http://127.0.0.1:5000. Solo Auth/Hosting en loopback, proyecto fijo
**demo-fullhouse-auth**. El CLI muestra enlaces de verificación/recuperación para
cuentas sintéticas; el emulador no envía correos reales. Ctrl+C detiene los procesos.
El script usa un directorio temporal de configuración del CLI y no modifica HOME.

Prueba automática real del SDK contra esos emuladores:

```sh
NODE_PATH=/workspace/.fullhouse-tools/node_modules npm run test:auth:emulator
```

NODE_PATH es específico de este entorno donde Playwright está instalado aparte;
en otra máquina debe estar disponible Playwright con Chromium o FULLHOUSE_CHROMIUM.
La suite borra únicamente las cuentas del emulador demo. No se conecta a proyectos
reales. Los tests unitarios de cambio inesperado usan dobles y se distinguen de los
recorridos reales del SDK/emulador.

## Conectar el proyecto Firebase real · pasos del propietario

1. Crear/elegir **un proyecto dedicado a staging**, distinto de producción; registrar
   una aplicación Web. No crear Firestore/Storage/Functions para esta PR.
2. En Authentication habilitar Email/Password, revisar política de contraseña
   (el registro aquí pide al menos ocho caracteres) y protección contra enumeración.
   Autorizar el dominio exacto de Hosting y los dominios de prueba necesarios.
3. Revisar plantillas/remitente/idioma de correo. Para usar nuestros formularios de
   acción, configurar la URL de acción de verificación/restablecimiento como
   https://<PROYECTO-STAGING>.web.app/ . Firebase añade mode/oobCode. No se sigue un
   continueUrl recibido de terceros. La opción de comprobar verificación también
   funciona si se conserva el manejador de correo por defecto de Firebase.
4. Copiar staging/firebase-config.example.json a staging/firebase-config.local.json
   y rellenar apiKey/authDomain/projectId/appId **Web públicos**. El archivo local
   está ignorado por Git. Nunca usar JSON de cuenta de servicio, claves privadas,
   tokens de CLI ni credenciales Admin. La configuración Web pública llegará al navegador.
5. Ejecutar npm run build:staging. Sin archivo genera una pantalla «sin configurar»;
   si el archivo es inválido, falla. Un build real rechaza emulatorUrl. Revisar el
   projectId mostrado y dist-staging; solo contiene recursos públicos, sin laboratorios,
   tests, fuentes ni mapas de código.
6. Tras autorización explícita de publicación, el propietario podrá autenticar el
   CLI y publicar **solo Hosting de staging**, con proyecto/config explícitos:

```sh
npx firebase login
npx firebase deploy --project <PROYECTO-STAGING> --config firebase.staging.json --only hosting
```

Estos comandos no se ejecutaron. No hay alias predeterminado de producción ni workflow
nuevo. Después de configurar se deben comprobar entrega real/spam, enlaces y dominios,
registro, recuperación, cuenta A/B y cierre/reapertura en navegadores reales.

Hosting añade no-store, nosniff, no-referrer y SAMEORIGIN; las acciones eliminan el
código de la URL tras completarse. El acceso directo a planner.html sin sesión válida
no carga Planner. No se incluyen secretos/contraseñas en mensajes, backups o logs propios.

## Dependencias y límites abiertos

Firebase/esbuild/CLI fijados por lockfile. Esbuild solo genera los recursos de staging;
Pages continúa usando React 16 y el JS compilado existente. El paquete Firebase incluye
una dependencia Node de Firestore/gRPC que no usa ni empaqueta esta PR. Se fija gRPC
1.14.7 por override acotado a Firebase para evitar los avisos altos de la rama 1.9.
No se aplicó audit fix --force ni se degradó el SDK. Revisar el override al actualizar.

Auditoría de producción después del ajuste: cero vulnerabilidades. Auditoría completa:
14 avisos moderados transitivos del CLI de desarrollo; cero altos/críticos. No se
ocultan ni se consideran resueltos. El CLI no se entrega al navegador; mantenerlo
actualizado y revisar estos avisos antes de automatizar publicación con credenciales.

Pendiente de UX antes del lanzamiento: explicar anticipadamente los rechazos de
reprogramación de PR #19 y ofrecer contexto/acción de copia sin perder el formulario.
Esta PR solo lo registra; no modifica guardas ni decisiones del motor histórico.

Resultados exactos y fuentes verificadas: docs/measurements/commercial-auth-verification.json.
No se ha probado un proyecto Firebase real, entrega de correo real, Firefox/WebKit
ni dispositivos físicos. No se puede dar por validada una beta pública solo con esto.
