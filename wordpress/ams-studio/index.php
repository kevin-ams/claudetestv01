<?php
/**
 * Fallback template for posts, pages and archives, styled to match the home.
 *
 * @package AMS_Studio
 */

get_header();
?>
<section class="relative z-10 pt-36 pb-24 px-4 sm:px-6 lg:px-8">
	<div class="max-w-3xl mx-auto space-y-8">
		<?php if ( have_posts() ) : ?>
			<?php
			while ( have_posts() ) :
				the_post();
				?>
				<article id="post-<?php the_ID(); ?>" <?php post_class( 'glass-panel p-8 sm:p-10 rounded-3xl' ); ?>>
					<?php if ( is_singular() ) : ?>
						<h1 class="text-3xl sm:text-5xl font-extrabold text-white tracking-tight mb-6"><?php the_title(); ?></h1>
						<div class="ams-prose"><?php the_content(); ?></div>
					<?php else : ?>
						<h2 class="text-2xl font-bold text-white mb-3"><a class="hover:text-brand-periwinkle transition-colors" href="<?php the_permalink(); ?>"><?php the_title(); ?></a></h2>
						<div class="ams-prose text-sm"><?php the_excerpt(); ?></div>
					<?php endif; ?>
				</article>
			<?php endwhile; ?>
			<div class="text-sm text-brand-periwinkle"><?php the_posts_pagination(); ?></div>
		<?php else : ?>
			<div class="glass-panel p-10 rounded-3xl text-center">
				<h1 class="text-3xl font-extrabold text-white mb-4"><?php esc_html_e( 'No encontramos lo que buscas', 'ams-studio' ); ?></h1>
				<a href="<?php echo esc_url( home_url( '/' ) ); ?>" class="inline-flex px-6 py-3 rounded-xl glass-button-primary text-white text-xs font-bold uppercase tracking-wider"><?php esc_html_e( 'Volver al inicio', 'ams-studio' ); ?></a>
			</div>
		<?php endif; ?>
	</div>
</section>
<?php
get_footer();
