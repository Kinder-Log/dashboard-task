import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';

import { AuthProvider, useAuth } from './shared/AuthContext.js';
import { I18nProvider, useI18n } from './shared/I18nContext.js';
import getTheme from './shared/theme.js';
import LoginPage from './features/auth/LoginPage.js';
import Layout from './app/Layout.js';
import DashboardPage from './features/dashboard/DashboardPage.js';
import KanbanPage from './features/kanban/KanbanPage.js';
import UsersPage from './features/users/UsersPage.js';

// Setup TanStack Query Client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

// Guard component for authenticated routes
const ProtectedRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <Box 
        sx={{ 
          display: 'flex', 
          minHeight: '100vh', 
          alignItems: 'center', 
          justifyContent: 'center', 
          bgcolor: '#0b0f19' 
        }}
      >
        <CircularProgress size={40} sx={{ color: 'primary.main' }} />
      </Box>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

// Guard component for Admin-only routes
const AdminRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { user } = useAuth();

  if (user?.role !== 'ADMIN') {
    return <Navigate to="/" replace />;
  }

  return children;
};

// Inner App containing routing logic after Providers are initialized
const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  
  // Theme state
  const [mode, setMode] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme_mode');
    return (saved === 'light' || saved === 'dark') ? saved : 'dark';
  });

  const toggleTheme = () => {
    setMode((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('theme_mode', next);
      return next;
    });
  };

  const { direction } = useI18n();
  const theme = getTheme(mode, direction);

  if (loading) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box 
          sx={{ 
            display: 'flex', 
            minHeight: '100vh', 
            alignItems: 'center', 
            justifyContent: 'center', 
            bgcolor: mode === 'dark' ? '#0b0f19' : '#f8fafc' 
          }}
        >
          <CircularProgress size={40} />
        </Box>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <Routes>
          {/* Public login route */}
          <Route 
            path="/login" 
            element={
              user ? (
                <Navigate to="/" replace />
              ) : (
                <LoginPage />
              )
            } 
          />

          {/* Protected layout routes */}
          <Route 
            path="/" 
            element={
              <ProtectedRoute>
                <Layout currentMode={mode} onToggleTheme={toggleTheme} />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="kanban" element={<KanbanPage />} />
            <Route 
              path="users" 
              element={
                <AdminRoute>
                  <UsersPage />
                </AdminRoute>
              } 
            />
          </Route>

          {/* Fallback route */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
};

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
};

export default App;
