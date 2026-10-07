<?php
/**
 * AMS Studio theme bootstrap.
 *
 * @package AMS_Studio
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'AMS_STUDIO_VERSION', '1.0.0' );
define( 'AMS_STUDIO_DIR', get_template_directory() );
define( 'AMS_STUDIO_URI', get_template_directory_uri() );

require AMS_STUDIO_DIR . '/inc/customizer.php';
require AMS_STUDIO_DIR . '/inc/estimator.php';
require AMS_STUDIO_DIR . '/inc/forms.php';

/**
 * Theme supports and menus.
 */
function ams_studio_setup() {
	load_theme_textdomain( 'ams-studio', AMS_STUDIO_DIR . '/languages' );

	add_theme_support( 'title-tag' );
	add_theme_support( 'post-thumbnails' );
	add_theme_support( 'html5', array( 'search-form', 'comment-form', 'comment-list', 'gallery', 'caption', 'style', 'script' ) );
	add_theme_support(
		'custom-logo',
		array(
			'height'      => 80,
			'width'       => 80,
			'flex-height' => true,
			'flex-width'  => true,
		)
	);

	register_nav_menus(
		array(
			'primary' => __( 'Menú principal', 'ams-studio' ),
		)
	);
}
add_action( 'after_setup_theme', 'ams_studio_setup' );

/**
 * Front-end assets. Tailwind is precompiled into assets/css/main.css,
 * so the CDN build is not loaded in production.
 */
function ams_studio_assets() {
	wp_enqueue_style(
		'ams-studio-fonts',
		'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400&display=swap',
		array(),
		null
	);
	wp_enqueue_style(
		'ams-studio-fontawesome',
		'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
		array(),
		'6.4.0'
	);
	wp_enqueue_style(
		'ams-studio-main',
		AMS_STUDIO_URI . '/assets/css/main.css',
		array(),
		filemtime( AMS_STUDIO_DIR . '/assets/css/main.css' )
	);

	wp_enqueue_script(
		'ams-studio-main',
		AMS_STUDIO_URI . '/assets/js/main.js',
		array(),
		filemtime( AMS_STUDIO_DIR . '/assets/js/main.js' ),
		true
	);

	wp_localize_script(
		'ams-studio-main',
		'AMS_STUDIO',
		array(
			'ajaxUrl'   => admin_url( 'admin-ajax.php' ),
			'nonce'     => wp_create_nonce( 'ams_studio_form' ),
			'estimator' => ams_studio_estimator_config(),
			'i18n'      => array(
				'sending' => __( 'Enviando…', 'ams-studio' ),
				'error'   => __( 'No pudimos enviar tu mensaje. Inténtalo de nuevo o escríbenos directamente por correo.', 'ams-studio' ),
			),
		)
	);
}
add_action( 'wp_enqueue_scripts', 'ams_studio_assets' );

/**
 * Preconnect to font hosts.
 *
 * @param array  $urls          URLs to print for resource hints.
 * @param string $relation_type The relation type.
 * @return array
 */
function ams_studio_resource_hints( $urls, $relation_type ) {
	if ( 'preconnect' === $relation_type ) {
		$urls[] = 'https://fonts.googleapis.com';
		$urls[] = array(
			'href'        => 'https://fonts.gstatic.com',
			'crossorigin' => 'anonymous',
		);
	}
	return $urls;
}
add_filter( 'wp_resource_hints', 'ams_studio_resource_hints', 10, 2 );

/**
 * Builds an in-page anchor that also works from inner pages.
 *
 * @param string $id Section id without '#'.
 * @return string
 */
function ams_studio_anchor( $id ) {
	return is_front_page() ? '#' . $id : home_url( '/#' . $id );
}

/**
 * Default one-page navigation, used when no menu is assigned.
 *
 * @return array<string,string> section id => label
 */
function ams_studio_default_nav() {
	return array(
		'proposito'  => __( 'Propósito', 'ams-studio' ),
		'pilares'    => __( 'Filosofía', 'ams-studio' ),
		'servicios'  => __( 'Expertise', 'ams-studio' ),
		'ecosistema' => __( 'Ecosistema', 'ams-studio' ),
		'estimador'  => __( 'Cotizador', 'ams-studio' ),
		'contacto'   => __( 'Contacto', 'ams-studio' ),
	);
}

/**
 * Prints nav links, either from the assigned WP menu or the defaults.
 *
 * @param string $link_class CSS classes for each link.
 */
function ams_studio_nav_links( $link_class ) {
	$locations = get_nav_menu_locations();
	if ( ! empty( $locations['primary'] ) ) {
		$items = wp_get_nav_menu_items( $locations['primary'] );
		if ( $items ) {
			foreach ( $items as $item ) {
				if ( (int) $item->menu_item_parent ) {
					continue;
				}
				printf( '<a href="%s" class="%s">%s</a>', esc_url( $item->url ), esc_attr( $link_class ), esc_html( $item->title ) );
			}
			return;
		}
	}
	foreach ( ams_studio_default_nav() as $id => $label ) {
		printf( '<a href="%s" class="%s">%s</a>', esc_url( ams_studio_anchor( $id ) ), esc_attr( $link_class ), esc_html( $label ) );
	}
}

/**
 * The AMS geometric logo mark (fallback when no custom logo is set).
 *
 * @param string $class   CSS classes.
 * @param bool   $accent  Whether to include the periwinkle accent wave.
 */
function ams_studio_logo_svg( $class = 'w-10 h-10', $accent = true ) {
	?>
	<svg viewBox="0 0 100 100" class="<?php echo esc_attr( $class ); ?>" aria-hidden="true" focusable="false">
		<rect x="5" y="15" width="90" height="70" rx="18" fill="#2563FF"/>
		<path d="M 15 65 Q 35 30 50 65 Q 65 25 85 65 L 85 70 L 15 70 Z" fill="#F4F6FF" opacity="0.95"/>
		<?php if ( $accent ) : ?>
			<path d="M 35 65 Q 50 35 65 65 Z" fill="#8DA5FF" opacity="0.8"/>
		<?php endif; ?>
	</svg>
	<?php
}
