# Roadmap de Fullhouse

Documento vivo. Actualizar al cerrar cada etapa con PR y comprobaciones realizadas.
Estados: ✅ completado comprobado · 🔄 en curso · ⬜ pendiente.
No es un compromiso de fechas ni autorización de despliegue.

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
| 🔄 | BUG-05 fase 4B.3b · B.2: rutinas por alcance | Creación/edición/eliminación verificadas en laboratorio; recuperación d5789c6 y resultados preservados. Calendarios no demostrables bloqueados. Ver SCOPED_ROUTINES |
| ⬜ | BUG-05 fase 4B.3b · B.3: programación por alcance | Series, excepciones, dependencias y límites BUG-04 |
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
