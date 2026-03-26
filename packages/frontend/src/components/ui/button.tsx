import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/utils';

const BASE =
  'inline-flex items-center justify-center rounded font-medium transition-colors disabled:opacity-50';

const VARIANTS = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
  secondary:
    'border border-surface-0 text-muted-foreground hover:bg-surface-0/60 hover:text-foreground',
  destructive: 'border border-destructive/30 text-destructive hover:bg-destructive/10',
  ghost: 'text-muted-foreground hover:bg-surface-0/60 hover:text-foreground',
} as const;

const SIZES = {
  sm: 'px-3 py-1.5 text-xs',
  default: 'px-4 py-2 text-xs',
} as const;

type ButtonVariant = keyof typeof VARIANTS;
type ButtonSize = keyof typeof SIZES;

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  readonly children: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'default',
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      className={cn(BASE, VARIANTS[variant], SIZES[size], className)}
      {...props}
    >
      {children}
    </button>
  );
}
