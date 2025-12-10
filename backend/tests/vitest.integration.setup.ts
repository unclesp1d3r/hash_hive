// Integration Test Retry Configuration for Vitest
// Integration tests may occasionally fail due to:
// - Testcontainers startup timing
// - Network issues with Docker containers
// - Race conditions in async operations
// Vitest will automatically retry failed tests up to 2 times before marking them as failed.
// If tests consistently fail even with retries, investigate the root cause rather than increasing retries.

// Note: Retry configuration is handled in vitest.integration.config.ts via the retry option

// Suppress known benign unhandled rejections from ioredis when Redis connections
// are being closed as part of normal BullMQ shutdown in integration tests.
// These manifest as "Error: Connection is closed." coming from ioredis
// event_handler.js after tests complete. We treat them as expected noise
// rather than test failures.
process.on('unhandledRejection', (reason) => {
  if (reason instanceof Error && reason.message === 'Connection is closed.') {
    // Swallow this specific error; other unhandled rejections should still surface.
    return;
  }
});
