import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { cn } from '../../lib/utils';

interface BackLinkProps {
  readonly to: string;
  readonly children: ReactNode;
  readonly className?: string;
}

export function BackLink({ to, children, className }: BackLinkProps) {
  return (
    <Link
      to={to}
      className={cn('text-xs font-medium text-primary hover:text-primary/80', className)}
    >
      {children}
    </Link>
  );
}
