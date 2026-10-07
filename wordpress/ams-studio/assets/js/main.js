/* AMS Studio theme scripts. Config comes from wp_localize_script as window.AMS_STUDIO. */
(function () {
	'use strict';

	var AMS = window.AMS_STUDIO || {};
	var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	/* ---------------------------------------------------------------
	 * Ambient particle canvas
	 * ------------------------------------------------------------- */
	var canvas = document.getElementById('ambientCanvas');
	if (canvas && canvas.getContext) {
		var ctx = canvas.getContext('2d');
		var resizeCanvas = function () {
			canvas.width = window.innerWidth;
			canvas.height = window.innerHeight;
		};
		window.addEventListener('resize', resizeCanvas);
		resizeCanvas();

		var particles = Array.from({ length: 35 }, function () {
			return {
				x: Math.random() * canvas.width,
				y: Math.random() * canvas.height,
				size: Math.random() * 2 + 1,
				speedX: (Math.random() - 0.5) * 0.4,
				speedY: (Math.random() - 0.5) * 0.4,
				opacity: Math.random() * 0.5 + 0.2
			};
		});

		var draw = function () {
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			particles.forEach(function (p) {
				p.x += p.speedX;
				p.y += p.speedY;
				if (p.x < 0) p.x = canvas.width;
				if (p.x > canvas.width) p.x = 0;
				if (p.y < 0) p.y = canvas.height;
				if (p.y > canvas.height) p.y = 0;
				ctx.fillStyle = 'rgba(141, 165, 255, ' + p.opacity + ')';
				ctx.beginPath();
				ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
				ctx.fill();
			});
			if (!reduceMotion) requestAnimationFrame(draw);
		};
		draw();
	}

	/* ---------------------------------------------------------------
	 * Mobile menu + navbar on scroll
	 * ------------------------------------------------------------- */
	var menuBtn = document.getElementById('mobileMenuBtn');
	var menu = document.getElementById('mobileMenu');
	var setMenu = function (open) {
		menu.classList.toggle('hidden', !open);
		menu.classList.toggle('flex', open);
		menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
	};
	if (menuBtn && menu) {
		menuBtn.addEventListener('click', function () {
			setMenu(menu.classList.contains('hidden'));
		});
		menu.querySelectorAll('.mobile-link').forEach(function (link) {
			link.addEventListener('click', function () { setMenu(false); });
		});
	}

	var nav = document.getElementById('navbar');
	var onScroll = function () {
		if (!nav) return;
		var scrolled = window.scrollY > 50;
		nav.classList.toggle('py-2', scrolled);
		nav.classList.toggle('py-4', !scrolled);
	};
	window.addEventListener('scroll', onScroll, { passive: true });
	onScroll();

	/* ---------------------------------------------------------------
	 * Ecosystem tabs
	 * ------------------------------------------------------------- */
	document.querySelectorAll('[data-ams-tabs]').forEach(function (list) {
		var tabs = Array.prototype.slice.call(list.querySelectorAll('[role="tab"]'));
		var stage = list.parentElement.querySelector('.ams-tab-stage');

		var select = function (tab, focus) {
			if (tab.getAttribute('aria-selected') === 'true') return;
			var from = stage ? stage.offsetHeight : 0;

			tabs.forEach(function (t) {
				var on = t === tab;
				t.setAttribute('aria-selected', on ? 'true' : 'false');
				t.tabIndex = on ? 0 : -1;
				document.getElementById(t.getAttribute('aria-controls')).classList.toggle('hidden', !on);
			});
			if (focus) tab.focus();

			// Animate the stage height between panels of different sizes.
			if (stage && !reduceMotion) {
				var to = stage.offsetHeight;
				stage.style.height = from + 'px';
				stage.style.overflow = 'hidden';
				requestAnimationFrame(function () {
					stage.style.height = to + 'px';
				});
				var done = function () {
					stage.style.height = '';
					stage.style.overflow = '';
					stage.removeEventListener('transitionend', done);
				};
				stage.addEventListener('transitionend', done);
				setTimeout(done, 600);
			}
		};

		tabs.forEach(function (tab, i) {
			tab.addEventListener('click', function () { select(tab, false); });
			tab.addEventListener('keydown', function (e) {
				var next = null;
				if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = tabs[(i + 1) % tabs.length];
				if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = tabs[(i - 1 + tabs.length) % tabs.length];
				if (e.key === 'Home') next = tabs[0];
				if (e.key === 'End') next = tabs[tabs.length - 1];
				if (next) {
					e.preventDefault();
					select(next, true);
				}
			});
		});
	});

	/* ---------------------------------------------------------------
	 * Estimator
	 * ------------------------------------------------------------- */
	var est = AMS.estimator;
	var wizard = document.getElementById('wizardForm');

	// Mirrors ams_studio_compute_estimate() in inc/estimator.php.
	var computeEstimate = function (stageKey, keys, scopeKey) {
		var picked = keys.map(function (k) { return est.disciplines[k]; }).filter(Boolean);
		var stage = est.stages[stageKey];
		var scope = est.scopes[scopeKey];
		if (!picked.length || !stage || !scope) return null;

		var factor = stage.multiplier * scope.multiplier;
		var sum = function (field) { return picked.reduce(function (a, d) { return a + d[field]; }, 0); };
		var maxWeeks = Math.max.apply(null, picked.map(function (d) { return d.weeks; }));
		return {
			min: Math.round(sum('min') * factor / 50) * 50,
			max: Math.round(sum('max') * factor / 50) * 50,
			weeks: Math.ceil((maxWeeks + picked.length - 1) * scope.weeksMultiplier + stage.extraWeeks)
		};
	};

	if (wizard && est) {
		var rangeEl = wizard.querySelector('[data-estimate-range]');
		var weeksEl = wizard.querySelector('[data-estimate-weeks]');
		var barEl = wizard.querySelector('[data-estimate-bar]');
		var pricesEl = wizard.querySelector('[data-estimate-prices]');
		var box = wizard.querySelector('.ams-estimate');
		var segmented = wizard.querySelector('.ams-segmented');
		var fmt = new Intl.NumberFormat('es-GT', { maximumFractionDigits: 0 });
		var shown = { min: 0, max: 0 };
		var ceiling = 0;
		var anim = null;

		// Largest possible estimate, used to scale the progress bar.
		var allKeys = Object.keys(est.disciplines);
		Object.keys(est.stages).forEach(function (s) {
			Object.keys(est.scopes).forEach(function (sc) {
				var r = computeEstimate(s, allKeys, sc);
				if (r && r.max > ceiling) ceiling = r.max;
			});
		});

		if (!est.showPrices && pricesEl) {
			pricesEl.innerHTML = '<div class="text-[10px] uppercase tracking-widest font-bold text-brand-periwinkle mb-1">Propuesta personalizada</div>' +
				'<div class="text-sm text-slate-300">Recibirás una inversión detallada después de tu diagnóstico.</div>';
		}

		var paintRange = function (min, max) {
			if (rangeEl) rangeEl.textContent = est.currency + fmt.format(min) + ' – ' + est.currency + fmt.format(max);
		};

		var animateRange = function (target) {
			if (anim) cancelAnimationFrame(anim);
			if (reduceMotion) {
				shown = target;
				paintRange(target.min, target.max);
				return;
			}
			var start = { min: shown.min, max: shown.max };
			var t0 = performance.now();
			var step = function (now) {
				var t = Math.min(1, (now - t0) / 600);
				var e = 1 - Math.pow(1 - t, 3);
				shown = {
					min: Math.round(start.min + (target.min - start.min) * e),
					max: Math.round(start.max + (target.max - start.max) * e)
				};
				paintRange(shown.min, shown.max);
				if (t < 1) anim = requestAnimationFrame(step);
			};
			anim = requestAnimationFrame(step);
		};

		var readSelection = function () {
			var stage = wizard.querySelector('input[name="etapa"]:checked');
			var scope = wizard.querySelector('input[name="alcance"]:checked');
			var keys = Array.prototype.map.call(wizard.querySelectorAll('input[name="servicio[]"]:checked'), function (i) { return i.value; });
			return { stage: stage && stage.value, scope: scope && scope.value, keys: keys };
		};

		var update = function () {
			var sel = readSelection();

			if (segmented) {
				var scopeInputs = Array.prototype.slice.call(segmented.querySelectorAll('input'));
				segmented.dataset.index = String(Math.max(0, scopeInputs.findIndex(function (i) { return i.checked; })));
			}

			var r = computeEstimate(sel.stage, sel.keys, sel.scope);
			if (!r) {
				if (rangeEl) rangeEl.textContent = 'Selecciona al menos una disciplina';
				shown = { min: 0, max: 0 };
				if (weeksEl) weeksEl.textContent = '—';
				if (barEl) barEl.style.width = '0';
				return;
			}
			if (est.showPrices) animateRange(r);
			if (weeksEl) weeksEl.textContent = '~' + r.weeks + ' semanas';
			if (barEl && ceiling) barEl.style.width = Math.max(8, Math.round(r.max / ceiling * 100)) + '%';
			if (box && !reduceMotion) {
				box.classList.remove('is-updating');
				void box.offsetWidth;
				box.classList.add('is-updating');
			}
		};

		wizard.addEventListener('change', update);
		update();
	}

	/* ---------------------------------------------------------------
	 * Toast modal
	 * ------------------------------------------------------------- */
	var toast = document.getElementById('toastModal');
	var toastCard = document.getElementById('toastCard');
	var toastClose = document.getElementById('toastClose');
	var lastFocus = null;

	var showToast = function (msg) {
		if (!toast) return;
		if (msg) document.getElementById('toastMessage').textContent = msg;
		lastFocus = document.activeElement;
		toast.classList.remove('opacity-0', 'pointer-events-none');
		toast.setAttribute('aria-hidden', 'false');
		toastCard.classList.remove('scale-95');
		toastCard.classList.add('scale-100');
		toastClose.focus();
	};

	var closeToast = function () {
		if (!toast) return;
		toast.classList.add('opacity-0', 'pointer-events-none');
		toast.setAttribute('aria-hidden', 'true');
		toastCard.classList.remove('scale-100');
		toastCard.classList.add('scale-95');
		if (lastFocus) lastFocus.focus();
	};

	if (toastClose) toastClose.addEventListener('click', closeToast);
	if (toast) {
		toast.addEventListener('click', function (e) { if (e.target === toast) closeToast(); });
		document.addEventListener('keydown', function (e) {
			if (e.key === 'Escape' && toast.getAttribute('aria-hidden') === 'false') closeToast();
		});
	}

	/* ---------------------------------------------------------------
	 * Forms (AJAX → admin-ajax.php)
	 * ------------------------------------------------------------- */
	document.querySelectorAll('form.ams-form').forEach(function (form) {
		var errorEl = form.querySelector('.ams-form-error');
		var button = form.querySelector('button[type="submit"]');

		var showError = function (msg) {
			if (!errorEl) return;
			errorEl.textContent = msg;
			errorEl.classList.toggle('hidden', !msg);
		};

		form.addEventListener('submit', function (e) {
			e.preventDefault();
			showError('');
			if (!form.checkValidity()) {
				form.reportValidity();
				return;
			}

			var type = form.dataset.formType;
			var data = new FormData(form);
			data.append('action', 'ams_studio_submit');
			data.append('nonce', AMS.nonce || '');
			data.append('form_type', type);

			var label = button.innerHTML;
			button.disabled = true;
			button.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i><span>' + ((AMS.i18n && AMS.i18n.sending) || 'Enviando…') + '</span>';

			fetch(AMS.ajaxUrl, { method: 'POST', body: data, credentials: 'same-origin' })
				.then(function (res) { return res.json().catch(function () { return { success: false }; }); })
				.then(function (json) {
					if (!json || !json.success) {
						throw new Error((json && json.data && json.data.message) || '');
					}
					var nombre = (data.get('nombre') || '').toString().trim();
					showToast(type === 'wizard'
						? '¡Excelente, ' + nombre + '! Hemos registrado tu requerimiento. Un consultor sénior de AMS Studio analizará la etapa de tu proyecto y agendará una sesión de diagnóstico.'
						: 'Gracias por comunicarte con AMS Studio. Hemos recibido tus datos y nuestro equipo estratégico te contactará pronto.');
					form.reset();
					form.dispatchEvent(new Event('change'));
				})
				.catch(function (err) {
					showError((err && err.message) || (AMS.i18n && AMS.i18n.error) || 'Error');
				})
				.finally(function () {
					button.disabled = false;
					button.innerHTML = label;
				});
		});
	});
})();
