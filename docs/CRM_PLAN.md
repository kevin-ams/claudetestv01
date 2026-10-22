# Plan del CRM

Plan de trabajo para construir un CRM dentro de esta app (Next.js 16 + Netlify Database + auth propia).
Primero lo desarrollamos y probamos aquí (`npm run dev`), y cuando esté estable lo desplegamos en Netlify.

---

## 1. Qué hacen los mejores CRM (investigación)

| CRM | Lo que destaca | Qué tomamos |
|---|---|---|
| **HubSpot** | Contactos, empresas, negocios y tickets en un solo registro; línea de tiempo con todo (emails, llamadas, notas); secuencias de email; cotizaciones con firma y pago; IA "Breeze" (agente de prospección, resúmenes, scoring predictivo) | Modelo de objetos y línea de tiempo unificada, cotizaciones, secuencias |
| **Salesforce** (Einstein / Agentforce) | Lead scoring 1–99 según tus conversiones históricas; agentes autónomos; forecasting | Lead score simple al inicio, forecast por probabilidad de etapa |
| **Pipedrive** | Pipeline visual tipo Kanban muy ágil; "rotting" (negocios que se enfrían); metas por vendedor | Kanban con drag & drop y alerta de negocios estancados |
| **Attio** | Modelo de datos flexible (campos personalizados), enriquecimiento automático, IA nativa | Campos personalizados por objeto |
| **Certo Growth** (referencia tuya) | Empresa como registro central; propuestas aceptadas online (se guarda la versión aceptada); contratos con alerta de renovación a 90 días; IA que responde con tus datos citando fuentes, detecta negocios sin actividad en 15 días y **nunca cambia datos sin aprobación** | Propuestas con aceptación online, contratos/renovaciones, IA "con permiso" |
| **Dastone** (referencia visual) | Plantilla admin con dashboards de analítica/CRM: tarjetas KPI, gráficas de línea/área, donut por fuente, tablas recientes | Estilo del dashboard: fila de KPIs + gráficas + tablas |

## 2. Módulos propuestos

### Núcleo (MVP)
1. **Contactos** – nombre, email, teléfono, empresa, dueño, etiquetas, origen, lead score, campos personalizados.
2. **Empresas** – datos fiscales (RFC/NIT), industria, tamaño, contactos asociados.
3. **Negocios / Oportunidades** – pipeline Kanban con etapas configurables, monto, probabilidad, fecha de cierre, motivo de pérdida.
4. **Actividades y tareas** – notas, llamadas, reuniones, tareas con vencimiento; línea de tiempo por contacto/negocio.
5. **Dashboard** – KPIs (pipeline abierto, ganado del mes, tasa de conversión, ciclo promedio), embudo por etapa, ingresos por mes, origen de leads, negocios estancados.
6. **Importación CSV/XLSX** con mapeo de columnas y detección de duplicados.

### Comunicación
7. **Integración Gmail (Google Workspace)** – ver detalle en §3.
8. **Envío masivo con Resend** – ver detalle en §4.
9. **Plantillas de email** con variables (`{{nombre}}`, `{{empresa}}`).

### Ventas
10. **Catálogo de productos/servicios** – precio, moneda, impuesto, unidad.
11. **Cotizador** – ver detalle en §5.
12. **Contratos y renovaciones** (fase posterior) – vigencia y alerta automática antes del vencimiento.

### Automatización
13. **Reglas simples**: "si negocio pasa a etapa X → crear tarea / enviar email", "si no hay actividad en N días → alerta".
14. **Secuencias** (fase posterior): serie de emails que se detiene cuando el contacto responde.

### Funciones con IA (usando la API de Claude)
| Función | Cómo funciona |
|---|---|
| **Resumen de cuenta/negocio** | Lee la línea de tiempo y emails y genera "dónde estamos y siguiente paso" |
| **Redactor de emails** | Borrador personalizado a partir del contexto del contacto; el usuario revisa antes de enviar |
| **Lead scoring** | Primero por reglas (cargo, interacción, aperturas); luego IA que explica el puntaje |
| **Detector de riesgo** | Marca negocios sin actividad, emails sin respuesta, cotizaciones esperando > 15 días |
| **Asistente "pregúntale al CRM"** | "¿Qué cotizaciones llevan más de 15 días sin respuesta?" — responde citando registros |
| **Extracción desde emails** | Detecta en un correo entrante datos de contacto, fechas o intención de compra y propone actualizar el CRM |
| **Notas de reunión → tareas** | Pegas notas/transcripción y propone tareas y cambio de etapa |

Principio (como Certo): **la IA propone, la persona aprueba**. Nunca cambia etapas, descuentos ni datos sin confirmación.

## 3. Integración con Gmail

- **Google OAuth 2.0** por usuario (conectar su cuenta desde Configuración). Tokens de refresco cifrados en la base de datos.
- **Gmail API** para: enviar desde la cuenta del vendedor (aparece en su "Enviados"), leer hilos con contactos del CRM y asociarlos automáticamente a la línea de tiempo.
- **Sincronización**: `users.watch` + Google Pub/Sub para notificaciones en tiempo real, o sondeo con `history.list` cada pocos minutos (más simple para empezar).
- **Importante**: los scopes de Gmail son "restringidos". Si la app es solo para su organización de Google Workspace, se configura como **app interna** y no requiere la verificación/auditoría de seguridad de Google. Si se ofrecerá a otras empresas, sí la requiere (proceso largo). → Confirmar cuál es el caso.
- Opcional: **Google Calendar** para agendar reuniones desde el negocio.

