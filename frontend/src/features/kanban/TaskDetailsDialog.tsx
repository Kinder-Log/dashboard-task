import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../shared/api.js';
import { useAuth } from '../../shared/AuthContext.js';
import { useI18n } from '../../shared/I18nContext.js';
import type {
  Task,
  TaskStatus,
  ProjectMember,
  TaskType,
  TaskPriority,
} from '../../types/index.js';
import {
  Dialog,
  DialogContent,
  Box,
  IconButton,
  Typography,
  Grid,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  TextField,
  Button,
  Divider,
  Avatar,
  Chip,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Alert,
  Paper,
  Tabs,
  Tab,
  useTheme,
} from '@mui/material';
import {
  Close as CloseIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  AttachFile as AttachFileIcon,
  AccessTime as AccessTimeIcon,
  Add as AddIcon,
} from '@mui/icons-material';

interface TaskDetailsDialogProps {
  open: boolean;
  onClose: () => void;
  taskId: string;
  projectId: string;
  projectMembers: ProjectMember[];
  statuses: TaskStatus[];
}

// Simple local Markdown renderer for titles/description
const renderMarkdown = (text?: string, noDescLabel?: string) => {
  if (!text) return <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>{noDescLabel || 'No description provided.'}</Typography>;

  const lines = text.split('\n');
  return lines.map((line, idx) => {
    // Headings
    if (line.startsWith('### ')) {
      return <Typography key={idx} variant="h6" sx={{ mt: 2, mb: 1, fontWeight: 700 }}>{line.slice(4)}</Typography>;
    }
    if (line.startsWith('## ')) {
      return <Typography key={idx} variant="h5" sx={{ mt: 2, mb: 1, fontWeight: 700 }}>{line.slice(3)}</Typography>;
    }
    if (line.startsWith('# ')) {
      return <Typography key={idx} variant="h4" sx={{ mt: 2, mb: 1, fontWeight: 800 }}>{line.slice(2)}</Typography>;
    }
    // Lists
    if (line.startsWith('- ') || line.startsWith('* ')) {
      return (
        <Box key={idx} sx={{ display: 'flex', gap: 1, ml: 2, my: 0.5 }}>
          <Typography sx={{ color: 'primary.main' }}>•</Typography>
          <Typography variant="body2">{line.slice(2)}</Typography>
        </Box>
      );
    }
    // Standard paragraph
    return (
      <Typography key={idx} variant="body2" sx={{ mb: 1, minHeight: '1.2em' }}>
        {line}
      </Typography>
    );
  });
};

