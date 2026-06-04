import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../shared/api.js';
import { useAuth } from '../../shared/AuthContext.js';
import { useI18n } from '../../shared/I18nContext.js';
import type { Project, Task, ProjectMember, TaskStatus } from '../../types/index.js';
import { TaskDetailsDialog } from '../kanban/TaskDetailsDialog.js';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
  Paper,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  Avatar,
  Chip,
  Divider,
  Button,
} from '@mui/material';
import {
  AccessTime as AccessTimeIcon,
  CheckCircleOutlined as CheckIcon,
  FormatListBulleted as ListIcon,
  WarningAmber as WarningIcon,
  AssignmentInd as AssignmentIcon,
  HourglassEmpty as HourglassIcon,
} from '@mui/icons-material';

// Priorities details colors
const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'CRITICAL': return { bg: 'rgba(239, 68, 68, 0.15)', color: '#f87171' };
    case 'HIGH': return { bg: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' };
    case 'MEDIUM': return { bg: 'rgba(99, 102, 241, 0.15)', color: '#818cf8' };
    case 'LOW': return { bg: 'rgba(148, 163, 184, 0.15)', color: '#cbd5e1' };
    default: return { bg: 'rgba(255,255,255,0.05)', color: '#ffffff' };
  }
};

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { t } = useI18n();
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  
  // Dialog state for opening tasks directly from dashboard
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);

  // 1. Fetch user projects
  const { data: projectsRes, isLoading: loadingProjects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get('/api/projects').then((res) => res.data),
  });
  const projects: Project[] = projectsRes?.data || [];

  // Default select first project when loaded
  useEffect(() => {
    if (projects.length > 0 && !selectedProjectId) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  // 2. Fetch project details (for member list)
  const { data: projectDetailsRes } = useQuery({
    queryKey: ['project', selectedProjectId],
    queryFn: () => api.get(`/api/projects/${selectedProjectId}`).then((res) => res.data),
    enabled: !!selectedProjectId,
  });
  const projectDetails = projectDetailsRes?.data;
  const projectMembers: ProjectMember[] = projectDetails?.members || [];

  // 3. Fetch task statuses
  const { data: statusesRes } = useQuery({
    queryKey: ['statuses'],
    queryFn: () => api.get('/api/tasks/statuses').then((res) => res.data),
  });
  const statuses: TaskStatus[] = statusesRes?.data || [];

  // 4. Fetch tasks
  const { data: tasksRes, isLoading: loadingTasks } = useQuery({
    queryKey: ['tasksDashboard', selectedProjectId],
    queryFn: () => api.get('/api/tasks', { params: { projectId: selectedProjectId, limit: 100 } }).then((res) => res.data),
    enabled: !!selectedProjectId,
  });
  const tasks: Task[] = tasksRes?.data || [];

  // 5. Fetch activities
  const { data: activitiesRes, isLoading: loadingActivities } = useQuery({
    queryKey: ['projectActivities', selectedProjectId],
    queryFn: () => api.get(`/api/projects/${selectedProjectId}/activities`, { params: { limit: 10 } }).then((res) => res.data),
    enabled: !!selectedProjectId,
  });
  const activities = activitiesRes?.data || [];

  // Calculations

  const completedTasks = tasks.filter((t) => t.statusKey === 'DONE').length;
  const activeTasks = tasks.filter((t) => t.statusKey !== 'DONE').length;
  const totalHoursLogged = tasks.reduce((sum, t) => sum + (t.actualHours || 0), 0);

  const overdueTasksList = tasks.filter((t) => {
    if (t.statusKey === 'DONE' || !t.dueDate) return false;
    return new Date(t.dueDate) < new Date();
  });
  const overdueCount = overdueTasksList.length;

  const urgentTasks = tasks
    .filter((t) => t.statusKey !== 'DONE' && (t.priority === 'CRITICAL' || t.priority === 'HIGH'))
    .slice(0, 5);

  const myTasks = tasks
    .filter((t) => t.statusKey !== 'DONE' && t.assigneeId === user?.id)
    .slice(0, 5);

  // Workload data
  const memberWorkload = projectMembers.map((m) => {
    const assigned = tasks.filter((t) => t.assigneeId === m.user.id && t.statusKey !== 'DONE');
    const estimatedHours = assigned.reduce((sum, t) => sum + (t.estimatedHours || 0), 0);
    return {
      userId: m.user.id,
      name: m.user.name,
      taskCount: assigned.length,
      hours: estimatedHours,
    };
  });

  const maxWorkloadHours = Math.max(...memberWorkload.map((mw) => mw.hours), 1);

  const handleOpenTask = (taskId: string) => {
    setSelectedTaskId(taskId);
    setDetailsDialogOpen(true);
  };

  return (
    <Box sx={{ pb: 6 }}>
      {/* Header Selector */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4, flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
          {t('dashboard.title')}
        </Typography>

        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel id="project-select-label">{t('dashboard.activeProject')}</InputLabel>
          {loadingProjects ? (
            <CircularProgress size={20} sx={{ m: 1 }} />
          ) : (
            <Select
              labelId="project-select-label"
              id="project-select"
              value={selectedProjectId}
              label={t('dashboard.activeProject')}
              onChange={(e) => setSelectedProjectId(e.target.value)}
            >
              {projects.map((proj) => (
                <MenuItem key={proj.id} value={proj.id}>
                  {proj.name} ({proj.key})
                </MenuItem>
              ))}
            </Select>
          )}
        </FormControl>
      </Box>

      {loadingTasks ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 8 }}>
          <CircularProgress />
        </Box>
      ) : !selectedProjectId ? (
        <Alert severity="info">{t('dashboard.selectProject')}</Alert>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {/* Summary Stat Cards */}
          <Grid container spacing={3}>
            {/* Active Tasks */}
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card className="glass-card" sx={{ position: 'relative', overflow: 'hidden' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box>
                      <Typography color="text.secondary" variant="subtitle2" sx={{ fontWeight: 600 }} gutterBottom>
                        {t('dashboard.activeTasks')}
                      </Typography>
                      <Typography variant="h3" sx={{ fontWeight: 800 }}>
                        {activeTasks}
                      </Typography>
                    </Box>
                    <Avatar sx={{ bgcolor: 'rgba(99, 102, 241, 0.15)', color: 'primary.main' }}>
                      <ListIcon />
                    </Avatar>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Completed Tasks */}
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card className="glass-card">
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box>
                      <Typography color="text.secondary" variant="subtitle2" sx={{ fontWeight: 600 }} gutterBottom>
                        {t('dashboard.completedTasks')}
                      </Typography>
                      <Typography variant="h3" sx={{ fontWeight: 800, color: 'success.main' }}>
                        {completedTasks}
                      </Typography>
                    </Box>
                    <Avatar sx={{ bgcolor: 'rgba(52, 211, 153, 0.15)', color: 'success.main' }}>
                      <CheckIcon />
                    </Avatar>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Hours Logged */}
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card className="glass-card">
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box>
                      <Typography color="text.secondary" variant="subtitle2" sx={{ fontWeight: 600 }} gutterBottom>
                        {t('dashboard.loggedHours')}
                      </Typography>
                      <Typography variant="h3" sx={{ fontWeight: 800, color: 'info.main' }}>
                        {totalHoursLogged.toFixed(1)}
                      </Typography>
                    </Box>
                    <Avatar sx={{ bgcolor: 'rgba(96, 165, 250, 0.15)', color: 'info.main' }}>
                      <AccessTimeIcon />
                    </Avatar>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Overdue Tasks */}
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card className="glass-card" sx={{ border: overdueCount > 0 ? '1px solid rgba(239, 68, 68, 0.2)' : 'inherit' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box>
                      <Typography color="text.secondary" variant="subtitle2" sx={{ fontWeight: 600 }} gutterBottom>
                        {t('dashboard.overdueTasks')}
                      </Typography>
                      <Typography variant="h3" sx={{ fontWeight: 800, color: overdueCount > 0 ? 'error.main' : 'text.primary' }}>
                        {overdueCount}
                      </Typography>
                    </Box>
                    <Avatar sx={{ bgcolor: overdueCount > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255,255,255,0.05)', color: overdueCount > 0 ? 'error.main' : 'text.secondary' }}>
                      <WarningIcon />
                    </Avatar>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Main Widgets row */}
          <Grid container spacing={3}>
            {/* Left Side (My Tasks & Urgent Tasks) */}
            <Grid size={{ xs: 12, md: 7 }} sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {/* My Tasks */}
              <Paper className="glass-panel" sx={{ p: 3, borderRadius: 3 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AssignmentIcon color="primary" /> {t('dashboard.myTasks')}
                </Typography>
                {myTasks.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                    {t('dashboard.noTasks')}
                  </Typography>
                ) : (
                  <List disablePadding>
                    {myTasks.map((task) => (
                      <React.Fragment key={task.id}>
                        <ListItem
                          sx={{
                            px: 0.5,
                            py: 1.5,
                            cursor: 'pointer',
                            '&:hover': { bgcolor: 'rgba(255,255,255,0.01)' },
                            borderRadius: 1,
                          }}
                          onClick={() => handleOpenTask(task.id)}
                        >
                          <ListItemText
                            primary={
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                <Chip label={task.taskKey} size="small" variant="outlined" sx={{ fontWeight: 700, borderColor: 'primary.main', color: 'primary.main', height: 20 }} />
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>{task.title}</Typography>
                              </Box>
                            }
                            secondary={
                              <Box sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
                                <Chip label={task.priority} size="small" sx={{ height: 16, fontSize: '0.6rem', ...getPriorityColor(task.priority) }} />
                                <Typography variant="caption" color="text.secondary">{t('dashboard.taskWorkload', { estimate: task.estimatedHours || 0, logged: task.actualHours })}</Typography>
                              </Box>
                            }
                          />
                        </ListItem>
                        <Divider />
                      </React.Fragment>
                    ))}
                  </List>
                )}
              </Paper>

              {/* Urgent Tasks */}
              <Paper className="glass-panel" sx={{ p: 3, borderRadius: 3 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <WarningIcon color="error" /> {t('dashboard.urgentTasks')}
                </Typography>
                {urgentTasks.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                    {t('dashboard.noUrgentTasks')}
                  </Typography>
                ) : (
                  <List disablePadding>
                    {urgentTasks.map((task) => (
                      <React.Fragment key={task.id}>
                        <ListItem
                          sx={{
                            px: 0.5,
                            py: 1.5,
                            cursor: 'pointer',
                            '&:hover': { bgcolor: 'rgba(255,255,255,0.01)' },
                            borderRadius: 1,
                          }}
                          onClick={() => handleOpenTask(task.id)}
                        >
                          <ListItemText
                            primary={
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                <Chip label={task.taskKey} size="small" sx={{ fontWeight: 700, ...getPriorityColor(task.priority), height: 20 }} />
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>{task.title}</Typography>
                              </Box>
                            }
                            secondary={
                              <Box sx={{ display: 'flex', gap: 1, mt: 0.5, alignItems: 'center' }}>
                                <Typography variant="caption" color="text.secondary">
                                  {t('dashboard.assigneeLabel', { name: task.assignee?.name || 'Unassigned' })}
                                </Typography>
                                {task.dueDate && (
                                  <Typography variant="caption" sx={{ color: new Date(task.dueDate) < new Date() ? 'error.main' : 'text.secondary', fontWeight: 600 }}>
                                    • {t('dashboard.dueLabel', { date: new Date(task.dueDate).toLocaleDateString() })}
                                  </Typography>
                                )}
                              </Box>
                            }
                          />
                        </ListItem>
                        <Divider />
                      </React.Fragment>
                    ))}
                  </List>
                )}
              </Paper>
            </Grid>

            {/* Right Side (Workload & Recent Activities) */}
            <Grid size={{ xs: 12, md: 5 }} sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {/* Workload */}
              <Paper className="glass-panel" sx={{ p: 3, borderRadius: 3 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 3 }}>
                  {t('dashboard.workloadDistribution')}
                </Typography>
                {memberWorkload.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    {t('dashboard.noMembers')}
                  </Typography>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                    {memberWorkload.map((mw) => {
                      const percentage = (mw.hours / maxWorkloadHours) * 100;
                      return (
                        <Box key={mw.userId}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>{mw.name}</Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                              {t('dashboard.workloadActive', { hours: mw.hours, count: mw.taskCount })}
                            </Typography>
                          </Box>
                          <LinearProgress
                            variant="determinate"
                            value={percentage}
                            sx={{
                              height: 8,
                              borderRadius: 4,
                              bgcolor: 'rgba(255,255,255,0.05)',
                              '& .MuiLinearProgress-bar': {
                                borderRadius: 4,
                                bgcolor: percentage > 80 ? 'error.main' : percentage > 50 ? 'warning.main' : 'primary.main',
                              },
                            }}
                          />
                        </Box>
                      );
                    })}
                  </Box>
                )}
              </Paper>

              {/* Recent Activity stream */}
              <Paper className="glass-panel" sx={{ p: 3, borderRadius: 3 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <HourglassIcon color="primary" /> {t('dashboard.recentActivity')}
                </Typography>
                {loadingActivities ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress size={24} />
                  </Box>
                ) : activities.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                    {t('dashboard.noActivity')}
                  </Typography>
                ) : (
                  <List disablePadding>
                    {activities.map((act: any) => (
                      <React.Fragment key={act.id}>
                        <ListItem sx={{ px: 0.5, py: 1.5 }}>
                          <ListItemText
                            primary={
                              <Typography variant="body2" sx={{ fontSize: '0.825rem' }}>
                                <strong>{act.user?.name}</strong> {act.action}{' '}
                                {act.details && <span style={{ opacity: 0.8 }}>({act.details})</span>}
                              </Typography>
                            }
                            secondary={
                              <Box sx={{ display: 'flex', gap: 1, mt: 0.5, alignItems: 'center' }}>
                                <Button
                                  variant="text"
                                  onClick={() => handleOpenTask(act.task.id)}
                                  sx={{
                                    p: 0,
                                    fontSize: '0.7rem',
                                    fontWeight: 700,
                                    minWidth: 0,
                                    textTransform: 'none',
                                    color: 'primary.main',
                                  }}
                                >
                                  {act.task.taskKey}
                                </Button>
                                <Typography variant="caption" color="text.secondary">
                                  • {new Date(act.createdAt).toLocaleTimeString()}
                                </Typography>
                              </Box>
                            }
                          />
                        </ListItem>
                        <Divider />
                      </React.Fragment>
                    ))}
                  </List>
                )}
              </Paper>
            </Grid>
          </Grid>
        </Box>
      )}

      {/* Task Details Dialog Modal inside Dashboard */}
      {selectedTaskId && (
        <TaskDetailsDialog
          open={detailsDialogOpen}
          onClose={() => {
            setDetailsDialogOpen(false);
            setSelectedTaskId(null);
          }}
          taskId={selectedTaskId}
          projectId={selectedProjectId}
          projectMembers={projectMembers}
          statuses={statuses}
        />
      )}
    </Box>
  );
};
export default DashboardPage;
