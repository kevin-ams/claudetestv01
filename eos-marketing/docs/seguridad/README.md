# Seguridad de EOS Nivel 10 — informe de la revisión (noviembre 2026)

Marco: ISO/IEC 27001:2022 (Anexo A / ISO 27002) y OWASP ASVS 5.0 nivel 2. Plan original: `../revision-seguridad-plan.md`.

| Documento | Contenido |
|---|---|
| `inventario-y-riesgos.md` | Fase 1: clasificación, inventario de datos y activos, registro de riesgos, proveedores |
| `configuracion.md` | Fase 3: variables y secretos, alcance en Netlify, rotación |
| `aplicacion.md` | Fases 2 y 4: autenticación, autorización, entradas, encabezados, MCP, IA, Clarity |
| `operacion.md` | Fases 5–7: bitácora, alertas, incidentes, retención, respaldos, CI y cambios |
| `declaracion-de-aplicabilidad.md` | Fase 8: cada control del Anexo A con su estado y evidencia |

## Hallazgos y correcciones

| # | Hallazgo | Riesgo | Corrección |
|---|---|---|---|
| 1 | Next.js 16.3.2 con avisos críticos (ejecución remota de código) | Crítico | Next.js 16.4.5 |
| 2 | Cualquier administrador de equipo (también el dueño de una demo) podía descargar un respaldo de **toda** la base y restaurarlo (pisar todo) | Crítico | Solo el dueño de la plataforma; bitácora y alerta |
| 3 | Clave de sesión con valor por omisión si faltaba `AUTH_SECRET` | Alto (latente) | Falla segura en producción |
| 4 | Sin límite de intentos de inicio de sesión | Alto | 5 por cuenta / 30 por IP cada 15 min, alerta |
| 5 | Variables leídas en 26 archivos sin validar | Medio | Módulo de configuración + regla de lint + inventario |
| 6 | Sin encabezados de seguridad | Medio | Encabezados + CSP en modo reporte |
| 7 | Sin bitácora de eventos de seguridad | Medio | Bitácora inmutable de 1 año + revisión de accesos |
| 8 | Imágenes validadas solo por el tipo declarado | Medio | Validación por contenido real |
| 9 | CSV de tratos con datos de leads sin neutralizar fórmulas | Medio | Neutralización |
| 10 | Sin CI ni revisión de dependencias | Medio | CI (pruebas, audit, secretos), Dependabot |
| 11 | Sin doble factor | Medio | Doble factor opcional (lo habilita el Administrador Premium) |
| 12 | Avisos altos en `zod`, `brace-expansion`, `source-map-js` | Bajo | Actualizados; queda `uuid` vía `exceljs` (aceptado) |

## Pendiente de la institución

- Designar responsable de seguridad e incidentes.
- Confirmar dueños y niveles de los datos, y la retención de los datos de negocio.
- Definir el tiempo máximo aceptable sin la plataforma.
- Aceptar los DPA de los proveedores y revisar sus certificaciones.
- GitHub: proteger `main` (PR + CI obligatorios) y publicar desde `main`.
- Netlify: marcar las variables secretas como "Contains secret values" con alcance Functions.
- Hacer y registrar la primera prueba de restauración.
- En 1–2 semanas: revisar los reportes `[csp]` y aplicar la CSP.
