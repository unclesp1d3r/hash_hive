/**
 * StorageService Usage Examples
 *
 * This file demonstrates how to use the StorageService for various file operations.
 * The StorageService provides an abstraction over S3-compatible storage (MinIO in development).
 */

import { createReadStream } from 'node:fs';
import { storageService } from '../services/storage.service';

/**
 * Example 1: Upload a file from a Buffer
 */
async function uploadFromBuffer() {
  const content = Buffer.from('Hello, World! This is a test file.');

  const key = await storageService.upload({
    key: 'documents/hello.txt',
    body: content,
    contentType: 'text/plain',
    metadata: {
      'uploaded-by': 'example-script',
      purpose: 'demonstration',
    },
  });
  return key;
}

/**
 * Example 2: Upload a file from a string
 */
async function uploadFromString() {
  const jsonData = JSON.stringify({
    name: 'Test Campaign',
    status: 'active',
    created: new Date().toISOString(),
  });

  const key = await storageService.upload({
    key: 'campaigns/test-campaign.json',
    body: jsonData,
    contentType: 'application/json',
  });
  return key;
}

/**
 * Example 3: Upload a file from a stream (e.g., file upload)
 */
async function uploadFromStream(filePath: string) {
  const stream = createReadStream(filePath);

  const key = await storageService.upload({
    key: `uploads/${Date.now()}-file.bin`,
    body: stream,
    contentType: 'application/octet-stream',
  });
  return key;
}

/**
 * Example 4: Download a file and read its contents
 */
async function downloadFile(key: string) {
  const result = await storageService.download(key);

  // Read the stream
  const chunks: Buffer[] = [];
  for await (const chunk of result.body) {
    chunks.push(chunk);
  }

  const content = Buffer.concat(chunks).toString();

  return content;
}

/**
 * Example 5: Get file metadata without downloading
 */
async function getFileInfo(key: string) {
  const metadata = await storageService.getMetadata(key);

  return metadata;
}

/**
 * Example 6: Generate a presigned URL for secure downloads
 */
async function generateDownloadLink(key: string) {
  // Generate URL valid for 1 hour (default)
  const url = await storageService.getPresignedUrl(key);

  // Generate URL valid for 24 hours
  const _longUrl = await storageService.getPresignedUrl(key, {
    expiresIn: 86400, // 24 hours in seconds
  });

  return url;
}

/**
 * Example 7: Check if a file exists
 */
async function checkFileExists(key: string) {
  const exists = await storageService.exists(key);

  if (exists) {
  } else {
  }

  return exists;
}

/**
 * Example 8: Delete a file
 */
async function deleteFile(key: string) {
  await storageService.delete(key);
}

/**
 * Example 9: Upload a hash list with metadata
 */
async function uploadHashList(projectId: string, hashListContent: string) {
  const key = `projects/${projectId}/hash-lists/${Date.now()}.txt`;

  await storageService.upload({
    key,
    body: Buffer.from(hashListContent),
    contentType: 'text/plain',
    metadata: {
      'project-id': projectId,
      'resource-type': 'hash-list',
      'upload-date': new Date().toISOString(),
    },
  });
  return key;
}

/**
 * Example 10: Upload a wordlist
 */
async function uploadWordlist(projectId: string, wordlistPath: string) {
  const stream = createReadStream(wordlistPath);
  const filename = wordlistPath.split('/').pop() || 'wordlist.txt';
  const key = `projects/${projectId}/wordlists/${filename}`;

  await storageService.upload({
    key,
    body: stream,
    contentType: 'text/plain',
    metadata: {
      'project-id': projectId,
      'resource-type': 'wordlist',
      'original-filename': filename,
    },
  });
  return key;
}

/**
 * Example 11: Complete workflow - Upload, verify, download, delete
 */
async function completeWorkflow() {
  const key = await uploadFromString();
  const exists = await checkFileExists(key);

  if (!exists) {
    throw new Error('File should exist after upload');
  }
  await getFileInfo(key);
  await generateDownloadLink(key);
  await downloadFile(key);
  await deleteFile(key);
  const stillExists = await checkFileExists(key);

  if (stillExists) {
    throw new Error('File should not exist after deletion');
  }
}

/**
 * Example 12: Batch operations
 */
async function batchUpload(files: Array<{ key: string; content: string }>) {
  const uploads = files.map((file) =>
    storageService.upload({
      key: file.key,
      body: Buffer.from(file.content),
      contentType: 'text/plain',
    })
  );

  const results = await Promise.all(uploads);

  return results;
}

/**
 * Example 13: Error handling
 */
async function handleErrors() {
  try {
    // Try to download a non-existent file
    await storageService.download('non-existent-file.txt');
  } catch (error) {
    if (error instanceof Error && error.message.includes('File not found')) {
    } else {
      throw error;
    }
  }

  try {
    // Try to get metadata for non-existent file
    await storageService.getMetadata('another-missing-file.txt');
  } catch (error) {
    if (error instanceof Error && error.message.includes('File not found')) {
    } else {
      throw error;
    }
  }
}

// Export examples for use in other modules
export {
  uploadFromBuffer,
  uploadFromString,
  uploadFromStream,
  downloadFile,
  getFileInfo,
  generateDownloadLink,
  checkFileExists,
  deleteFile,
  uploadHashList,
  uploadWordlist,
  completeWorkflow,
  batchUpload,
  handleErrors,
};

/**
 * Run examples if this file is executed directly
 */
if (require.main === module) {
  (async () => {
    try {
      await completeWorkflow();
    } catch (_error) {
      process.exit(1);
    }
  })();
}
