import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // 1. Seed Feature Flags
  console.log('Seeding Feature Flags...');
  const flags = [
    { key: 'S3_STORAGE', enabled: false, description: 'Enable AWS S3 file storage upload layer' },
    { key: 'EMAIL_NOTIFICATIONS', enabled: false, description: 'Enable email message dispatching' },
    { key: 'AI_ASSISTANT', enabled: false, description: 'Enable AI task automation assistant' },
    { key: 'WEBHOOKS', enabled: false, description: 'Enable webhook delivery events' },
  ];

  for (const flag of flags) {
    await prisma.featureFlag.upsert({
      where: { key: flag.key },
      update: {},
      create: flag,
    });
  }

  // 2. Seed Task Statuses
  console.log('Seeding Task Statuses...');
  const statuses = [
    { key: 'BACKLOG', name: 'Backlog', color: '#7F8C8D', position: 0, protected: true },
    { key: 'TODO', name: 'To Do', color: '#3498DB', position: 1, protected: true },
    { key: 'IN_PROGRESS', name: 'In Progress', color: '#F39C12', position: 2, protected: true },
    { key: 'REVIEW', name: 'In Review', color: '#9B59B6', position: 3, protected: true },
    { key: 'DONE', name: 'Done', color: '#2ECC71', position: 4, protected: true },
  ];

  for (const status of statuses) {
    await prisma.taskStatus.upsert({
      where: { key: status.key },
      update: { name: status.name, color: status.color, position: status.position, protected: status.protected },
      create: status,
    });
  }

  // 3. Seed Task Transition Rules
  console.log('Seeding Task Transition Rules...');
  // Define default workflow flow transitions
  const roles: Role[] = [Role.ADMIN, Role.PROJECT_MANAGER, Role.DEVELOPER];
  const keys = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'];

  for (const role of roles) {
    for (const from of keys) {
      for (const to of keys) {
        if (from === to) continue;
        
        // Developer restrictions: Developer cannot move tasks directly to DONE from Backlog, or move from DONE to BACKLOG
        if (role === Role.DEVELOPER) {
          const isValidDevTransition =
            (from === 'BACKLOG' && to === 'TODO') ||
            (from === 'TODO' && to === 'IN_PROGRESS') ||
            (from === 'IN_PROGRESS' && to === 'TODO') ||
            (from === 'IN_PROGRESS' && to === 'REVIEW') ||
            (from === 'REVIEW' && to === 'IN_PROGRESS') ||
            (from === 'REVIEW' && to === 'DONE') ||
            (from === 'DONE' && to === 'IN_PROGRESS'); // Reopen task
          if (!isValidDevTransition) continue;
        }

        await prisma.taskTransitionRule.upsert({
          where: {
            fromStatus_toStatus_roleAllowed: {
              fromStatus: from,
              toStatus: to,
              roleAllowed: role,
            },
          },
          update: {},
          create: {
            fromStatus: from,
            toStatus: to,
            roleAllowed: role,
          },
        });
      }
    }
  }

  // 4. Seed Users (Admin & Demo accounts)
  console.log('Seeding Users...');
  const saltRounds = 12;
  const adminPasswordHash = await bcrypt.hash('admin12345', saltRounds);
  const pmPasswordHash = await bcrypt.hash('pm12345', saltRounds);
  const devPasswordHash = await bcrypt.hash('dev12345', saltRounds);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@localhost' },
    update: {},
    create: {
      email: 'admin@localhost',
      name: 'System Admin',
      passwordHash: adminPasswordHash,
      role: Role.ADMIN,
      active: true,
      changePasswordOnFirstLogin: true,
    },
  });

  const pm = await prisma.user.upsert({
    where: { email: 'pm@localhost' },
    update: {},
    create: {
      email: 'pm@localhost',
      name: 'Project Manager Netanel',
      passwordHash: pmPasswordHash,
      role: Role.PROJECT_MANAGER,
      active: true,
      changePasswordOnFirstLogin: false,
    },
  });

  const dev1 = await prisma.user.upsert({
    where: { email: 'dev1@localhost' },
    update: {},
    create: {
      email: 'dev1@localhost',
      name: 'Developer Evyatar',
      passwordHash: devPasswordHash,
      role: Role.DEVELOPER,
      active: true,
      changePasswordOnFirstLogin: false,
    },
  });

  const dev2 = await prisma.user.upsert({
    where: { email: 'dev2@localhost' },
    update: {},
    create: {
      email: 'dev2@localhost',
      name: 'Developer David',
      passwordHash: devPasswordHash,
      role: Role.DEVELOPER,
      active: true,
      changePasswordOnFirstLogin: false,
    },
  });

  // 5. Seed Demo Project & Members
  console.log('Seeding Demo Project...');
  const project = await prisma.project.upsert({
    where: { key: 'DEMO' },
    update: {},
    create: {
      name: 'Demo Project Board',
      key: 'DEMO',
      description: 'Initial demonstration board workspace to verify workflow setups.',
    },
  });

  // Create Project Counter if not exists
  await prisma.projectCounter.upsert({
    where: { projectId: project.id },
    update: {},
    create: {
      projectId: project.id,
      lastNumber: 0,
    },
  });

  console.log('Linking Members to Project...');
  const users = [admin, pm, dev1, dev2];
  for (const user of users) {
    await prisma.projectMember.upsert({
      where: {
        projectId_userId: {
          projectId: project.id,
          userId: user.id,
        },
      },
      update: {},
      create: {
        projectId: project.id,
        userId: user.id,
      },
    });
  }

  console.log('Database seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
