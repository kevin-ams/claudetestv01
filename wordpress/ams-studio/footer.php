<?php
/**
 * Site footer + confirmation modal.
 *
 * @package AMS_Studio
 */

$ams_socials = array(
	'ams_social_linkedin'  => array( 'fa-linkedin', 'LinkedIn' ),
	'ams_social_instagram' => array( 'fa-instagram', 'Instagram' ),
	'ams_social_whatsapp'  => array( 'fa-whatsapp', 'WhatsApp' ),
);
?>
	</main>

	<?php if ( ! function_exists( 'elementor_theme_do_location' ) || ! elementor_theme_do_location( 'footer' ) ) : ?>
	<footer class="py-12 relative z-10 border-t border-white/10 px-4 sm:px-6 lg:px-8 text-xs text-slate-400">
		<div class="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">

			<div class="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
				<?php ams_studio_logo_svg( 'w-7 h-7 shrink-0', false ); ?>
				<span class="text-white font-bold text-sm whitespace-nowrap">AMS Studio</span>
				<span class="text-slate-500">|</span>
				<span class="whitespace-nowrap">Action. Mindset. Strategy.</span>
			</div>

			<div class="flex items-center gap-4 text-base">
				<?php
				foreach ( $ams_socials as $ams_mod => $ams_social ) :
					$ams_url = ams_studio_mod( $ams_mod );
					if ( ! $ams_url ) {
						continue;
					}
					?>
					<a href="<?php echo esc_url( $ams_url ); ?>" target="_blank" rel="noopener" class="hover:text-brand-blue transition-colors" aria-label="<?php echo esc_attr( $ams_social[1] ); ?>"><i class="fa-brands <?php echo esc_attr( $ams_social[0] ); ?>" aria-hidden="true"></i></a>
				<?php endforeach; ?>
			</div>

			<div>
				&copy; <?php echo esc_html( gmdate( 'Y' ) ); ?> AMS Studio. Todos los derechos reservados.
			</div>

		</div>
	</footer>
	<?php endif; ?>

	<!-- Glass Toast / Modal Notification -->
	<div id="toastModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md opacity-0 pointer-events-none transition-opacity duration-300" role="dialog" aria-modal="true" aria-labelledby="toastTitle" aria-hidden="true">
		<div class="glass-panel p-8 rounded-3xl max-w-md w-full border border-brand-blue/40 text-center space-y-4 shadow-glow-blue transform scale-95 transition-transform duration-300" id="toastCard">
			<div class="w-16 h-16 rounded-full bg-brand-blue/20 text-brand-periwinkle flex items-center justify-center text-3xl mx-auto">
				<i class="fa-solid fa-circle-check" aria-hidden="true"></i>
			</div>
			<h4 id="toastTitle" class="text-2xl font-bold text-white">¡Mensaje Recibido!</h4>
			<p id="toastMessage" class="text-xs text-slate-300 leading-relaxed">
				Gracias por ponerte en contacto con AMS Studio. Un estratega del equipo revisará tu información y te responderá a la brevedad.
			</p>
			<button type="button" id="toastClose" class="w-full py-3 rounded-xl glass-button-primary text-white text-xs font-bold uppercase">
				Entendido
			</button>
		</div>
	</div>

<?php wp_footer(); ?>
</body>
</html>
