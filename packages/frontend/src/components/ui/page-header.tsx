import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface PageHeaderProps {
  readonly children: ReactNode;
  readonly className?: string;
}

export function PageHeader({ children, className }: PageHeaderProps) {
  return <h2 className={cn('text-xl font-semibold tracking-tight', className)}>{children}</h2>;
}
