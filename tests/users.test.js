const request = require('supertest');
const app = require('../src/server');
const { initializeDatabase, closeDatabase } = require('../src/database/connection');

describe('User Management Endpoints', () => {
  let userToken, adminToken;
  let userId, adminId;

  beforeAll(async () => {
    await initializeDatabase();
    
    // Register regular user
    const userResponse = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'regularuser',
        email: 'user@example.com',
        password: 'password123',
        role: 'user'
      });
    
    userToken = userResponse.body.data.token;
    userId = userResponse.body.data.user.id;

    // Register admin user
    const adminResponse = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'adminuser',
        email: 'admin@example.com',
        password: 'password123',
        role: 'admin'
      });
    
    adminToken = adminResponse.body.data.token;
    adminId = adminResponse.body.data.user.id;
  });

  afterAll(async () => {
    await closeDatabase();
  });

  describe('GET /api/users', () => {
    test('should allow admin to get all users', async () => {
      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.users).toBeDefined();
      expect(Array.isArray(response.body.data.users)).toBe(true);
      expect(response.body.data.pagination).toBeDefined();
    });

    test('should deny regular user access to all users', async () => {
      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    test('should support pagination and search', async () => {
      const response = await request(app)
        .get('/api/users?page=1&limit=5&search=user')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.pagination.currentPage).toBe(1);
      expect(response.body.data.pagination.itemsPerPage).toBe(5);
    });
  });

  describe('GET /api/users/:id', () => {
    test('should allow user to get their own profile', async () => {
      const response = await request(app)
        .get(`/api/users/${userId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.id).toBe(userId);
      expect(response.body.data.user.email).toBe('user@example.com');
    });

    test('should allow admin to get any user profile', async () => {
      const response = await request(app)
        .get(`/api/users/${userId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.id).toBe(userId);
    });

    test('should deny user access to other profiles', async () => {
      const response = await request(app)
        .get(`/api/users/${adminId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/users/:id', () => {
    test('should allow user to update their own profile', async () => {
      const updateData = {
        username: 'updateduser',
        email: 'updated@example.com'
      };

      const response = await request(app)
        .put(`/api/users/${userId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.username).toBe(updateData.username);
      expect(response.body.data.user.email).toBe(updateData.email);
    });

    test('should not allow user to change their role', async () => {
      const updateData = {
        role: 'admin' // Regular user trying to become admin
      };

      const response = await request(app)
        .put(`/api/users/${userId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(updateData)
        .expect(200);

      // Role should remain unchanged
      expect(response.body.data.user.role).toBe('user');
    });

    test('should allow admin to update any user', async () => {
      const updateData = {
        role: 'admin'
      };

      const response = await request(app)
        .put(`/api/users/${userId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.role).toBe(updateData.role);
    });
  });

  describe('POST /api/users/:id/change-password', () => {
    test('should allow user to change their password', async () => {
      const passwordData = {
        currentPassword: 'password123',
        newPassword: 'newpassword123'
      };

      const response = await request(app)
        .post(`/api/users/${userId}/change-password`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(passwordData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('changed');
    });

    test('should fail with incorrect current password', async () => {
      const passwordData = {
        currentPassword: 'wrongpassword',
        newPassword: 'newpassword123'
      };

      const response = await request(app)
        .post(`/api/users/${userId}/change-password`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(passwordData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('incorrect');
    });

    test('should not allow changing other users passwords', async () => {
      const passwordData = {
        currentPassword: 'password123',
        newPassword: 'newpassword123'
      };

      const response = await request(app)
        .post(`/api/users/${adminId}/change-password`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(passwordData)
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/users/:id', () => {
    let testUserId;

    beforeAll(async () => {
      // Create a test user to delete
      const testUserResponse = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'deleteuser',
          email: 'delete@example.com',
          password: 'password123'
        });
      
      testUserId = testUserResponse.body.data.user.id;
    });

    test('should allow admin to delete users', async () => {
      const response = await request(app)
        .delete(`/api/users/${testUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deleted');
    });

    test('should not allow regular user to delete users', async () => {
      const response = await request(app)
        .delete(`/api/users/${adminId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    test('should not allow admin to delete themselves', async () => {
      const response = await request(app)
        .delete(`/api/users/${adminId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('own account');
    });
  });
});