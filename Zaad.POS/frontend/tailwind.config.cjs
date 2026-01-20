/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Zaad Bakery – Theme 01 (Bakery Modern)
        // Backgrounds / surfaces
        base: '#F7F7F5',
        card: '#FFFFFF',
        elev: '#FFFFFF',

        // Typography
        ink: '#0F172A',
        mute: '#64748B',

        // Borders
        line: '#E2E8F0',

        // Brand
        gold: '#C57A2A',     // Primary
        cocoa: '#7A4B23',    // Deep warm brown (supporting)
        secondary: '#1F9D8A',

        // Status
        success: '#16A34A',
        danger: '#DC2626',
        warning: '#F59E0B',
      },
      boxShadow: {
        soft: '0 8px 24px rgba(17,17,17,0.06)',
        // keep legacy name in case something still references it
        neon: '0 8px 24px rgba(15,23,42,0.08)',
      },
      borderRadius: { xl2: '1rem' },
      fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui'] },
    },
  },
  plugins: [],
}
