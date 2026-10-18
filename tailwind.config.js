/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Consolas', 'monospace'],
      },
      colors: {
        terminal: {
          bg: '#05070b',
          panel: 'rgba(12, 16, 23, 0.74)',
          line: 'rgba(255, 255, 255, 0.10)',
          ink: '#f0efec',
          sub: '#c3c2b7',
          muted: '#898781',
          accent: '#f5a623',
          up: '#3987e5',
          down: '#e66767',
          neutral: '#383835',
        },
      },
      boxShadow: {
        glass: '0 10px 40px -10px rgba(0, 0, 0, 0.75), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
      },
      keyframes: {
        'slide-in': { from: { transform: 'translateX(24px)', opacity: '0' }, to: { transform: 'none', opacity: '1' } },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
      },
      animation: {
        'slide-in': 'slide-in 280ms cubic-bezier(.2,.8,.2,1)',
        'fade-in': 'fade-in 200ms ease-out',
      },
    },
  },
  plugins: [],
};
