/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#030303",
        foreground: "#ffffff",
        primary: {
          DEFAULT: "#6366f1", // indigo-500
          foreground: "#ffffff",
        },
        secondary: {
          DEFAULT: "#f43f5e", // rose-500
          foreground: "#ffffff",
        },
      },
    },
  },
  plugins: [],
}
