/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    // screens を extend ではなく theme 直下で上書きし、
    // landscape をスマホ横向き（幅 767px 以下）のみに限定する
    screens: {
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
      // スマホ横向きのみ（PC 幅では適用しない）
      landscape: { raw: '(orientation: landscape) and (max-width: 767px)' },
    },
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
