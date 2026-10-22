# Plan del CRM: Ams Studio

CRM interno de **Ams Studio** ([amscreativeint.com](https://amscreativeint.com)). Es un **producto independiente**: no tiene relación con la app EOS de este repositorio.
Se desarrolla y prueba en local (`npm run dev`) y, cuando esté estable, se publica en Netlify como un sitio propio.

---

## 0. Decisiones tomadas

| Tema | Decisión |
|---|---|
| Relación con la app EOS | Ninguna. Repositorio, base de datos y sitio de Netlify propios |
| Gmail | Solo para la organización **Ams Studio** (Google Workspace, `amscreativeint.com`). Se registra como app **interna**, sin verificación de Google |
| Moneda | **Quetzales (GTQ)** como principal y **dólares (USD)** como opcional, por cotización/factura |
| Impuesto | Por documento: **IVA 12 % incluido** (régimen general) o **5 %** (pequeño contribuyente) |
| Tipo de cliente | **B2B y B2C**: la empresa es opcional y el contacto puede existir solo |
| Cotizador | Al estilo **Zoho Invoice** (ver §5) |
| Marca | Ver §6 |

## 1. Qué hacen los mejores CRM (investigación)

| CRM | Lo que destaca | Qué tomamos |
|---|---|---|
| **HubSpot** | Contactos, empresas y negocios en un registro; línea de tiempo unificada; secuencias; cotizaciones; IA Breeze (prospección, resúmenes, scoring) | Línea de tiempo unificada, secuencias |
| **Salesforce** (Einstein / Agentforce) | Lead scoring 1–99 según conversiones históricas; forecasting | Lead score y forecast por probabilidad |
| **Pipedrive** | Pipeline Kanban ágil; negocios que se "enfrían"; metas por vendedor | Kanban con alerta de estancamiento |
| **Attio** | Modelo de datos flexible y campos personalizados | Campos personalizados |
| **Certo Growth** | Propuestas aceptadas online; renovaciones con alerta a 90 días; IA que cita fuentes y **nunca cambia datos sin aprobación** | Aceptación online, renovaciones, IA "con permiso" |
| **Zoho Invoice** | Cotización → factura en un clic, portal del cliente, recordatorios de pago, facturas recurrentes, multimoneda, plantillas personalizables | Base del módulo de cotizaciones y facturación |
| **Dastone** (visual) | Dashboard con KPIs, gráficas y tablas | Estilo del dashboard |

## 2. Módulos

### Núcleo (MVP)
1. **Contactos**: nombre, email, teléfono/WhatsApp, NIT o CF, empresa (opcional), dueño, etiquetas, origen, lead score y campos personalizados.
2. **Empresas**: razón social, nombre comercial, NIT, dirección fiscal, industria y contactos asociados.
3. **Negocios**: pipeline Kanban con etapas configurables, monto, moneda, probabilidad, fecha de cierre y motivo de pérdida.
4. **Actividades y tareas**: notas, llamadas, reuniones y tareas con vencimiento, en una línea de tiempo por contacto y negocio.
5. **Dashboard**: pipeline abierto, ganado del mes (GTQ y USD), conversión, ciclo promedio, embudo, origen de leads y negocios estancados.
6. **Importación CSV/XLSX** con mapeo de columnas y detección de duplicados.

### Comunicación
7. **Gmail** (§3) para correo 1 a 1.
8. **Resend** (§4) para envío masivo.
9. **Plantillas de email** con variables (`{{nombre}}`, `{{empresa}}`).

### Ventas y facturación (§5)
10. Catálogo de productos y servicios.
11. Cotizaciones.
12. Facturas y pagos.
13. Contratos y renovaciones (fase posterior).

### Automatización
14. Reglas simples, por ejemplo: "si un negocio pasa a la etapa X, crear una tarea", "si no hay actividad en N días, alertar" o "si una cotización vence, recordar".
15. Secuencias de email que se detienen cuando el contacto responde (fase posterior).

### IA (API de Claude)
| Función | Qué hace |
|---|---|
| Resumen de cuenta o negocio | Resume dónde estamos y cuál es el siguiente paso, a partir de la línea de tiempo y los emails |
| Redactor de emails | Prepara un borrador con el contexto del contacto; tú lo revisas antes de enviarlo |
| Lead scoring | Primero por reglas; después, la IA explica el puntaje |
| Detector de riesgo | Señala negocios sin actividad, emails sin respuesta y cotizaciones con más de 15 días esperando |
| "Pregúntale al CRM" | Responde preguntas en lenguaje natural y cita los registros |
| Extracción desde emails | Propone crear o actualizar contactos y negocios a partir de correos entrantes |
| Cotización asistida | A partir de una descripción ("branding + web de 5 páginas"), propone líneas del catálogo |
| Notas de reunión a tareas | Propone tareas y cambios de etapa |

Principio: **la IA propone y una persona aprueba**.

## 3. Gmail (Ams Studio)

- **Inicio de sesión con Google** restringido al dominio `amscreativeint.com`. Así no hacen falta contraseñas y se reutiliza el mismo OAuth para Gmail.
- Proyecto en Google Cloud con la pantalla de consentimiento en modo **Interno**: sin verificación ni auditoría de Google.
- Gmail API para enviar desde la cuenta de cada persona (el correo aparece en su carpeta "Enviados") y para asociar automáticamente los hilos con contactos del CRM.
- Sincronización: al inicio, consultas periódicas con `history.list` (función programada de Netlify); más adelante, notificaciones en tiempo real con Pub/Sub.
- Opcional: Google Calendar para agendar reuniones desde un negocio.

## 4. Envío masivo con Resend

- Gmail se usa para el correo 1 a 1 y Resend para el masivo, para proteger la reputación de la cuenta de Workspace.
- Subdominio de envío verificado, p. ej. `mail.amscreativeint.com` (SPF, DKIM, DMARC), para no afectar al correo principal.
- Campañas: segmento (filtros del CRM) → plantilla → vista previa → programar o enviar (Batch API o Broadcasts).
- Webhooks de Resend que registran entregas, aperturas, clics, rebotes y quejas en la línea de tiempo y alimentan el lead score.
- Enlace de baja, lista de supresión y consentimiento.

## 5. Cotizaciones y facturación (estilo Zoho Invoice)

### Funciones
- **Catálogo** de productos y servicios: precio en GTQ y/o USD, unidad, tasa de impuesto por defecto y descripción reutilizable.
- **Cotización**: cliente (contacto o empresa), líneas del catálogo o libres, cantidad, descuento por línea o global, moneda y tasa de cambio, **IVA 12 % incluido o 5 %**, notas, términos y vigencia.
- **Desglose del IVA incluido**: base = total / 1.12 e IVA = total − base, para mostrarlos en el documento.
- **Folio** consecutivo configurable (`COT-2026-0001`) y estados: borrador → enviada → vista → aceptada / rechazada / vencida.
- **Versiones** (v1, v2…), comparadas por la IA.
- **Plantilla PDF con la marca Ams Studio**. Cuando me compartas tu plantilla de presentación, la página de precios generada se insertará en su sección de precios (con `pdf-lib`) y saldrá un único PDF.
- **Envío por Gmail** con enlace al **portal del cliente**, donde el cliente ve, descarga, **acepta o rechaza** y comenta. Al aceptar, la versión se congela y el negocio pasa a "Ganado".
- **Convertir a factura** en un clic.
- **Facturas**: pagos parciales (anticipo de 50 %, etc.), saldo pendiente, **recordatorios de pago** automáticos, **facturas recurrentes** (iguala mensual) y notas de crédito.
- **Reportes**: cuentas por cobrar con antigüedad de saldos, ventas por cliente y servicio, y tasa de aceptación de cotizaciones.

### Nota sobre Guatemala (FEL)
En Guatemala, la factura con validez fiscal debe ser **FEL** (Factura Electrónica en Línea), certificada por un certificador autorizado por la SAT (Infile, Digifact, etc.).

- **Fase 1**: el CRM emite cotizaciones y **facturas internas o proformas** (control y cobranza), y la FEL se sigue emitiendo donde la emites hoy.
- **Fase posterior**: conectar la API del certificador para que "Convertir a factura" genere la FEL y guarde el número de autorización y el PDF.

Esto hay que validarlo con tu contador; la IA no reemplaza esa decisión.

## 6. Marca

Archivos en `docs/brand/`: tablero de marca, símbolo, ícono de app y logotipos para fondo claro y oscuro.

| Token | Color | Uso |
|---|---|---|
| `primary` | `#2563FF` Royal Blue | Botones, enlaces, acentos |
| `secondary` | `#F4F6FF` Pale Lavender | Fondos de tarjetas y secciones |
| `overlap` | `#8DA5FF` Soft Periwinkle | Estados hover, gráficas secundarias |
| `text` | `#0F172A` Charcoal | Texto y sidebar oscuro |

- Tipografía: **Plus Jakarta Sans**. H1 en Bold, H2 en SemiBold, cuerpo en Regular y captions en Medium.
- Conceptos: moderno, modular, estratégico, tecnológico. La interfaz debe ser limpia, con tarjetas redondeadas, mucho espacio y gráficas en la paleta de marca.
- También se aplica a los PDFs de cotización y factura, al portal del cliente y a las plantillas de email.

## 7. Arquitectura

- **Repositorio nuevo** (propuesta: `ams-crm`) y **sitio nuevo en Netlify**.
- **Next.js** (App Router y server actions), TypeScript y Tailwind con los tokens de marca.
- **Netlify Database** (Postgres) con migraciones.
- **Auth**: Google OAuth restringido a `amscreativeint.com`.
- **Archivos** (plantillas y PDFs): Netlify Blobs.
- **Tareas programadas** (sincronización de Gmail, recordatorios de pago, alertas, facturas recurrentes): Netlify Scheduled Functions.
- **Dependencias**: `googleapis`, `resend`, `@anthropic-ai/sdk`, `pdf-lib` / `@react-pdf/renderer`, `recharts`, `@dnd-kit`, `papaparse` / `xlsx`, `zod`.
- **Variables de entorno**: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ALLOWED_DOMAIN=amscreativeint.com`, `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `ANTHROPIC_API_KEY`, `ENCRYPTION_KEY`.

### Tablas (borrador)
`users`, `companies`, `contacts`, `pipelines`, `pipeline_stages`, `deals`, `activities`, `tasks`, `custom_fields`, `products`, `tax_rates`, `quotes`, `quote_items`, `invoices`, `invoice_items`, `payments`, `recurring_profiles`, `number_sequences`, `email_accounts`, `email_messages`, `email_templates`, `campaigns`, `campaign_recipients`, `email_events`, `automations`, `ai_suggestions`.

## 8. Fases

| Fase | Entregable |
|---|---|
| 0. Base | Repositorio nuevo, marca, login con Google, layout y esquema de BD |
| 1. Núcleo | Contactos, empresas, negocios (Kanban), actividades e importación |
| 2. Dashboard | KPIs y gráficas |
| 3. Cotizaciones | Catálogo, cotización con GTQ/USD e IVA, PDF con marca, portal del cliente y aceptación online |
| 4. Facturación | Convertir a factura, pagos, recordatorios, recurrentes y reportes |
| 5. Gmail | Enviar desde el CRM y sincronizar hilos |
| 6. Resend | Segmentos, campañas y métricas |
| 7. IA | Resúmenes, redactor, riesgo, asistente y cotización asistida |
| 8. Automatización y FEL | Reglas, secuencias, renovaciones e integración con el certificador FEL |
| 9. Deploy | Sitio en Netlify, dominio (p. ej. `crm.amscreativeint.com`) y variables de producción |

## 9. Pendiente de ti

1. Confirmar el nombre del repositorio (`ams-crm`) y el subdominio (`crm.amscreativeint.com`).
2. Plantilla de presentación para la cotización y en qué página va la sección de precios.
3. Si ya emites FEL y con qué certificador.
4. Etapas de tu pipeline de ventas (p. ej. Lead → Reunión → Propuesta → Negociación → Ganado/Perdido).
