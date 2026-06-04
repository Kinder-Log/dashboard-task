import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.ts';

describe('Admin Configurations Integration Tests', () => {
  let adminToken = '';
  let devToken = '';

  it('should authenticate admin and developer users', async () => {
    // Admin login
    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@example.com', password: 'admin12345' });
    adminToken = adminRes.body.data.accessToken;

    // Dev login
    const devRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'dev1@example.com', password: 'dev12345' });
    devToken = devRes.body.data.accessToken;
  });

  describe('User Management API (Prerequisites verify)', () => {
    it('should allow admin to list users', async () => {
      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('should deny developer from listing users', async () => {
      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${devToken}`);

      expect(res.status).toBe(403);
    });

    it('should allow admin to create a new user', async () => {
      const uniqueEmail = `testuser_${Date.now()}@example.com`;
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test Setup User',
          email: uniqueEmail,
          password: 'Password12345',
          role: 'DEVELOPER',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.email).toBe(uniqueEmail);
    });
  });

  describe('Column Configurations API', () => {
    it('should allow admin to list all statuses', async () => {
      const res = await request(app)
        .get('/api/tasks/statuses/all')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      
      // Verify protected fields are present
      const todoStatus = res.body.data.find((s: any) => s.key === 'TODO');
      expect(todoStatus).toBeDefined();
      expect(todoStatus.protected).toBe(true);
    });

    it('should block non-admin from listing all statuses', async () => {
      const res = await request(app)
        .get('/api/tasks/statuses/all')
        .set('Authorization', `Bearer ${devToken}`);

      expect(res.status).toBe(403);
    });

    it('should allow admin to update a status color and name', async () => {
      const res = await request(app)
        .put('/api/tasks/statuses/TODO')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'To Do Styled',
          color: '#3b82f6',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('To Do Styled');
      expect(res.body.data.color).toBe('#3b82f6');
    });

    it('should reject deactivating a protected status', async () => {
      const res = await request(app)
        .put('/api/tasks/statuses/TODO')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          active: false,
        });

      expect(res.status).toBe(400);
    });
  });
});
