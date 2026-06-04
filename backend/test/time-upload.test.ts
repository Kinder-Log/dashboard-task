import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.ts';

describe('Time Tracking & Secure Uploads Integration Tests', () => {
  let adminToken = '';
  let devToken = '';
  let devUserId = '';
  let dev2Token = '';
  let dev2UserId = '';
  let projectId = '';
  let taskId = '';
  let attachmentId = '';

  it('should authenticate users and prepare project/task', async () => {
    // Admin login
    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@example.com', password: 'admin12345' });
    adminToken = adminRes.body.data.accessToken;

    // Dev 1 login
    const devRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'dev1@example.com', password: 'dev12345' });
    devToken = devRes.body.data.accessToken;
    devUserId = devRes.body.data.user.id;

    // Dev 2 login
    const dev2Res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'dev2@example.com', password: 'dev12345' });
    dev2Token = dev2Res.body.data.accessToken;
    dev2UserId = dev2Res.body.data.user.id;

    // Create Project
    const projectKey = 'TIM' + Math.floor(Math.random() * 10000);
    const projRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Time Tracking Board', key: projectKey });
    projectId = projRes.body.data.id;

    // Add members
    await request(app)
      .post(`/api/projects/${projectId}/members`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: devUserId });
    await request(app)
      .post(`/api/projects/${projectId}/members`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: dev2UserId });

    // Create Task
    const taskRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Implement endpoints', projectId: projectId, type: 'FEATURE', priority: 'HIGH' });
    taskId = taskRes.body.data.id;
  });

  describe('Time Tracking API', () => {
    it('should log 2 hours to task and update actualHours sum cache', async () => {
      const res = await request(app)
        .post(`/api/tasks/${taskId}/timelogs`)
        .set('Authorization', `Bearer ${devToken}`)
        .send({ hours: 2.5, description: 'Coded routers' });

      expect(res.status).toBe(200);
      expect(res.body.data.hours).toBe(2.5);

      // Verify task details actualHours cache updated
      const taskRes = await request(app)
        .get(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${devToken}`);
      expect(taskRes.body.data.actualHours).toBe(2.5);
    });

    it('should log 3 more hours and accumulate actualHours to 5.5', async () => {
      await request(app)
        .post(`/api/tasks/${taskId}/timelogs`)
        .set('Authorization', `Bearer ${dev2Token}`)
        .send({ hours: 3.0, description: 'Added tests' });

      const taskRes = await request(app)
        .get(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${devToken}`);
      expect(taskRes.body.data.actualHours).toBe(5.5);
    });

    it('should reject logging negative hours', async () => {
      const res = await request(app)
        .post(`/api/tasks/${taskId}/timelogs`)
        .set('Authorization', `Bearer ${devToken}`)
        .send({ hours: -1.0 });

      expect(res.status).toBe(400);
    });
  });

  describe('Secure Uploads API', () => {
    const dummyPdf = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\nxref\n0 1\n0000000000 65535 f\ntrailer\n<<>>\nstartxref\n0\n%%EOF');

    it('should upload a valid pdf file and rename it', async () => {
      const res = await request(app)
        .post(`/api/tasks/${taskId}/attachments`)
        .set('Authorization', `Bearer ${devToken}`)
        .attach('file', dummyPdf, 'resume_draft.pdf');

      expect(res.status).toBe(200);
      expect(res.body.data.filename).toBe('resume_draft.pdf');
      expect(res.body.data.filepath).toContain('.pdf');
      expect(res.body.data.filepath).not.toContain('resume_draft'); // UUID renamed check

      attachmentId = res.body.data.id;
    });

    it('should reject non-whitelisted extension uploads', async () => {
      const scriptBuffer = Buffer.from('echo "malicious script"');
      const res = await request(app)
        .post(`/api/tasks/${taskId}/attachments`)
        .set('Authorization', `Bearer ${devToken}`)
        .attach('file', scriptBuffer, 'run.sh');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject double extension exploits', async () => {
      const exeBuffer = Buffer.from('binary-code');
      const res = await request(app)
        .post(`/api/tasks/${taskId}/attachments`)
        .set('Authorization', `Bearer ${devToken}`)
        .attach('file', exeBuffer, 'invoice.exe.pdf');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('SECURITY_VIOLATION');
    });

    it('should deny attachment deletion to developer user who is not the uploader', async () => {
      // dev2Token tries to delete attachment uploaded by devToken
      const res = await request(app)
        .delete(`/api/attachments/${attachmentId}`)
        .set('Authorization', `Bearer ${dev2Token}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should allow deletion to the uploader developer', async () => {
      const res = await request(app)
        .delete(`/api/attachments/${attachmentId}`)
        .set('Authorization', `Bearer ${devToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.message).toContain('deleted');
    });
  });
});