## 4. Envío masivo con Resend

- **Gmail para 1 a 1, Resend para masivo**: así no se arriesga la reputación ni los límites de la cuenta de Gmail.
- Dominio propio verificado en Resend (SPF, DKIM, DMARC), idealmente un subdominio (`mail.tudominio.com`).
- **Campañas**: elegir segmento (filtros del CRM) → plantilla → vista previa → programar/enviar. Usar la Batch API (hasta 100 por llamada) o Broadcasts de Resend.
- **Webhooks de Resend** → registrar entregado, abierto, clic, rebote y queja en la línea de tiempo del contacto y alimentar el lead score.
- **Cumplimiento**: enlace de baja obligatorio, lista de supresión, respetar consentimiento.

## 5. Cotizador

Flujo propuesto:
1. Desde un negocio → "Nueva cotización". Se agregan líneas desde el catálogo (cantidad, precio, descuento, impuesto) y se calculan subtotal/IVA/total.
2. **Plantilla**: subes tu plantilla (PDF de presentación de la empresa). El sistema genera la **página de precios** con la tabla de la cotización y la **inserta en la sección de precios** de la plantilla (por ejemplo, en la página marcada para ello), produciendo un único PDF. Técnica: `pdf-lib` para combinar páginas + generación de la página de precios.
3. Enlace público para que el cliente **vea y acepte online**; al aceptar se congela esa versión, el negocio pasa a "Ganado" y se notifica al dueño.
4. Versionado (v1, v2…), vencimiento, folio consecutivo, moneda.
5. IA: explicar diferencias entre la versión enviada y la aceptada; sugerir seguimiento si no hay respuesta.

**Necesito de ti**: la plantilla (PDF o Word) y cómo identificar dónde va la página de precios (número de página o una página marcador).

## 6. Arquitectura técnica

- **Reutilizar lo que ya existe**: Next.js 16 (App Router, server actions), Netlify Database (Postgres) con migraciones en `netlify/database/migrations/`, auth propia (`src/lib/auth`), capa de dominio en `src/lib/domain`, Tailwind.
- **Nuevas dependencias previstas**: `googleapis` (Gmail), `resend`, `@anthropic-ai/sdk` (IA), `pdf-lib` (cotizaciones), una librería de gráficas (p. ej. `recharts`), `@dnd-kit` (Kanban), `xlsx`/`papaparse` (importación).
- **Archivos** (plantillas y PDFs generados): Netlify Blobs.
- **Tareas programadas** (sincronizar Gmail, alertas de estancamiento/renovación): Netlify Scheduled Functions.
- **Variables de entorno**: `GOOGLE_CLIENT_ID/SECRET`, `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `ANTHROPIC_API_KEY`, `ENCRYPTION_KEY`.
- **Navegación**: nueva sección "CRM" en el sidebar (Dashboard CRM, Contactos, Empresas, Negocios, Cotizaciones, Campañas, Productos).

### Tablas nuevas (borrador)
`companies`, `contacts`, `pipelines`, `pipeline_stages`, `deals`, `deal_contacts`, `activities`, `tasks`, `custom_fields`, `products`, `quotes`, `quote_items`, `quote_templates`, `email_accounts`, `email_messages`, `email_templates`, `campaigns`, `campaign_recipients`, `email_events`, `automations`, `ai_suggestions`.

## 7. Fases

| Fase | Entregable | Resultado |
|---|---|---|
| **0. Base** | Esquema de BD, navegación CRM, componentes de tabla/formulario | Estructura lista |
| **1. Núcleo** | Contactos, empresas, negocios (Kanban), actividades, importación CSV | CRM usable a mano |
| **2. Dashboard** | KPIs y gráficas estilo Dastone | Visibilidad del pipeline |
| **3. Cotizador** | Catálogo, cotización, PDF con tu plantilla, aceptación online | Propuestas profesionales |
| **4. Gmail** | Conectar cuenta, enviar y sincronizar hilos | Email dentro del CRM |
| **5. Resend** | Segmentos, plantillas, campañas, webhooks de métricas | Envío masivo |
| **6. IA** | Resúmenes, redactor, riesgo, asistente, scoring | Diferenciador |
| **7. Automatización** | Reglas y secuencias, contratos/renovaciones | Menos trabajo manual |
| **8. Deploy** | Variables en Netlify, dominio Resend, OAuth en producción | En línea |

## 8. Decisiones pendientes

1. ¿El CRM vive **dentro de esta app EOS** (mismo login y equipo) o como app separada? *Recomendación: dentro, comparte usuarios y equipo.*
2. ¿Gmail solo para tu organización de Google Workspace (app interna) o para clientes externos?
3. ¿Moneda(s) e impuestos de las cotizaciones (MXN/USD, IVA 16 %…)?
4. ¿Ventas B2B (empresa como centro) o B2C (contacto como centro)?
5. Plantilla de cotización y dominio para Resend.
