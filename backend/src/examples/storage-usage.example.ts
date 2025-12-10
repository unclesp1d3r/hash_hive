/**
 * StorageService Usage Examples
 *
 * This file demonstrates how to use the StorageService for various file operations.
 * The StorageService provides an abstraction over S3-compatible storage (MinIO in development).
 */

import { storageService } from '../services/storage.service';
import { createReadStream } from 'fs';

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

  console.log(`File uploaded successfully: ${key}`);
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

  console.log(`JSON file uploaded: ${key}`);
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

  console.log(`Stream uploaded: ${key}`);
  return key;
}

/**
 * Example 4: Download a file and read its contents
 */
async function downloadFile(key: string) {
  const result = await storageService.download(key);

  console.log(`Downloaded file: ${key}`);
  console.log(`Content-Type: ${result.contentType}`);
  console.log(`Size: ${result.contentLength} bytes`);

  // Read the stream
  const chunks: Buffer[] = [];
  for await (const chunk of result.body) {
    chunks.push(chunk);
  }

  const content = Buffer.concat(chunks).toString();
  console.log(`Content: ${content}`);

  return content;
}

/**
 * Example 5: Get file metadata without downloading
 */
async function getFileInfo(key: string) {
  const metadata = await storageService.getMetadata(key);

  console.log(`File: ${metadata.key}`);
  console.log(`Size: ${metadata.size} bytes`);
  console.log(`Type: ${metadata.contentType}`);
  console.log(`Modified: ${metadata.lastModified}`);
  console.log(`Metadata:`, metadata.metadata);

  return metadata;
}

/**
 * Example 6: Generate a presigned URL for secure downloads
 */
async function generateDownloadLink(key: string) {
  // Generate URL valid for 1 hour (default)
  const url = await storageService.getPresignedUrl(key);
  console.log(`Download URL (1 hour): ${url}`);

  // Generate URL valid for 24 hours
  const longUrl = await storageService.getPresignedUrl(key, {
    expiresIn: 86400, // 24 hours in seconds
  });
  console.log(`Download URL (24 hours): ${longUrl}`);

  return url;
}

/**
 * Example 7: Check if a file exists
 */
async function checkFileExists(key: string) {
  const exists = await storageService.exists(key);

  if (exists) {
    console.log(`File exists: ${key}`);
  } else {
    console.log(`File not found: ${key}`);
  }

  return exists;
}

/**
 * Example 8: Delete a file
 */
async function deleteFile(key: string) {
  await storageService.delete(key);
  console.log(`File deleted: ${key}`);
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

  console.log(`Hash list uploaded: ${key}`);
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

  console.log(`Wordlist uploaded: ${key}`);
  return key;
}

/**
 * Example 11: Complete workflow - Upload, verify, download, delete
 */
async function completeWorkflow() {
  console.log('=== Complete Storage Workflow ===\n');

  // 1. Upload
  console.log('1. Uploading file...');
  const key = await uploadFromString();

  // 2. Verify existence
  console.log('\n2. Checking if file exists...');
  const exists = await checkFileExists(key);

  if (!exists) {
    throw new Error('File should exist after upload');
  }

  // 3. Get metadata
  console.log('\n3. Getting file metadata...');
  await getFileInfo(key);

  // 4. Generate presigned URL
  console.log('\n4. Generating presigned URL...');
  await generateDownloadLink(key);

  // 5. Download
  console.log('\n5. Downloading file...');
  await downloadFile(key);

  // 6. Delete
  console.log('\n6. Deleting file...');
  await deleteFile(key);

  // 7. Verify deletion
  console.log('\n7. Verifying deletion...');
  const stillExists = await checkFileExists(key);

  if (stillExists) {
    throw new Error('File should not exist after deletion');
  }

  console.log('\n=== Workflow completed successfully ===');
}

/**
 * Example 12: Batch operations
 */
async function batchUpload(files: Array<{ key: string; content: string }>) {
  console.log(`Uploading ${files.length} files...`);

  const uploads = files.map((file) =>
    storageService.upload({
      key: file.key,
      body: Buffer.from(file.content),
      contentType: 'text/plain',
    })
  );

  const results = await Promise.all(uploads);
  console.log(`Successfully uploaded ${results.length} files`);

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
      console.log('Handled expected error: File not found');
    } else {
      console.error('Unexpected error:', error);
      throw error;
    }
  }

  try {
    // Try to get metadata for non-existent file
    await storageService.getMetadata('another-missing-file.txt');
  } catch (error) {
    if (error instanceof Error && error.message.includes('File not found')) {
      console.log('Handled expected error: Metadata not found');
    } else {
      console.error('Unexpected error:', error);
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
    } catch (error) {
      console.error('Error running examples:', error);
      process.exit(1);
    }
  })();
}
