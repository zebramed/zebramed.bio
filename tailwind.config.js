/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './_includes/**/*.html',
    './_layouts/**/*.html',
    './*.html',
    './assets/js/**/*.js'
  ],
  // The scanner turns any matching word into a utility; "ring" appears in figure
  // comments and its utility draws a 3px blue box-shadow. Not used on purpose.
  blocklist: ['ring'],
  theme: {
    extend: {
      colors: {
        'bg-dark': '#171F56',
        'text-light': '#ffffff',
        'text-bright': '#eef2fb',
        'text-medium': '#c4cbe0',
        'flag': '#f5b85c',
        'accent-primary': '#32aafb',
        'accent-secondary': '#80d4ff',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
