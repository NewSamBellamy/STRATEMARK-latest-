/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Light, minimalist palette (ref: Pixel Rise). Warm off-white canvas,
        // white panels, near-black ink, vivid orange accent.
        bg: '#EDECE8',
        surface: '#FFFFFF',
        'surface-2': '#F5F4F1',
        border: '#E5E3DD',
        content: '#18181B',
        // Darkened so body/muted text clears WCAG AA (4.5:1) on the warm canvas.
        muted: '#57575E',
        faint: '#6E6E76',
        // Orange accent used for highlights, active states, the logo, card
        // accents. Buttons use `ink` (black) with white text for AA contrast.
        primary: { DEFAULT: '#F15A24', fg: '#FFFFFF', ink: '#B7441A' },
        ink: '#18181B',
        positive: '#16A34A',
        neutral: '#CA8A04',
        negative: '#DC2626',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', 'Inter', 'ui-sans-serif', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(17,17,26,0.04), 0 12px 28px -16px rgba(17,17,26,0.18)',
        'card-hover': '0 2px 6px rgba(17,17,26,0.06), 0 26px 50px -20px rgba(17,17,26,0.28)',
        soft: '0 1px 2px rgba(17,17,26,0.05), 0 6px 16px -10px rgba(17,17,26,0.14)',
      },
      borderRadius: { xl2: '1.25rem' },
    },
  },
  plugins: [],
};
