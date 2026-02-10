import { useUiStore } from '../stores/ui';

export function DashboardPage() {
  const { selectedProjectId } = useUiStore();

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Dashboard</h2>
      {selectedProjectId ? (
        <p className="text-muted-foreground">Viewing project {selectedProjectId}</p>
      ) : (
        <p className="text-muted-foreground">Select a project to view its dashboard.</p>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <DashboardCard title="Agents" value="--" subtitle="Online" />
        <DashboardCard title="Campaigns" value="--" subtitle="Active" />
        <DashboardCard title="Tasks" value="--" subtitle="Running" />
        <DashboardCard title="Cracked" value="--" subtitle="Total hashes" />
      </div>
    </div>
  );
}

function DashboardCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string;
  subtitle: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="mt-1 text-3xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{subtitle}</p>
    </div>
  );
}
