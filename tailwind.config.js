/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './_includes/**/*.html',
    './_layouts/**/*.html',
    './*.html',
    './assets/js/**/*.js'
  ],
  theme: {
    extend: {
      colors: {
        'bg-dark': '#171F56',
        'text-light': '#ffffff',
        'text-bright': '#e6f1ff',
        'text-medium': '#ccd6f6',
        'flag': '#f5b85c',
        'accent-primary': '#64ffda',
        'accent-secondary': '#a8ff78',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
