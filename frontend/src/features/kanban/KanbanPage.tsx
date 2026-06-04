import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import type { DropResult } from '@hello-pangea/dnd';
import { useAuth } from '../../shared/AuthContext.js';
import { useI18n } from '../../shared/I18nContext.js';
import { api } from '../../shared/api.js';
import type { Project, Task, TaskStatus, TaskType, TaskPriority } from '../../types/index.js';
import { TaskDetailsDialog } from './TaskDetailsDialog.js';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  TextField,
  Avatar,
  AvatarGroup,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Chip,
  Divider,
  IconButton,
  Tooltip,
  Paper,
  InputAdornment,
  Alert,
  Snackbar,
} from '@mui/material';
import {
  Search as SearchIcon,
  Add as AddIcon,
  Refresh as RefreshIcon,
  AccessTime as AccessTimeIcon,
} from '@mui/icons-material';

// Helper to HSL map task priorities
const getPriorityColor = (priority: TaskPriority) => {
  switch (priority) {
    case 'CRITICAL': return { bg: 'rgba(239, 68, 68, 0.15)', color: '#f87171' };
    case 'HIGH': return { bg: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' };
    case 'MEDIUM': return { bg: 'rgba(99, 102, 241, 0.15)', color: '#818cf8' };
    case 'LOW': return { bg: 'rgba(148, 163, 184, 0.15)', color: '#cbd5e1' };
  }
};

const getTypeLabelColor = (type: TaskType) => {
  switch (type) {
    case 'BUG': return '#f87171';
    case 'FEATURE': return '#34d399';
    case 'RESEARCH': return '#60a5fa';
    case 'MAINTENANCE': return '#fbbf24';
    default: return '#cbd5e1';
  }
};

export const KanbanPage: React.FC = () => {
  const { user } = useAuth();
  const { t } = useI18n();
  const queryClient = useQueryClient();

  // App States
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('ALL');
  const [filterPriority, setFilterPriority] = useState('ALL');
  const [filterType, setFilterType] = useState('ALL');
  
  // Modals / Alerts
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastSeverity, setToastSeverity] = useState<'success' | 'error' | 'warning'>('success');

  // Detail Modal States
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);

  const handleCardClick = (taskId: string) => {
    setSelectedTaskId(taskId);
    setDetailsDialogOpen(true);
  };

  // Form States for task creation
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newType, setNewType] = useState<TaskType>('FEATURE');
  const [newPriority, setNewPriority] = useState<TaskPriority>('MEDIUM');
  const [newAssigneeId, setNewAssigneeId] = useState('');
  const [newEstHours, setNewEstHours] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

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
  const projectMembers = projectDetails?.members || [];

  // 3. Fetch task statuses
  const { data: statusesRes, isLoading: loadingStatuses } = useQuery({
    queryKey: ['statuses'],
    queryFn: () => api.get('/api/tasks/statuses').then((res) => res.data),
  });
  const statuses: TaskStatus[] = statusesRes?.data || [];

  // 4. Fetch tasks
  const { data: tasksRes, isLoading: loadingTasks, isRefetching: refetchingTasks } = useQuery({
    queryKey: ['tasks', selectedProjectId],
    queryFn: () => api.get('/api/tasks', { params: { projectId: selectedProjectId } }).then((res) => res.data),
    enabled: !!selectedProjectId,
  });
  const tasks: Task[] = tasksRes?.data || [];

  // Drag and drop mutation
  const dragMutation = useMutation({
    mutationFn: ({ taskId, statusKey, version }: { taskId: string; statusKey: string; version: number }) =>
      api.patch(`/api/tasks/${taskId}/status`, { statusKey, version }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', selectedProjectId] });
      setToastSeverity('success');
      setToastMessage(t('kanban.taskStatusUpdated'));
    },
    onError: (err: any) => {
      if (err.response?.status === 409) {
        setToastSeverity('error');
        setToastMessage(t('kanban.concurrencyError'));
        queryClient.invalidateQueries({ queryKey: ['tasks', selectedProjectId] });
      } else {
        setToastSeverity('error');
        setToastMessage(err.response?.data?.error?.message || t('kanban.statusUpdateFailed'));
      }
    },
  });

  // Task creation mutation
  const createMutation = useMutation({
    mutationFn: (taskData: any) => api.post('/api/tasks', taskData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', selectedProjectId] });
      setCreateDialogOpen(false);
      resetCreateForm();
      setToastSeverity('success');
      setToastMessage(t('kanban.taskCreatedSuccessfully'));
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.error?.message || t('kanban.taskCreationFailed'));
    },
  });

  const resetCreateForm = () => {
    setNewTitle('');
    setNewDescription('');
    setNewType('FEATURE');
    setNewPriority('MEDIUM');
    setNewAssigneeId('');
    setNewEstHours('');
    setNewDueDate('');
    setFormError(null);
  };

  const handleCreateTaskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      setFormError(t('kanban.titleRequired'));
      return;
    }

    const payload: any = {
      title: newTitle,
      description: newDescription.trim() || undefined,
      projectId: selectedProjectId,
      type: newType,
      priority: newPriority,
      assigneeId: newAssigneeId || undefined,
      estimatedHours: newEstHours ? parseFloat(newEstHours) : undefined,
      dueDate: newDueDate ? new Date(newDueDate).toISOString() : undefined,
    };

    createMutation.mutate(payload);
  };

  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;

    // If position and status did not change, exit
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    const targetTask = tasks.find((t) => t.id === draggableId);
    if (!targetTask) return;

    // Apply optimistic updates immediately
    
    // Invalidate local client state optimistically
    const updatedTasks = tasks.map((t) => {
      if (t.id === draggableId) {
        return { ...t, statusKey: destination.droppableId };
      }
      return t;
    });
    queryClient.setQueryData(['tasks', selectedProjectId], { data: updatedTasks });

    dragMutation.mutate({
      taskId: draggableId,
      statusKey: destination.droppableId,
      version: targetTask.version,
    });
  };

  // Perform Local Client Filters
  const filteredTasks = tasks.filter((task) => {
    const matchesSearch =
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (task.description && task.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      task.taskKey.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesAssignee = filterAssignee === 'ALL' || task.assigneeId === filterAssignee;
    const matchesPriority = filterPriority === 'ALL' || task.priority === filterPriority;
    const matchesType = filterType === 'ALL' || task.type === filterType;

    return matchesSearch && matchesAssignee && matchesPriority && matchesType;
  });

  const canCreateTasks = user?.role === 'ADMIN' || user?.role === 'PROJECT_MANAGER';

  return (
    <Box sx={{ pb: 6 }}>
      {/* 1. Header Board Section */}
      <Paper 
        className="glass-panel" 
        sx={{ 
          p: 3, 
          mb: 4, 
          borderRadius: 3, 
          boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.2)' 
        }}
      >
        <Grid container spacing={2} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <Grid size={{ xs: 12, md: 4 }} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <FormControl fullWidth size="small" variant="outlined">
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

            <Tooltip title="Force Refresh Tasks">
              <IconButton 
                onClick={() => queryClient.invalidateQueries({ queryKey: ['tasks', selectedProjectId] })}
                disabled={!selectedProjectId || loadingTasks || refetchingTasks}
              >
                {refetchingTasks ? <CircularProgress size={20} /> : <RefreshIcon />}
              </IconButton>
            </Tooltip>
          </Grid>

          <Grid size={{ xs: 12, md: 8 }} sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, flexWrap: 'wrap' }}>
            {/* Show avatar group of members */}
            {projectMembers.length > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', mr: 2 }}>
                <AvatarGroup max={4}>
                  {projectMembers.map((m: any) => (
                    <Tooltip key={m.user.id} title={`${m.user.name} (${m.user.role})`}>
                      <Avatar sx={{ width: 30, height: 30, fontSize: '0.75rem', bgcolor: 'primary.main' }}>
                        {m.user.name.charAt(0).toUpperCase()}
                      </Avatar>
                    </Tooltip>
                  ))}
                </AvatarGroup>
              </Box>
            )}

             {canCreateTasks && (
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setCreateDialogOpen(true)}
                disabled={!selectedProjectId}
              >
                {t('kanban.addTask')}
              </Button>
            )}
          </Grid>
        </Grid>

        <Divider sx={{ my: 2 }} />

        {/* 2. Filters Row */}
        <Grid container spacing={2} sx={{ alignItems: 'center' }}>
          <Grid size={{ xs: 12, sm: 4, md: 3 }}>
            <TextField
              fullWidth
              size="small"
              placeholder={t('kanban.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: 'text.secondary', fontSize: 18 }} />
                    </InputAdornment>
                  ),
                },
              }}
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 8, md: 9 }} sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
            {/* Assignee Filter */}
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel id="filter-assignee-label">{t('kanban.assignee')}</InputLabel>
              <Select
                labelId="filter-assignee-label"
                id="filter-assignee"
                value={filterAssignee}
                label={t('kanban.assignee')}
                onChange={(e) => setFilterAssignee(e.target.value)}
              >
                <MenuItem value="ALL">{t('kanban.allAssignees')}</MenuItem>
                {projectMembers.map((m: any) => (
                  <MenuItem key={m.user.id} value={m.user.id}>
                    {m.user.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Priority Filter */}
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel id="filter-priority-label">{t('kanban.priority')}</InputLabel>
              <Select
                labelId="filter-priority-label"
                id="filter-priority"
                value={filterPriority}
                label={t('kanban.priority')}
                onChange={(e) => setFilterPriority(e.target.value)}
              >
                <MenuItem value="ALL">{t('kanban.allPriorities')}</MenuItem>
                <MenuItem value="CRITICAL">{t('kanban.priority.CRITICAL')}</MenuItem>
                <MenuItem value="HIGH">{t('kanban.priority.HIGH')}</MenuItem>
                <MenuItem value="MEDIUM">{t('kanban.priority.MEDIUM')}</MenuItem>
                <MenuItem value="LOW">{t('kanban.priority.LOW')}</MenuItem>
              </Select>
            </FormControl>

            {/* Type Filter */}
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel id="filter-type-label">{t('kanban.type')}</InputLabel>
              <Select
                labelId="filter-type-label"
                id="filter-type"
                value={filterType}
                label={t('kanban.type')}
                onChange={(e) => setFilterType(e.target.value)}
              >
                <MenuItem value="ALL">{t('kanban.allTypes')}</MenuItem>
                <MenuItem value="FEATURE">{t('kanban.type.FEATURE')}</MenuItem>
                <MenuItem value="BUG">{t('kanban.type.BUG')}</MenuItem>
                <MenuItem value="RESEARCH">{t('kanban.type.RESEARCH')}</MenuItem>
                <MenuItem value="MAINTENANCE">{t('kanban.type.MAINTENANCE')}</MenuItem>
                <MenuItem value="INFRASTRUCTURE">{t('kanban.type.INFRASTRUCTURE')}</MenuItem>
                <MenuItem value="TEST">{t('kanban.type.TEST')}</MenuItem>
              </Select>
            </FormControl>

            {/* Clear Filters Button */}
            {(searchQuery || filterAssignee !== 'ALL' || filterPriority !== 'ALL' || filterType !== 'ALL') && (
              <Button 
                variant="text" 
                size="small" 
                onClick={() => {
                  setSearchQuery('');
                  setFilterAssignee('ALL');
                  setFilterPriority('ALL');
                  setFilterType('ALL');
                }}
              >
                {t('kanban.clearFilters')}
              </Button>
            )}
          </Grid>
        </Grid>
      </Paper>

      {/* 3. Drag Drop Columns Grid */}
      {loadingTasks || loadingStatuses ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 8 }}>
          <CircularProgress />
        </Box>
      ) : !selectedProjectId ? (
        <Alert severity="info">{t('dashboard.selectProject')}</Alert>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Box
            sx={{
              display: 'flex',
              gap: 2.5,
              overflowX: 'auto',
              minHeight: '65vh',
              pb: 2,
              '&::-webkit-scrollbar': { height: 10 },
            }}
          >
            {statuses.map((status) => {
              const statusTasks = filteredTasks.filter((t) => t.statusKey === status.key);
              
              return (
                <Box
                  key={status.key}
                  sx={{
                    flex: '1 0 280px',
                    maxWidth: 320,
                    display: 'flex',
                    flexDirection: 'column',
                    borderRadius: 3,
                    bgcolor: 'rgba(22, 28, 45, 0.4)',
                    border: '1px solid rgba(255, 255, 255, 0.03)',
                    p: 1.5,
                  }}
                >
                  {/* Column Header */}
                  <Box 
                    sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between',
                      mb: 2,
                      px: 0.5 
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: status.color }} />
                      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                        {status.name}
                      </Typography>
                    </Box>
                    <Chip 
                      label={statusTasks.length} 
                      size="small" 
                      sx={{ 
                        fontSize: '0.75rem', 
                        fontWeight: 700,
                        bgcolor: 'rgba(255, 255, 255, 0.05)',
                        color: 'text.secondary' 
                      }} 
                    />
                  </Box>

                  {/* Tasks Droppable container */}
                  <Droppable droppableId={status.key}>
                    {(provided, snapshot) => (
                      <Box
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        sx={{
                          flexGrow: 1,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 1.5,
                          borderRadius: 2,
                          bgcolor: snapshot.isDraggingOver ? 'rgba(99, 102, 241, 0.03)' : 'transparent',
                          transition: 'background-color 0.2s ease',
                          minHeight: 150,
                          pb: 4,
                        }}
                      >
                        {statusTasks.map((task, index) => {
                          const priorityStyle = getPriorityColor(task.priority);
                          
                          return (
                            <Draggable key={task.id} draggableId={task.id} index={index}>
                              {(provided, snapshot) => (
                                <Card
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className="glass-card"
                                  onClick={() => handleCardClick(task.id)}
                                  sx={{
                                    boxShadow: snapshot.isDragging 
                                      ? '0 12px 24px -6px rgba(0, 0, 0, 0.8), 0 0 10px 0 rgba(99, 102, 241, 0.2)' 
                                      : '0 2px 8px -2px rgba(0, 0, 0, 0.3)',
                                    transform: snapshot.isDragging ? 'rotate(2deg) scale(1.02)' : 'none',
                                    border: snapshot.isDragging 
                                      ? '1px solid rgba(99, 102, 241, 0.3) !important'
                                      : '1px solid rgba(255, 255, 255, 0.03) !important',
                                    cursor: 'pointer',
                                    position: 'relative',
                                    transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease',
                                    '&:hover': {
                                      transform: 'translateY(-2px)',
                                      boxShadow: '0 8px 16px -4px rgba(0, 0, 0, 0.5)',
                                      borderColor: 'rgba(255, 255, 255, 0.1) !important',
                                    }
                                  }}
                                >
                                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                        <Typography 
                                          variant="caption" 
                                          sx={{ 
                                            fontWeight: 700, 
                                            color: getTypeLabelColor(task.type),
                                            letterSpacing: '0.05em'
                                          }}
                                        >
                                          {t('kanban.type.' + task.type)}
                                        </Typography>
                                      </Box>
                                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                                        {task.taskKey}
                                      </Typography>
                                    </Box>

                                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5, lineHeight: 1.3 }}>
                                      {task.title}
                                    </Typography>

                                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                      <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center' }}>
                                        <Chip
                                          label={t('kanban.priority.' + task.priority)}
                                          size="small"
                                          sx={{
                                            height: 18,
                                            fontSize: '0.625rem',
                                            fontWeight: 700,
                                            bgcolor: priorityStyle.bg,
                                            color: priorityStyle.color,
                                            borderRadius: 1,
                                            border: 'none',
                                          }}
                                        />

                                        {task.estimatedHours && (
                                          <Tooltip title={t('dashboard.taskWorkload', { estimate: task.estimatedHours, logged: task.actualHours })}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, color: 'text.secondary' }}>
                                              <AccessTimeIcon sx={{ fontSize: 12 }} />
                                              <Typography variant="caption" sx={{ fontSize: '0.65rem', fontWeight: 600 }}>
                                                {task.actualHours}/{task.estimatedHours}h
                                              </Typography>
                                            </Box>
                                          </Tooltip>
                                        )}
                                      </Box>

                                      {task.assignee && (
                                        <Tooltip title={t('dashboard.assigneeLabel', { name: task.assignee.name })}>
                                          <Avatar sx={{ width: 22, height: 22, fontSize: '0.65rem', bgcolor: 'secondary.main', color: '#ffffff' }}>
                                            {task.assignee.name.charAt(0).toUpperCase()}
                                          </Avatar>
                                        </Tooltip>
                                      )}
                                    </Box>
                                  </CardContent>
                                </Card>
                              )}
                            </Draggable>
                          );
                        })}
                        {provided.placeholder}
                      </Box>
                    )}
                  </Droppable>
                </Box>
              );
            })}
          </Box>
        </DragDropContext>
      )}

      {/* 4. Task Creation Dialog (Drawer Modal) */}
      <Dialog 
        open={createDialogOpen} 
        onClose={() => setCreateDialogOpen(false)} 
        fullWidth 
        maxWidth="sm"
        slotProps={{
          paper: {
            className: 'glass-panel',
            sx: {
              backgroundImage: 'none',
              boxShadow: '0 24px 48px -12px rgba(0,0,0,0.8)',
              border: '1px solid rgba(255, 255, 255, 0.08)'
            }
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 800 }}>{t('kanban.createTask')}</DialogTitle>
        <DialogContent>
          <Box component="form" noValidate sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            {formError && (
              <Alert severity="error" sx={{ borderRadius: 2 }}>
                {formError}
              </Alert>
            )}

            <TextField
              autoFocus
              required
              fullWidth
              label={t('kanban.taskTitle')}
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />

            <TextField
              fullWidth
              multiline
              rows={3}
              label={t('kanban.taskDesc')}
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
            />

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormControl fullWidth>
                  <InputLabel id="task-type-label">{t('taskDetails.taskType')}</InputLabel>
                  <Select
                    labelId="task-type-label"
                    value={newType}
                    label={t('taskDetails.taskType')}
                    onChange={(e) => setNewType(e.target.value as TaskType)}
                  >
                    <MenuItem value="FEATURE">{t('kanban.type.FEATURE')}</MenuItem>
                    <MenuItem value="BUG">{t('kanban.type.BUG')}</MenuItem>
                    <MenuItem value="RESEARCH">{t('kanban.type.RESEARCH')}</MenuItem>
                    <MenuItem value="MAINTENANCE">{t('kanban.type.MAINTENANCE')}</MenuItem>
                    <MenuItem value="INFRASTRUCTURE">{t('kanban.type.INFRASTRUCTURE')}</MenuItem>
                    <MenuItem value="TEST">{t('kanban.type.TEST')}</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid size={{ xs: 12, sm: 6 }}>
                <FormControl fullWidth>
                  <InputLabel id="task-priority-label">{t('kanban.priority')}</InputLabel>
                  <Select
                    labelId="task-priority-label"
                    value={newPriority}
                    label={t('kanban.priority')}
                    onChange={(e) => setNewPriority(e.target.value as TaskPriority)}
                  >
                    <MenuItem value="CRITICAL">{t('kanban.priority.CRITICAL')}</MenuItem>
                    <MenuItem value="HIGH">{t('kanban.priority.HIGH')}</MenuItem>
                    <MenuItem value="MEDIUM">{t('kanban.priority.MEDIUM')}</MenuItem>
                    <MenuItem value="LOW">{t('kanban.priority.LOW')}</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormControl fullWidth>
                  <InputLabel id="assignee-select-label">{t('kanban.assignee')}</InputLabel>
                  <Select
                    labelId="assignee-select-label"
                    value={newAssigneeId}
                    label={t('kanban.assignee')}
                    onChange={(e) => setNewAssigneeId(e.target.value)}
                  >
                    <MenuItem value="">{t('kanban.unassigned')}</MenuItem>
                    {projectMembers.map((m: any) => (
                      <MenuItem key={m.user.id} value={m.user.id}>
                        {m.user.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  type="number"
                  label={t('kanban.estimate')}
                  value={newEstHours}
                  onChange={(e) => setNewEstHours(e.target.value)}
                  slotProps={{ htmlInput: { min: 0, step: 0.5 } }}
                />
              </Grid>
            </Grid>

            <TextField
              fullWidth
              type="date"
              label={t('kanban.dueDate')}
              value={newDueDate}
              onChange={(e) => setNewDueDate(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button onClick={() => setCreateDialogOpen(false)} color="inherit">
            {t('kanban.cancel')}
          </Button>
          <Button 
            onClick={handleCreateTaskSubmit} 
            variant="contained" 
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? <CircularProgress size={20} /> : t('kanban.create')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Toast Notification Popup */}
      <Snackbar
        open={Boolean(toastMessage)}
        autoHideDuration={6000}
        onClose={() => setToastMessage(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        {toastMessage ? (
          <Alert 
            onClose={() => setToastMessage(null)} 
            severity={toastSeverity} 
            sx={{ width: '100%', borderRadius: 2, boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}
          >
            {toastMessage}
          </Alert>
        ) : undefined}
      </Snackbar>

      {/* Task Details Dialog Modal */}
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
export default KanbanPage;
