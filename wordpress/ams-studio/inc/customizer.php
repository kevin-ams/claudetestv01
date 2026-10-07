<?php
/**
 * Customizer settings: contact data, social links and optional WPForms forms.
 *
 * @package AMS_Studio
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Default values for contact theme mods.
 *
 * @return array<string,string>
 */
function ams_studio_contact_defaults() {
	return array(
		'ams_phone'           => '+502 4867-4068',
		'ams_email_sales'     => 'ventas@amscreativeint.com',
		'ams_email_info'      => 'info@amscreativeint.com',
		'ams_email_support'   => 'soporte@amscreativeint.com',
		'ams_form_recipient'  => 'ventas@amscreativeint.com',
		'ams_social_linkedin' => '',
		'ams_social_instagram' => '',
		'ams_social_whatsapp' => 'https://wa.me/50248674068',
	);
}

/**
 * Reads a contact theme mod with its default.
 *
 * @param string $key Theme mod key.
 * @return string
 */
function ams_studio_mod( $key ) {
	$defaults = ams_studio_contact_defaults();
	return (string) get_theme_mod( $key, isset( $defaults[ $key ] ) ? $defaults[ $key ] : '' );
}

/**
 * Registers Customizer panels.
 *
 * @param WP_Customize_Manager $wp_customize Customizer instance.
 */
function ams_studio_customize_register( $wp_customize ) {
	$defaults = ams_studio_contact_defaults();

	// Contact.
	$wp_customize->add_section(
		'ams_studio_contact',
		array(
			'title'    => __( 'AMS Studio: Contacto', 'ams-studio' ),
			'priority' => 30,
		)
	);

	$fields = array(
		'ams_phone'            => array( __( 'Teléfono principal', 'ams-studio' ), 'sanitize_text_field', 'text' ),
		'ams_email_sales'      => array( __( 'Correo de ventas', 'ams-studio' ), 'sanitize_email', 'email' ),
		'ams_email_info'       => array( __( 'Correo de información', 'ams-studio' ), 'sanitize_email', 'email' ),
		'ams_email_support'    => array( __( 'Correo de soporte', 'ams-studio' ), 'sanitize_email', 'email' ),
		'ams_form_recipient'   => array( __( 'Correo que recibe los formularios', 'ams-studio' ), 'sanitize_email', 'email' ),
		'ams_social_linkedin'  => array( __( 'URL de LinkedIn', 'ams-studio' ), 'esc_url_raw', 'url' ),
		'ams_social_instagram' => array( __( 'URL de Instagram', 'ams-studio' ), 'esc_url_raw', 'url' ),
		'ams_social_whatsapp'  => array( __( 'URL de WhatsApp (https://wa.me/…)', 'ams-studio' ), 'esc_url_raw', 'url' ),
	);

	foreach ( $fields as $key => $field ) {
		$wp_customize->add_setting(
			$key,
			array(
				'default'           => $defaults[ $key ],
				'sanitize_callback' => $field[1],
			)
		);
		$wp_customize->add_control(
			$key,
			array(
				'label'   => $field[0],
				'section' => 'ams_studio_contact',
				'type'    => $field[2],
			)
		);
	}

	// Forms.
	$wp_customize->add_section(
		'ams_studio_forms',
		array(
			'title'       => __( 'AMS Studio: Formularios', 'ams-studio' ),
			'description' => __( 'Opcional: escribe el ID de un formulario de WPForms (WPForms → Todos los formularios) para usarlo en lugar del formulario integrado. Déjalo vacío para usar el formulario del tema.', 'ams-studio' ),
			'priority'    => 31,
		)
	);

	$forms = array(
		'ams_wpforms_contact' => __( 'ID de WPForms para "Envíanos un mensaje"', 'ams-studio' ),
		'ams_wpforms_wizard'  => __( 'ID de WPForms para "Solicitar Diagnóstico"', 'ams-studio' ),
	);
	foreach ( $forms as $key => $label ) {
		$wp_customize->add_setting(
			$key,
			array(
				'default'           => '',
				'sanitize_callback' => 'ams_studio_sanitize_form_id',
			)
		);
		$wp_customize->add_control(
			$key,
			array(
				'label'       => $label,
				'section'     => 'ams_studio_forms',
				'type'        => 'number',
				'input_attrs' => array( 'min' => 1 ),
			)
		);
	}
}
add_action( 'customize_register', 'ams_studio_customize_register' );

/**
 * Sanitizes an optional form ID ('' when empty).
 *
 * @param mixed $value Raw value.
 * @return string
 */
function ams_studio_sanitize_form_id( $value ) {
	$id = absint( $value );
	return $id ? (string) $id : '';
}

/**
 * Renders the WPForms form set for a slot, or '' to fall back to the built-in form.
 *
 * @param string $mod Theme mod holding the WPForms form ID.
 * @return string
 */
function ams_studio_wpforms( $mod ) {
	$id = absint( get_theme_mod( $mod, '' ) );
	if ( ! $id || ! function_exists( 'wpforms' ) ) {
		return '';
	}
	return '<div class="ams-wpforms">' . do_shortcode( '[wpforms id="' . $id . '" title="false" description="false"]' ) . '</div>';
}
