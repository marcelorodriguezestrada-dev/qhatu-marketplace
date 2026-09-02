import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        bg: '#F1ECE0',
        panel: '#FFFFFF',
        panelalt: '#FBF8F1',
        ink: '#1E2233',
        inksoft: '#5B5F73',
        line: '#DEDACB',
        maroon: '#A23B2E',
        maroonsoft: '#F2DFD9',
        ochre: '#C98A2B',
        ochresoft: '#F6E8CD',
        teal: '#2F6E5C',
        tealsoft: '#DCEBE5',
      },
      fontFamily: {
        display: ['var(--font-space-grotesk)', 'sans-serif'],
        body: ['var(--font-inter)', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
export default config
