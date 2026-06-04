import { createTheme } from '@mui/material/styles';
import type { ThemeOptions } from '@mui/material/styles';

const getDesignTokens = (mode: 'light' | 'dark'): ThemeOptions => ({
  palette: {
    mode,
    ...(mode === 'light'
      ? {
          // Light Mode Colors
          primary: {
            main: '#4f46e5', // Royal Indigo
            light: '#6366f1',
            dark: '#3730a3',
          },
          secondary: {
            main: '#9333ea', // Purple
            light: '#a855f7',
            dark: '#6b21a8',
          },
          background: {
            default: '#f8fafc',
            paper: '#ffffff',
          },
          text: {
            primary: '#0f172a',
            secondary: '#475569',
          },
          divider: '#e2e8f0',
        }
      : {
          // Dark Mode Colors (Premium dark cyber theme)
          primary: {
            main: '#6366f1', // Bright Indigo
            light: '#818cf8',
            dark: '#4f46e5',
          },
          secondary: {
            main: '#d946ef', // Fuchsia Accent
            light: '#e879f9',
            dark: '#a21caf',
          },
          background: {
            default: '#0b0f19', // Deep dark space blue
            paper: '#161c2d',   // Translucent sleek cards
          },
          text: {
            primary: '#f8fafc',
            secondary: '#94a3b8',
          },
          divider: 'rgba(255, 255, 255, 0.08)',
        }),
  },
  typography: {
    fontFamily: "'Outfit', sans-serif",
    h1: {
      fontSize: '2.5rem',
      fontWeight: 700,
      letterSpacing: '-0.025em',
    },
    h2: {
      fontSize: '1.875rem',
      fontWeight: 700,
      letterSpacing: '-0.02em',
    },
    h3: {
      fontSize: '1.5rem',
      fontWeight: 600,
      letterSpacing: '-0.015em',
    },
    h4: {
      fontSize: '1.25rem',
      fontWeight: 600,
      letterSpacing: '-0.01em',
    },
    h5: {
      fontSize: '1.125rem',
      fontWeight: 600,
    },
    h6: {
      fontSize: '1rem',
      fontWeight: 600,
    },
    button: {
      textTransform: 'none',
      fontWeight: 500,
      letterSpacing: '0.02em',
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: ({ ownerState }) => ({
          borderRadius: 8,
          padding: '8px 16px',
          fontWeight: 600,
          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: 'none',
          '&:hover': {
            boxShadow: 'none',
            transform: 'translateY(-1px)',
          },
          '&:active': {
            transform: 'translateY(0)',
          },
          ...(ownerState.variant === 'contained' && ownerState.color === 'primary' && {
            background: mode === 'dark' 
              ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)'
              : 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
            color: '#ffffff',
            boxShadow: '0 4px 14px 0 rgba(99, 102, 241, 0.3)',
            '&:hover': {
              background: mode === 'dark' 
                ? 'linear-gradient(135deg, #818cf8 0%, #6366f1 100%)'
                : 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
              boxShadow: '0 6px 20px 0 rgba(99, 102, 241, 0.4)',
            },
          }),
          ...(ownerState.variant === 'contained' && ownerState.color === 'secondary' && {
            background: 'linear-gradient(135deg, #d946ef 0%, #a21caf 100%)',
            color: '#ffffff',
            boxShadow: '0 4px 14px 0 rgba(217, 70, 239, 0.3)',
            '&:hover': {
              background: 'linear-gradient(135deg, #e879f9 0%, #d946ef 100%)',
              boxShadow: '0 6px 20px 0 rgba(217, 70, 239, 0.4)',
            },
          }),
        }),
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          boxShadow: mode === 'dark' 
            ? '0 4px 20px -2px rgba(0, 0, 0, 0.4)'
            : '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
          border: mode === 'dark'
            ? '1px solid rgba(255, 255, 255, 0.05)'
            : '1px solid rgba(0, 0, 0, 0.04)',
          backgroundImage: 'none', // Remove default MUI dark mode paper background gradient
          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 8,
            transition: 'all 0.2s ease-in-out',
            '& fieldset': {
              borderColor: mode === 'dark' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)',
            },
            '&:hover fieldset': {
              borderColor: mode === 'dark' ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)',
            },
            '&.Mui-focused fieldset': {
              borderWidth: '1.5px',
            },
          },
        },
      },
    },
  },
});

export const getTheme = (mode: 'light' | 'dark', direction: 'ltr' | 'rtl' = 'ltr') => 
  createTheme({ ...getDesignTokens(mode), direction });
export default getTheme;

