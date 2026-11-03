/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        canvas: {
          DEFAULT: '#F8F9F6',
          muted: '#F0F2ED',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          border: '#E5E8E2',
          subtle: '#EEF0EA',
        },
        ink: {
          primary: '#151C17',
          secondary: '#4A564D',
          muted: '#7A877E',
        },
        // Quiropraxia & Kinesiología (Azul Petróleo Clásico)
        petrol: {
          900: '#0B2B33',
          800: '#103E4A',
          DEFAULT: '#134E5E', // Primary
          accent: '#236B80',
          hover: '#1B5B6D',
          light: '#EBF4F6',
          border: '#C9DFE6',
        },
        // Acupuntura & Medicina Tradicional China (Verde Salvia Botánico)
        sage: {
          900: '#15281D',
          800: '#213C2B',
          DEFAULT: '#2E4D38', // Primary
          accent: '#497356',
          hover: '#3A5E45',
          light: '#EFF5F0',
          border: '#D3E3D6',
        },
      },
      fontFamily: {
        serif: ['Playfair Display', 'Georgia', 'serif'],
        sans: ['DM Sans', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      boxShadow: {
        'soft-sm': '0 2px 8px rgba(21, 28, 23, 0.04)',
        'soft': '0 4px 20px rgba(21, 28, 23, 0.05), 0 1px 3px rgba(21, 28, 23, 0.03)',
        'soft-lg': '0 12px 36px rgba(21, 28, 23, 0.08), 0 2px 6px rgba(21, 28, 23, 0.04)',
        'petrol-glow': '0 8px 24px rgba(19, 78, 94, 0.18)',
        'sage-glow': '0 8px 24px rgba(46, 77, 56, 0.18)',
      },
    },
  },
  plugins: [],
};
