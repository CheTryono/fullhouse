# Comercial 3B · integración asíncrona v1, solo laboratorio

Base `89540d8` (PR #21 / 3A fusionada). Rama `feat/commercial-remote-planner`.
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
Los detalles y resultados finales se completarán al cerrar esta PR.
