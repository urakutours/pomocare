/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        tiffany: {
          DEFAULT: '#0abab5',
          hover: '#099d99',
        },
      },
    },
  },
  plugins: [],
};
