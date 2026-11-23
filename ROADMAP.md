# Roadmap de Fullhouse

Documento vivo. Actualizar al cerrar cada etapa con PR y comprobaciones realizadas.
Estados: ✅ completado comprobado · 🔄 en curso · ⬜ pendiente.
No es un compromiso de fechas ni autorización de despliegue.

## Preparación comercial inicial · objetivo 3 diciembre 2026

| Estado | Trabajo | Evidencia / siguiente paso |
| --- | --- | --- |
| ✅ | PR comercial 1: protección mínima del historial v1 | PR #19 fusionada; main d159fe6. Mitigación por bloqueo/copia, sin v2 |
| ✅ | PR comercial 2: cuentas y Hosting de pruebas | PR #20 fusionada; staging publicado por el propietario; autenticación real manual en curso |
| 🔄 | PR comercial 3A: contrato/backend v1 aislado | Revisiones privadas, CAS, recibos y restauración; pruebas unitarias/Auth+Functions. Firestore/Storage bloqueados por descarga 403; sin despliegue ni activación |
| ⬜ | PR comercial 3B: conexión a persistencia remota | Tras verificar reglas/emuladores y aprobar servicios, costes y recuperación; Planner sigue local |
| ⬜ | UX antes del lanzamiento: avisos de protección histórica | Explicar antes del rechazo qué fecha/registro impide reprogramar y cómo continuar con copia; conservar borradores. No cambiar motor en PR 2 |
| ⬜ | Suscripciones, información pública y validación de lanzamiento | Condicionado a aislamiento, recuperación y decisiones comerciales |

B.3c.1 permanece pausada en feature/history-scoped-events-shift-v2, commit 773c2d2.
No se utiliza como base comercial y no se autoriza B.3c.2/B.4/4C.

## Etapa A · desarrollo seguro

