interface StatCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  loading?: boolean;
}

export function StatCard({ title, value, subtitle, loading }: StatCardProps) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="mt-1 text-3xl font-bold">{loading ? '--' : value}</p>
      <p className="text-xs text-muted-foreground">{subtitle}</p>
    </div>
  );
}
