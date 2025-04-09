/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{html,js,ts,jsx,tsx}"],
  theme: {
    extend: {
      lineHeight: {
        // Adjust default line heights
        normal: "1.8", // Default is typically 1.5
        relaxed: "1.9", // Default is typically 1.625
        loose: "2.0", // Default is typically 2
      },
      colors: {
        primary: {
          DEFAULT: "#6a5acd", // Keep as an accent
          500: "#6a5acd", // Main purple for small highlights
          600: "#5a49b4",
        },
        background: {
          DEFAULT: "#ffffff", // White background for a clean look
          dark: "#f8f9fc", // Slightly off-white for contrast
        },
        foreground: "#1a1a1a", // Dark blackish-gray for text
        muted: {
          DEFAULT: "#6c6f7f", // Medium-dark gray for secondary text
          foreground: "#4b4e5a",
        },
        border: "#e0e0e0", // Light gray borders for a modern feel
        input: "#f2f2f2", // Soft gray input background
        destructive: {
          DEFAULT: "#e63946", // Red for destructive actions
        },
        success: {
          DEFAULT: "#2a9d8f", // Teal-green success
        },
        warning: {
          DEFAULT: "#f4a261", // Warm orange warning
        },
      },
    },
  },
  plugins: [],
};