| Estado | Trabajo | Evidencia / siguiente paso |
| --- | --- | --- |
| ✅ | Base de regresión automatizada | PR #1; datos sintéticos y arnés sobre app.js |
| ✅ | Validación/importación de respaldos y recuperación local (BUG-02/03) | PR #2 fusionada; compatibilidad histórica 0.1–0.9 |
| ✅ | Guardado confirmado y cambios pendientes (BUG-01) | PR #3 fusionada; reintento, exportación y avisos |
| ✅ | Límites del día y dependencias (BUG-04) | PR #4 fusionada; base main 7a05350 |
| ✅ | Publicación actual del prototipo en GitHub Pages | Confirmada por el propietario; no es alojamiento comercial |
| ✅ | BUG-05 fase 1: contrato histórico, compatibilidad y pruebas | PR #5 fusionada; main 5e1f683; reproducción pública todavía fallida |
| ✅ | BUG-05 fase 2: motor y codec aislados | PR #6 fusionada; main 31f2ae3; sin activación pública |
| ✅ | BUG-05 fase 3: lectura y progreso históricos | PR #7 fusionada; main 4324abc. Laboratorio aislado; Planner sigue en v1 |
| ✅ | BUG-05 fase 4A: integración y persistencia simuladas | PR #8 fusionada; main 470212c; sin activación pública |
| ✅ | BUG-05 fase 4B.1: arquitectura y migración sintética | PR #9 fusionada; main 52dbe4d; IndexedDB aislado, sin activación |
| ✅ | BUG-05 fase 4B.2: base de compatibilidad experimental | PR #10 fusionada; main 35ca45c. Borrado físico y paridad React completa siguen abiertos |
| ✅ | BUG-05 fase 4B.3: preparación técnica aislada | PR #11 fusionada, main d1dae11; incremental/Worker, recuperación y capacidad. No preparado para 4C |
| ✅ | BUG-05 fase 4B.3b · A: autoridad persistente | PR #12 fusionada, main cc1d901; manifiesto/cadena, vigilancia y barrera física 2, solo laboratorio |
| ✅ | BUG-05 fase 4B.3b · B.1: metas y revisiones por alcance | PR #13 fusionada, main 0e9e25c; sin activación pública |
| ✅ | BUG-05 fase 4B.3b · B.2: rutinas por alcance | PR #14 fusionada, main 33bd80a; creación/edición/eliminación aisladas. Límites conservadores; centinela corregido en B.3a.1 y límites de captura documentados en CALENDAR_HARDENING |
| ✅ | BUG-05 fase 4B.3b · B.3a: demostración del calendario | PR #15 fusionada, main beff908; motor puro, sin activación pública |
| ✅ | BUG-05 B.3a.1: alternativas y garantías locales | PR #16 fusionada, main 13ee9d1; catálogo seguro, cobertura semanal local y guardas de captura/zona |
| ✅ | BUG-05 B.3b.1: creación por alcance | PR #17 fusionada, main c61e6ac; calendario, recuperación y capacidad aislados |
| ✅ | BUG-05 B.3b.2: edición y segmentación por alcance | PR #18 fusionada, main 721ce2d; solo infraestructura experimental |
| 🔄 | BUG-05 B.3c.1: desplazamiento experimental | Pausado y conservado en 773c2d2, rama independiente; sin integración comercial |
| ⬜ | BUG-05 fase 4B.3b · B.4: adopción por alcance | Tramo nuevo explícito, conservación de legado y evidencias |
| ⬜ | Otros bloqueos antes de 4C | Privacidad aprobada, paridad React, fuentes grandes/cadenas largas y otros motores/dispositivos |
| ⬜ | BUG-05 fase 4C: integración y activación por etapas | Solo tras cerrar matriz, previsualización, respaldos/reversión y autorización explícita |
| ⬜ | Automatizar pruebas en GitHub Actions | Separar pruebas que deben pasar y error conocido explícito; no ocultarlo |
| ⬜ | Entorno de previsualización por PR | Aislado de datos y publicación de producción |
| ⬜ | Organizar tareas y solicitudes de funcionalidades | Issues, prioridades, criterios de aceptación y relación con PR |
| ⬜ | Ampliar pruebas visuales, móviles y accesibilidad | Hay comprobaciones Chromium previas; falta cobertura amplia automatizada |
| ⬜ | Modularizar gradualmente | Extracciones pequeñas protegidas por regresión; sin refactorización general |
| ⬜ | Continuar funciones y diseños | Priorizar con usuarios tras estabilización, conservar accesibilidad y paletas |

## Etapa B · aplicación pública y comercial

| Estado | Trabajo | Decisiones necesarias |
| --- | --- | --- |
| ⬜ | Público objetivo y propuesta de valor | Validación de necesidades y posicionamiento |
| ⬜ | Free y Pro | Límites, precio y funciones; todavía no implementados |
| ⬜ | Onboarding y experiencia pública | Primera sesión, ayuda y recuperación comprensible |
| ⬜ | Dominio y alojamiento comercial | Disponibilidad, despliegues y operación |
| ⬜ | Cuentas, autenticación y seguridad | Modelo de identidad y amenazas, sesiones y acceso |
| ⬜ | Almacenamiento remoto, sincronización y recuperación | Conflictos, cifrado, copias y restauración; hoy los datos son locales |
| ⬜ | Suscripciones y pagos | Proveedor, facturación, impuestos y cancelaciones |
| ⬜ | Privacidad, cumplimiento legal y costes | Consentimiento, retención, derechos, proveedores y presupuesto |
| ⬜ | Beta pública | Soporte, métricas respetuosas con privacidad y criterios de salida |
| ⬜ | Difusión y lanzamiento | Canales y comunicación tras validar fiabilidad |
| ⬜ | Evolución comercial | Costes operativos, mantenimiento y nuevas necesidades |

La etapa B requiere decisiones de producto y seguridad propias. Este roadmap no
introduce cuentas, servicios externos, pagos ni sincronización de calendarios.
