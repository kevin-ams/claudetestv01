<?php
/**
 * One-page home.
 *
 * @package AMS_Studio
 */

get_header();

foreach ( array( 'hero', 'purpose', 'pillars', 'services', 'ecosystem', 'estimator', 'contact' ) as $ams_section ) {
	get_template_part( 'template-parts/section', $ams_section );
}

get_footer();
