// Set test environment variables before any imports
process.env['NODE_ENV'] = 'test';
process.env['PORT'] = '4001';
process.env['LOG_LEVEL'] = 'silent';
process.env['LOG_PRETTY'] = 'false';
process.env['DATABASE_URL'] = 'postgres://hashhive:hashhive@localhost:5432/hashhive_test';
process.env['REDIS_URL'] = 'redis://localhost:6379';
process.env['S3_ENDPOINT'] = 'http://localhost:9000';
process.env['S3_ACCESS_KEY'] = 'minioadmin';
process.env['S3_SECRET_KEY'] = 'minioadmin';
process.env['S3_BUCKET'] = 'hashhive-test';
process.env['S3_REGION'] = 'us-east-1';
process.env['JWT_SECRET'] = 'test-secret-at-least-16-chars-long';
process.env['JWT_EXPIRY'] = '1h';
