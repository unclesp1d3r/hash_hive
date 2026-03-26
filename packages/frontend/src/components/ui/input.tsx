import type { InputHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

const BASE =
  'w-full rounded border border-surface-0 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary/40 disabled:opacity-50';

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, ...props }: InputProps) {
  return <input className={cn(BASE, className)} {...props} />;
}
