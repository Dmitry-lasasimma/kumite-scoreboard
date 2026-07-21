/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}', './public/**/*.html'],
  theme: {
    extend: {
      colors: {
        'kumite-blue': {
          50: '#e8f0fe',
          100: '#c5d9fc',
          200: '#9ebffa',
          300: '#74a4f7',
          400: '#528ff5',
          500: '#2563eb',
          600: '#1d4ed8',
          700: '#1e3a8a',
          800: '#172e6e',
          900: '#0f1f4d',
        },
        'kumite-red': {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#dc2626',
          600: '#b91c1c',
          700: '#991b1b',
          800: '#7f1d1d',
          900: '#5c1414',
        },
      },
      fontFamily: {
        'score': ['Oswald', 'Impact', 'Arial Black', 'sans-serif'],
        'display': ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-score': 'pulse-score 0.5s ease-in-out',
        'flash': 'flash 0.3s ease-in-out',
        'slide-in': 'slide-in 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        'slide-in': {
          '0%': { opacity: '0', transform: 'translateX(1.5rem)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'pulse-score': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.15)' },
        },
        'flash': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
      },
    },
  },
  plugins: [],
};
