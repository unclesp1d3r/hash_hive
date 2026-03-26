import { cn } from '../../lib/utils';

interface EmptyStateProps {
  readonly message: string;
  readonly className?: string;
}

export function EmptyState({ message, className }: EmptyStateProps) {
  return <p className={cn('text-sm text-muted-foreground', className)}>{message}</p>;
}
