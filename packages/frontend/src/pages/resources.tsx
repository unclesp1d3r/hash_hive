import { useState } from 'react';
import {
  useGuessHashType,
  useHashLists,
  useMasklists,
  useRulelists,
  useWordlists,
} from '../hooks/use-resources';
import { useUiStore } from '../stores/ui';

type Tab = 'hash-lists' | 'wordlists' | 'rulelists' | 'masklists' | 'hash-detect';

export function ResourcesPage() {
  const { selectedProjectId } = useUiStore();
  const [activeTab, setActiveTab] = useState<Tab>('hash-lists');

  if (!selectedProjectId) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Resources</h2>
        <p className="text-muted-foreground">Select a project to view resources.</p>
      </div>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'hash-lists', label: 'Hash Lists' },
    { id: 'wordlists', label: 'Wordlists' },
    { id: 'rulelists', label: 'Rulelists' },
    { id: 'masklists', label: 'Masklists' },
    { id: 'hash-detect', label: 'Hash Detect' },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Resources</h2>

      <div className="flex gap-1 border-b">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'hash-lists' && <HashListsTab />}
      {activeTab === 'wordlists' && <ResourceListTab type="wordlists" />}
      {activeTab === 'rulelists' && <ResourceListTab type="rulelists" />}
      {activeTab === 'masklists' && <ResourceListTab type="masklists" />}
      {activeTab === 'hash-detect' && <HashDetectTab />}
    </div>
  );
}

function HashListsTab() {
  const { data, isLoading } = useHashLists();

  if (isLoading) return <p className="text-muted-foreground">Loading...</p>;

  const hashLists = data?.hashLists ?? [];

  if (hashLists.length === 0) {
    return <p className="text-muted-foreground">No hash lists found.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-left text-sm">
        <thead className="border-b bg-muted/50">
          <tr>
            <th className="px-4 py-3 font-medium">Name</th>
            <th className="px-4 py-3 font-medium">Hashes</th>
            <th className="px-4 py-3 font-medium">Cracked</th>
            <th className="px-4 py-3 font-medium">Created</th>
          </tr>
        </thead>
        <tbody>
          {hashLists.map((hl) => (
            <tr key={hl.id} className="border-b last:border-b-0">
              <td className="px-4 py-3 font-medium">{hl.name}</td>
              <td className="px-4 py-3">{hl.hashCount}</td>
              <td className="px-4 py-3">{hl.crackedCount}</td>
              <td className="px-4 py-3 text-muted-foreground">
                {new Date(hl.createdAt).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ResourceListTab({ type }: { type: 'wordlists' | 'rulelists' | 'masklists' }) {
  const wordlists = useWordlists();
  const rulelists = useRulelists();
  const masklists = useMasklists();

  const hookMap = { wordlists, rulelists, masklists };
  const { data, isLoading } = hookMap[type];

  if (isLoading) return <p className="text-muted-foreground">Loading...</p>;

  const resources = data?.resources ?? [];

  if (resources.length === 0) {
    return <p className="text-muted-foreground">No {type} found.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-left text-sm">
        <thead className="border-b bg-muted/50">
          <tr>
            <th className="px-4 py-3 font-medium">Name</th>
            <th className="px-4 py-3 font-medium">Created</th>
          </tr>
        </thead>
        <tbody>
          {resources.map((r) => (
            <tr key={r.id} className="border-b last:border-b-0">
              <td className="px-4 py-3 font-medium">{r.name}</td>
              <td className="px-4 py-3 text-muted-foreground">
                {new Date(r.createdAt).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HashDetectTab() {
  const [hashInput, setHashInput] = useState('');
  const guessType = useGuessHashType();

  const handleDetect = () => {
    if (hashInput.trim()) {
      guessType.mutate(hashInput.trim());
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Enter a hash value..."
          className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
          value={hashInput}
          onChange={(e) => setHashInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleDetect();
          }}
        />
        <button
          type="button"
          onClick={handleDetect}
          disabled={guessType.isPending || !hashInput.trim()}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {guessType.isPending ? 'Detecting...' : 'Detect Type'}
        </button>
      </div>

      {guessType.data && (
        <div className="space-y-2">
          <h3 className="font-medium">
            Results {guessType.data.identified ? '(Identified)' : '(Candidates)'}
          </h3>
          {guessType.data.candidates.length === 0 ? (
            <p className="text-sm text-muted-foreground">No matching hash types found.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Hashcat Mode</th>
                    <th className="px-4 py-3 font-medium">Category</th>
                    <th className="px-4 py-3 font-medium">Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {guessType.data.candidates.map((c) => (
                    <tr key={c.hashcatMode} className="border-b last:border-b-0">
                      <td className="px-4 py-3 font-medium">{c.name}</td>
                      <td className="px-4 py-3">{c.hashcatMode}</td>
                      <td className="px-4 py-3 text-muted-foreground">{c.category}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-20 rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{ width: `${Math.round(c.confidence * 100)}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {Math.round(c.confidence * 100)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
