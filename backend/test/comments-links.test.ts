import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.ts';

describe('Comments & Task Links Integration Tests', () => {
  let adminToken = '';
  let devToken = '';
  let devUserId = '';
  let dev2Token = '';
  let dev2UserId = '';
  let projectId = '';
  let taskId = '';
  let commentId = '';
  let linkId = '';

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
    const projectKey = 'COM' + Math.floor(Math.random() * 10000);
    const projRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Comments Project', key: projectKey });
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
      .send({ title: 'Task with comments and links', projectId: projectId, type: 'BUG', priority: 'MEDIUM' });
    taskId = taskRes.body.data.id;
  });

  describe('Comments API', () => {
    it('should add a comment to a task', async () => {
      const res = await request(app)
        .post(`/api/tasks/${taskId}/comments`)
        .set('Authorization', `Bearer ${devToken}`)
        .send({ content: 'This is a test comment by dev1' });

      expect(res.status).toBe(200);
      expect(res.body.data.content).toBe('This is a test comment by dev1');
      expect(res.body.data.authorId).toBe(devUserId);
      commentId = res.body.data.id;
    });

    it('should show the comment in task details', async () => {
      const res = await request(app)
        .get(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${devToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.comments).toBeDefined();
      expect(res.body.data.comments.length).toBe(1);
      expect(res.body.data.comments[0].content).toBe('This is a test comment by dev1');
      expect(res.body.data.comments[0].author.name).toBeDefined();
    });

    it('should prevent non-author and non-PM/Admin from deleting comment', async () => {
      const res = await request(app)
        .delete(`/api/tasks/comments/${commentId}`)
        .set('Authorization', `Bearer ${dev2Token}`);

      expect(res.status).toBe(403);
    });

    it('should allow the author to delete the comment', async () => {
      const res = await request(app)
        .delete(`/api/tasks/comments/${commentId}`)
        .set('Authorization', `Bearer ${devToken}`);

      expect(res.status).toBe(200);

      // Verify it is gone
      const detailsRes = await request(app)
        .get(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${devToken}`);
      expect(detailsRes.body.data.comments.length).toBe(0);
    });
  });

  describe('Links API', () => {
    it('should add a link to a task', async () => {
      const res = await request(app)
        .post(`/api/tasks/${taskId}/links`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          url: 'https://github.com/GoogleDeepMind',
          title: 'Google DeepMind Github',
          type: 'DOCUMENTATION'
        });

      expect(res.status).toBe(200);
      expect(res.body.data.url).toBe('https://github.com/GoogleDeepMind');
      expect(res.body.data.title).toBe('Google DeepMind Github');
      linkId = res.body.data.id;
    });

    it('should display the link in task details', async () => {
      const res = await request(app)
        .get(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${devToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.links).toBeDefined();
      expect(res.body.data.links.length).toBe(1);
      expect(res.body.data.links[0].url).toBe('https://github.com/GoogleDeepMind');
    });

    it('should allow deleting the link', async () => {
      const res = await request(app)
        .delete(`/api/tasks/links/${linkId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);

      // Verify link is gone
      const detailsRes = await request(app)
        .get(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${devToken}`);
      expect(detailsRes.body.data.links.length).toBe(0);
    });
  });
});
