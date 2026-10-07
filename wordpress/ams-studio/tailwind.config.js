/** Same theme tokens as the original Tailwind CDN config. */
module.exports = {
	content: ['./*.php', './template-parts/**/*.php', './inc/**/*.php', './assets/js/**/*.js'],
	safelist: ['hidden', 'flex', 'opacity-0', 'pointer-events-none', 'scale-95', 'scale-100', 'py-2', 'py-4'],
	theme: {
		extend: {
			colors: {
				brand: {
					blue: '#2563FF',       /* Royal Blue */
					lavender: '#F4F6FF',   /* Pale Lavender */
					periwinkle: '#8DA5FF', /* Soft Periwinkle */
					charcoal: '#0B0F19',   /* Deep Charcoal Dark BG */
					cardDark: '#121827',
					borderGlass: 'rgba(255, 255, 255, 0.12)',
				},
			},
			fontFamily: {
				sans: ['Plus Jakarta Sans', 'sans-serif'],
			},
			boxShadow: {
				crystal: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
				'glow-blue': '0 0 35px -5px rgba(37, 99, 255, 0.4)',
				'glow-soft': '0 0 50px -10px rgba(141, 165, 255, 0.25)',
			},
			animation: {
				float: 'float 6s ease-in-out infinite',
				'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
				shimmer: 'shimmer 2.5s infinite',
			},
			keyframes: {
				float: {
					'0%, 100%': { transform: 'translateY(0px)' },
					'50%': { transform: 'translateY(-12px)' },
				},
				shimmer: {
					'100%': { transform: 'translateX(100%)' },
				},
			},
		},
	},
	plugins: [],
};
