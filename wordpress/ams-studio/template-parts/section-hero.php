<?php
/**
 * Hero section.
 *
 * @package AMS_Studio
 */
?>
<section id="inicio" class="relative min-h-screen pt-36 pb-20 flex items-center justify-center px-4 sm:px-6 lg:px-8 z-10">
	<div class="max-w-5xl mx-auto text-center space-y-8">

		<!-- Strategic Tagline Badge -->
		<div class="inline-flex items-center gap-3 px-4 py-2 rounded-full glass-card border border-brand-blue/30 text-xs sm:text-sm font-semibold tracking-wide text-brand-periwinkle shadow-glow-soft">
			<span class="w-2.5 h-2.5 rounded-full bg-brand-blue animate-pulse"></span>
			<span>WE EXIST TO MAKE IDEAS WORK</span>
			<span class="hidden sm:inline text-slate-500">|</span>
			<span class="hidden sm:inline text-slate-300">Estrategia + Creatividad + Ejecución</span>
		</div>

		<!-- Main Heading -->
		<h1 class="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.1] text-white">
			Convertimos <span class="text-gradient">ideas con propósito</span> en realidades de alto impacto.
		</h1>

		<!-- Subtitle -->
		<p class="max-w-3xl mx-auto text-lg sm:text-xl text-slate-300 font-normal leading-relaxed">
			AMS Studio no es solo una agencia de publicidad ni un estudio tradicional. Somos el socio estratégico que crea, opera e impulsa marcas capaces de redefinir mercados y generar resultados tangibles.
		</p>

		<!-- Hero Action Buttons -->
		<div class="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
			<a href="<?php echo esc_url( ams_studio_anchor( 'estimador' ) ); ?>" class="w-full sm:w-auto px-8 py-4 rounded-2xl glass-button-primary text-white font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-3 group">
				<span>Diseñar mi Estrategia</span>
				<i class="fa-solid fa-arrow-right transition-transform group-hover:translate-x-1" aria-hidden="true"></i>
			</a>
			<a href="<?php echo esc_url( ams_studio_anchor( 'ecosistema' ) ); ?>" class="w-full sm:w-auto px-8 py-4 rounded-2xl glass-card text-slate-200 font-semibold text-sm hover:text-white flex items-center justify-center gap-2">
				<i class="fa-solid fa-network-wired text-brand-periwinkle" aria-hidden="true"></i>
				<span>Ver Ecosistema de Marcas</span>
			</a>
		</div>

		<!-- Glass Key Metric Counters Bar -->
		<div class="pt-12 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 max-w-4xl mx-auto text-left">
			<div class="glass-card p-4 sm:p-5 rounded-2xl border-white/10 min-w-0">
				<div class="text-lg min-[360px]:text-xl min-[400px]:text-2xl sm:text-3xl font-extrabold text-white text-gradient">100%</div>
				<div class="text-xs font-medium text-slate-400 mt-1 uppercase tracking-wider">Orientación a Resultados</div>
			</div>
			<div class="glass-card p-4 sm:p-5 rounded-2xl border-white/10 min-w-0">
				<div class="text-lg min-[360px]:text-xl min-[400px]:text-2xl sm:text-3xl font-extrabold text-white text-gradient">12+</div>
				<div class="text-xs font-medium text-slate-400 mt-1 uppercase tracking-wider">Áreas de Especialidad</div>
			</div>
			<div class="glass-card p-4 sm:p-5 rounded-2xl border-white/10 min-w-0">
				<div class="text-lg min-[360px]:text-xl min-[400px]:text-2xl sm:text-3xl font-extrabold text-white text-gradient">4+</div>
				<div class="text-xs font-medium text-slate-400 mt-1 uppercase tracking-wider">Verticales Propias</div>
			</div>
			<div class="glass-card p-4 sm:p-5 rounded-2xl border-white/10 min-w-0">
				<div class="text-lg min-[360px]:text-xl min-[400px]:text-2xl sm:text-3xl font-extrabold text-white text-gradient">Guatemala</div>
				<div class="text-xs font-medium text-slate-400 mt-1 uppercase tracking-wider">Proyección Global</div>
			</div>
		</div>

	</div>
</section>
