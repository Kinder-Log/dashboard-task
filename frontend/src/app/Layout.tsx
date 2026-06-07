import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../shared/AuthContext.js';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  Divider,
  IconButton,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Avatar,
  Menu,
  MenuItem,
  Tooltip,
  useTheme,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  Menu as MenuIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  DashboardOutlined as DashboardIcon,
  AssignmentOutlined as KanbanIcon,
  PeopleAltOutlined as PeopleIcon,
  Brightness4 as DarkModeIcon,
  Brightness7 as LightModeIcon,
  LogoutOutlined as LogoutIcon,
  LockOutlined as LockIcon
} from '@mui/icons-material';
import { useI18n } from '../shared/I18nContext.js';

const drawerWidth = 240;

interface LayoutProps {
  currentMode: 'light' | 'dark';
  onToggleTheme: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ currentMode, onToggleTheme }) => {
  const { user, logout, changePassword } = useAuth();
  const navigate = useNavigate();

  // Change Password Dialog state
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || !confirmPassword) {
      setPasswordError(language === 'he' ? 'אנא מלא את כל השדות' : 'Please fill in all fields');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(t('passwordReset.mismatch'));
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError(language === 'he' ? 'הסיסמה חייבת להכיל לפחות 8 תווים' : 'Password must be at least 8 characters long.');
      return;
    }

    setPasswordError(null);
    setPasswordSuccess(null);
    setPasswordSubmitting(true);

    try {
      await changePassword(newPassword);
      setPasswordSuccess(language === 'he' ? 'הסיסמה עודכנה בהצלחה!' : 'Password updated successfully!');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setPasswordDialogOpen(false);
        setPasswordSuccess(null);
      }, 1500);
    } catch (err: any) {
      setPasswordError(err.message || (language === 'he' ? 'עדכון הסיסמה נכשל.' : 'Failed to update password.'));
    } finally {
      setPasswordSubmitting(false);
    }
  };
  const location = useLocation();
  const theme = useTheme();
  const { t, language, setLanguage } = useI18n();

  // Navigation Drawer state
  const [open, setOpen] = useState(true);
  const handleDrawerToggle = () => {
    setOpen(!open);
  };

  // User Dropdown menu state
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    handleMenuClose();
    await logout();
    navigate('/login');
  };

  const menuItems = [
    { text: t('sidebar.dashboard'), icon: <DashboardIcon />, path: '/' },
    { text: t('sidebar.kanban'), icon: <KanbanIcon />, path: '/kanban' },
  ];

  // If user is Admin, add Users Management panel link
  if (user?.role === 'ADMIN') {
    menuItems.push({ text: t('sidebar.users'), icon: <PeopleIcon />, path: '/users' });
  }

  const activeRoute = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default', color: 'text.primary' }}>
      
      {/* App Bar (Header) */}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          zIndex: theme.zIndex.drawer + 1,
          transition: theme.transitions.create(['width', 'margin'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
          }),
          background: currentMode === 'dark' ? 'rgba(11, 15, 25, 0.7)' : 'rgba(248, 250, 252, 0.8)',
          backdropFilter: 'blur(10px)',
          borderBottom: '1px solid',
          borderColor: 'divider',
          color: 'text.primary',
          ...(open && {
            marginLeft: theme.direction === 'rtl' ? 0 : drawerWidth,
            marginRight: theme.direction === 'rtl' ? drawerWidth : 0,
            width: `calc(100% - ${drawerWidth}px)`,
            transition: theme.transitions.create(['width', 'margin'], {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.enteringScreen,
            }),
          }),
        }}
      >
        <Toolbar sx={{ justifyContent: 'space-between', px: { xs: 1, sm: 2 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <IconButton
              color="inherit"
              aria-label="open drawer"
              onClick={handleDrawerToggle}
              edge="start"
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>
            <Typography variant="h6" noWrap component="div" sx={{ fontWeight: 700, letterSpacing: '-0.02em' }}>
              {t('sidebar.workspace')}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            {/* Language Toggle */}
            <Tooltip title={language === 'en' ? 'עברית' : 'English'}>
              <IconButton 
                onClick={() => setLanguage(language === 'en' ? 'he' : 'en')} 
                color="inherit" 
                size="small"
                sx={{ fontWeight: 600, fontSize: '0.85rem', minWidth: 32 }}
              >
                {language === 'en' ? 'עב' : 'EN'}
              </IconButton>
            </Tooltip>

            {/* Theme Toggle */}
            <Tooltip title={t('sidebar.themeToggle')}>
              <IconButton onClick={onToggleTheme} color="inherit" size="small">
                {currentMode === 'dark' ? <LightModeIcon sx={{ fontSize: 20 }} /> : <DarkModeIcon sx={{ fontSize: 20 }} />}
              </IconButton>
            </Tooltip>

            {/* Profile Dropdown Trigger */}
            <Tooltip title={t('sidebar.accountSettings')}>
              <IconButton onClick={handleMenuOpen} size="small" sx={{ p: 0.5 }}>
                <Avatar 
                  sx={{ 
                    width: 32, 
                    height: 32, 
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    bgcolor: 'primary.main',
                    color: '#ffffff'
                  }}
                >
                  {user?.name.charAt(0).toUpperCase()}
                </Avatar>
              </IconButton>
            </Tooltip>

            {/* Account Settings Menu */}
            <Menu
              anchorEl={anchorEl}
              id="account-menu"
              open={Boolean(anchorEl)}
              onClose={handleMenuClose}
              onClick={handleMenuClose}
              slotProps={{
                paper: {
                  elevation: 0,
                  sx: {
                    overflow: 'visible',
                    filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.32))',
                    mt: 1.5,
                    bgcolor: 'background.paper',
                    border: '1px solid',
                    borderColor: 'divider',
                    minWidth: 180,
                    '& .MuiAvatar-root': {
                      width: 24,
                      height: 24,
                      ml: -0.5,
                      mr: 1,
                    },
                  },
                }
              }}
              transformOrigin={{ horizontal: 'right', vertical: 'top' }}
              anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            >
              <Box sx={{ px: 2, py: 1.5 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{user?.name}</Typography>
                <Typography variant="caption" color="text.secondary">{user?.email}</Typography>
                <Box sx={{ mt: 0.5 }}>
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      px: 0.75, 
                      py: 0.25, 
                      borderRadius: 1, 
                      bgcolor: 'primary.dark', 
                      color: 'primary.light',
                      fontSize: '0.675rem',
                      fontWeight: 600,
                      display: 'inline-block'
                    }}
                  >
                    {user?.role}
                  </Typography>
                </Box>
              </Box>
              <Divider />
              <MenuItem onClick={() => { handleMenuClose(); setPasswordDialogOpen(true); }}>
                <ListItemIcon>
                  <LockIcon fontSize="small" />
                </ListItemIcon>
                {t('passwordReset.title')}
              </MenuItem>
              <Divider />
              <MenuItem onClick={handleLogout}>
                <ListItemIcon>
                  <LogoutIcon fontSize="small" />
                </ListItemIcon>
                {t('sidebar.logout')}
              </MenuItem>
            </Menu>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Sidebar (Navigation Drawer) */}
      <Drawer
        variant="permanent"
        open={open}
        anchor={theme.direction === 'rtl' ? 'right' : 'left'}
        sx={{
          width: open ? drawerWidth : 0,
          flexShrink: 0,
          whiteSpace: 'nowrap',
          boxSizing: 'border-box',
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            transition: theme.transitions.create('width', {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.enteringScreen,
            }),
            overflowX: 'hidden',
            boxSizing: 'border-box',
            borderRight: theme.direction === 'rtl' ? 'none' : '1px solid',
            borderLeft: theme.direction === 'rtl' ? '1px solid' : 'none',
            borderColor: 'divider',
            bgcolor: 'background.paper',
            ...(!open && {
              width: 0,
              borderRight: 'none',
              borderLeft: 'none',
              transition: theme.transitions.create('width', {
                easing: theme.transitions.easing.sharp,
                duration: theme.transitions.duration.leavingScreen,
              }),
            }),
          },
        }}
      >
        <Toolbar sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: [1] }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pl: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: 'primary.main', letterSpacing: '-0.02em' }}>
              AG-JIRA
            </Typography>
          </Box>
          <IconButton onClick={handleDrawerToggle}>
            {theme.direction === 'rtl' ? <ChevronRightIcon /> : <ChevronLeftIcon />}
          </IconButton>
        </Toolbar>
        <Divider />
        
        {/* Navigation list */}
        <List sx={{ px: 1, py: 1.5 }}>
          {menuItems.map((item) => {
            const active = activeRoute(item.path);
            return (
              <ListItem key={item.text} disablePadding sx={{ display: 'block', mb: 0.5 }}>
                <ListItemButton
                  onClick={() => navigate(item.path)}
                  sx={{
                    minHeight: 48,
                    px: 2,
                    borderRadius: 2,
                    bgcolor: active ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                    color: active ? 'primary.main' : 'text.secondary',
                    '&:hover': {
                      bgcolor: active ? 'rgba(99, 102, 241, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                      color: active ? 'primary.main' : 'text.primary',
                      '& .MuiListItemIcon-root': {
                        color: active ? 'primary.main' : 'text.primary',
                      }
                    },
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: 40,
                      color: active ? 'primary.main' : 'text.secondary',
                    }}
                  >
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText 
                    primary={item.text} 
                    slotProps={{
                      primary: { 
                        sx: {
                          fontSize: '0.875rem', 
                          fontWeight: active ? 600 : 500 
                        }
                      }
                    }} 
                  />
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
      </Drawer>

      {/* Main page content area */}
      <Box component="main" sx={{ flexGrow: 1, p: 3, pt: 10, minWidth: 0 }}>
        <Outlet />
      </Box>

      {/* Change Password Dialog */}
      <Dialog 
        open={passwordDialogOpen} 
        onClose={() => {
          if (!passwordSubmitting) {
            setPasswordDialogOpen(false);
            setPasswordError(null);
            setPasswordSuccess(null);
            setNewPassword('');
            setConfirmPassword('');
          }
        }}
        maxWidth="xs"
        fullWidth
        slotProps={{
          paper: {
            className: 'glass-panel',
            sx: {
              borderRadius: 3,
              boxShadow: '0 20px 40px -15px rgba(0,0,0,0.5)',
              border: '1px solid',
              borderColor: 'divider',
            }
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>
          {t('passwordReset.title')}
        </DialogTitle>
        <Box component="form" onSubmit={handleChangePasswordSubmit}>
          <DialogContent sx={{ pt: 1, pb: 2 }}>
            {passwordError && (
              <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
                {passwordError}
              </Alert>
            )}
            {passwordSuccess && (
              <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }}>
                {passwordSuccess}
              </Alert>
            )}
            <TextField
              margin="dense"
              required
              fullWidth
              name="newPassword"
              label={t('passwordReset.newPassword')}
              type="password"
              id="newPassword"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={passwordSubmitting}
              sx={{ mb: 2 }}
            />
            <TextField
              margin="dense"
              required
              fullWidth
              name="confirmPassword"
              label={t('passwordReset.confirmPassword')}
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={passwordSubmitting}
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button 
              onClick={() => {
                setPasswordDialogOpen(false);
                setPasswordError(null);
                setPasswordSuccess(null);
                setNewPassword('');
                setConfirmPassword('');
              }}
              disabled={passwordSubmitting}
              color="inherit"
            >
              {language === 'he' ? 'ביטול' : 'Cancel'}
            </Button>
            <Button 
              type="submit" 
              variant="contained" 
              disabled={passwordSubmitting}
            >
              {passwordSubmitting ? (
                <CircularProgress size={24} sx={{ color: '#ffffff' }} />
              ) : (
                t('passwordReset.button')
              )}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  );
};
export default Layout;
