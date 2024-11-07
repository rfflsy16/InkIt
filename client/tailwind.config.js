import tailwindScrollbar from 'tailwind-scrollbar';

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        saltedegg: '#A3C4C9', // Define your salted egg color here
      },
    },
  },
  plugins: [
    require('tailwind-scrollbar'),
  ],
  plugins: [
    tailwindScrollbar({ nocompatible: true }),
  ],
}