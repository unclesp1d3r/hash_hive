// Integration Test Retry Configuration
// Integration tests may occasionally fail due to:
// - Testcontainers startup timing
// - Network issues with Docker containers
// - Race conditions in async operations
// Jest will automatically retry failed tests up to 2 times before marking them as failed.
// If tests consistently fail even with retries, investigate the root cause rather than increasing retries.

// Enable retries for all integration tests
jest.retryTimes(2);
