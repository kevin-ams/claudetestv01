/* AMS Studio scroll animations (GSAP 3 + ScrollTrigger + SplitText), front page only.
 * If GSAP fails to load, this file does nothing and the CSS reveal in main.js stays in charge. */
(function () {
	'use strict';

	var gsap = window.gsap;
	if (!gsap || !window.ScrollTrigger) return;

	var ScrollTrigger = window.ScrollTrigger;
	var SplitText = window.SplitText;
	gsap.registerPlugin(ScrollTrigger);
	if (SplitText) gsap.registerPlugin(SplitText);

	var $ = function (sel, root) { return (root || document).querySelector(sel); };
	var $$ = function (sel, root) { return gsap.utils.toArray(sel, root); };

	/* ---------------------------------------------------------------
	 * Always on (not motion-heavy): scroll progress bar + header that
	 * hides while scrolling down and comes back on the way up.
	 * ------------------------------------------------------------- */
	var bar = $('.ams-progress');
	if (bar) {
		gsap.to(bar, { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.3 } });
	}

	var nav = document.getElementById('navbar');
	var menu = document.getElementById('mobileMenu');
	if (nav) {
		ScrollTrigger.create({
			start: 0,
			end: 'max',
			onUpdate: function (self) {
				var menuOpen = menu && !menu.classList.contains('hidden');
				var hide = self.direction === 1 && self.scroll() > 160 && !menuOpen && !nav.contains(document.activeElement);
				nav.classList.toggle('is-hidden', hide);
			}
		});
	}

	/* ---------------------------------------------------------------
	 * Motion: only when the visitor hasn't asked to reduce it.
	 * ------------------------------------------------------------- */
	var mm = gsap.matchMedia();

	mm.add({
		motion: '(prefers-reduced-motion: no-preference)',
		mobile: '(max-width: 767px)'
	}, function (ctx) {
		if (!ctx.conditions.motion) return;
		var mobile = ctx.conditions.mobile;

		// GSAP takes over from the CSS fade-in sections.
		document.documentElement.classList.remove('ams-reveal');
		$$('.reveal-on-scroll').forEach(function (s) { s.classList.add('is-visible'); });

		var ease = 'power3.out';
		// The glass cards and buttons have CSS 'transition: all', which would lag behind every
		// GSAP frame; switch it off while they animate and hand control back afterwards.
		var CLEAR = 'transform,transition';

		// Rises a group of elements in a gentle cascade when they enter the screen. Also on the
		// way back up, so cards skipped by a menu jump still appear.
		var cascade = function (targets, opts) {
			targets = $$(targets);
			if (!targets.length) return;
			gsap.set(targets, { autoAlpha: 0, y: (opts && opts.y) || 48, transition: 'none' });
			var show = function (batch) {
				gsap.to(batch, { autoAlpha: 1, y: 0, duration: 0.9, ease: ease, stagger: 0.1, overwrite: true, clearProps: CLEAR });
			};
			ScrollTrigger.batch(targets, { start: 'top 88%', onEnter: show, onEnterBack: show });
		};

		// Splits a heading into words, each behind its own mask so it can rise into view.
		var splitWords = function (el) {
			if (!el || !SplitText) return null;
			return SplitText.create(el, { type: 'words', mask: 'words', wordsClass: 'ams-word' }).words;
		};

		// Word-by-word rise for a section heading, the first time it reaches the screen.
		var riseOnScroll = function (el) {
			var words = splitWords(el);
			if (!words) return;
			var tween = gsap.from(words, { yPercent: 110, duration: 0.9, ease: ease, stagger: 0.06, paused: true });
			ScrollTrigger.create({ trigger: el, start: 'top 88%', once: true, onEnter: function () { tween.play(); } });
		};

		/* 1. Hero: badge, headline word by word, text and buttons in sequence. */
		var hero = $('#inicio');
		if (hero) {
			var heroBadge = $('.inline-flex', hero);
			var heroButtons = hero.querySelectorAll('h1 ~ div a');
			gsap.set([heroBadge, heroButtons], { transition: 'none' });
			var tl = gsap.timeline({ defaults: { ease: ease }, delay: 0.15 });
			tl.from(heroBadge, { autoAlpha: 0, y: 20, duration: 0.7, clearProps: CLEAR });
			var heroWords = splitWords($('h1', hero));
			if (heroWords) tl.from(heroWords, { yPercent: 110, duration: 0.9, stagger: 0.06 }, '-=0.35');
			tl.from($('p', hero), { autoAlpha: 0, y: 24, duration: 0.8 }, '-=0.5')
				.from(heroButtons, { autoAlpha: 0, y: 20, duration: 0.7, stagger: 0.1, clearProps: CLEAR }, '-=0.5');
		}

		/* 2. Ambient light blobs drift slightly slower/faster than the page (parallax). */
		$$('[data-parallax]').forEach(function (blob) {
			gsap.to(blob, {
				yPercent: parseFloat(blob.getAttribute('data-parallax')),
				ease: 'none',
				scrollTrigger: { start: 0, end: 'max', scrub: 1 }
			});
		});

		/* 3. Purpose & vision cards. */
		cascade('#proposito .glass-card');

		/* 4. "Action. Mindset. Strategy." letters ride in on a wave as you scroll (the
		 *    reference site's signature effect, used once so it stays special). */
		var pillarsTitle = $('#pilares h2');
		if (pillarsTitle && SplitText) {
			var chars = SplitText.create(pillarsTitle, { type: 'words, chars', charsClass: 'ams-char' }).chars;
			gsap.from(chars, {
				y: function (i) { return 30 + Math.sin(i * 0.55) * 20; },
				rotate: function (i) { return Math.sin(i * 0.8) * 10; },
				autoAlpha: 0,
				ease: 'none',
				stagger: 0.04,
				scrollTrigger: { trigger: pillarsTitle, start: 'top 92%', end: mobile ? 'top 55%' : 'top 50%', scrub: 0.8 }
			});
		}
		cascade('#pilares .space-y-6 > .glass-card', { y: 60 });

		/* 5. Services: heading words, then the bento cards. Filtering re-plays a short cascade. */
		riseOnScroll($('#servicios h3'));
		cascade('#servicios .svc-card');
		$$('[data-svc-filter]').forEach(function (btn) {
			btn.addEventListener('click', function () {
				var shown = $$('#servicios .svc-card').filter(function (c) { return !c.classList.contains('hidden'); });
				gsap.fromTo(shown, { autoAlpha: 0, y: 24, transition: 'none' }, { autoAlpha: 1, y: 0, duration: 0.5, ease: ease, stagger: 0.06, overwrite: true, clearProps: CLEAR });
				ScrollTrigger.refresh();
			});
		});

		/* 6. Ecosystem: heading words, then the four vertical cards. */
		riseOnScroll($('#ecosistema h3'));
		cascade('#ecosistema .ams-tab');

		/* 7. Diagnosis panel opens out from the centre as it scrolls in. */
		var panel = $('#estimador .glass-panel');
		if (panel) {
			var inset = mobile ? 6 : 16;
			gsap.fromTo(panel,
				{ clipPath: 'inset(4% ' + inset + '% 4% ' + inset + '% round 24px)' },
				{ clipPath: 'inset(0% 0% 0% 0% round 24px)', ease: 'none', scrollTrigger: { trigger: panel, start: 'top 95%', end: 'top 45%', scrub: 0.6 } }
			);
		}

		/* 8. Contact: heading words, then the cards and the form. */
		riseOnScroll($('#contacto h3'));
		cascade('#contacto .space-y-6 > .glass-card, #contacto .lg\\:grid-cols-2 > .glass-panel');

		// Fonts can change heading heights after load; recompute trigger positions once they're in.
		if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
	});
})();
