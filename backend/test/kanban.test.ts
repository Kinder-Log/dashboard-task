import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.ts';

describe('Kanban Concurrency & Transition Tests', () => {
  let adminToken = '';
  let devToken = '';
  let devUserId = '';
  let projectId = '';
  let taskId = '';
  let taskVersion = 1;

  const kanbanProjectKey = 'KAN' + Math.floor(Math.random() * 10000);

  it('should login users and set up project', async () => {
    // Logins
    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@example.com', password: 'admin12345' });
    adminToken = adminRes.body.data.accessToken;

    const devRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'dev1@example.com', password: 'dev12345' });
    devToken = devRes.body.data.accessToken;
    devUserId = devRes.body.data.user.id;

    // Create Project
    const projRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Kanban Board Test', key: kanbanProjectKey });
    projectId = projRes.body.data.id;

    // Add dev to project
    await request(app)
      .post(`/api/projects/${projectId}/members`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: devUserId });
  });

  it('should create a task in BACKLOG status', async () => {
    // Wait, in taskService, createTask defaults statusKey to 'TODO'.
    // Let's create a task, and then move it to BACKLOG as Admin to prepare for tests.
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Draft board layouts',
        projectId: projectId,
        type: 'RESEARCH',
        priority: 'MEDIUM',
      });

    expect(res.status).toBe(211);
    taskId = res.body.data.id;
    taskVersion = res.body.data.version;

    // Move to BACKLOG
    const backlogRes = await request(app)
      .patch(`/api/tasks/${taskId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ statusKey: 'BACKLOG', version: taskVersion });

    expect(backlogRes.status).toBe(200);
    taskVersion = backlogRes.body.data.version; // Incremented
  });

  it('should deny transition from BACKLOG to DONE directly for Developer role', async () => {
    // 1. Assign task to Developer (Admin action)
    const assignRes = await request(app)
      .patch(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ assigneeId: devUserId, version: taskVersion });
    taskVersion = assignRes.body.data.version;

    // 2. Try transition BACKLOG -> DONE (Should fail: Developer transition rule restriction)
    const res = await request(app)
      .patch(`/api/tasks/${taskId}/status`)
      .set('Authorization', `Bearer ${devToken}`)
      .send({ statusKey: 'DONE', version: taskVersion });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_STATUS_TRANSITION');
  });

  it('should allow transition from BACKLOG to TODO for Developer', async () => {
    const res = await request(app)
      .patch(`/api/tasks/${taskId}/status`)
      .set('Authorization', `Bearer ${devToken}`)
      .send({ statusKey: 'TODO', version: taskVersion });

    expect(res.status).toBe(200);
    expect(res.body.data.statusKey).toBe('TODO');
    taskVersion = res.body.data.version;
  });

  it('should trigger 409 Conflict when updating status with outdated task version', async () => {
    // Currently, task version in database is taskVersion.
    // User A updates status to IN_PROGRESS sending current taskVersion
    const resA = await request(app)
      .patch(`/api/tasks/${taskId}/status`)
      .set('Authorization', `Bearer ${devToken}`)
      .send({ statusKey: 'IN_PROGRESS', version: taskVersion });

    expect(resA.status).toBe(200);
    const updatedVersion = resA.body.data.version;

    // User B sends old taskVersion trying to update to REVIEW (Should result in 409 Conflict)
    const resB = await request(app)
      .patch(`/api/tasks/${taskId}/status`)
      .set('Authorization', `Bearer ${devToken}`)
      .send({ statusKey: 'REVIEW', version: taskVersion });

    expect(resB.status).toBe(409);
    expect(resB.body.error.code).toBe('CONFLICT');

    // Sync taskVersion to updatedVersion for subsequent steps
    taskVersion = updatedVersion;
  });
});
