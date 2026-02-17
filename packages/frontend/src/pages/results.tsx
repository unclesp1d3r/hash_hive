import { useState } from 'react';
import { useResults, useResultsExportUrl } from '../hooks/use-results';
import { useUiStore } from '../stores/ui';

export function ResultsPage() {
  const { selectedProjectId } = useUiStore();
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const { data, isLoading } = useResults({
    ...(search ? { search } : {}),
    limit,
    offset,
  });
  const exportUrl = useResultsExportUrl({
    ...(search ? { search } : {}),
  });

  if (!selectedProjectId) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Cracked Results</h2>
        <p className="text-muted-foreground">Select a project to view results.</p>
      </div>
    );
  }

  const total = data?.total ?? 0;
  const hasNext = offset + limit < total;
  const hasPrev = offset > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Cracked Results</h2>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Search hashes or plaintexts..."
            className="rounded-md border bg-background px-3 py-1.5 text-sm"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setOffset(0);
            }}
          />
          {exportUrl && (
            <a
              href={exportUrl}
              download
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
            >
              Export CSV
            </a>
          )}
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading results...</p>
      ) : !data?.results.length ? (
        <p className="text-muted-foreground">No cracked results found.</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="px-4 py-3 font-medium">Hash</th>
                  <th className="px-4 py-3 font-medium">Plaintext</th>
                  <th className="px-4 py-3 font-medium">Campaign</th>
                  <th className="px-4 py-3 font-medium">Hash List</th>
                  <th className="px-4 py-3 font-medium">Cracked At</th>
                </tr>
              </thead>
              <tbody>
                {data.results.map((r) => (
                  <tr key={r.id} className="border-b last:border-b-0">
                    <td className="max-w-[200px] truncate px-4 py-3 font-mono text-xs">
                      {r.hashValue}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs font-medium">
                      {r.plaintext ?? '--'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{r.campaignName}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.hashListName}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {r.crackedAt ? new Date(r.crackedAt).toLocaleString() : '--'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Showing {offset + 1}–{Math.min(offset + limit, total)} of {total}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={!hasPrev}
                onClick={() => setOffset(Math.max(0, offset - limit))}
                className="rounded-md border px-3 py-1 text-sm hover:bg-accent disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={!hasNext}
                onClick={() => setOffset(offset + limit)}
                className="rounded-md border px-3 py-1 text-sm hover:bg-accent disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
