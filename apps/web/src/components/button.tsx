import type { ButtonHTMLAttributes } from 'react';

/*
 * Focus is handled globally (`:focus-visible` in globals.css) so every control
 * in the product gets the same 2px --seal ring at 2px offset, including the
 * ones that are not this component.
 */
const BASE =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded px-4 py-2 text-meta font-medium transition-colors disabled:cursor-not-allowed';

const VARIANTS = {
  primary:
    'bg-seal text-surface hover:bg-seal-deep disabled:bg-rule disabled:text-ink-faint',
  quiet:
    'border border-rule bg-surface text-ink hover:bg-paper disabled:text-ink-faint disabled:hover:bg-surface',
} as const;

export type ButtonVariant = keyof typeof VARIANTS;

export function Button({
  variant = 'primary',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return <button className={`${BASE} ${VARIANTS[variant]} ${className ?? ''}`} {...props} />;
}
