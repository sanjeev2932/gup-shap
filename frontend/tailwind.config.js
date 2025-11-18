/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./public/index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#0ea5a4",
          neon: "#00eaff",
          purple: "#8b5cf6",
          accent: "#ff6b6b"
        },
      },
      boxShadow: {
        neon: '0 6px 24px rgba(139,92,246,0.12), 0 2px 6px rgba(0,234,255,0.05)'
      }
    },
  },
  plugins: [],
}
