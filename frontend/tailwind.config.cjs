/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        gold: '#D4AF37',
        cocoa: '#5A4632',
        ink: '#111111',
        base: '#FAFAFA',
        card: '#FFFFFF',
        line: '#EAE7E1',
        mute: '#6B7280',
        neon: {
          bg: '#0B0F14',
          card: 'rgba(18,22,28,0.8)',
          border: 'rgba(255,255,255,0.06)',
          gold: '#F2C041',
          violet: '#a855f7',
          cyan: '#22d3ee',
          orange: '#f97316',
        },
      },
      boxShadow: {
        soft: '0 8px 24px rgba(17,17,17,0.06)',
        neon: '0 0 24px rgba(249,115,22,0.25), inset 0 0 1px rgba(255,255,255,0.35)',
      },
      borderRadius: { xl2: '1rem' },
      fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui'] },
    },
  },
  plugins: [],
}
