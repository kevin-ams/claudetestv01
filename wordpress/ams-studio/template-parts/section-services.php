<?php
/**
 * Services & expertise bento grid with category filters.
 *
 * @package AMS_Studio
 */
?>
<!-- SERVICES & EXPERTISE SECTION -->
<section id="servicios" class="py-24 relative z-10 px-4 sm:px-6 lg:px-8 reveal-on-scroll">
	<div class="max-w-7xl mx-auto">

		<!-- Header Section with Dynamic Filter Tabs -->
		<div class="flex flex-col lg:flex-row lg:items-end justify-between mb-12 gap-6">
			<div>
				<div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-blue/15 border border-brand-blue/30 text-brand-periwinkle text-xs font-bold uppercase tracking-widest mb-3">
					<i class="fa-solid fa-cubes text-brand-blue" aria-hidden="true"></i>
					<span>En Qué Somos Expertos</span>
				</div>
				<h3 class="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">Capacidades Integrales</h3>
			</div>

			<!-- Category Filter Buttons -->
			<div role="group" aria-label="Filtrar capacidades" class="flex flex-wrap gap-2 p-1.5 rounded-2xl glass-panel border border-white/10 text-xs font-semibold">
				<button type="button" data-svc-filter="all" aria-pressed="true" class="svc-filter-btn active px-4 py-2 rounded-xl text-white bg-brand-blue transition-all">
					Todas
				</button>
				<button type="button" data-svc-filter="estrategia" aria-pressed="false" class="svc-filter-btn px-4 py-2 rounded-xl text-slate-300 hover:text-white transition-all">
					Estrategia & Marca
				</button>
				<button type="button" data-svc-filter="tech" aria-pressed="false" class="svc-filter-btn px-4 py-2 rounded-xl text-slate-300 hover:text-white transition-all">
					Tecnología & Web
				</button>
				<button type="button" data-svc-filter="growth" aria-pressed="false" class="svc-filter-btn px-4 py-2 rounded-xl text-slate-300 hover:text-white transition-all">
					Growth & Contenido
				</button>
			</div>
		</div>

		<!-- Bento Box Grid Structure -->
		<div class="grid grid-cols-1 md:grid-cols-12 gap-6">

			<!-- Bento Item 1: Business Strategy (Spotlight Large Card - 8 Cols) -->
			<div class="svc-card estrategia md:col-span-12 lg:col-span-8 glass-card p-8 rounded-3xl border border-white/10 relative overflow-hidden group hover:border-brand-blue/60 transition-all flex flex-col justify-between">
				<div class="absolute -right-10 -top-10 w-64 h-64 bg-brand-blue/15 rounded-full blur-3xl group-hover:bg-brand-blue/30 transition-all pointer-events-none"></div>

				<div>
					<div class="flex items-center justify-between mb-6">
						<!-- Unboxed Tech Floating Vector with Glow Halo -->
						<div class="relative flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
							<div class="absolute w-12 h-12 bg-brand-blue/35 rounded-full blur-lg pointer-events-none"></div>
							<svg aria-hidden="true" focusable="false" class="w-10 h-10 text-brand-blue relative z-10" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" d="M12 21a9 9 0 100-18 9 9 0 000 18z" />
								<path stroke-linecap="round" stroke-linejoin="round" d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
								<path stroke-linecap="round" stroke-linejoin="round" d="M12 3v3m0 12v3m9-9h-3M6 12H3" />
							</svg>
						</div>
						<span class="text-[10px] uppercase font-bold text-brand-blue tracking-widest px-3 py-1 rounded-full bg-brand-blue/10 border border-brand-blue/20">
							Flagship Strategic Core
						</span>
					</div>

					<h4 class="text-2xl sm:text-3xl font-extrabold text-white mb-3">
						Estrategia de Negocio & Consultoría
					</h4>
					<p class="text-slate-300 text-sm leading-relaxed max-w-2xl mb-6">
						Diseñamos la arquitectura estratégica de tu proyecto. Evaluamos modelos de negocio, viabilidad financiera, diferenciación en el mercado y planes tácticos de escalamiento comercial sin margen a la especulación.
					</p>
				</div>

				<!-- Deliverable Scope Pills -->
				<div class="pt-6 border-t border-white/10 flex flex-wrap gap-2">
					<span class="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-medium text-slate-300">
						<i class="fa-solid fa-check text-brand-blue mr-1.5" aria-hidden="true"></i>Modelos de Negocio
					</span>
					<span class="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-medium text-slate-300">
						<i class="fa-solid fa-check text-brand-blue mr-1.5" aria-hidden="true"></i>Planes de Viabilidad
					</span>
					<span class="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-medium text-slate-300">
						<i class="fa-solid fa-check text-brand-blue mr-1.5" aria-hidden="true"></i>Go-To-Market Strategy
					</span>
					<span class="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-medium text-slate-300">
						<i class="fa-solid fa-check text-brand-blue mr-1.5" aria-hidden="true"></i>Roadmap Ejecutivo
					</span>
				</div>
			</div>

			<!-- Bento Item 2: Branding & Identity (4 Cols) -->
			<div class="svc-card estrategia md:col-span-6 lg:col-span-4 glass-card p-8 rounded-3xl border border-white/10 relative overflow-hidden group hover:border-brand-periwinkle/60 transition-all flex flex-col justify-between">
				<div>
					<div class="flex items-center justify-between mb-6">
						<!-- Unboxed Tech Wireframe Geometry SVG -->
						<div class="relative flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
							<div class="absolute w-10 h-10 bg-brand-periwinkle/30 rounded-full blur-md pointer-events-none"></div>
							<svg aria-hidden="true" focusable="false" class="w-9 h-9 text-brand-periwinkle relative z-10" fill="none" stroke="currentColor" stroke-width="1.7" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
							</svg>
						</div>
						<span class="text-[10px] uppercase font-bold text-brand-blue tracking-widest px-2.5 py-0.5 rounded-full bg-brand-blue/10 border border-brand-blue/20">
							Identity
						</span>
					</div>

					<h4 class="text-xl font-bold text-white mb-2">Branding & Identidad de Marca</h4>
					<p class="text-slate-300 text-xs leading-relaxed mb-6">
						Creación y rediseño de sistemas visuales memorables, narrativa de marca, universos tipográficos y guías de estilo para posicionar con distinción.
					</p>
				</div>

				<div class="pt-4 border-t border-white/10 flex flex-wrap gap-2">
					<span class="px-2.5 py-1 rounded-lg bg-white/5 text-[11px] font-medium text-slate-300">Sistemas Visuales</span>
					<span class="px-2.5 py-1 rounded-lg bg-white/5 text-[11px] font-medium text-slate-300">Brand Books</span>
				</div>
			</div>

			<!-- Bento Item 3: Tech & Web (4 Cols) -->
			<div class="svc-card tech md:col-span-6 lg:col-span-4 glass-card p-8 rounded-3xl border border-white/10 relative overflow-hidden group hover:border-brand-blue/60 transition-all flex flex-col justify-between">
				<div>
					<div class="flex items-center justify-between mb-6">
						<!-- Unboxed Tech Terminal Vector SVG -->
						<div class="relative flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
							<div class="absolute w-10 h-10 bg-brand-blue/35 rounded-full blur-md pointer-events-none"></div>
							<svg aria-hidden="true" focusable="false" class="w-9 h-9 text-brand-blue relative z-10" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
							</svg>
						</div>
						<span class="text-[10px] uppercase font-bold text-brand-periwinkle tracking-widest px-2.5 py-0.5 rounded-full bg-brand-blue/10 border border-brand-blue/20">
							Engineering
						</span>
					</div>

					<h4 class="text-xl font-bold text-white mb-2">Desarrollo Web & Tech</h4>
					<p class="text-slate-300 text-xs leading-relaxed mb-6">
						Plataformas digitales de alto rendimiento, sitios web modernos responsive, e-commerce avanzado y arquitecturas con experiencia de usuario impecable.
					</p>
				</div>

				<div class="pt-4 border-t border-white/10 flex flex-wrap gap-2">
					<span class="px-2.5 py-1 rounded-lg bg-white/5 text-[11px] font-medium text-slate-300">Websites Modernos</span>
					<span class="px-2.5 py-1 rounded-lg bg-white/5 text-[11px] font-medium text-slate-300">UI/UX High-End</span>
				</div>
			</div>

			<!-- Bento Item 4: Growth & Marketing (4 Cols) -->
			<div class="svc-card growth md:col-span-6 lg:col-span-4 glass-card p-8 rounded-3xl border border-white/10 relative overflow-hidden group hover:border-brand-periwinkle/60 transition-all flex flex-col justify-between">
				<div>
					<div class="flex items-center justify-between mb-6">
						<!-- Unboxed Tech Telemetry Pulse SVG -->
						<div class="relative flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
							<div class="absolute w-10 h-10 bg-brand-periwinkle/30 rounded-full blur-md pointer-events-none"></div>
							<svg aria-hidden="true" focusable="false" class="w-9 h-9 text-brand-periwinkle relative z-10" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 005.814-5.519l2.74-1.22m0 0l-5.94-2.281m5.94 2.28l-2.28 5.941" />
							</svg>
						</div>
						<span class="text-[10px] uppercase font-bold text-brand-periwinkle tracking-widest px-2.5 py-0.5 rounded-full bg-brand-blue/10 border border-brand-blue/20">
							Acquisition
						</span>
					</div>

					<h4 class="text-xl font-bold text-white mb-2">Marketing Digital & Growth</h4>
					<p class="text-slate-300 text-xs leading-relaxed mb-6">
						Estrategias performance orientadas a la captación de clientes, optimización de embudos de conversión y campañas de pauta digital medibles.
					</p>
				</div>

				<div class="pt-4 border-t border-white/10 flex flex-wrap gap-2">
					<span class="px-2.5 py-1 rounded-lg bg-white/5 text-[11px] font-medium text-slate-300">Performance Ads</span>
					<span class="px-2.5 py-1 rounded-lg bg-white/5 text-[11px] font-medium text-slate-300">Funnels de Venta</span>
				</div>
			</div>

			<!-- Bento Item 5: Audiovisual & Content (4 Cols) -->
			<div class="svc-card growth md:col-span-6 lg:col-span-4 glass-card p-8 rounded-3xl border border-white/10 relative overflow-hidden group hover:border-brand-blue/60 transition-all flex flex-col justify-between">
				<div>
					<div class="flex items-center justify-between mb-6">
						<!-- Unboxed Tech Optic Lens SVG -->
						<div class="relative flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
							<div class="absolute w-10 h-10 bg-brand-blue/35 rounded-full blur-md pointer-events-none"></div>
							<svg aria-hidden="true" focusable="false" class="w-9 h-9 text-brand-blue relative z-10" fill="none" stroke="currentColor" stroke-width="1.7" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
								<path stroke-linecap="round" stroke-linejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
							</svg>
						</div>
						<span class="text-[10px] uppercase font-bold text-brand-periwinkle tracking-widest px-2.5 py-0.5 rounded-full bg-brand-blue/10 border border-brand-blue/20">
							Media
						</span>
					</div>

					<h4 class="text-xl font-bold text-white mb-2">Producción Audiovisual</h4>
					<p class="text-slate-300 text-xs leading-relaxed mb-6">
						Fotografía comercial y corporativa, producción audiovisual con acabado cinematográfico y desarrollo de activos multimediales de alto valor.
					</p>
				</div>

				<div class="pt-4 border-t border-white/10 flex flex-wrap gap-2">
					<span class="px-2.5 py-1 rounded-lg bg-white/5 text-[11px] font-medium text-slate-300">Fotografía 4K</span>
					<span class="px-2.5 py-1 rounded-lg bg-white/5 text-[11px] font-medium text-slate-300">Video Promocional</span>
				</div>
			</div>

			<!-- Bento Item 6: Venture Development & Launch (Full Row Spotlight - 12 Cols) -->
			<div class="svc-card estrategia md:col-span-12 glass-card p-8 rounded-3xl border border-white/10 relative overflow-hidden group hover:border-brand-blue/60 transition-all">
				<div class="flex flex-col md:flex-row md:items-center justify-between gap-6">
					<div class="flex items-start gap-5">
						<!-- Unboxed Tech Venture Propulsion SVG -->
						<div class="relative flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shrink-0 mt-1">
							<div class="absolute w-12 h-12 bg-brand-blue/40 rounded-full blur-lg pointer-events-none"></div>
							<svg aria-hidden="true" focusable="false" class="w-10 h-10 text-brand-blue relative z-10" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.58-5.84a14.927 14.927 0 015.84 2.58" />
							</svg>
						</div>
						<div>
							<div class="flex items-center gap-3 mb-1">
								<h4 class="text-2xl font-bold text-white">Lanzamiento & Desarrollo de Nuevos Negocios</h4>
								<span class="hidden sm:inline-block text-[10px] font-bold text-brand-periwinkle bg-brand-blue/10 border border-brand-blue/20 px-2.5 py-0.5 rounded-full uppercase tracking-wider">Ventures</span>
							</div>
							<p class="text-slate-300 text-xs sm:text-sm leading-relaxed max-w-3xl">
								Acompañamos a empresarios y creativos desde la concepción de la idea hasta la operación en el mercado real, estructurando la unidad de negocio con bases sólidas y sostenibles.
							</p>
						</div>
					</div>
					<a href="<?php echo esc_url( ams_studio_anchor( 'estimador' ) ); ?>" class="shrink-0 px-6 py-3 rounded-xl glass-button-primary text-white text-xs font-bold uppercase tracking-wider flex items-center gap-2 self-start md:self-center">
						<span>Estructurar Proyecto</span>
						<i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
					</a>
				</div>
			</div>

		</div>

	</div>
</section>
