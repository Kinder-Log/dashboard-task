import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.routes.js';
import projectRoutes from './routes/project.routes.js';
import taskRoutes from './routes/task.routes.js';
import { errorHandler } from './middlewares/error.js';
import { authenticateJWT, requireRole } from './middlewares/auth.js';
import { Role } from '@prisma/client';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// CORS setup
const allowedOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
app.use(cors({
  origin: allowedOrigin,
  credentials: true,
}));

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Dynamic routes registration
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);

// Integration test/verification check route
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date() });
});

app.get('/api/test-protected', authenticateJWT, (req, res) => {
  res.json({
    message: 'Access granted to protected route',
    user: req.user,
  });
});

app.get('/api/test-admin', authenticateJWT, requireRole([Role.ADMIN]), (req, res) => {
  res.json({
    message: 'Access granted to admin-only route',
    user: req.user,
  });
});

// Global error handler
app.use(errorHandler);

// Start server
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`[Jira Server] running on http://localhost:${PORT}`);
  });
}

export default app;
