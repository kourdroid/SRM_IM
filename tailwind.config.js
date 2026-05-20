/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include the paths to all of your component files.
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#DAF22C', // Electric Lime
          dark: '#111827',    // Control Dark — matches all COLORS constants
          background: '#FAFAFA', // Off-White
          secondary: '#FAFAFA', // keeping for compatibility
        },
        surface: {
          DEFAULT: '#ffffff',
          secondary: '#FAFAFA',
        },
      },
      fontFamily: {
        sans: ['Inter_400Regular', 'System'],
        bold: ['Inter_700Bold', 'System-Bold'],
        medium: ['Inter_500Medium', 'System-Medium'],
      },
    },
  },
  plugins: [],
};
