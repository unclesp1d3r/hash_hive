# Resource Management UI

## Overview

Implement tabbed resource management page with file upload, hash type detection, and resource listing for hash lists, wordlists, rulelists, and masklists.

## Scope

**In Scope:**
- Implement tabbed resource page (Hash Lists, Wordlists, Rulelists, Masklists)
- Add file upload with drag-and-drop
- Implement upload progress indicators
- Add resource list tables with name, size, status, actions
- Implement hash type detection UI with confidence scores
- Add resource delete confirmation
- Update `file:packages/frontend/src/pages/resources.tsx`

**Out of Scope:**
- Resource editing
- Resource sharing between projects
- Advanced hash analysis

## Acceptance Criteria

1. **Tabbed Interface**
   - 4 tabs: Hash Lists, Wordlists, Rulelists, Masklists
   - Each tab shows resource list for that type
   - Active tab highlighted
   - Tab content loads on demand (lazy loading)

2. **File Upload**
   - Drag-and-drop zone for file upload
   - Click to browse file picker
   - Shows file name and size before upload
   - Upload button triggers multipart upload to API
   - Progress bar shows upload progress
   - Success message on completion
   - Error message on failure

3. **Resource List Table**
   - Columns: Name, Size, Status, Created At, Actions
   - Status badge (uploading = blue, ready = green, failed = red)
   - Actions: View, Delete
   - Empty state when no resources
   - Pagination for large lists (50 per page)

4. **Hash Type Detection**
   - "Detect Hash Type" button on Hash Lists tab
   - Modal with textarea for sample hashes (5-10 samples)
   - "Detect" button calls API
   - Results show candidates with:
     - Hash type name
     - Confidence score (percentage)
     - Hashcat mode
     - Example hash
   - "Use This Type" button sets hash type for list

5. **Resource Delete**
   - Delete button on each resource row
   - Confirmation modal: "Are you sure you want to delete {name}?"
   - Delete button in modal calls API
   - Success message on deletion
   - Resource removed from list

6. **Real-Time Upload Status**
   - Upload status updates in real-time via WebSocket
   - When hash list parsing completes, status changes from "uploading" to "ready"
   - Statistics update when parsing completes (total count, file size)

## Technical Notes

**Resource Upload:**
```typescript
function useUploadResource(type: 'hash-lists' | 'wordlists' | 'rulelists' | 'masklists') {
  return useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return api.post(`/dashboard/resources/${type}`, formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['resources', type]);
    },
  });
}
```

**Hash Type Detection:**
```typescript
function useDetectHashType() {
  return useMutation({
    mutationFn: (samples: string[]) =>
      api.post('/dashboard/resources/detect-hash-type', { samples }),
  });
}
```

**Drag-and-Drop Upload:**
```typescript
function FileUpload({ onUpload }: { onUpload: (file: File) => void }) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onUpload(file);
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={isDragging ? 'border-blue-500' : 'border-gray-300'}
    >
      Drop file here or click to browse
    </div>
  );
}
```

## Dependencies

- `ticket:f4542d0d-b9bd-4e50-b90b-9141e8063a18/T8` (Resource Management API)
- `ticket:f4542d0d-b9bd-4e50-b90b-9141e8063a18/T3` (Real-Time Events for upload status)

## Spec References

- `spec:f4542d0d-b9bd-4e50-b90b-9141e8063a18/98662419-66d0-40ee-a788-e5aa8c4c4de5` (Core Flows → Flows 6-7: Resource Management & Hash Detection)
- `spec:f4542d0d-b9bd-4e50-b90b-9141e8063a18/98662419-66d0-40ee-a788-e5aa8c4c4de5` (Core Flows → Wireframes: Resources Tabs)
