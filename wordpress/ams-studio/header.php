<?php
/**
 * Site header: ambient background + floating glass navbar.
 *
 * @package AMS_Studio
 */

?><!DOCTYPE html>
<html <?php language_attributes(); ?> class="scroll-smooth">
<head>
	<meta charset="<?php bloginfo( 'charset' ); ?>">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<meta name="theme-color" content="#0B0F19">
	<?php wp_head(); ?>
</head>
<body <?php body_class( 'bg-brand-charcoal text-slate-200 font-sans antialiased overflow-x-hidden selection:bg-brand-blue selection:text-white' ); ?>>
<?php wp_body_open(); ?>

	<!-- Background Ambient Glow Canvas & Blobs -->
	<div class="fixed inset-0 overflow-hidden pointer-events-none z-0" aria-hidden="true">
		<div class="ambient-blob w-[500px] h-[500px] bg-brand-blue top-[-100px] left-[-100px]"></div>
		<div class="ambient-blob w-[600px] h-[600px] bg-indigo-900 bottom-[-200px] right-[-100px]"></div>
		<div class="ambient-blob w-[400px] h-[400px] bg-brand-periwinkle top-[40%] left-[50%] -translate-x-1/2 -translate-y-1/2 opacity-20"></div>
		<canvas id="ambientCanvas" class="absolute inset-0 w-full h-full opacity-30"></canvas>
	</div>

	<a class="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[60] focus:px-4 focus:py-2 focus:rounded-xl focus:bg-brand-blue focus:text-white" href="#main"><?php esc_html_e( 'Saltar al contenido', 'ams-studio' ); ?></a>

	<?php if ( ! function_exists( 'elementor_theme_do_location' ) || ! elementor_theme_do_location( 'header' ) ) : ?>
	<!-- Navigation Bar -->
	<header id="navbar" class="fixed top-0 left-0 right-0 z-50 transition-all duration-300 py-4 px-4 sm:px-8">
		<div class="max-w-7xl mx-auto glass-panel rounded-2xl px-6 py-3 flex items-center justify-between shadow-crystal border border-white/10">
			<a href="<?php echo esc_url( ams_studio_anchor( 'inicio' ) ); ?>" class="flex items-center gap-3 group" aria-label="<?php echo esc_attr( get_bloginfo( 'name' ) ); ?>">
				<div class="relative w-10 h-10 flex items-center justify-center">
					<?php
					if ( has_custom_logo() ) {
						$logo_id = get_theme_mod( 'custom_logo' );
						echo wp_get_attachment_image( $logo_id, 'thumbnail', false, array( 'class' => 'w-10 h-10 object-contain transition-transform duration-300 group-hover:scale-105', 'alt' => '' ) );
					} else {
						ams_studio_logo_svg( 'w-10 h-10 transition-transform duration-300 group-hover:scale-105' );
					}
					?>
				</div>
				<div class="flex flex-col">
					<span class="text-xl font-extrabold tracking-tight text-white flex items-center gap-1 whitespace-nowrap">
						Ams <span class="font-normal text-brand-periwinkle">Studio</span>
					</span>
					<span class="hidden min-[360px]:block whitespace-nowrap text-[9px] uppercase tracking-widest text-slate-400 font-semibold -mt-1">Action • Mindset • Strategy</span>
				</div>
			</a>

			<nav class="hidden xl:flex items-center gap-8 text-sm font-medium text-slate-300" aria-label="<?php esc_attr_e( 'Principal', 'ams-studio' ); ?>">
				<?php ams_studio_nav_links( 'hover:text-brand-periwinkle transition-colors' ); ?>
			</nav>

			<div class="flex items-center gap-2 sm:gap-4">
				<div class="hidden sm:flex items-center">
					<a href="<?php echo esc_url( ams_studio_anchor( 'estimador' ) ); ?>" class="px-5 py-2.5 rounded-xl glass-button-primary text-white text-xs font-bold uppercase tracking-wider flex items-center gap-2">
						<i class="fa-solid fa-bolt text-brand-periwinkle" aria-hidden="true"></i>
						<span><?php esc_html_e( 'Iniciar Proyecto', 'ams-studio' ); ?></span>
					</a>
				</div>

				<button id="mobileMenuBtn" type="button" aria-label="<?php esc_attr_e( 'Abrir menú de navegación', 'ams-studio' ); ?>" aria-expanded="false" aria-controls="mobileMenu" class="xl:hidden text-slate-300 hover:text-white text-2xl p-2 focus:outline-none">
					<i class="fa-solid fa-bars" aria-hidden="true"></i>
				</button>
			</div>
		</div>

		<div id="mobileMenu" class="hidden xl:hidden max-w-7xl mx-auto mt-3 glass-panel bg-brand-charcoal/90 rounded-2xl p-6 border border-white/10 flex-col gap-4 text-center">
			<?php ams_studio_nav_links( 'mobile-link text-slate-200 hover:text-brand-blue py-2' ); ?>
			<a href="<?php echo esc_url( ams_studio_anchor( 'estimador' ) ); ?>" class="mobile-link mt-2 w-full py-3 rounded-xl glass-button-primary text-white text-xs font-bold uppercase"><?php esc_html_e( 'Iniciar Proyecto', 'ams-studio' ); ?></a>
		</div>
	</header>
	<?php endif; ?>

	<main id="main">
