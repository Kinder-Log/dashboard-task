import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.ts';

describe('Auth Integration Tests', () => {
  let adminAccessToken = '';
  let adminRefreshTokenCookie = '';
  let devAccessToken = '';

  it('should fail login with incorrect credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@example.com',
        password: 'wrongpassword',
      });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('should login admin user successfully and return tokens', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@example.com',
        password: 'admin12345',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.user.email).toBe('admin@example.com');
    expect(res.body.data.user.role).toBe('ADMIN');

    adminAccessToken = res.body.data.accessToken;

    // Get cookie header
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    const refreshCookie = cookies.find((c: string) => c.startsWith('refreshToken='));
    expect(refreshCookie).toBeDefined();

    // Isolate the cookie value part (refreshToken=xxx; ...)
    adminRefreshTokenCookie = refreshCookie.split(';')[0];
  });

  it('should login developer user successfully', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'dev1@example.com',
        password: 'dev12345',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.user.role).toBe('DEVELOPER');

    devAccessToken = res.body.data.accessToken;
  });

  it('should access protected route with valid token', async () => {
    const res = await request(app)
      .get('/api/test-protected')
      .set('Authorization', `Bearer ${adminAccessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('Access granted');
    expect(res.body.user.role).toBe('ADMIN');
  });

  it('should fail to access protected route with no token', async () => {
    const res = await request(app).get('/api/test-protected');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('should grant admin-only access to admin user', async () => {
    const res = await request(app)
      .get('/api/test-admin')
      .set('Authorization', `Bearer ${adminAccessToken}`);

    expect(res.status).toBe(200);
  });

  it('should deny admin-only access to developer user', async () => {
    const res = await request(app)
      .get('/api/test-admin')
      .set('Authorization', `Bearer ${devAccessToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('should refresh access token using valid refresh token cookie', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [adminRefreshTokenCookie]);

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
  });

  it('should fail to refresh with invalid refresh token', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', ['refreshToken=invalid_token']);

    expect(res.status).toBe(401);
  });
});
