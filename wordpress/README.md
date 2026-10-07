# Tema WordPress — AMS Studio

Réplica del sitio oficial de AMS Studio (Crystal Glassmorphism, luz azul real, cotizador interactivo y pestañas del ecosistema) empaquetada como tema de WordPress.

## Instalación

1. Descarga `wordpress/ams-studio.zip`.
2. En WordPress: **Apariencia → Temas → Añadir nuevo → Subir tema**, selecciona el zip y pulsa **Instalar** y luego **Activar**.
3. **Ajustes → Lectura**: deja "Tus últimas entradas" o elige una página estática como portada. En ambos casos la portada muestra el one-page (`front-page.php`).
4. **Apariencia → Personalizar**:
   - **AMS Studio: Contacto**: teléfono, correos visibles, el correo que recibe los formularios y los enlaces a LinkedIn, Instagram y WhatsApp. Un ícono social sin URL no se muestra.
   - **AMS Studio: Cotizador**: rangos base (mínimo, máximo y semanas) por disciplina, la moneda y si se muestra el monto al visitante.
   - **Identidad del sitio → Logo**: opcional; si no subes uno se usa el isotipo SVG de AMS.
5. (Opcional) **Apariencia → Menús**: si asignas un menú a "Menú principal" reemplaza la navegación por defecto. Para anclas usa enlaces personalizados como `/#ecosistema`.

## Formularios

- El contacto y el cotizador se envían por AJAX (`admin-ajax.php`) con nonce, honeypot anti-spam y un límite de 5 envíos cada 10 minutos por IP.
- Cada envío se guarda en **wp-admin → Solicitudes**, así que no se pierde aunque falle el correo.
- El correo se envía con `wp_mail()`. En la mayoría de hostings conviene instalar un plugin SMTP (WP Mail SMTP, FluentSMTP…) para que llegue a la bandeja de entrada.
- El estimado que aparece en el correo se recalcula en el servidor, así que no se puede manipular desde el navegador.

## Cómo calcula el cotizador

```
inversión = suma de rangos de las disciplinas elegidas × factor de etapa × factor de alcance
semanas   = (semanas de la disciplina más larga + 1 por cada disciplina extra) × factor de alcance + semanas extra por etapa
```

| Etapa                   | Factor | Semanas extra |
|-------------------------|--------|---------------|
| Idea por validar        | 1.00   | +1            |
| Marca existente         | 0.90   | 0             |
| Nueva unidad de negocio | 1.25   | +2            |

| Alcance     | Factor inversión | Factor tiempo |
|-------------|------------------|---------------|
| Esencial    | 1.0              | 1.00          |
| Profesional | 1.6              | 1.25          |
| Premium     | 2.4              | 1.50          |

**Los montos por defecto son de referencia**: ajústalos en el Personalizador antes de publicar. Los factores se cambian con el filtro `ams_studio_estimator_config` (por ejemplo, desde un plugin de snippets).

## Editar textos

Los textos de cada sección están en `ams-studio/template-parts/section-*.php`. Puedes editarlos en **Herramientas → Editor de archivos del tema** o por FTP.

## Desarrollo

Los estilos son Tailwind CSS 3, con la misma configuración del diseño original, compilados en `assets/css/main.css`. En producción no se usa el CDN de Tailwind. Si cambias clases en las plantillas:

```sh
cd wordpress/ams-studio
npm install
npm run build        # o: npm run watch
cd .. && ./build-zip.sh
```
