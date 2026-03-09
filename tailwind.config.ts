import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Material Design 3 / Google Workspace / Anthropic 色彩 Token
        primary: {
          DEFAULT: 'var(--color-primary, #0B57D0)',
          container: 'var(--color-primary-container, #D3E3FD)',
          on: 'var(--color-primary-on, #FFFFFF)',
          'on-container': 'var(--color-primary-on-container, #041E49)',
        },
        secondary: {
          DEFAULT: 'var(--color-secondary, #5E5E5E)',
          container: 'var(--color-secondary-container, #E3E3E3)',
          on: 'var(--color-secondary-on, #FFFFFF)',
          'on-container': 'var(--color-secondary-on-container, #1F1F1F)',
        },
        surface: {
          DEFAULT: 'var(--color-surface, #FFFFFF)',
          variant: 'var(--color-surface-variant, #F0F4F9)',
          on: 'var(--color-surface-on, #1F1F1F)',
          'on-variant': 'var(--color-surface-on-variant, #444746)',
        },
        error: {
          DEFAULT: 'var(--color-error, #B3261E)',
          container: 'var(--color-error-container, #F9DEDC)',
          on: 'var(--color-error-on, #FFFFFF)',
          'on-container': 'var(--color-error-on-container, #410E0B)',
        },
        outline: 'var(--color-outline, #DADCE0)',
        background: 'var(--color-background, #F8F9FA)',
        'nav-hover': 'var(--color-nav-hover, #E8ECF0)',
        'card-bg': 'var(--color-card-bg, #FFFFFF)',
        'card-border': 'var(--color-card-border, rgba(0,0,0,0.08))',
        'btn-border': 'var(--color-btn-border, rgba(0,0,0,0.14))',
      },
      borderRadius: {
        'md': '8px',
        'lg': '12px',
        'xl': '16px',
        '2xl': '24px',
        '3xl': '32px',
        'full': '9999px',
      },
      fontFamily: {
        sans: ['"Geist Sans"', 'Inter', 'Roboto', 'system-ui', 'sans-serif'],
        geist: ['"Geist Sans"', 'sans-serif'],
        inter: ['Inter', 'sans-serif'],
      },
      boxShadow: {
        'elevation-1': '0 1px 2px 0 rgba(60,64,67,0.3), 0 1px 3px 1px rgba(60,64,67,0.15)',
        'elevation-2': '0 1px 3px 0 rgba(60,64,67,0.3), 0 4px 8px 3px rgba(60,64,67,0.15)',
      },
    },
  },
  plugins: [],
}

export default config
