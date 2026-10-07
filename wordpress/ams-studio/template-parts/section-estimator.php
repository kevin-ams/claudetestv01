<?php
/**
 * Interactive estimator & roadmap wizard.
 *
 * @package AMS_Studio
 */

$ams_cfg      = ams_studio_estimator_config();
$ams_selected = array( 'branding', 'web' );
?>
<section id="estimador" class="py-24 relative z-10 px-4 sm:px-6 lg:px-8">
	<div class="max-w-5xl mx-auto">

		<div class="glass-panel p-8 sm:p-12 rounded-3xl border border-brand-blue/30 relative overflow-hidden shadow-glow-blue">
			<div class="text-center max-w-2xl mx-auto mb-10">
				<span class="text-xs uppercase font-extrabold tracking-widest text-brand-periwinkle">Cotizador Interactivo</span>
				<h3 class="text-3xl font-extrabold text-white mt-2">¿Cuál es la etapa de tu proyecto?</h3>
				<p class="text-xs sm:text-sm text-slate-300 mt-2">Selecciona tus requerimientos y recibe una propuesta de aceleración inicial.</p>
			</div>

			<form id="wizardForm" class="ams-form space-y-8" data-form-type="wizard" novalidate>

				<!-- Step 1: Stage -->
				<fieldset>
					<legend class="block text-xs uppercase font-bold text-slate-400 mb-3">1. Etapa actual:</legend>
					<div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
						<?php
						$ams_first = true;
						foreach ( $ams_cfg['stages'] as $ams_key => $ams_stage ) :
							?>
							<label class="ams-option glass-card p-4 rounded-xl cursor-pointer flex items-center gap-3 border-white/10 hover:border-brand-blue">
								<input type="radio" name="etapa" value="<?php echo esc_attr( $ams_key ); ?>" class="ams-radio"<?php checked( $ams_first ); ?>>
								<span class="text-xs font-semibold text-white"><?php echo esc_html( $ams_stage['label'] ); ?></span>
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
					<div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
						<?php foreach ( $ams_cfg['disciplines'] as $ams_key => $ams_d ) : ?>
							<label class="ams-option glass-card p-3 rounded-xl cursor-pointer flex items-center gap-2 border-white/10 text-xs text-slate-200">
								<input type="checkbox" name="servicio[]" value="<?php echo esc_attr( $ams_key ); ?>" class="ams-check"<?php checked( in_array( $ams_key, $ams_selected, true ) ); ?>>
								<span><?php echo esc_html( $ams_d['label'] ); ?></span>
							</label>
						<?php endforeach; ?>
					</div>
				</fieldset>

				<!-- Step 3: Scope -->
				<fieldset>
					<legend class="block text-xs uppercase font-bold text-slate-400 mb-3">3. Alcance deseado:</legend>
					<div class="ams-segmented relative grid grid-cols-3 gap-1 p-1 rounded-xl bg-black/30 border border-white/10">
						<span class="ams-segmented-thumb" aria-hidden="true"></span>
						<?php
						$ams_first = true;
						foreach ( $ams_cfg['scopes'] as $ams_key => $ams_scope ) :
							?>
							<label class="relative z-10 cursor-pointer text-center">
								<input type="radio" name="alcance" value="<?php echo esc_attr( $ams_key ); ?>" class="sr-only peer"<?php checked( $ams_first ); ?>>
								<span class="block py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider text-slate-400 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-brand-periwinkle transition-colors"><?php echo esc_html( $ams_scope['label'] ); ?></span>
							</label>
							<?php
							$ams_first = false;
						endforeach;
						?>
					</div>
				</fieldset>

				<!-- Live estimate -->
				<div class="ams-estimate glass-card rounded-2xl p-6 border border-brand-blue/30 relative overflow-hidden" aria-live="polite">
					<div class="ams-estimate-shine" aria-hidden="true"></div>
					<div class="relative grid sm:grid-cols-3 gap-6 items-center">
						<div class="sm:col-span-2" data-estimate-prices>
							<div class="text-[10px] uppercase tracking-widest font-bold text-brand-periwinkle mb-1">Inversión estimada</div>
							<div class="text-3xl sm:text-4xl font-extrabold text-gradient tracking-tight" data-estimate-range>—</div>
						</div>
						<div class="sm:text-right">
							<div class="text-[10px] uppercase tracking-widest font-bold text-brand-periwinkle mb-1">Tiempo estimado</div>
							<div class="text-2xl font-extrabold text-white" data-estimate-weeks>—</div>
						</div>
					</div>
					<div class="relative mt-4 h-1.5 rounded-full bg-white/10 overflow-hidden">
						<div class="ams-estimate-bar h-full rounded-full" data-estimate-bar></div>
					</div>
					<p class="relative mt-3 text-[11px] text-slate-400" data-estimate-note>Estimado referencial. La propuesta final se define en la sesión de diagnóstico.</p>
				</div>

				<!-- Step 4: Fast Contact Details -->
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

				<button type="submit" class="w-full py-4 rounded-xl glass-button-primary text-white font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2">
					<i class="fa-solid fa-paper-plane" aria-hidden="true"></i>
					<span>Solicitar Diagnóstico Estratégico</span>
				</button>

			</form>
		</div>

	</div>
</section>
