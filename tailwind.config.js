/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'yt-white': 'hsl(0, 0%, 100%)',
        'yt-black': '#0f0f0f',
        'yt-light-black': '#272727',
        'yt-light': '#f2f2f2',
        'yt-gray': '#3f3f3f',
        'yt-dark-gray': '#272727',
        'yt-light-gray': '#aaa',
        'yt-red': 'hsl(0, 100%, 50%)',
        'yt-blue': '#3ea6ff',
        'yt-spec-10': 'rgba(255, 255, 255, 0.1)',
        'yt-spec-20': 'rgba(255, 255, 255, 0.2)',
        'yt-spec-light-10': 'rgba(0, 0, 0, 0.05)',
        'yt-spec-light-20': 'rgba(0, 0, 0, 0.1)',
      },
      fontFamily: {
        sans: ['Roboto', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
