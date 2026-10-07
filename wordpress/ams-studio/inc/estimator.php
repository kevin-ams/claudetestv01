<?php
/**
 * Project estimator configuration.
 *
 * Base amounts are editable in Apariencia → Personalizar → AMS Studio: Cotizador.
 * Stages and scopes can be adjusted with the `ams_studio_estimator_config` filter.
 *
 * @package AMS_Studio
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Disciplines offered in the estimator with their default ranges.
 *
 * @return array<string,array{label:string,icon:string,min:int,max:int,weeks:int}>
 */
function ams_studio_estimator_disciplines() {
	return array(
		'estrategia' => array(
			'label' => __( 'Estrategia', 'ams-studio' ),
			'icon'  => 'fa-chart-line',
			'min'   => 800,
			'max'   => 1500,
			'weeks' => 3,
		),
		'branding'   => array(
			'label' => __( 'Branding', 'ams-studio' ),
			'icon'  => 'fa-wand-magic-sparkles',
			'min'   => 1200,
			'max'   => 2500,
			'weeks' => 4,
		),
		'web'        => array(
			'label' => __( 'Desarrollo Web', 'ams-studio' ),
			'icon'  => 'fa-code',
			'min'   => 1500,
			'max'   => 4000,
			'weeks' => 6,
		),
		'growth'     => array(
			'label' => __( 'Growth', 'ams-studio' ),
			'icon'  => 'fa-bullhorn',
			'min'   => 600,
			'max'   => 1500,
			'weeks' => 4,
		),
	);
}

/**
 * Full estimator config with Customizer overrides applied.
 *
 * @return array
 */
function ams_studio_estimator_config() {
	$disciplines = array();
	foreach ( ams_studio_estimator_disciplines() as $key => $d ) {
		$d['min']            = absint( get_theme_mod( "ams_est_{$key}_min", $d['min'] ) );
		$d['max']            = absint( get_theme_mod( "ams_est_{$key}_max", $d['max'] ) );
		$d['weeks']          = absint( get_theme_mod( "ams_est_{$key}_weeks", $d['weeks'] ) );
		$disciplines[ $key ] = $d;
	}

	$config = array(
		'currency'    => get_theme_mod( 'ams_est_currency', 'US$' ),
		'showPrices'  => (bool) get_theme_mod( 'ams_est_show_prices', true ),
		'disciplines' => $disciplines,
		'stages'      => array(
			'idea'      => array(
				'label'      => __( 'Idea por Validar', 'ams-studio' ),
				'value'      => __( 'Tengo una idea por validar', 'ams-studio' ),
				'icon'       => 'fa-lightbulb',
				'multiplier' => 1.0,
				'extraWeeks' => 1,
			),
			'existente' => array(
				'label'      => __( 'Marca Existente', 'ams-studio' ),
				'value'      => __( 'Marca existente en crecimiento', 'ams-studio' ),
				'icon'       => 'fa-arrow-trend-up',
				'multiplier' => 0.9,
				'extraWeeks' => 0,
			),
			'unidad'    => array(
				'label'      => __( 'Nueva Unidad de Negocio', 'ams-studio' ),
				'value'      => __( 'Nueva unidad de negocio', 'ams-studio' ),
				'icon'       => 'fa-rocket',
				'multiplier' => 1.25,
				'extraWeeks' => 2,
			),
		),
		'scopes'      => array(
			'esencial'    => array(
				'label'      => __( 'Esencial', 'ams-studio' ),
				'multiplier' => 1.0,
				'weeksMultiplier' => 1.0,
			),
			'profesional' => array(
				'label'      => __( 'Profesional', 'ams-studio' ),
				'multiplier' => 1.6,
				'weeksMultiplier' => 1.25,
			),
			'premium'     => array(
				'label'      => __( 'Premium', 'ams-studio' ),
				'multiplier' => 2.4,
				'weeksMultiplier' => 1.5,
			),
		),
	);

	return apply_filters( 'ams_studio_estimator_config', $config );
}

/**
 * Computes an estimate. Mirrors computeEstimate() in assets/js/main.js so the
 * figures in the notification email can't be altered from the browser.
 *
 * @param string   $stage       Stage key.
 * @param string[] $disciplines Discipline keys.
 * @param string   $scope       Scope key.
 * @return array{min:int,max:int,weeks:int}|null Null when nothing is selected.
 */
function ams_studio_compute_estimate( $stage, $disciplines, $scope ) {
	$config = ams_studio_estimator_config();
	$picked = array_values( array_intersect_key( $config['disciplines'], array_flip( (array) $disciplines ) ) );
	if ( ! $picked || ! isset( $config['stages'][ $stage ], $config['scopes'][ $scope ] ) ) {
		return null;
	}

	$stage_cfg = $config['stages'][ $stage ];
	$scope_cfg = $config['scopes'][ $scope ];
	$factor    = $stage_cfg['multiplier'] * $scope_cfg['multiplier'];

	$min   = array_sum( wp_list_pluck( $picked, 'min' ) ) * $factor;
	$max   = array_sum( wp_list_pluck( $picked, 'max' ) ) * $factor;
	$weeks = ( max( wp_list_pluck( $picked, 'weeks' ) ) + count( $picked ) - 1 ) * $scope_cfg['weeksMultiplier'] + $stage_cfg['extraWeeks'];

	return array(
		'min'   => (int) ( round( $min / 50 ) * 50 ),
		'max'   => (int) ( round( $max / 50 ) * 50 ),
		'weeks' => (int) ceil( $weeks ),
	);
}
