import React, { useState } from 'react';
import { useAuth } from '../../shared/AuthContext.js';
import { useI18n } from '../../shared/I18nContext.js';
import { 
  Box, 
  Card, 
  CardContent, 
  TextField, 
  Button, 
  Typography, 
  Alert, 
  CircularProgress,
  IconButton,
  InputAdornment
} from '@mui/material';
import { Visibility, VisibilityOff, LockOutlined, EmailOutlined } from '@mui/icons-material';

export const LoginPage: React.FC = () => {
  const { login, changePassword } = useAuth();
  const { t } = useI18n();
  
  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Force password reset flow state
  const [mustReset, setMustReset] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError(t('login.invalidCredentials'));
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      const loggedUser = await login(email, password);
      if (loggedUser.changePasswordOnFirstLogin) {
        setMustReset(true);
      }
    } catch (err: any) {
      setError(err.message || 'Invalid credentials or connection issue.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || !confirmPassword) {
      setError(t('login.invalidCredentials'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t('passwordReset.mismatch'));
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      await changePassword(newPassword);
      // After success, useAuth updates user state which triggers main layout redirect
    } catch (err: any) {
      setError(err.message || 'Failed to update password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        minHeight: '100vh',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(circle at 10% 20%, rgba(99, 102, 241, 0.15) 0%, rgba(0, 0, 0, 0) 40%), radial-gradient(circle at 90% 80%, rgba(217, 70, 239, 0.15) 0%, rgba(0, 0, 0, 0) 40%)',
        padding: 3,
      }}
    >
      <Card
        className="glass-panel"
        sx={{
          width: '100%',
          maxWidth: 420,
          boxShadow: '0 20px 40px -15px rgba(0,0,0,0.7)',
          overflow: 'visible',
          position: 'relative',
          borderRadius: 4,
          '&::before': {
            content: '""',
            position: 'absolute',
            top: -2,
            left: -2,
            right: -2,
            bottom: -2,
            background: 'linear-gradient(135deg, #6366f1 0%, #d946ef 100%)',
            borderRadius: 'inherit',
            zIndex: -1,
            opacity: 0.3,
          }
        }}
      >
        <CardContent sx={{ p: 4 }}>
          {/* Logo / Brand Header */}
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Typography 
              variant="h4" 
              component="h1" 
              sx={{ 
                fontWeight: 800, 
                letterSpacing: '-0.03em',
                background: 'linear-gradient(135deg, #a5b4fc 0%, #f472b6 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                mb: 1
              }}
            >
              ANTIGRAVITY JIRA
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {mustReset ? t('passwordReset.title') : t('login.subtitle')}
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
              {error}
            </Alert>
          )}

          {/* Form */}
          {!mustReset ? (
            <Box component="form" onSubmit={handleLoginSubmit} noValidate>
              <TextField
                margin="normal"
                required
                fullWidth
                id="email"
                label={t('login.email')}
                name="email"
                autoComplete="email"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <EmailOutlined sx={{ color: 'text.secondary', fontSize: 20 }} />
                      </InputAdornment>
                    ),
                  },
                }}
                sx={{ mb: 2 }}
              />
              <TextField
                margin="normal"
                required
                fullWidth
                name="password"
                label={t('login.password')}
                type={showPassword ? 'text' : 'password'}
                id="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockOutlined sx={{ color: 'text.secondary', fontSize: 20 }} />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          aria-label="toggle password visibility"
                          onClick={() => setShowPassword(!showPassword)}
                          edge="end"
                          size="small"
                        >
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
                sx={{ mb: 3 }}
              />
              <Button
                type="submit"
                fullWidth
                variant="contained"
                disabled={submitting}
                sx={{ py: 1.5, mt: 1 }}
              >
                {submitting ? (
                  <CircularProgress size={24} sx={{ color: '#ffffff' }} />
                ) : (
                  t('login.button')
                )}
              </Button>
            </Box>
          ) : (
            <Box component="form" onSubmit={handleResetSubmit} noValidate>
              <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>
                {t('passwordReset.subtitle')}
              </Alert>

              <TextField
                margin="normal"
                required
                fullWidth
                name="newPassword"
                label={t('passwordReset.newPassword')}
                type={showNewPassword ? 'text' : 'password'}
                id="newPassword"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={submitting}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockOutlined sx={{ color: 'text.secondary', fontSize: 20 }} />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          aria-label="toggle new password visibility"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          edge="end"
                          size="small"
                        >
                          {showNewPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
                sx={{ mb: 2 }}
              />

              <TextField
                margin="normal"
                required
                fullWidth
                name="confirmPassword"
                label={t('passwordReset.confirmPassword')}
                type={showNewPassword ? 'text' : 'password'}
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={submitting}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockOutlined sx={{ color: 'text.secondary', fontSize: 20 }} />
                      </InputAdornment>
                    ),
                  },
                }}
                sx={{ mb: 3 }}
              />

              <Button
                type="submit"
                fullWidth
                variant="contained"
                color="secondary"
                disabled={submitting}
                sx={{ py: 1.5 }}
              >
                {submitting ? (
                  <CircularProgress size={24} sx={{ color: '#ffffff' }} />
                ) : (
                  t('passwordReset.button')
                )}
              </Button>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};
export default LoginPage;
