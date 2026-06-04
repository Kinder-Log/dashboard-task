import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.ts';

describe('Project and Task Integration Tests', () => {
  let adminToken = '';
  let devToken = '';
  let devUserId = '';
  let projectId = '';
  let taskId = '';
  let taskVersion = 1;

  it('should authenticate users and fetch tokens', async () => {
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
    devUserId = devRes.body.data.user.id;
  });

  const projectKey = 'MOB' + Math.floor(Math.random() * 10000);

  it('should create a project successfully as Admin', async () => {
    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Mobile App Project',
        key: projectKey,
        description: 'React Native app board',
      });

    expect(res.status).toBe(211);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.key).toBe(projectKey);

    projectId = res.body.data.id;
  });

  it('should add developer user to the new project', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/members`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: devUserId });

    expect(res.status).toBe(200);
    expect(res.body.data.message).toContain('Member added');
  });

  it('should block non-members from listing tasks of this project', async () => {
    // dev2@example.com is not a member of MOB project
    const dev2Res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'dev2@example.com', password: 'dev12345' });
    const dev2Token = dev2Res.body.data.accessToken;

    const res = await request(app)
      .get(`/api/tasks?projectId=${projectId}`)
      .set('Authorization', `Bearer ${dev2Token}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('should create a task inside the project', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Implement login screen',
        description: 'Use custom hooks',
        projectId: projectId,
        type: 'FEATURE',
        priority: 'HIGH',
        estimatedHours: 5,
        dueDate: new Date(Date.now() + 86400000).toISOString(),
      });

    expect(res.status).toBe(211);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.taskKey).toBe(`${projectKey}-1`); // Key calculation check (first task in MOB)

    taskId = res.body.data.id;
    taskVersion = res.body.data.version;
  });

  it('should allow assignee developer to partially edit description', async () => {
    // 1. Assign to dev user (Admin action)
    await request(app)
      .patch(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        assigneeId: devUserId,
        version: taskVersion,
      });
      
    // Version incremented to 2
    taskVersion = 2;

    // 2. Edit description as dev
    const res = await request(app)
      .patch(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${devToken}`)
      .send({
        description: 'Updated description from dev user',
        version: taskVersion,
      });

    expect(res.status).toBe(200);
    expect(res.body.data.description).toBe('Updated description from dev user');
    taskVersion = res.body.data.version; // Should be 3 now
  });

  it('should prevent developer from editing task fields like estimated hours', async () => {
    const res = await request(app)
      .patch(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${devToken}`)
      .send({
        estimatedHours: 10,
        version: taskVersion,
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('should deny task deletion to developer user', async () => {
    const res = await request(app)
      .delete(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${devToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('should archive task successfully as Admin (soft delete)', async () => {
    const res = await request(app)
      .delete(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.message).toContain('archived');

    // Verify it is not listed anymore in active tasks
    const listRes = await request(app)
      .get(`/api/tasks?projectId=${projectId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(listRes.body.data.length).toBe(0);
  });

  it('should deny project deletion to developer user', async () => {
    const res = await request(app)
      .delete(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${devToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('should delete project successfully as Admin', async () => {
    const res = await request(app)
      .delete(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.message).toContain('deleted');

    // Verify project details returns 404
    const detailsRes = await request(app)
      .get(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(detailsRes.status).toBe(404);
  });
});
