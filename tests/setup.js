const fs = require('fs');
const path = require('path');

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key';
process.env.DB_PATH = ':memory:'; // Use in-memory database for tests

// Clean up test files after tests
afterAll(async () => {
  // Clean up any test files if needed
  const testDbPath = path.join(__dirname, '..', 'test.db');
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
});