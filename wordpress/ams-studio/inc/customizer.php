<?php
/**
 * Customizer settings: contact data, social links and estimator pricing.
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

	// Estimator.
	$wp_customize->add_section(
		'ams_studio_estimator',
		array(
			'title'       => __( 'AMS Studio: Cotizador', 'ams-studio' ),
			'description' => __( 'Rangos base por disciplina (alcance Esencial). El cotizador los ajusta según etapa y alcance.', 'ams-studio' ),
			'priority'    => 31,
		)
	);

	$wp_customize->add_setting(
		'ams_est_show_prices',
		array(
			'default'           => true,
			'sanitize_callback' => 'rest_sanitize_boolean',
		)
	);
	$wp_customize->add_control(
		'ams_est_show_prices',
		array(
			'label'   => __( 'Mostrar rango de inversión al visitante', 'ams-studio' ),
			'section' => 'ams_studio_estimator',
			'type'    => 'checkbox',
		)
	);

	$wp_customize->add_setting(
		'ams_est_currency',
		array(
			'default'           => 'US$',
			'sanitize_callback' => 'sanitize_text_field',
		)
	);
	$wp_customize->add_control(
		'ams_est_currency',
		array(
			'label'   => __( 'Símbolo de moneda', 'ams-studio' ),
			'section' => 'ams_studio_estimator',
			'type'    => 'text',
		)
	);

	foreach ( ams_studio_estimator_disciplines() as $key => $d ) {
		$parts = array(
			'min'   => __( 'mínimo', 'ams-studio' ),
			'max'   => __( 'máximo', 'ams-studio' ),
			'weeks' => __( 'semanas', 'ams-studio' ),
		);
		foreach ( $parts as $part => $part_label ) {
			$setting = "ams_est_{$key}_{$part}";
			$wp_customize->add_setting(
				$setting,
				array(
					'default'           => $d[ $part ],
					'sanitize_callback' => 'absint',
				)
			);
			$wp_customize->add_control(
				$setting,
				array(
					/* translators: 1: discipline name, 2: field (minimum, maximum, weeks). */
					'label'       => sprintf( __( '%1$s — %2$s', 'ams-studio' ), $d['label'], $part_label ),
					'section'     => 'ams_studio_estimator',
					'type'        => 'number',
					'input_attrs' => array( 'min' => 0 ),
				)
			);
		}
	}
}
add_action( 'customize_register', 'ams_studio_customize_register' );
