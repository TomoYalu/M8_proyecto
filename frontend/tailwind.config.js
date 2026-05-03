/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        bloomberg: {
          bg: '#0b0f19',
          panel: '#141b2d',
          accent: '#3b82f6',
          text: '#e2e8f0',
          'text-muted': '#94a3b8',
          green: '#22c55e',
          red: '#ef4444',
          yellow: '#eab308',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'ui-monospace', 'monospace'],
      },
      keyframes: {
        'value-flash': {
          '0%': { backgroundColor: 'var(--flash-color, rgba(59,130,246,0.18))' },
          '100%': { backgroundColor: 'transparent' },
        },
      },
      animation: {
        'value-flash': 'value-flash 0.8s ease-out',
      },
    },
  },
  plugins: [],
};
