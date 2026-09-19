/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        mono: ['"JetBrains Mono"', 'monospace'],
        sans: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        cyber: {
          950: '#06080d',
          900: '#0a0e17',
          850: '#0f1422',
          800: '#141b2d',
          700: '#1d2740',
          600: '#2b395b',
          neonCyan: '#00f0ff',
          neonAmber: '#ffaa00',
          neonEmerald: '#00ffaa',
          neonMagenta: '#ff007f',
          glass: 'rgba(10, 14, 23, 0.75)',
          glassBorder: 'rgba(0, 240, 255, 0.15)',
        },
      },
      boxShadow: {
        'glow-cyan': '0 0 15px rgba(0, 240, 255, 0.25)',
        'glow-cyan-sm': '0 0 8px rgba(0, 240, 255, 0.2)',
        'glow-amber': '0 0 15px rgba(255, 170, 0, 0.25)',
        'glow-emerald': '0 0 15px rgba(0, 255, 170, 0.25)',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
}
