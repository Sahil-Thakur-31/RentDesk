/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef6ff',
          100: '#d9e9ff',
          200: '#b9d6ff',
          300: '#8fbaff',
          400: '#5f96ff',
          500: '#3f74ff',
          600: '#2c57e6',
          700: '#2342b8',
          800: '#1f3a96',
          900: '#1b327a'
        }
      }
    }
  },
  plugins: []
};