export const TaskDetailsDialog: React.FC<TaskDetailsDialogProps> = ({
  open,
  onClose,
  taskId,
  projectId,
  projectMembers,
  statuses,
}) => {
  const { user } = useAuth();
  const { t } = useI18n();
  const theme = useTheme();
  const queryClient = useQueryClient();

  // Tabs for main content: Description/Details vs Unified Timeline
  const [tabValue, setTabValue] = useState(0);

  // Editing state for Title & Description
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [descValue, setDescValue] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState('');

  // Timeline add inputs
  const [commentText, setCommentText] = useState('');
  const [logHours, setLogHours] = useState('');
  const [logDesc, setLogDesc] = useState('');
  const [linkLabel, setLinkLabel] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkType, setLinkType] = useState<'GITHUB' | 'DOCUMENTATION' | 'FIGMA' | 'EXTERNAL'>('EXTERNAL');

  // Attachment error / state
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // General dialog action error
  const [dialogError, setDialogError] = useState<string | null>(null);

  // Fetch Task Details
  const { data: taskRes, isLoading, isError, refetch } = useQuery({
    queryKey: ['taskDetails', taskId],
    queryFn: () => api.get(`/api/tasks/${taskId}`).then((res) => res.data),
    enabled: open && !!taskId,
  });
  const task: Task | undefined = taskRes?.data;

  // Initialize form fields when task loads
  useEffect(() => {
    if (task) {
      setDescValue(task.description || '');
      setTitleValue(task.title || '');
    }
  }, [task]);

  // Mutations
  const updateTaskMutation = useMutation({
    mutationFn: (payload: { title?: string; description?: string; assigneeId?: string | null; type?: TaskType; priority?: TaskPriority; estimatedHours?: number; dueDate?: string | null; version: number }) =>
      api.patch(`/api/tasks/${taskId}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taskDetails', taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      setIsEditingDesc(false);
      setIsEditingTitle(false);
      setDialogError(null);
    },
    onError: (err: any) => {
      setDialogError(err.response?.data?.error?.message || 'Failed to update task properties.');
      if (err.response?.status === 409) {
        // Force reload board state
        refetch();
      }
    },
  });

  const changeStatusMutation = useMutation({
    mutationFn: (payload: { statusKey: string; version: number }) =>
      api.patch(`/api/tasks/${taskId}/status`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taskDetails', taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      setDialogError(null);
    },
    onError: (err: any) => {
      setDialogError(err.response?.data?.error?.message || 'Failed to change task status.');
      if (err.response?.status === 409) {
        refetch();
      }
    },
  });

  // Comments & Links & Timelogs Mutations
  const addCommentMutation = useMutation({
    mutationFn: (content: string) => api.post(`/api/tasks/${taskId}/comments`, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taskDetails', taskId] });
      setCommentText('');
    },
    onError: (err: any) => {
      setDialogError(err.response?.data?.error?.message || 'Failed to add comment.');
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: string) => api.delete(`/api/tasks/comments/${commentId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taskDetails', taskId] });
    },
    onError: (err: any) => {
      setDialogError(err.response?.data?.error?.message || 'Failed to delete comment.');
    },
  });

  const addLinkMutation = useMutation({
    mutationFn: (payload: { url: string; title: string; type: string }) => api.post(`/api/tasks/${taskId}/links`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taskDetails', taskId] });
      setLinkLabel('');
      setLinkUrl('');
    },
    onError: (err: any) => {
      setDialogError(err.response?.data?.error?.message || 'Failed to add link.');
    },
  });

  const deleteLinkMutation = useMutation({
    mutationFn: (linkId: string) => api.delete(`/api/tasks/links/${linkId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taskDetails', taskId] });
    },
    onError: (err: any) => {
      setDialogError(err.response?.data?.error?.message || 'Failed to delete link.');
    },
  });

  const logTimeMutation = useMutation({
    mutationFn: (payload: { hours: number; description?: string }) => api.post(`/api/tasks/${taskId}/timelogs`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taskDetails', taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      setLogHours('');
      setLogDesc('');
    },
    onError: (err: any) => {
      setDialogError(err.response?.data?.error?.message || 'Failed to log hours.');
    },
  });

  const deleteAttachmentMutation = useMutation({
    mutationFn: (attachmentId: string) => api.delete(`/api/attachments/${attachmentId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taskDetails', taskId] });
    },
    onError: (err: any) => {
      setDialogError(err.response?.data?.error?.message || 'Failed to delete attachment.');
    },
  });

  if (!open) return null;

  const handleFieldChange = (field: string, value: any) => {
    if (!task) return;
    const payload: any = { version: task.version };
    if (field === 'dueDate') {
      payload[field] = value ? new Date(value).toISOString() : null;
    } else if (field === 'assigneeId') {
      payload[field] = value || null;
    } else {
      payload[field] = value;
    }
    updateTaskMutation.mutate(payload);
  };

  const handleStatusChange = (statusKey: string) => {
    if (!task) return;
    changeStatusMutation.mutate({ statusKey, version: task.version });
  };

  const handleSaveDescription = () => {
    if (!task) return;
    updateTaskMutation.mutate({ description: descValue, version: task.version });
  };

  const handleSaveTitle = () => {
    if (!task) return;
    if (!titleValue.trim()) {
      setDialogError('Title cannot be empty');
      return;
    }
    updateTaskMutation.mutate({ title: titleValue, version: task.version });
  };

  const handleAddComment = () => {
    if (!commentText.trim()) return;
    addCommentMutation.mutate(commentText);
  };

  const handleAddLink = () => {
    if (!linkLabel.trim() || !linkUrl.trim()) return;
    addLinkMutation.mutate({ url: linkUrl, title: linkLabel, type: linkType });
  };

  const handleLogTime = () => {
    const hours = parseFloat(logHours);
    if (isNaN(hours) || hours <= 0) {
      setDialogError('Logged hours must be greater than 0');
      return;
    }
    logTimeMutation.mutate({ hours, description: logDesc.trim() || undefined });
  };

  // Upload attachment file check and execute
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];

    // Check size limit: 25MB
    const limit = 25 * 1024 * 1024;
    if (file.size > limit) {
      setUploadError('File size exceeds the 25MB security limit.');
      return;
    }

    setUploadError(null);
    setIsUploading(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      await api.post(`/api/tasks/${taskId}/attachments`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      queryClient.invalidateQueries({ queryKey: ['taskDetails', taskId] });
    } catch (err: any) {
      setUploadError(err.response?.data?.error?.message || 'העלאת קובץ נכשלה.');
    } finally {
      setIsUploading(false);
    }
  };

  // Build chronologically sorted timeline
  const buildTimeline = (): Array<{
    id: string;
    type: 'comment' | 'activity' | 'timelog' | 'attachment';
    date: string;
    user?: { id: string; name: string };
    content: string;
    rawItem: any;
  }> => {
    if (!task) return [];
    const items: any[] = [];

    // Add Comments
    (task.comments || []).forEach((c) => {
      items.push({
        id: `comment-${c.id}`,
        type: 'comment',
        date: c.createdAt,
        user: c.author,
        content: c.content,
        rawItem: c,
      });
    });

    // Add Activities
    (task.activities || []).forEach((a) => {
      items.push({
        id: `activity-${a.id}`,
        type: 'activity',
        date: a.createdAt,
        user: a.user,
        content: `${a.action} ${a.details || ''}`,
        rawItem: a,
      });
    });

    // Add TimeLogs
    (task.timeLogs || []).forEach((log) => {
      items.push({
        id: `timelog-${log.id}`,
        type: 'timelog',
        date: log.createdAt,
        user: log.user,
        content: t('taskDetails.loggedHoursActivity', { hours: log.hours, comment: log.description || '' }),
        rawItem: log,
      });
    });

    // Add Attachments
    (task.attachments || []).forEach((at) => {
      items.push({
        id: `attachment-${at.id}`,
        type: 'attachment',
        date: at.createdAt,
        user: at.uploader,
        content: t('taskDetails.uploadedFile', { name: at.filename, size: (at.size / 1024 / 1024).toFixed(2) }),
        rawItem: at,
      });
    });

    // Sort descending by date
    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const timelineItems = buildTimeline();
  const isDeveloper = user?.role === 'DEVELOPER';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      slotProps={{
        paper: {
          className: 'glass-panel',
          sx: {
            backgroundImage: 'none',
            boxShadow: '0 24px 64px -12px rgba(0,0,0,0.8)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 3,
            overflow: 'hidden',
          },
        },
      }}
    >
      {/* Dialog Header */}
      <Box
        sx={{
          p: 2.5,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Chip
            label={task?.taskKey || 'Loading...'}
            size="small"
            variant="outlined"
            sx={{ fontWeight: 700, borderColor: 'primary.main', color: 'primary.main' }}
          />
          <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 600 }}>
            {task?.project?.name}
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </Box>

      <DialogContent sx={{ p: 0 }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 8 }}>
            <CircularProgress />
          </Box>
        ) : isError || !task ? (
          <Box sx={{ p: 4 }}>
            <Alert severity="error">{t('taskDetails.loadError')}</Alert>
          </Box>
        ) : (
          <Box sx={{ flexGrow: 1 }}>
            {dialogError && (
              <Alert severity="error" sx={{ m: 2, borderRadius: 2 }} onClose={() => setDialogError(null)}>
                {dialogError}
              </Alert>
            )}

            <Grid container>
              {/* Left Column (Content, Timeline) */}
              <Grid 
                size={{ xs: 12, md: 8 }} 
                sx={{ 
                  p: 3, 
                  borderRight: theme.direction === 'rtl' ? 'none' : '1px solid rgba(255,255,255,0.05)',
                  borderLeft: theme.direction === 'rtl' ? '1px solid rgba(255,255,255,0.05)' : 'none'
                }}
              >
                {/* Editable Title */}
                <Box sx={{ mb: 3 }}>
                  {isEditingTitle ? (
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      <TextField
                        fullWidth
                        size="small"
                        variant="outlined"
                        value={titleValue}
                        onChange={(e) => setTitleValue(e.target.value)}
                        slotProps={{ htmlInput: { style: { fontSize: '1.25rem', fontWeight: 700 } } }}
                      />
                      <IconButton onClick={handleSaveTitle} color="primary" size="small">
                        <SaveIcon />
                      </IconButton>
                      <IconButton onClick={() => setIsEditingTitle(false)} color="inherit" size="small">
                        <CloseIcon />
                      </IconButton>
                    </Box>
                  ) : (
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                      <Typography variant="h5" sx={{ fontWeight: 800, flexGrow: 1, pr: 2 }}>
                        {task.title}
                      </Typography>
                      {(!isDeveloper || task.assigneeId === user?.id) && (
                        <IconButton size="small" onClick={() => setIsEditingTitle(true)}>
                          <EditIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      )}
                    </Box>
                  )}
                </Box>

                {/* Tabs */}
                <Tabs value={tabValue} onChange={(_, val) => setTabValue(val)} sx={{ mb: 3, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <Tab label={t('taskDetails.description') + ' & ' + t('taskDetails.attachments')} />
                  <Tab label={t('taskDetails.activityLog') + ` (${timelineItems.length})`} />
                </Tabs>

                {/* Tab 0: Description & Attachments & Links */}
                {tabValue === 0 && (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3.5 }}>
                    {/* Description */}
                    <Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                          {t('taskDetails.description') + ' (Markdown)'}
                        </Typography>
                        {isEditingDesc ? (
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <Button size="small" variant="contained" onClick={handleSaveDescription}>
                              {t('kanban.save')}
                            </Button>
                            <Button size="small" onClick={() => setIsEditingDesc(false)}>
                              {t('kanban.cancel')}
                            </Button>
                          </Box>
                        ) : (
                          (!isDeveloper || task.assigneeId === user?.id) && (
                            <Button size="small" startIcon={<EditIcon />} onClick={() => setIsEditingDesc(true)}>
                              {t('taskDetails.editDescription')}
                            </Button>
                          )
                        )}
                      </Box>
                      {isEditingDesc ? (
                        <TextField
                          fullWidth
                          multiline
                          rows={6}
                          variant="outlined"
                          value={descValue}
                          onChange={(e) => setDescValue(e.target.value)}
                        />
                      ) : (
                        <Paper sx={{ p: 2, bgcolor: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 2 }}>
                          {renderMarkdown(task.description, t('taskDetails.noDescription'))}
                        </Paper>
                      )}
                    </Box>

                    {/* Attachments */}
                    <Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                          {t('taskDetails.attachments')}
                        </Typography>
                        <Button
                          component="label"
                          variant="outlined"
                          size="small"
                          startIcon={<AttachFileIcon />}
                          disabled={isUploading}
                        >
                          {isUploading ? t('taskDetails.uploading') : t('taskDetails.addAttachment')}
                          <input type="file" hidden onChange={handleFileUpload} />
                        </Button>
                      </Box>
                      {uploadError && <Alert severity="error" sx={{ mb: 1.5 }}>{uploadError}</Alert>}

                      {(task.attachments || []).length === 0 ? (
                        <Typography variant="caption" color="text.secondary">{t('taskDetails.noAttachments')}</Typography>
                      ) : (
                        <List disablePadding>
                          {(task.attachments || []).map((at) => {
                            const isUploader = at.uploaderId === user?.id;
                            const isPrivileged = user?.role === 'ADMIN' || user?.role === 'PROJECT_MANAGER';
                            return (
                              <ListItem
                                key={at.id}
                                sx={{
                                  px: 1.5,
                                  py: 0.75,
                                  mb: 1,
                                  borderRadius: 2,
                                  bgcolor: 'rgba(255,255,255,0.01)',
                                  border: '1px solid rgba(255,255,255,0.03)',
                                }}
                              >
                                <ListItemText
                                  primary={
                                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                      <a
                                        href={`${api.defaults.baseURL || ''}/uploads/${at.filepath.split('/').pop()}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        style={{ color: '#818cf8', textDecoration: 'none' }}
                                      >
                                        {at.filename}
                                      </a>
                                    </Typography>
                                  }
                                  secondary={t('taskDetails.uploadedBy', { name: at.uploader?.name || 'Unknown', size: (at.size / 1024 / 1024).toFixed(2) })}
                                />
                                {(isUploader || isPrivileged) && (
                                  <ListItemSecondaryAction>
                                    <IconButton size="small" onClick={() => deleteAttachmentMutation.mutate(at.id)}>
                                      <DeleteIcon sx={{ fontSize: 16 }} />
                                    </IconButton>
                                  </ListItemSecondaryAction>
                                )}
                              </ListItem>
                            );
                          })}
                        </List>
                      )}
                    </Box>

                    {/* Task Links */}
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.secondary', mb: 1.5 }}>
                        {t('taskDetails.links')}
                      </Typography>

                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                        <TextField
                          size="small"
                          label={t('kanban.taskTitle')}
                          value={linkLabel}
                          onChange={(e) => setLinkLabel(e.target.value)}
                          sx={{ flexGrow: 1, minWidth: 120 }}
                        />
                        <TextField
                          size="small"
                          label={t('taskDetails.linkUrl')}
                          placeholder="https://..."
                          value={linkUrl}
                          onChange={(e) => setLinkUrl(e.target.value)}
                          sx={{ flexGrow: 2, minWidth: 180 }}
                        />
                        <FormControl size="small" sx={{ minWidth: 130 }}>
                          <Select
                            value={linkType}
                            onChange={(e) => setLinkType(e.target.value as any)}
                          >
                            <MenuItem value="GITHUB">{'Github'}</MenuItem>
                            <MenuItem value="FIGMA">{'Figma'}</MenuItem>
                            <MenuItem value="DOCUMENTATION">{'Documentation'}</MenuItem>
                            <MenuItem value="EXTERNAL">{'External'}</MenuItem>
                          </Select>
                        </FormControl>
                        <Button
                          variant="contained"
                          size="small"
                          onClick={handleAddLink}
                          startIcon={<AddIcon />}
                        >
                          {t('taskDetails.addLink')}
                        </Button>
                      </Box>

                      {(task.links || []).length === 0 ? (
                        <Typography variant="caption" color="text.secondary">{t('taskDetails.noLinks')}</Typography>
                      ) : (
                        <List disablePadding>
                          {(task.links || []).map((lnk) => (
                            <ListItem
                              key={lnk.id}
                              sx={{
                                px: 1.5,
                                py: 0.5,
                                mb: 0.5,
                                borderRadius: 1.5,
                                bgcolor: 'rgba(255,255,255,0.01)',
                              }}
                            >
                              <ListItemText
                                primary={
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Chip label={lnk.type} size="small" sx={{ height: 16, fontSize: '0.6rem' }} />
                                    <a
                                      href={lnk.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      style={{ color: '#818cf8', textDecoration: 'none', fontSize: '0.875rem' }}
                                    >
                                      {lnk.title}
                                    </a>
                                  </Box>
                                }
                              />
                              <ListItemSecondaryAction>
                                <IconButton size="small" onClick={() => deleteLinkMutation.mutate(lnk.id)}>
                                  <DeleteIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                              </ListItemSecondaryAction>
                            </ListItem>
                          ))}
                        </List>
                      )}
                    </Box>
                  </Box>
                )}

                {/* Tab 1: Activity Timeline Feed */}
                {tabValue === 1 && (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3.5 }}>
                    {/* Add Comment */}
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.secondary', mb: 1 }}>
                        {t('taskDetails.addCommentLabel')}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                        <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: '0.85rem' }}>
                          {user?.name.charAt(0).toUpperCase()}
                        </Avatar>
                        <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                          <TextField
                            fullWidth
                            multiline
                            rows={2}
                            placeholder={t('taskDetails.addComment')}
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                          />
                          <Box sx={{ alignSelf: 'flex-end' }}>
                            <Button
                              variant="contained"
                              size="small"
                              onClick={handleAddComment}
                              disabled={addCommentMutation.isPending}
                            >
                              {t('taskDetails.postComment')}
                            </Button>
                          </Box>
                        </Box>
                      </Box>
                    </Box>

                    <Divider />

                    {/* Timeline Feed list */}
                    <Box>
                      {timelineItems.length === 0 ? (
                        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                          {t('taskDetails.noActivity')}
                        </Typography>
                      ) : (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                          {timelineItems.map((item) => {
                            const isComment = item.type === 'comment';
                            const isTimeLog = item.type === 'timelog';
                            const isAttachment = item.type === 'attachment';
                            
                            // Comment actions
                            const isAuthor = item.rawItem.authorId === user?.id;
                            const isPrivileged = user?.role === 'ADMIN' || user?.role === 'PROJECT_MANAGER';
                            const canDelete = isComment && (isAuthor || isPrivileged);

                            return (
                              <Box key={item.id} sx={{ display: 'flex', gap: 1.5 }}>
                                <Avatar sx={{ width: 28, height: 28, bgcolor: isComment ? 'secondary.main' : isTimeLog ? 'success.main' : isAttachment ? 'info.main' : 'grey.700', fontSize: '0.75rem' }}>
                                  {item.user ? item.user.name.charAt(0).toUpperCase() : '?'}
                                </Avatar>
                                <Box sx={{ flexGrow: 1 }}>
                                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                        {item.user?.name || 'System'}
                                      </Typography>
                                      <Typography variant="caption" color="text.secondary">
                                        {new Date(item.date).toLocaleString()}
                                      </Typography>
                                    </Box>

                                    {canDelete && (
                                      <IconButton size="small" onClick={() => deleteCommentMutation.mutate(item.rawItem.id)}>
                                        <DeleteIcon sx={{ fontSize: 14 }} />
                                      </IconButton>
                                    )}
                                  </Box>
                                  <Typography
                                    variant="body2"
                                    sx={{
                                      mt: 0.5,
                                      whiteSpace: 'pre-wrap',
                                      p: isComment ? 1.5 : 0,
                                      bgcolor: isComment ? 'rgba(255,255,255,0.02)' : 'transparent',
                                      border: isComment ? '1px solid rgba(255,255,255,0.03)' : 'none',
                                      borderRadius: 2,
                                    }}
                                  >
                                    {item.content}
                                  </Typography>
                                </Box>
                              </Box>
                            );
                          })}
                        </Box>
                      )}
                    </Box>
                  </Box>
                )}
              </Grid>

              {/* Right Column (Properties Sidebar) */}
              <Grid size={{ xs: 12, md: 4 }} sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 3.5 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'text.secondary' }}>
                  {t('taskDetails.taskFields')}
                </Typography>

                {/* Status Selection */}
                <FormControl fullWidth size="small">
                  <InputLabel id="task-status-label">{t('kanban.status')}</InputLabel>
                  <Select
                    labelId="task-status-label"
                    value={task.statusKey}
                    label={t('kanban.status')}
                    onChange={(e) => handleStatusChange(e.target.value)}
                  >
                    {statuses.map((st) => (
                      <MenuItem key={st.key} value={st.key}>
                        {st.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {/* Assignee Selection */}
                <FormControl fullWidth size="small">
                  <InputLabel id="task-assignee-label">{t('kanban.assignee')}</InputLabel>
                  <Select
                    labelId="task-assignee-label"
                    value={task.assigneeId || ''}
                    label={t('kanban.assignee')}
                    onChange={(e) => handleFieldChange('assigneeId', e.target.value)}
                  >
                    <MenuItem value="">{t('kanban.unassigned')}</MenuItem>
                    {projectMembers.map((m) => (
                      <MenuItem key={m.user.id} value={m.user.id}>
                        {m.user.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {/* Priority Selection */}
                <FormControl fullWidth size="small">
                  <InputLabel id="task-priority-label">{t('kanban.priority')}</InputLabel>
                  <Select
                    labelId="task-priority-label"
                    value={task.priority}
                    label={t('kanban.priority')}
                    onChange={(e) => handleFieldChange('priority', e.target.value)}
                  >
                    <MenuItem value="CRITICAL">{t('kanban.priority.CRITICAL')}</MenuItem>
                    <MenuItem value="HIGH">{t('kanban.priority.HIGH')}</MenuItem>
                    <MenuItem value="MEDIUM">{t('kanban.priority.MEDIUM')}</MenuItem>
                    <MenuItem value="LOW">{t('kanban.priority.LOW')}</MenuItem>
                  </Select>
                </FormControl>

                {/* Type Selection */}
                <FormControl fullWidth size="small">
                  <InputLabel id="task-type-label">{t('taskDetails.taskType')}</InputLabel>
                  <Select
                    labelId="task-type-label"
                    value={task.type}
                    label={t('taskDetails.taskType')}
                    onChange={(e) => handleFieldChange('type', e.target.value)}
                  >
                    <MenuItem value="FEATURE">{t('kanban.type.FEATURE')}</MenuItem>
                    <MenuItem value="BUG">{t('kanban.type.BUG')}</MenuItem>
                    <MenuItem value="RESEARCH">{t('kanban.type.RESEARCH')}</MenuItem>
                    <MenuItem value="MAINTENANCE">{t('kanban.type.MAINTENANCE')}</MenuItem>
                    <MenuItem value="INFRASTRUCTURE">{t('kanban.type.INFRASTRUCTURE')}</MenuItem>
                    <MenuItem value="TEST">{t('kanban.type.TEST')}</MenuItem>
                  </Select>
                </FormControl>

                {/* Estimated Hours (PM / Admin only) */}
                <TextField
                  fullWidth
                  size="small"
                  type="number"
                  label={t('kanban.estimate')}
                  value={task.estimatedHours || ''}
                  onChange={(e) => handleFieldChange('estimatedHours', e.target.value ? parseFloat(e.target.value) : null)}
                  disabled={isDeveloper}
                  slotProps={{ htmlInput: { min: 0, step: 0.5 } }}
                />

                {/* Logged Hours Tracker display */}
                <Paper sx={{ p: 2, bgcolor: 'rgba(99, 102, 241, 0.05)', border: '1px solid rgba(99,102,241,0.1)', borderRadius: 2 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
                    {t('taskDetails.progress')}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {t('taskDetails.loggedTime', { logged: task.actualHours, estimate: task.estimatedHours || 0 })}
                    </Typography>
                    {task.estimatedHours && (
                      <Typography variant="caption" sx={{ fontWeight: 700 }}>
                        {((task.actualHours / task.estimatedHours) * 100).toFixed(0)}% {t('taskDetails.ofTarget')}
                      </Typography>
                    )}
                  </Box>

                  {/* Add Quick Worklog action */}
                  <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <TextField
                        size="small"
                        placeholder={t('taskDetails.hours')}
                        type="number"
                        value={logHours}
                        onChange={(e) => setLogHours(e.target.value)}
                        slotProps={{ htmlInput: { min: 0.1, step: 0.5, style: { fontSize: '0.8rem' } } }}
                        sx={{ width: 75 }}
                      />
                      <TextField
                        size="small"
                        placeholder={t('taskDetails.workDescription')}
                        value={logDesc}
                        onChange={(e) => setLogDesc(e.target.value)}
                        slotProps={{ htmlInput: { style: { fontSize: '0.8rem' } } }}
                        sx={{ flexGrow: 1 }}
                      />
                    </Box>
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<AccessTimeIcon />}
                      onClick={handleLogTime}
                    >
                      {t('taskDetails.logTime')}
                    </Button>
                  </Box>
                </Paper>

                {/* Due Date (PM / Admin only) */}
                <TextField
                  fullWidth
                  size="small"
                  type="date"
                  label={t('kanban.dueDate')}
                  value={task.dueDate ? task.dueDate.split('T')[0] : ''}
                  onChange={(e) => handleFieldChange('dueDate', e.target.value || null)}
                  disabled={isDeveloper}
                  slotProps={{ inputLabel: { shrink: true } }}
                />

                {/* Tags displays */}
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block', mb: 1 }}>
                    {t('taskDetails.tags')}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                    {(task.tags || []).length === 0 ? (
                      <Typography variant="caption" color="text.secondary">{t('taskDetails.noTags')}</Typography>
                    ) : (
                      (task.tags || []).map((tagObj) => (
                        <Chip key={tagObj.tag.name} label={tagObj.tag.name} size="small" />
                      ))
                    )}
                  </Box>
                </Box>
              </Grid>
            </Grid>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
};
export default TaskDetailsDialog;
