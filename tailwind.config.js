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
        'bg-dark': '#0a192f',
        'text-light': '#ffffff',
        'text-bright': '#e6f1ff',
        'text-medium': '#ccd6f6',
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
