import { Link, useParams } from 'react-router';
import { StatusBadge } from '../components/features/status-badge';
import { useAgent, useAgentErrors } from '../hooks/use-dashboard';

export function AgentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const agentId = Number(id);
  const { data: agentData, isLoading } = useAgent(agentId);
  const { data: errorsData } = useAgentErrors(agentId);

  if (isLoading) {
    return <p className="text-muted-foreground">Loading agent...</p>;
  }

  const agent = agentData?.agent;
  if (!agent) {
    return (
      <div className="space-y-4">
        <Link to="/agents" className="text-sm text-primary hover:underline">
          Back to agents
        </Link>
        <p className="text-muted-foreground">Agent not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link to="/agents" className="text-sm text-primary hover:underline">
        Back to agents
      </Link>

      <div className="flex items-center gap-3">
        <h2 className="text-2xl font-bold">{agent.name}</h2>
        <StatusBadge status={agent.status} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-lg border bg-card p-4">
          <h3 className="mb-3 font-medium">Details</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">ID</dt>
              <dd>{agent.id}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Last Seen</dt>
              <dd>{agent.lastSeenAt ? new Date(agent.lastSeenAt).toLocaleString() : 'Never'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Created</dt>
              <dd>{new Date(agent.createdAt).toLocaleString()}</dd>
            </div>
          </dl>
        </div>

        {agent.hardwareProfile && (
          <div className="rounded-lg border bg-card p-4">
            <h3 className="mb-3 font-medium">Hardware</h3>
            <pre className="overflow-auto text-xs text-muted-foreground">
              {JSON.stringify(agent.hardwareProfile, null, 2)}
            </pre>
          </div>
        )}

        {agent.capabilities && (
          <div className="rounded-lg border bg-card p-4">
            <h3 className="mb-3 font-medium">Capabilities</h3>
            <pre className="overflow-auto text-xs text-muted-foreground">
              {JSON.stringify(agent.capabilities, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {errorsData?.errors && errorsData.errors.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-medium">Recent Errors</h3>
          <div className="space-y-2">
            {errorsData.errors.map((err) => (
              <div key={err.id} className="rounded-md border bg-destructive/5 p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-destructive">{err.severity}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(err.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="mt-1 text-sm">{err.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
