# Tema WordPress — AMS Studio

Réplica del sitio oficial de AMS Studio (Crystal Glassmorphism, luz azul real y pestañas del ecosistema) empaquetada como tema de WordPress.

## Instalar o actualizar

1. Descarga `wordpress/ams-studio.zip`.
2. En WordPress ve a **Apariencia → Temas → Añadir nuevo → Subir tema**, selecciona el zip y pulsa **Instalar**. Si el tema ya existe, elige **Reemplazar el instalado por el subido**.
3. **LiteSpeed Cache → Panel → Purgar todo** para que los visitantes vean la versión nueva.

## Configuración

- **Ajustes → Generales → Título del sitio**: `AMS Studio`. Hoy el título, y por eso también lo que muestran Google y Yoast, es el dominio temporal.
- **Apariencia → Personalizar → AMS Studio: Contacto**: teléfono, correos visibles, correo que recibe los formularios y enlaces a LinkedIn, Instagram y WhatsApp. Un ícono social sin URL no se muestra.
- **Apariencia → Personalizar → AMS Studio: Formularios** (opcional): ID de un formulario de WPForms para "Envíanos un mensaje" y otro para "Solicitar Diagnóstico". Vacío = formulario integrado del tema.
- **Identidad del sitio → Logo** (opcional): si no subes uno se usa el isotipo SVG.
- **Apariencia → Menús** (opcional): un menú asignado a "Menú principal" reemplaza la navegación por defecto. Para las anclas usa enlaces como `/#ecosistema`.

## Plugins

| Plugin | Qué tener en cuenta |
|---|---|
| **LiteSpeed Cache** | Los formularios piden un nonce nuevo justo antes de enviar, así que siguen funcionando aunque la página venga de la caché. Si activas *Generar UCSS*, el tema ya marca como protegidas las clases que agrega por JavaScript (menú móvil, modal). Después de actualizar el tema, purga la caché. |
| **WP Mail SMTP** | Configúralo con el correo de `amscreativeint.com`. El formulario integrado y WPForms envían a través de él. |
| **WPForms** | Opcional. Crea el formulario y pon su ID en *Personalizar → AMS Studio: Formularios*; el tema le aplica el estilo glass. |
| **Elementor** | La portada usa el diseño del tema; no hace falta editarla con Elementor. Para páginas nuevas usa la plantilla **Elementor ancho completo**, que conserva el menú y el pie del tema (el contenido arranca debajo del menú fijo). Con **Elementor Pro**, un encabezado o pie hecho en el Theme Builder reemplaza al del tema. |
| **Yoast SEO** | El tema deja que Yoast maneje el título y las metas. Completa el título SEO y la meta descripción de la portada en **Yoast → Ajustes → Tipos de contenido → Página de inicio**. |
| **Site Kit by Google** | Funciona sin cambios: el tema incluye `wp_head`, `wp_body_open` y `wp_footer`. |
| **Contact Form 7** | Está activo en el sitio pero el tema no lo usa. Si no lo necesitas, desactívalo: carga sus scripts en todas las páginas. |

## Formularios integrados

- Se envían por AJAX con nonce, honeypot antispam y un límite de 5 envíos cada 10 minutos por IP.
- Cada envío se guarda en **wp-admin → Solicitudes**, así que no se pierde aunque falle el correo.

## Editar textos

Los textos de cada sección están en `ams-studio/template-parts/section-*.php`. Puedes editarlos en **Apariencia → Editor de archivos de tema** o por FTP.

## Desarrollo

Los estilos son Tailwind CSS 3 (misma configuración del diseño original), compilados en `assets/css/main.css`. Si cambias clases en las plantillas:

```sh
cd wordpress/ams-studio
npm install
npm run build        # o: npm run watch
cd .. && ./build-zip.sh
```
