# Tema WordPress — AMS Studio

Réplica del sitio oficial de AMS Studio (Crystal Glassmorphism, luz azul real y pestañas del ecosistema) empaquetada como tema de WordPress.

## Modo claro / oscuro

- Por defecto el sitio usa el modo que el visitante tiene configurado en su navegador o sistema operativo, y cambia en vivo si lo cambia.
- El botón luna/sol del menú permite elegir otro modo; esa elección se recuerda en el navegador del visitante y tiene prioridad.
- Las secciones aparecen con una animación al hacer scroll. Si el visitante tiene activado "reducir movimiento", o si el JavaScript tarda en cargar, se muestran sin animación (nunca quedan ocultas).

## Animaciones (GSAP)

Inspiradas en guillaumezhu.com, pero solo las ligeras, para no frenar la navegación. Usan GSAP 3.15 con ScrollTrigger y SplitText, incluidos en el tema (`assets/js/vendor/`, unos 48 KB comprimidos) y cargados solo en la portada. El código está en `assets/js/animations.js`.

| Dónde | Efecto |
|---|---|
| Todo el sitio | Barra de progreso de lectura arriba; el menú se esconde al bajar y vuelve al subir |
| Hero | Insignia, titular palabra por palabra, texto y botones en secuencia al cargar |
| Fondo | Las luces azules se desplazan un poco más lento que la página (parallax) |
| Action. Mindset. Strategy. | Las letras entran en ola siguiendo el scroll (el efecto distintivo del sitio de referencia, usado una sola vez) |
| Títulos de Capacidades, Ecosistema y Contacto | Suben palabra por palabra al aparecer |
| Tarjetas (propósito, pilares, capacidades, ecosistema, contacto) | Suben en cascada al entrar en pantalla; al filtrar capacidades se reacomodan con una cascada corta |
| Cotizador | El panel se abre desde el centro mientras haces scroll |

Lo que se dejó fuera a propósito del sitio de referencia: pantalla de carga, objetos 3D, scroll suavizado y secciones fijas, porque hacen la navegación más lenta o pesada.

Si el visitante tiene activado "reducir movimiento" no se anima nada (el menú y la barra de progreso sí funcionan). Si GSAP no carga, el sitio usa la animación CSS sencilla de antes.

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
| **LiteSpeed Cache** | Los formularios piden un nonce nuevo justo antes de enviar, así que siguen funcionando aunque la página venga de la caché. Si activas *Generar UCSS*, el tema ya marca como protegidas las clases que agrega por JavaScript (menú móvil, modal, modo claro). No actives *Cargar JS retrasado*: el sitio seguiría funcionando, pero sin animaciones ni modo claro/oscuro hasta que el visitante toque la página. Después de actualizar el tema, purga la caché. |
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
