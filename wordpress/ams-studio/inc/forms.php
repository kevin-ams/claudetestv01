<?php
/**
 * Contact + estimator form handling.
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
		$config      = ams_studio_estimator_config();
		$stage       = ams_studio_post_text( 'etapa' );
		$scope       = ams_studio_post_text( 'alcance' );
		// phpcs:ignore WordPress.Security.NonceVerification.Missing
		$disciplines = isset( $_POST['servicio'] ) ? array_map( 'sanitize_key', (array) wp_unslash( $_POST['servicio'] ) ) : array();
		$disciplines = array_values( array_intersect( $disciplines, array_keys( $config['disciplines'] ) ) );
		$estimate    = ams_studio_compute_estimate( $stage, $disciplines, $scope );

		$labels  = array_map(
			function ( $k ) use ( $config ) {
				return $config['disciplines'][ $k ]['label'];
			},
			$disciplines
		);
		$subject = sprintf( /* translators: %s: name. */ __( '[AMS Studio] Nuevo diagnóstico estratégico — %s', 'ams-studio' ), $name );
		$lines[] = __( 'Etapa:', 'ams-studio' ) . ' ' . ( isset( $config['stages'][ $stage ] ) ? $config['stages'][ $stage ]['value'] : '—' );
		$lines[] = __( 'Alcance:', 'ams-studio' ) . ' ' . ( isset( $config['scopes'][ $scope ] ) ? $config['scopes'][ $scope ]['label'] : '—' );
		$lines[] = __( 'Disciplinas:', 'ams-studio' ) . ' ' . ( $labels ? implode( ', ', $labels ) : '—' );
		if ( $estimate ) {
			$lines[] = sprintf(
				/* translators: 1: currency, 2: min, 3: max, 4: weeks. */
				__( 'Estimado mostrado: %1$s%2$s – %1$s%3$s · ~%4$d semanas', 'ams-studio' ),
				$config['currency'],
				number_format_i18n( $estimate['min'] ),
				number_format_i18n( $estimate['max'] ),
				$estimate['weeks']
			);
		}
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
