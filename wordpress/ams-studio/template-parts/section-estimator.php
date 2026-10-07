<?php
/**
 * Diagnosis request form ("¿Cuál es la etapa de tu proyecto?").
 *
 * @package AMS_Studio
 */

$ams_options  = ams_studio_wizard_options();
$ams_selected = array( 'branding', 'web' );
$ams_wpforms  = ams_studio_wpforms( 'ams_wpforms_wizard' );
?>
<section id="estimador" class="py-24 relative z-10 px-4 sm:px-6 lg:px-8">
	<div class="max-w-5xl mx-auto">

		<div class="glass-panel p-6 sm:p-12 rounded-3xl border border-brand-blue/30 relative overflow-hidden shadow-glow-blue">
			<div class="text-center max-w-2xl mx-auto mb-10">
				<span class="text-xs uppercase font-extrabold tracking-widest text-brand-periwinkle">Cotizador Interactivo</span>
				<h3 class="text-2xl sm:text-3xl font-extrabold text-white mt-2">¿Cuál es la etapa de tu proyecto?</h3>
				<p class="text-xs sm:text-sm text-slate-300 mt-2">Selecciona tus requerimientos y recibe una propuesta de aceleración inicial.</p>
			</div>

			<?php if ( $ams_wpforms ) : ?>
				<?php echo $ams_wpforms; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- WPForms output. ?>
			<?php else : ?>
				<form id="wizardForm" class="ams-form space-y-8" data-form-type="wizard" novalidate>

					<!-- Step 1: Stage -->
					<fieldset>
						<legend class="block text-xs uppercase font-bold text-slate-400 mb-3">1. Etapa actual:</legend>
						<div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
							<?php
							$ams_first = true;
							foreach ( $ams_options['stages'] as $ams_key => $ams_label ) :
								?>
								<label class="ams-option glass-card p-4 rounded-xl cursor-pointer flex items-center gap-3 border-white/10 hover:border-brand-blue">
									<input type="radio" name="etapa" value="<?php echo esc_attr( $ams_key ); ?>"<?php checked( $ams_first ); ?>>
									<span class="text-xs font-semibold text-white"><?php echo esc_html( $ams_label ); ?></span>
								</label>
								<?php
								$ams_first = false;
							endforeach;
							?>
						</div>
					</fieldset>

					<!-- Step 2: Disciplines Required -->
					<fieldset>
						<legend class="block text-xs uppercase font-bold text-slate-400 mb-3">2. Disciplinas requeridas (Selecciona varias):</legend>
						<div class="grid grid-cols-1 min-[400px]:grid-cols-2 sm:grid-cols-4 gap-3">
							<?php foreach ( $ams_options['disciplines'] as $ams_key => $ams_label ) : ?>
								<label class="ams-option glass-card p-3 rounded-xl cursor-pointer flex items-center gap-2 border-white/10 text-xs text-slate-200">
									<input type="checkbox" name="servicio[]" value="<?php echo esc_attr( $ams_key ); ?>"<?php checked( in_array( $ams_key, $ams_selected, true ) ); ?>>
									<span><?php echo esc_html( $ams_label ); ?></span>
								</label>
							<?php endforeach; ?>
						</div>
					</fieldset>

					<!-- Step 3: Fast Contact Details -->
					<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<div>
							<label for="wizNombre" class="block text-xs font-semibold text-slate-300 mb-1">Nombre completo *</label>
							<input type="text" id="wizNombre" name="nombre" required autocomplete="name" placeholder="Tu nombre" class="w-full glass-input px-4 py-3 rounded-xl text-sm">
						</div>
						<div>
							<label for="wizEmail" class="block text-xs font-semibold text-slate-300 mb-1">Correo electrónico *</label>
							<input type="email" id="wizEmail" name="email" required autocomplete="email" placeholder="tu@empresa.com" class="w-full glass-input px-4 py-3 rounded-xl text-sm">
						</div>
					</div>

					<div class="ams-hp" aria-hidden="true">
						<label>Website <input type="text" name="website" tabindex="-1" autocomplete="off"></label>
					</div>

					<p class="ams-form-error hidden text-xs text-red-300" role="alert"></p>

					<button type="submit" class="w-full py-4 px-4 rounded-xl glass-button-primary text-white font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2 text-center">
						<i class="fa-solid fa-paper-plane" aria-hidden="true"></i>
						<span>Solicitar Diagnóstico Estratégico</span>
					</button>

				</form>
			<?php endif; ?>
		</div>

	</div>
</section>
