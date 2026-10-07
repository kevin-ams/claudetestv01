<?php
/**
 * Ecosystem (umbrella brand) section with animated tabs.
 *
 * @package AMS_Studio
 */

// Class strings are written out in full so Tailwind can find them when compiling.
$ams_verticals = array(
	'artists'   => array(
		'name'     => 'Marketing for Artists',
		'badge'    => 'Vertical Artística',
		'icon'     => 'fa-music',
		'footer'   => 'Desarrollo Artístico',
		'accent'   => '129, 140, 248',
		'icon_cls' => 'bg-indigo-500/20 text-indigo-400',
		'badge_cls' => 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20',
		'text_cls' => 'text-indigo-300',
		'desc'     => 'Estructura enfocada en el desarrollo de marca, estrategia digital, booking y comercialización para artistas y proyectos creativos.',
		'points'   => array( 'Desarrollo de marca artística', 'Estrategia digital y contenido', 'Booking y comercialización' ),
	),
	'financial' => array(
		'name'     => 'AMS Financial',
		'badge'    => 'Finanzas & Contabilidad',
		'icon'     => 'fa-calculator',
		'footer'   => 'Soluciones Financieras',
		'accent'   => '52, 211, 153',
		'icon_cls' => 'bg-emerald-500/20 text-emerald-400',
		'badge_cls' => 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
		'text_cls' => 'text-emerald-300',
		'desc'     => 'Soluciones especializadas para el área de finanzas, consultoría financiera, control presupuestario y gestión contable estratégica.',
		'points'   => array( 'Consultoría financiera', 'Control presupuestario', 'Gestión contable estratégica' ),
	),
	'creative'  => array(
		'name'     => 'AMS Creative',
		'badge'    => 'Diseño & Web',
		'icon'     => 'fa-palette',
		'footer'   => 'Estudio Creativo',
		'accent'   => '192, 132, 252',
		'icon_cls' => 'bg-purple-500/20 text-purple-400',
		'badge_cls' => 'bg-purple-500/10 text-purple-300 border-purple-500/20',
		'text_cls' => 'text-purple-300',
		'desc'     => 'Agencia de diseño visual, branding, diseño de experiencia de usuario y desarrollo de páginas web de alto impacto.',
		'points'   => array( 'Diseño visual y branding', 'Experiencia de usuario (UX)', 'Páginas web de alto impacto' ),
	),
	'tech'      => array(
		'name'     => 'AMS Tech',
		'badge'    => 'Tecnología',
		'icon'     => 'fa-code',
		'footer'   => 'Soluciones de Software',
		'accent'   => '34, 211, 238',
		'icon_cls' => 'bg-cyan-500/20 text-cyan-400',
		'badge_cls' => 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20',
		'text_cls' => 'text-cyan-300',
		'desc'     => 'Desarrollo de soluciones de software a la medida, plataformas digitales, integraciones de sistemas y automatización de procesos.',
		'points'   => array( 'Software a la medida', 'Plataformas e integraciones', 'Automatización de procesos' ),
	),
);
?>
<section id="ecosistema" class="py-24 relative z-10 bg-slate-900/40 border-y border-white/10 px-4 sm:px-6 lg:px-8">
	<div class="max-w-7xl mx-auto">

		<div class="text-center max-w-3xl mx-auto mb-16">
			<div class="inline-block px-3 py-1 rounded-full bg-brand-blue/20 text-brand-periwinkle text-xs font-bold uppercase tracking-widest mb-3">
				Marca Umbrella
			</div>
			<h3 class="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">El Ecosistema AMS</h3>
			<p class="text-slate-300 mt-4 text-base">
				AMS Studio funciona como sombrilla estratégica operando y acelerando verticales especializadas y proyectos asociados.
			</p>
		</div>

		<!-- Ecosystem Vertical Cards (act as tabs) -->
		<div role="tablist" aria-label="Verticales del ecosistema AMS" class="grid md:grid-cols-2 lg:grid-cols-4 gap-6" data-ams-tabs>
			<?php
			$ams_i = 0;
			foreach ( $ams_verticals as $ams_key => $ams_v ) :
				$ams_active = 0 === $ams_i;
				?>
				<button type="button" role="tab" id="tab-<?php echo esc_attr( $ams_key ); ?>" aria-controls="panel-<?php echo esc_attr( $ams_key ); ?>" aria-selected="<?php echo $ams_active ? 'true' : 'false'; ?>" tabindex="<?php echo $ams_active ? '0' : '-1'; ?>" style="--accent: <?php echo esc_attr( $ams_v['accent'] ); ?>" class="ams-tab glass-panel p-8 rounded-3xl border border-white/15 relative overflow-hidden group transition-all flex flex-col justify-between text-left">
					<span class="block">
						<span class="flex items-center justify-between mb-6">
							<span class="w-12 h-12 rounded-2xl <?php echo esc_attr( $ams_v['icon_cls'] ); ?> flex items-center justify-center text-xl">
								<i class="fa-solid <?php echo esc_attr( $ams_v['icon'] ); ?>" aria-hidden="true"></i>
							</span>
							<span class="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md border <?php echo esc_attr( $ams_v['badge_cls'] ); ?>"><?php echo esc_html( $ams_v['badge'] ); ?></span>
						</span>
						<span class="block text-xl font-bold text-white mb-2"><?php echo esc_html( $ams_v['name'] ); ?></span>
						<span class="block text-slate-300 text-xs leading-relaxed mb-6"><?php echo esc_html( $ams_v['desc'] ); ?></span>
					</span>
					<span class="pt-4 border-t border-white/10 flex items-center justify-between text-xs <?php echo esc_attr( $ams_v['text_cls'] ); ?> font-medium">
						<span><?php echo esc_html( $ams_v['footer'] ); ?></span>
						<i class="fa-solid fa-arrow-up-right-from-square ams-tab-arrow" aria-hidden="true"></i>
					</span>
				</button>
				<?php
				++$ams_i;
			endforeach;
			?>
		</div>

		<!-- Detail panels -->
		<div class="ams-tab-stage hidden md:block mt-6">
			<?php
			$ams_i = 0;
			foreach ( $ams_verticals as $ams_key => $ams_v ) :
				?>
				<div role="tabpanel" id="panel-<?php echo esc_attr( $ams_key ); ?>" aria-labelledby="tab-<?php echo esc_attr( $ams_key ); ?>" tabindex="0" style="--accent: <?php echo esc_attr( $ams_v['accent'] ); ?>" class="ams-tab-panel glass-panel p-6 sm:p-8 rounded-3xl border border-white/15 relative overflow-hidden<?php echo 0 === $ams_i ? '' : ' hidden'; ?>">
					<div class="ams-panel-glow" aria-hidden="true"></div>
					<div class="relative flex flex-col lg:flex-row lg:items-center gap-6">
						<div class="flex items-center gap-4 lg:w-64 shrink-0">
							<div class="w-14 h-14 rounded-2xl <?php echo esc_attr( $ams_v['icon_cls'] ); ?> flex items-center justify-center text-2xl shrink-0">
								<i class="fa-solid <?php echo esc_attr( $ams_v['icon'] ); ?>" aria-hidden="true"></i>
							</div>
							<div>
								<div class="text-[10px] uppercase tracking-widest font-bold <?php echo esc_attr( $ams_v['text_cls'] ); ?>"><?php echo esc_html( $ams_v['footer'] ); ?></div>
								<h4 class="text-lg font-bold text-white"><?php echo esc_html( $ams_v['name'] ); ?></h4>
							</div>
						</div>
						<ul class="grid sm:grid-cols-3 gap-3 flex-1">
							<?php foreach ( $ams_v['points'] as $ams_point ) : ?>
								<li class="rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-xs font-semibold text-slate-200 flex items-center gap-2">
									<i class="fa-solid fa-check <?php echo esc_attr( $ams_v['text_cls'] ); ?>" aria-hidden="true"></i>
									<span><?php echo esc_html( $ams_point ); ?></span>
								</li>
							<?php endforeach; ?>
						</ul>
						<a href="<?php echo esc_url( ams_studio_anchor( 'contacto' ) ); ?>" class="shrink-0 px-5 py-3 rounded-xl glass-button-primary text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2">
							<span>Hablemos</span>
							<i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
						</a>
					</div>
				</div>
				<?php
				++$ams_i;
			endforeach;
			?>
		</div>

	</div>
</section>
