<?php
/**
 * Contact section. Phone and emails come from Apariencia → Personalizar → AMS Studio: Contacto.
 *
 * @package AMS_Studio
 */

$ams_phone  = ams_studio_mod( 'ams_phone' );
$ams_emails = array(
	array( ams_studio_mod( 'ams_email_sales' ), 'text-brand-blue', 'text-white' ),
	array( ams_studio_mod( 'ams_email_info' ), 'text-brand-periwinkle', 'text-slate-300' ),
	array( ams_studio_mod( 'ams_email_support' ), 'text-slate-400', 'text-slate-300' ),
);
$ams_wpforms = ams_studio_wpforms( 'ams_wpforms_contact' );
?>
<section id="contacto" class="py-24 relative z-10 px-4 sm:px-6 lg:px-8 bg-black/40 border-t border-white/10">
	<div class="max-w-7xl mx-auto">

		<div class="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-start">

			<!-- Left Column: Info & Contact Cards -->
			<div class="space-y-6">
				<div>
					<span class="text-xs font-bold text-brand-blue uppercase tracking-widest">Contacto Directo</span>
					<h3 class="text-3xl sm:text-5xl font-extrabold text-white tracking-tight mt-2">Hablemos de tu próximo paso.</h3>
					<p class="text-slate-400 mt-4 text-sm leading-relaxed">
						Ponte en contacto con nuestro equipo estratégico. Estamos listos para escuchar tu visión y llevar tu proyecto al siguiente nivel.
					</p>
				</div>

				<?php if ( $ams_phone ) : ?>
					<div class="glass-card p-6 rounded-2xl border-white/10">
						<a href="tel:<?php echo esc_attr( preg_replace( '/[^0-9+]/', '', $ams_phone ) ); ?>" class="flex items-center gap-4 hover:opacity-90 transition-opacity">
							<div class="w-12 h-12 rounded-xl bg-brand-blue/20 text-brand-periwinkle flex items-center justify-center text-xl shrink-0">
								<i class="fa-solid fa-phone" aria-hidden="true"></i>
							</div>
							<div>
								<div class="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Teléfono de Contacto Principal</div>
								<div class="text-lg font-bold text-white mt-0.5"><?php echo esc_html( $ams_phone ); ?></div>
							</div>
						</a>
					</div>
				<?php endif; ?>

				<div class="glass-card p-6 rounded-2xl border-white/10 space-y-3">
					<div class="text-xs font-bold text-slate-400 uppercase tracking-wider">Correos Electrónicos Oficiales:</div>
					<div class="flex flex-col gap-2 text-xs">
						<?php
						foreach ( $ams_emails as $ams_email ) :
							if ( ! $ams_email[0] ) {
								continue;
							}
							?>
							<a href="mailto:<?php echo esc_attr( antispambot( $ams_email[0] ) ); ?>" class="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-brand-blue/20 text-slate-200 border border-white/10 flex items-center gap-3 transition-colors break-all">
								<i class="fa-regular fa-envelope <?php echo esc_attr( $ams_email[1] ); ?> text-sm shrink-0" aria-hidden="true"></i>
								<span class="font-medium <?php echo esc_attr( $ams_email[2] ); ?>"><?php echo esc_html( antispambot( $ams_email[0] ) ); ?></span>
							</a>
						<?php endforeach; ?>
					</div>
				</div>

			</div>

			<!-- Right Column: Glass Contact Form -->
			<div class="glass-panel p-6 sm:p-8 rounded-3xl border border-white/15 relative">
				<h4 class="text-2xl font-bold text-white mb-6">Envíanos un mensaje</h4>

				<?php if ( $ams_wpforms ) : ?>
					<?php echo $ams_wpforms; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- WPForms output. ?>
				<?php else : ?>
					<form id="contactForm" class="ams-form space-y-4" data-form-type="contact" novalidate>
						<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
							<div>
								<label for="cNombre" class="block text-xs font-semibold text-slate-300 mb-1">Nombre *</label>
								<input type="text" id="cNombre" name="nombre" required autocomplete="given-name" placeholder="Nombre" class="w-full glass-input px-4 py-3 rounded-xl text-sm">
							</div>
							<div>
								<label for="cApellido" class="block text-xs font-semibold text-slate-300 mb-1">Apellido *</label>
								<input type="text" id="cApellido" name="apellido" required autocomplete="family-name" placeholder="Apellido" class="w-full glass-input px-4 py-3 rounded-xl text-sm">
							</div>
						</div>

						<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
							<div>
								<label for="cTelefono" class="block text-xs font-semibold text-slate-300 mb-1">Número Telefónico *</label>
								<input type="tel" id="cTelefono" name="telefono" required autocomplete="tel" placeholder="+502 0000-0000" class="w-full glass-input px-4 py-3 rounded-xl text-sm">
							</div>
							<div>
								<label for="cEmail" class="block text-xs font-semibold text-slate-300 mb-1">Email *</label>
								<input type="email" id="cEmail" name="email" required autocomplete="email" placeholder="tu@empresa.com" class="w-full glass-input px-4 py-3 rounded-xl text-sm">
							</div>
						</div>

						<div>
							<label for="cMensaje" class="block text-xs font-semibold text-slate-300 mb-1">Mensaje *</label>
							<textarea id="cMensaje" name="mensaje" rows="4" required placeholder="Cuéntanos brevemente sobre tu proyecto o idea..." class="w-full glass-input px-4 py-3 rounded-xl text-sm resize-none"></textarea>
						</div>

						<div class="ams-hp" aria-hidden="true">
							<label>Website <input type="text" name="website" tabindex="-1" autocomplete="off"></label>
						</div>

						<p class="ams-form-error hidden text-xs text-red-300" role="alert"></p>

						<button type="submit" class="w-full py-4 rounded-xl glass-button-primary text-white font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2">
							<span>Enviar Mensaje</span>
							<i class="fa-solid fa-paper-plane" aria-hidden="true"></i>
						</button>
					</form>
				<?php endif; ?>
			</div>

		</div>

	</div>
</section>
