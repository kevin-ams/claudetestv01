<?php
/**
 * Contact + diagnosis form handling.
 *
 * Every submission is saved as a private "Solicitud" in wp-admin (so leads are
 * never lost if email delivery fails) and emailed to the configured recipient.
 *
 * @package AMS_Studio
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Registers the private lead post type.
 */
function ams_studio_register_leads() {
	register_post_type(
		'ams_lead',
		array(
			'labels'          => array(
				'name'          => __( 'Solicitudes', 'ams-studio' ),
				'singular_name' => __( 'Solicitud', 'ams-studio' ),
				'menu_name'     => __( 'Solicitudes', 'ams-studio' ),
			),
			'public'          => false,
			'show_ui'         => true,
			'show_in_rest'    => false,
			'menu_icon'       => 'dashicons-email-alt',
			'menu_position'   => 25,
			'supports'        => array( 'title', 'editor' ),
			'capability_type' => 'post',
			'capabilities'    => array( 'create_posts' => 'do_not_allow' ),
			'map_meta_cap'    => true,
		)
	);
}
add_action( 'init', 'ams_studio_register_leads' );

/**
 * Choices shown in the diagnosis form (section-estimator.php).
 *
 * @return array{stages:array<string,string>,disciplines:array<string,string>}
 */
function ams_studio_wizard_options() {
	return array(
		'stages'      => array(
			'idea'      => __( 'Idea por Validar', 'ams-studio' ),
			'existente' => __( 'Marca Existente', 'ams-studio' ),
			'unidad'    => __( 'Nueva Unidad de Negocio', 'ams-studio' ),
		),
		'disciplines' => array(
			'estrategia' => __( 'Estrategia', 'ams-studio' ),
			'branding'   => __( 'Branding', 'ams-studio' ),
			'web'        => __( 'Desarrollo Web', 'ams-studio' ),
			'growth'     => __( 'Growth', 'ams-studio' ),
		),
	);
}

/**
 * Hands out a fresh nonce. The page HTML is cached by LiteSpeed (and the host),
 * so a nonce printed into the page would expire while the cached copy lives on;
 * admin-ajax.php is never cached, so the form asks for one right before sending.
 */
function ams_studio_get_nonce() {
	nocache_headers();
	wp_send_json_success( array( 'nonce' => wp_create_nonce( 'ams_studio_form' ) ) );
}
add_action( 'wp_ajax_ams_studio_nonce', 'ams_studio_get_nonce' );
add_action( 'wp_ajax_nopriv_ams_studio_nonce', 'ams_studio_get_nonce' );

/**
 * Reads a sanitized text field from the POST body.
 *
 * @param string $key Field name.
 * @return string
 */
function ams_studio_post_text( $key ) {
	// phpcs:ignore WordPress.Security.NonceVerification.Missing -- verified in ams_studio_handle_submit().
	return isset( $_POST[ $key ] ) ? sanitize_text_field( wp_unslash( $_POST[ $key ] ) ) : '';
}

/**
 * AJAX endpoint for both forms.
 */
function ams_studio_handle_submit() {
	check_ajax_referer( 'ams_studio_form', 'nonce' );

	// Honeypot: bots fill every field.
	if ( '' !== ams_studio_post_text( 'website' ) ) {
		wp_send_json_success();
	}

	// Basic per-IP throttle: 5 submissions per 10 minutes.
	$ip    = isset( $_SERVER['REMOTE_ADDR'] ) ? sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ) ) : '';
	$key   = 'ams_rl_' . md5( $ip );
	$count = (int) get_transient( $key );
	if ( $count >= 5 ) {
		wp_send_json_error( array( 'message' => __( 'Has enviado varias solicitudes seguidas. Espera unos minutos e inténtalo de nuevo.', 'ams-studio' ) ), 429 );
	}
	set_transient( $key, $count + 1, 10 * MINUTE_IN_SECONDS );

	$type  = 'wizard' === ams_studio_post_text( 'form_type' ) ? 'wizard' : 'contact';
	$name  = ams_studio_post_text( 'nombre' );
	$email = sanitize_email( ams_studio_post_text( 'email' ) );

	if ( '' === $name || ! is_email( $email ) ) {
		wp_send_json_error( array( 'message' => __( 'Revisa tu nombre y correo electrónico.', 'ams-studio' ) ), 400 );
	}

	$lines = array();
	if ( 'wizard' === $type ) {
		$options     = ams_studio_wizard_options();
		$stage       = ams_studio_post_text( 'etapa' );
		// phpcs:ignore WordPress.Security.NonceVerification.Missing
		$disciplines = isset( $_POST['servicio'] ) ? array_map( 'sanitize_key', (array) wp_unslash( $_POST['servicio'] ) ) : array();
		$labels      = array_values( array_intersect_key( $options['disciplines'], array_flip( $disciplines ) ) );

		$subject = sprintf( /* translators: %s: name. */ __( '[AMS Studio] Nuevo diagnóstico estratégico — %s', 'ams-studio' ), $name );
		$lines[] = __( 'Etapa:', 'ams-studio' ) . ' ' . ( isset( $options['stages'][ $stage ] ) ? $options['stages'][ $stage ] : '—' );
		$lines[] = __( 'Disciplinas:', 'ams-studio' ) . ' ' . ( $labels ? implode( ', ', $labels ) : '—' );
	} else {
		$last    = ams_studio_post_text( 'apellido' );
		$phone   = ams_studio_post_text( 'telefono' );
		// phpcs:ignore WordPress.Security.NonceVerification.Missing
		$message = isset( $_POST['mensaje'] ) ? sanitize_textarea_field( wp_unslash( $_POST['mensaje'] ) ) : '';
		if ( '' === $message ) {
			wp_send_json_error( array( 'message' => __( 'Escribe un mensaje.', 'ams-studio' ) ), 400 );
		}
		$name    = trim( $name . ' ' . $last );
		$subject = sprintf( /* translators: %s: name. */ __( '[AMS Studio] Nuevo mensaje de contacto — %s', 'ams-studio' ), $name );
		$lines[] = __( 'Teléfono:', 'ams-studio' ) . ' ' . $phone;
		$lines[] = '';
		$lines[] = $message;
	}

	$body = implode(
		"\n",
		array_merge(
			array(
				__( 'Nombre:', 'ams-studio' ) . ' ' . $name,
				__( 'Email:', 'ams-studio' ) . ' ' . $email,
			),
			$lines
		)
	);

	wp_insert_post(
		array(
			'post_type'    => 'ams_lead',
			'post_status'  => 'private',
			'post_title'   => $subject,
			'post_content' => $body,
		)
	);

	$recipient = ams_studio_mod( 'ams_form_recipient' );
	if ( ! is_email( $recipient ) ) {
		$recipient = get_option( 'admin_email' );
	}
	wp_mail( $recipient, $subject, $body, array( 'Reply-To: ' . $name . ' <' . $email . '>' ) );

	wp_send_json_success();
}
add_action( 'wp_ajax_ams_studio_submit', 'ams_studio_handle_submit' );
add_action( 'wp_ajax_nopriv_ams_studio_submit', 'ams_studio_handle_submit' );
