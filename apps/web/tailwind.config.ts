import type { Config } from 'tailwindcss';

/*
 * Tokens live in globals.css as custom properties; this file only teaches
 * Tailwind their names. Utilities therefore read as design vocabulary
 * (`text-ink`, `border-rule`, `bg-seal`) and no component ever holds a hex.
 */
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: 'var(--ink)',
        'ink-soft': 'var(--ink-soft)',
        'ink-faint': 'var(--ink-faint)',
        paper: 'var(--paper)',
        surface: 'var(--surface)',
        rule: 'var(--rule)',
        seal: 'var(--seal)',
        'seal-deep': 'var(--seal-deep)',
        stamp: 'var(--stamp)',
        amber: 'var(--amber)',
        slate: 'var(--slate)',
        void: 'var(--void)',
      },
      fontFamily: {
        display: ['var(--font-bodoni-moda)', 'Didot', 'Georgia', 'serif'],
        sans: ['var(--font-public-sans)', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['var(--font-ibm-plex-mono)', 'ui-monospace', 'SF Mono', 'monospace'],
      },
      // The whole scale, named. Nothing sits between 1.125 and 1.5: the jump is
      // what keeps hierarchy from going mushy, so there is no token for it.
      fontSize: {
        display: ['3rem', { lineHeight: '1.05' }],
        title: ['2rem', { lineHeight: '1.15' }],
        heading: ['1.5rem', { lineHeight: '1.25' }],
        lead: ['1.125rem', { lineHeight: '1.45' }],
        body: ['1rem', { lineHeight: '1.55' }],
        meta: ['0.875rem', { lineHeight: '1.5' }],
        label: ['0.75rem', { lineHeight: '1.2', letterSpacing: '0.08em' }],
      },
      borderRadius: {
        DEFAULT: '4px',
        sm: '2px',
      },
      boxShadow: {
        // The deepest shadow the design allows. There is no second step.
        press: '0 1px 2px rgb(20 27 46 / 0.06)',
        none: 'none',
      },
      spacing: {
        // One indent level in the entity hierarchy.
        indent: '24px',
      },
    },
  },
  plugins: [],
} satisfies Config;
