# Results Analysis & Export UI

## Overview

Implement global Results page with filters, search, and CSV export, plus campaign-specific and hash list results views for comprehensive result analysis.

## Scope

**In Scope:**
- Implement global Results page with filters (campaign, hash list, date range) and search
- Add CSV export functionality
- Implement campaign-specific results tab on campaign detail page
- Add hash list results view showing cracked/uncracked hashes
- Implement result attribution (campaign → attack → hash list)
- Add plaintext visibility (always visible to authenticated project members)
- Create `file:packages/frontend/src/pages/results.tsx`

**Out of Scope:**
- Advanced analytics dashboards
- Password pattern analysis
- Result sharing/collaboration

## Acceptance Criteria

1. **Global Results Page**
   - Table view of all cracked hashes in current project
   - Columns: Hash Value, Plaintext, Campaign, Attack, Hash List, Cracked At
   - Filter dropdowns: Campaign (all/specific), Hash List (all/specific), Date Range (last 24h/7d/30d/all)
   - Search input: Search by hash value or plaintext
   - Pagination (100 results per page)
   - "Export CSV" button downloads filtered results

2. **CSV Export**
   - "Export CSV" button triggers download
   - CSV includes all filtered results (not just current page)
   - CSV columns: Hash Value, Plaintext, Campaign, Attack, Hash List, Cracked At
   - Filename: `results-{project}-{timestamp}.csv`
   - Shows loading indicator during export generation

3. **Campaign Results Tab**
   - Tab on campaign detail page labeled "Results"
   - Table shows hashes cracked by this campaign
   - Columns: Hash Value, Plaintext, Attack, Cracked At
   - Statistics summary: Total Cracked, Crack Rate (percentage of hash list)
   - Link to hash list detail page

4. **Hash List Results View**
   - Page showing all hashes in a hash list
   - Toggle: Show All / Show Cracked / Show Uncracked
   - Table columns: Hash Value, Plaintext (if cracked), Status, Cracked At, Campaign (if cracked)
   - Statistics: Total Hashes, Cracked Count, Crack Rate
   - "Export CSV" button for hash list results

5. **Result Attribution**
   - Each result row shows which campaign and attack cracked it
   - Clicking campaign name navigates to campaign detail
   - Clicking attack name shows attack configuration in tooltip
   - Clicking hash list name navigates to hash list results view

6. **Plaintext Visibility**
   - Plaintext always visible to authenticated project members (no masking)
   - No role-based restrictions on plaintext visibility
   - Plaintext displayed in monospace font for readability

## Technical Notes

**Results Query:**
```typescript
function useResults(filters?: { campaignId?: number; hashListId?: number; dateRange?: string; search?: string }) {
  return useQuery({
    queryKey: ['results', filters],
    queryFn: () => api.get('/dashboard/results', { params: filters }),
  });
}
```

**CSV Export:**
```typescript
function useExportResults(filters?: ResultFilters) {
  return useMutation({
    mutationFn: () => api.get('/dashboard/results/export', {
      params: filters,
      responseType: 'blob',
    }),
    onSuccess: (blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `results-${Date.now()}.csv`;
      a.click();
    },
  });
}
```

**Results Table Component:**
```typescript
function ResultsTable({ results }: { results: Result[] }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Hash Value</th>
          <th>Plaintext</th>
          <th>Campaign</th>
          <th>Attack</th>
          <th>Hash List</th>
          <th>Cracked At</th>
        </tr>
      </thead>
      <tbody>
        {results.map(result => (
          <tr key={result.id}>
            <td className="font-mono text-sm">{result.hashValue}</td>
            <td className="font-mono text-sm font-bold">{result.plaintext}</td>
            <td>
              <Link to={`/campaigns/${result.campaignId}`}>
                {result.campaignName}
              </Link>
            </td>
            <td>{result.attackMode}</td>
            <td>
              <Link to={`/hash-lists/${result.hashListId}`}>
                {result.hashListName}
              </Link>
            </td>
            <td>{formatDate(result.crackedAt)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

**Hash List Results View:**
- Toggle between "All", "Cracked", "Uncracked" views
- Cracked hashes show plaintext and attribution
- Uncracked hashes show just hash value and status
- Statistics card shows total/cracked/crack rate

## Dependencies

- `ticket:f4542d0d-b9bd-4e50-b90b-9141e8063a18/T9` (Campaign Orchestration API)
- `ticket:f4542d0d-b9bd-4e50-b90b-9141e8063a18/T3` (Real-Time Events)

## Spec References

- `spec:f4542d0d-b9bd-4e50-b90b-9141e8063a18/98662419-66d0-40ee-a788-e5aa8c4c4de5` (Core Flows → Flow 8: Result Analysis)
- `spec:f4542d0d-b9bd-4e50-b90b-9141e8063a18/98662419-66d0-40ee-a788-e5aa8c4c4de5` (Core Flows → Wireframes: Results Page)
