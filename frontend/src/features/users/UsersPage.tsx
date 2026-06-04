import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../shared/api.js';
import { useI18n } from '../../shared/I18nContext.js';
import type { User, TaskStatus, Role, Project } from '../../types/index.js';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Select,
  MenuItem,
  Switch,
  TextField,
  Button,
  Grid,
  Alert,
  Snackbar,
  CircularProgress,
  Avatar,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  IconButton,
} from '@mui/material';
import {
  PersonAdd as PersonAddIcon,
  Settings as SettingsIcon,
  Save as SaveIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
} from '@mui/icons-material';

export const UsersPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const [tabValue, setTabValue] = useState(0);

  // Success/Error notifications
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastSeverity, setToastSeverity] = useState<'success' | 'error'>('success');

  // New User Form States
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<Role>('DEVELOPER');
  const [formError, setFormError] = useState<string | null>(null);

  // Project Form & Management States
  const [projName, setProjName] = useState('');
  const [projKey, setProjKey] = useState('');
  const [projDescription, setProjDescription] = useState('');
  const [projFormError, setProjFormError] = useState<string | null>(null);
  const [projectToDeleteId, setProjectToDeleteId] = useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  // Queries
  const { data: usersRes, isLoading: loadingUsers } = useQuery({
    queryKey: ['adminUsers'],
    queryFn: () => api.get('/api/users').then((res) => res.data),
    enabled: tabValue === 0,
  });
  const users: User[] = usersRes?.data || [];

  const { data: statusesRes, isLoading: loadingStatuses } = useQuery({
    queryKey: ['adminStatuses'],
    queryFn: () => api.get('/api/tasks/statuses/all').then((res) => res.data),
    enabled: tabValue === 1,
  });
  const statuses: TaskStatus[] = statusesRes?.data || [];

  const { data: projectsRes, isLoading: loadingProjects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get('/api/projects').then((res) => res.data),
    enabled: tabValue === 2,
  });
  const projects: Project[] = projectsRes?.data || [];

  // Mutations
  const createUserMutation = useMutation({
    mutationFn: (payload: any) => api.post('/api/users', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      setNewName('');
      setNewEmail('');
      setNewPassword('');
      setNewRole('DEVELOPER');
      setFormError(null);
      setToastSeverity('success');
      setToastMessage(t('users.createdSuccessfully'));
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.error?.message || t('users.creationFailed'));
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ userId, payload }: { userId: string; payload: any }) =>
      api.put(`/api/users/${userId}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      setToastSeverity('success');
      setToastMessage(t('users.updatedSuccessfully'));
    },
    onError: (err: any) => {
      setToastSeverity('error');
      setToastMessage(err.response?.data?.error?.message || t('users.updateFailed'));
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ key, payload }: { key: string; payload: any }) =>
      api.put(`/api/tasks/statuses/${key}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminStatuses'] });
      setToastSeverity('success');
      setToastMessage(t('users.statusSavedSuccessfully'));
    },
    onError: (err: any) => {
      setToastSeverity('error');
      setToastMessage(err.response?.data?.error?.message || t('users.statusSaveFailed'));
    },
  });

  const createProjectMutation = useMutation({
    mutationFn: (payload: any) => api.post('/api/projects', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setProjName('');
      setProjKey('');
      setProjDescription('');
      setProjFormError(null);
      setToastSeverity('success');
      setToastMessage(t('projects.createdSuccessfully'));
    },
    onError: (err: any) => {
      setProjFormError(err.response?.data?.error?.message || t('projects.creationFailed'));
    },
  });

  const deleteProjectMutation = useMutation({
    mutationFn: (projectId: string) => api.delete(`/api/projects/${projectId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setConfirmDeleteOpen(false);
      setProjectToDeleteId(null);
      setToastSeverity('success');
      setToastMessage(t('projects.deletedSuccessfully'));
    },
    onError: (err: any) => {
      setConfirmDeleteOpen(false);
      setProjectToDeleteId(null);
      setToastSeverity('error');
      setToastMessage(err.response?.data?.error?.message || t('projects.deletionFailed'));
    },
  });

  // Local state helper for modifying status rows prior to saving
  const [editingStatuses, setEditingStatuses] = useState<{ [key: string]: { name: string; color: string; position: number; active: boolean } }>({});

  React.useEffect(() => {
    if (statuses.length > 0) {
      const initial: typeof editingStatuses = {};
      statuses.forEach((s) => {
        initial[s.key] = { name: s.name, color: s.color, position: s.position, active: s.active };
      });
      setEditingStatuses(initial);
    }
  }, [statuses]);

  const handleStatusFieldChange = (key: string, field: string, value: any) => {
    setEditingStatuses((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: value,
      },
    }));
  };

  const handleSaveStatus = (key: string) => {
    const config = editingStatuses[key];
    if (!config) return;
    updateStatusMutation.mutate({
      key,
      payload: {
        name: config.name,
        color: config.color,
        position: config.position,
        active: config.active,
      },
    });
  };

  const handleCreateUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim() || !newPassword.trim()) {
      setFormError(t('users.allFieldsRequired'));
      return;
    }
    createUserMutation.mutate({
      name: newName,
      email: newEmail,
      password: newPassword,
      role: newRole,
    });
  };

  return (
    <Box sx={{ pb: 6 }}>
      <Typography variant="h4" sx={{ fontWeight: 800, mb: 4, letterSpacing: '-0.02em' }}>
        {t('users.title')}
      </Typography>

      <Tabs value={tabValue} onChange={(_, val) => setTabValue(val)} sx={{ mb: 4, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <Tab label={t('users.tabs.users')} />
        <Tab label={t('users.tabs.statuses')} />
        <Tab label={t('users.tabs.projects')} />
      </Tabs>

      {/* Tab 0: User Management & Creation */}
      {tabValue === 0 && (
        <Grid container spacing={4}>
          {/* Create User Form */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Card className="glass-panel" sx={{ p: 2 }}>
              <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <PersonAddIcon color="primary" /> {t('users.createUser')}
                </Typography>
                
                {formError && <Alert severity="error">{formError}</Alert>}

                <Box component="form" onSubmit={handleCreateUserSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <TextField
                    fullWidth
                    size="small"
                    label={t('users.name')}
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                  <TextField
                    fullWidth
                    size="small"
                    type="email"
                    label={t('login.email')}
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                  />
                  <TextField
                    fullWidth
                    size="small"
                    type="password"
                    label={t('users.initialPassword')}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <FormControl fullWidth size="small">
                    <InputLabel id="create-user-role-label">{t('users.role')}</InputLabel>
                    <Select
                      labelId="create-user-role-label"
                      value={newRole}
                      label={t('users.role')}
                      onChange={(e) => setNewRole(e.target.value as Role)}
                    >
                      <MenuItem value="ADMIN">{t('users.role.admin')}</MenuItem>
                      <MenuItem value="PROJECT_MANAGER">{t('users.role.projectManager')}</MenuItem>
                      <MenuItem value="DEVELOPER">{t('users.role.developer')}</MenuItem>
                    </Select>
                  </FormControl>
                  <Button
                    type="submit"
                    variant="contained"
                    fullWidth
                    disabled={createUserMutation.isPending}
                    startIcon={createUserMutation.isPending ? <CircularProgress size={20} /> : <PersonAddIcon />}
                  >
                    {t('users.createUser')}
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* User list table */}
          <Grid size={{ xs: 12, md: 8 }}>
            {loadingUsers ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <TableContainer component={Paper} className="glass-panel" sx={{ borderRadius: 3, boxShadow: 'none' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>{t('users.userColumn')}</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>{t('users.emailColumn')}</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>{t('users.role')}</TableCell>
                      <TableCell sx={{ fontWeight: 700 }} align="center">{t('users.status')}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {users.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1.5 }}>
                          <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: '0.85rem' }}>
                            {u.name.charAt(0).toUpperCase()}
                          </Avatar>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>{u.name}</Typography>
                        </TableCell>
                        <TableCell>{u.email}</TableCell>
                        <TableCell>
                          <FormControl size="small" variant="standard" sx={{ minWidth: 140 }}>
                            <Select
                              value={u.role}
                              onChange={(e) => updateUserMutation.mutate({ userId: u.id, payload: { role: e.target.value } })}
                            >
                              <MenuItem value="ADMIN">{t('users.role.admin')}</MenuItem>
                              <MenuItem value="PROJECT_MANAGER">{t('users.role.projectManager')}</MenuItem>
                              <MenuItem value="DEVELOPER">{t('users.role.developer')}</MenuItem>
                            </Select>
                          </FormControl>
                        </TableCell>
                        <TableCell align="center">
                          <Switch
                            checked={u.active}
                            color="success"
                            size="small"
                            onChange={(e) => updateUserMutation.mutate({ userId: u.id, payload: { active: e.target.checked } })}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Grid>
        </Grid>
      )}

      {/* Tab 1: Column Configurations */}
      {tabValue === 1 && (
        <Paper className="glass-panel" sx={{ p: 3, borderRadius: 3 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
            <SettingsIcon color="primary" /> {t('users.tabs.statuses')}
          </Typography>

          {loadingStatuses ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>{t('users.statusKey')}</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>{t('users.statusName')}</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>{t('users.statusColor')}</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="center">{t('users.statusOrder')}</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="center">{t('users.status')}</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="center">{t('users.actions')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {statuses.map((st) => {
                    const editState = editingStatuses[st.key] || { name: st.name, color: st.color, position: st.position, active: st.active };
                    return (
                      <TableRow key={st.key}>
                        <TableCell>
                          <Chip label={st.key} size="small" sx={{ fontWeight: 700 }} />
                          {st.protected && (
                            <Chip label={t('users.systemProtected')} size="small" color="info" variant="outlined" sx={{ mx: 1, height: 16, fontSize: '0.6rem' }} />
                          )}
                        </TableCell>
                        <TableCell sx={{ py: 1.5 }}>
                          <TextField
                            size="small"
                            value={editState.name}
                            onChange={(e) => handleStatusFieldChange(st.key, 'name', e.target.value)}
                            sx={{ width: 160 }}
                          />
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{ width: 16, height: 16, borderRadius: '50%', bgcolor: editState.color, border: '1px solid rgba(255,255,255,0.1)' }} />
                            <TextField
                              size="small"
                              value={editState.color}
                              onChange={(e) => handleStatusFieldChange(st.key, 'color', e.target.value)}
                              sx={{ width: 100 }}
                            />
                          </Box>
                        </TableCell>
                        <TableCell align="center">
                          <TextField
                            size="small"
                            type="number"
                            value={editState.position}
                            onChange={(e) => handleStatusFieldChange(st.key, 'position', parseInt(e.target.value) || 0)}
                            sx={{ width: 70 }}
                            slotProps={{ htmlInput: { min: 0 } }}
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Switch
                            checked={editState.active}
                            color="success"
                            size="small"
                            disabled={st.protected}
                            onChange={(e) => handleStatusFieldChange(st.key, 'active', e.target.checked)}
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Button
                            variant="outlined"
                            size="small"
                            startIcon={<SaveIcon />}
                            onClick={() => handleSaveStatus(st.key)}
                          >
                            {t('kanban.save')}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      )}

      {/* Tab 2: Project Management */}
      {tabValue === 2 && (
        <Grid container spacing={4}>
          {/* Create Project Form */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Card className="glass-panel" sx={{ p: 2 }}>
              <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AddIcon color="primary" /> {t('projects.createProject')}
                </Typography>

                {projFormError && <Alert severity="error">{projFormError}</Alert>}

                <Box
                  component="form"
                  onSubmit={(e: React.FormEvent) => {
                    e.preventDefault();
                    if (!projName.trim() || !projKey.trim()) {
                      setProjFormError(t('projects.nameAndKeyRequired'));
                      return;
                    }
                    if (!/^[A-Z0-9]{2,10}$/.test(projKey.trim().toUpperCase())) {
                      setProjFormError(t('projects.keyInvalid'));
                      return;
                    }
                    setProjFormError(null);
                    createProjectMutation.mutate({
                      name: projName.trim(),
                      key: projKey.trim().toUpperCase(),
                      description: projDescription.trim() || undefined,
                    });
                  }}
                  sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
                >
                  <TextField
                    fullWidth
                    size="small"
                    label={t('projects.name')}
                    value={projName}
                    onChange={(e) => setProjName(e.target.value)}
                  />
                  <TextField
                    fullWidth
                    size="small"
                    label={t('projects.key')}
                    value={projKey}
                    onChange={(e) => setProjKey(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                    helperText={t('projects.keyHint')}
                    slotProps={{ htmlInput: { maxLength: 10 } }}
                  />
                  <TextField
                    fullWidth
                    size="small"
                    multiline
                    rows={3}
                    label={t('projects.description')}
                    value={projDescription}
                    onChange={(e) => setProjDescription(e.target.value)}
                  />
                  <Button
                    type="submit"
                    variant="contained"
                    fullWidth
                    disabled={createProjectMutation.isPending}
                    startIcon={createProjectMutation.isPending ? <CircularProgress size={20} /> : <AddIcon />}
                  >
                    {t('projects.createProject')}
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Project list table */}
          <Grid size={{ xs: 12, md: 8 }}>
            {loadingProjects ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <TableContainer component={Paper} className="glass-panel" sx={{ borderRadius: 3, boxShadow: 'none' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>{t('projects.key')}</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>{t('projects.name')}</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>{t('projects.description')}</TableCell>
                      <TableCell sx={{ fontWeight: 700 }} align="center">{t('users.actions')}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {projects.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                          {t('projects.noProjects')}
                        </TableCell>
                      </TableRow>
                    ) : (
                      projects.map((p) => (
                        <TableRow key={p.id} hover>
                          <TableCell>
                            <Chip label={p.key} size="small" sx={{ fontWeight: 700, fontFamily: 'monospace' }} />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>{p.name}</Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {p.description || '—'}
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => {
                                setProjectToDeleteId(p.id);
                                setConfirmDeleteOpen(true);
                              }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Grid>
        </Grid>
      )}

      {/* Confirm Delete Project Dialog */}
      <Dialog open={confirmDeleteOpen} onClose={() => setConfirmDeleteOpen(false)}>
        <DialogTitle sx={{ fontWeight: 700 }}>{t('projects.confirmDeleteTitle')}</DialogTitle>
        <DialogContent>
          <DialogContentText>{t('projects.confirmDeleteBody')}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDeleteOpen(false)}>{t('projects.cancel')}</Button>
          <Button
            color="error"
            variant="contained"
            disabled={deleteProjectMutation.isPending}
            startIcon={deleteProjectMutation.isPending ? <CircularProgress size={18} /> : <DeleteIcon />}
            onClick={() => {
              if (projectToDeleteId) deleteProjectMutation.mutate(projectToDeleteId);
            }}
          >
            {t('projects.delete')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar notification */}
      <Snackbar
        open={Boolean(toastMessage)}
        autoHideDuration={4000}
        onClose={() => setToastMessage(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        {toastMessage ? (
          <Alert
            onClose={() => setToastMessage(null)}
            severity={toastSeverity}
            sx={{ width: '100%', borderRadius: 2 }}
          >
            {toastMessage}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Box>
  );
};
export default UsersPage;
