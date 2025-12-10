// Integration Test Retry Configuration for Vitest
// Integration tests may occasionally fail due to:
// - Testcontainers startup timing
// - Network issues with Docker containers
// - Race conditions in async operations
// Vitest will automatically retry failed tests up to 2 times before marking them as failed.
// If tests consistently fail even with retries, investigate the root cause rather than increasing retries.

// Note: Retry configuration is handled in vitest.integration.config.ts via the retry option

