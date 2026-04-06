const request = require('supertest');
const app = require('../src/server');
const { initializeDatabase, closeDatabase } = require('../src/database/connection');

describe('Health Endpoints', () => {
  beforeAll(async () => {
    await initializeDatabase();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  describe('GET /api/health', () => {
    test('should return healthy status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('healthy');
      expect(response.body.data.timestamp).toBeDefined();
      expect(response.body.data.uptime).toBeDefined();
      expect(response.body.data.database.status).toBe('connected');
    });

    test('should include performance metrics', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body.data.database.responseTime).toBeDefined();
      expect(response.body.data.memory).toBeDefined();
      expect(response.body.data.memory.used).toBeDefined();
      expect(response.body.data.memory.total).toBeDefined();
    });
  });

  describe('GET /api/health/detailed', () => {
    test('should return detailed health information', async () => {
      const response = await request(app)
        .get('/api/health/detailed')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('healthy');
      expect(response.body.data.database.statistics).toBeDefined();
      expect(response.body.data.system).toBeDefined();
      expect(response.body.data.system.platform).toBeDefined();
      expect(response.body.data.system.nodeVersion).toBeDefined();
    });

    test('should include database statistics', async () => {
      const response = await request(app)
        .get('/api/health/detailed')
        .expect(200);

      expect(response.body.data.database.statistics.users).toBeDefined();
      expect(response.body.data.database.statistics.dataEntries).toBeDefined();
      expect(typeof response.body.data.database.statistics.users).toBe('number');
      expect(typeof response.body.data.database.statistics.dataEntries).toBe('number');
    });
  });
});