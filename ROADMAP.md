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
| 🔄 | BUG-05 fase 4A: integración y persistencia simuladas | Puente a operaciones reales, confirmado/pendiente, dos ranuras/manifiesto y recuperación probados en Map. Pendiente de revisión; sin activación |
| ⬜ | BUG-05 fase 4B: cerrar compatibilidad e integración nativa | Resolver legado/fotos/cuotas, puertos reales en previsualización, todas las rutas, concurrencia y rollback; autorización separada antes de activar |
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
