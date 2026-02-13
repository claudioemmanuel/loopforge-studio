import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      /* ------------------------------------------------------------------ */
      /*  Typography System (Inter-based, GitLab-style)                      */
      /* ------------------------------------------------------------------ */
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'sans-serif',
        ],
        mono: [
          '"JetBrains Mono"',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Consolas',
          '"Liberation Mono"',
          'monospace',
        ],
      },
      fontSize: {
        /* Typographic scale -- optimised for UI-dense dev tools            */
        /* [fontSize, { lineHeight, letterSpacing, fontWeight }]            */
        'display-lg': ['2rem', { lineHeight: '2.5rem', letterSpacing: '-0.025em', fontWeight: '600' }],
        'display':    ['1.5rem', { lineHeight: '2rem', letterSpacing: '-0.02em', fontWeight: '600' }],
        'heading-lg': ['1.25rem', { lineHeight: '1.75rem', letterSpacing: '-0.015em', fontWeight: '600' }],
        'heading':    ['1rem', { lineHeight: '1.5rem', letterSpacing: '-0.011em', fontWeight: '600' }],
        'heading-sm': ['0.875rem', { lineHeight: '1.25rem', letterSpacing: '-0.006em', fontWeight: '600' }],
        'body':       ['0.875rem', { lineHeight: '1.375rem', letterSpacing: '-0.006em' }],
        'body-sm':    ['0.8125rem', { lineHeight: '1.25rem', letterSpacing: '-0.003em' }],
        'caption':    ['0.75rem', { lineHeight: '1rem', letterSpacing: '0em' }],
        'overline':   ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.04em', fontWeight: '500' }],
        'code':       ['0.8125rem', { lineHeight: '1.375rem', letterSpacing: '0em' }],
        'code-sm':    ['0.75rem', { lineHeight: '1.125rem', letterSpacing: '0em' }],
      },
      letterSpacing: {
        tightest: '-0.025em',
        tighter:  '-0.015em',
        tight:    '-0.011em',
        snug:     '-0.006em',
        normal:   '0em',
        wide:     '0.04em',
        wider:    '0.06em',
      },

      /* ------------------------------------------------------------------ */
      /*  Colors                                                             */
      /* ------------------------------------------------------------------ */
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar-bg))',
          foreground: 'hsl(var(--sidebar-fg))',
          accent: 'hsl(var(--sidebar-accent))',
          hover: 'hsl(var(--sidebar-hover))',
          border: 'hsl(var(--sidebar-border))',
        },
        success: 'hsl(var(--success))',
        warning: 'hsl(var(--warning))',
        info: 'hsl(var(--info))',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      width: {
        sidebar: 'var(--sidebar-width)',
        'sidebar-collapsed': 'var(--sidebar-collapsed-width)',
      },
    },
  },
  plugins: [],
}

export default config
