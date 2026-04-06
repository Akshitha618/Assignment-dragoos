const request = require('supertest');
const app = require('../src/server');
const { initializeDatabase, closeDatabase } = require('../src/database/connection');

describe('Data Endpoints', () => {
  let authToken;
  let userId;

  beforeAll(async () => {
    await initializeDatabase();
    
    // Register and login a test user
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'datauser',
        email: 'datauser@example.com',
        password: 'password123'
      });
    
    authToken = registerResponse.body.data.token;
    userId = registerResponse.body.data.user.id;
  });

  afterAll(async () => {
    await closeDatabase();
  });

  describe('POST /api/data', () => {
    test('should create a new data entry', async () => {
      const dataEntry = {
        title: 'Test Entry',
        content: 'This is a test content',
        category: 'test',
        tags: ['tag1', 'tag2'],
        metadata: { key: 'value' },
        isPublic: false
      };

      const response = await request(app)
        .post('/api/data')
        .set('Authorization', `Bearer ${authToken}`)
        .send(dataEntry)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.entry.title).toBe(dataEntry.title);
      expect(response.body.data.entry.content).toBe(dataEntry.content);
      expect(response.body.data.entry.tags).toEqual(dataEntry.tags);
      expect(response.body.data.entry.metadata).toEqual(dataEntry.metadata);
    });

    test('should fail without authentication', async () => {
      const dataEntry = {
        title: 'Test Entry',
        content: 'This is a test content'
      };

      const response = await request(app)
        .post('/api/data')
        .send(dataEntry)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    test('should fail with invalid data', async () => {
      const dataEntry = {
        // Missing required title
        content: 'This is a test content'
      };

      const response = await request(app)
        .post('/api/data')
        .set('Authorization', `Bearer ${authToken}`)
        .send(dataEntry)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('title');
    });
  });

  describe('GET /api/data', () => {
    test('should get user data entries', async () => {
      const response = await request(app)
        .get('/api/data')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.entries).toBeDefined();
      expect(response.body.data.pagination).toBeDefined();
      expect(Array.isArray(response.body.data.entries)).toBe(true);
    });

    test('should support pagination', async () => {
      const response = await request(app)
        .get('/api/data?page=1&limit=5')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.pagination.currentPage).toBe(1);
      expect(response.body.data.pagination.itemsPerPage).toBe(5);
    });

    test('should support search', async () => {
      const response = await request(app)
        .get('/api/data?search=Test')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.entries).toBeDefined();
    });

    test('should fail without authentication', async () => {
      const response = await request(app)
        .get('/api/data')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/data/:id', () => {
    let dataEntryId;

    beforeAll(async () => {
      // Create a test entry
      const createResponse = await request(app)
        .post('/api/data')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Specific Test Entry',
          content: 'Content for specific test',
          category: 'specific'
        });
      
      dataEntryId = createResponse.body.data.entry.id;
    });

    test('should get specific data entry', async () => {
      const response = await request(app)
        .get(`/api/data/${dataEntryId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.entry.id).toBe(dataEntryId);
      expect(response.body.data.entry.title).toBe('Specific Test Entry');
    });

    test('should fail for non-existent entry', async () => {
      const response = await request(app)
        .get('/api/data/99999')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/data/:id', () => {
    let dataEntryId;

    beforeAll(async () => {
      // Create a test entry
      const createResponse = await request(app)
        .post('/api/data')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Update Test Entry',
          content: 'Original content',
          category: 'update'
        });
      
      dataEntryId = createResponse.body.data.entry.id;
    });

    test('should update data entry', async () => {
      const updateData = {
        title: 'Updated Test Entry',
        content: 'Updated content',
        tags: ['updated']
      };

      const response = await request(app)
        .put(`/api/data/${dataEntryId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.entry.title).toBe(updateData.title);
      expect(response.body.data.entry.content).toBe(updateData.content);
      expect(response.body.data.entry.tags).toEqual(updateData.tags);
    });

    test('should fail for non-existent entry', async () => {
      const response = await request(app)
        .put('/api/data/99999')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Updated' })
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/data/:id', () => {
    let dataEntryId;

    beforeAll(async () => {
      // Create a test entry
      const createResponse = await request(app)
        .post('/api/data')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Delete Test Entry',
          content: 'Content to be deleted'
        });
      
      dataEntryId = createResponse.body.data.entry.id;
    });

    test('should delete data entry', async () => {
      const response = await request(app)
        .delete(`/api/data/${dataEntryId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deleted');
    });

    test('should fail for non-existent entry', async () => {
      const response = await request(app)
        .delete('/api/data/99999')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/data/categories/list', () => {
    test('should get categories list', async () => {
      const response = await request(app)
        .get('/api/data/categories/list')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.categories).toBeDefined();
      expect(Array.isArray(response.body.data.categories)).toBe(true);
    });
  });
});