import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eefbf8',
          500: '#14b8a6',
          600: '#0f766e',
          700: '#115e59',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
