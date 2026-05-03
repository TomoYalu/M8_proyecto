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
          bg: '#0a0e0c',
          panel: 'rgba(20, 30, 25, 0.4)',
          accent: '#10b981',
          text: '#f8faf9',
          'text-muted': '#94a39b',
          green: '#22c55e',
          red: '#ef4444',
          yellow: '#eab308',
        },
      },
      fontFamily: {
        sans: ['Jost', 'system-ui', '-apple-system', 'sans-serif'],
        serif: ['Cormorant Garamond', 'Georgia', 'serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'ui-monospace', 'monospace'],
      },
      borderColor: {
        DEFAULT: 'rgba(255, 255, 255, 0.08)',
      },
      keyframes: {
        'value-flash': {
          '0%': { backgroundColor: 'rgba(16, 185, 129, 0.18)' },
          '100%': { backgroundColor: 'transparent' },
        },
        'float': {
          '0%': { transform: 'translate(0, 0) scale(1)' },
          '50%': { transform: 'translate(50px, -30px) scale(1.1)' },
          '100%': { transform: 'translate(-20px, 50px) scale(0.9)' },
        },
      },
      animation: {
        'value-flash': 'value-flash 0.8s ease-out',
        'float': 'float 20s ease-in-out infinite alternate',
      },
    },
  },
  plugins: [],
};
