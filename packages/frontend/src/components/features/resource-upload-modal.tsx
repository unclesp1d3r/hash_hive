import type { ChangeEvent } from 'react';
import { useRef, useState } from 'react';
import { useCreateResource, useUploadResourceFile } from '../../hooks/use-resources';

type ResourceType = 'hash-lists' | 'wordlists' | 'rulelists' | 'masklists';

const TYPE_LABELS: Record<ResourceType, string> = {
  'hash-lists': 'Hash List',
  wordlists: 'Wordlist',
  rulelists: 'Rulelist',
  masklists: 'Masklist',
};

interface ResourceUploadModalProps {
  type: ResourceType;
  open: boolean;
  onClose: () => void;
  onSuccess: (resourceId: number) => void;
}

export function ResourceUploadModal({ type, open, onClose, onSuccess }: ResourceUploadModalProps) {
  const [name, setName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createResource = useCreateResource(type);
  const uploadFile = useUploadResourceFile(type);

  const isUploading = createResource.isPending || uploadFile.isPending;
  const label = TYPE_LABELS[type];

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null;
    setFile(selected);
    if (selected && !name) {
      setName(selected.name.replace(/\.[^.]+$/, ''));
    }
  };

  const handleUpload = async () => {
    if (!file || !name.trim()) return;

    setError(null);
    try {
      const result = await createResource.mutateAsync({ name: name.trim() });
      const resourceId = result.resource.id;

      await uploadFile.mutateAsync({ id: resourceId, file });

      onSuccess(resourceId);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    }
  };

  const handleClose = () => {
    setName('');
    setFile(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg border bg-background p-6 shadow-lg">
        <h3 className="mb-4 text-lg font-medium">Upload New {label}</h3>

        {error && (
          <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label htmlFor="resource-name" className="text-sm font-medium">
              Name
            </label>
            <input
              id="resource-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
              placeholder={`Enter ${label.toLowerCase()} name`}
            />
          </div>

          <div>
            <label htmlFor="resource-file" className="text-sm font-medium">
              File
            </label>
            <input
              id="resource-file"
              ref={fileInputRef}
              type="file"
              onChange={handleFileChange}
              className="mt-1 w-full text-sm"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={handleClose}
            disabled={isUploading}
            className="rounded-md border px-4 py-2 text-sm hover:bg-accent disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleUpload}
            disabled={!file || !name.trim() || isUploading}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isUploading ? 'Uploading...' : 'Upload'}
          </button>
        </div>
      </div>
    </div>
  );
}
