import axios, { AxiosError } from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';

// Create base axios instance
export const api = axios.create({
  baseURL: '',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Send HttpOnly cookie
});

// Access token memory cache
let accessTokenMemory: string | null = null;
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: string | null) => void;
  reject: (error: any) => void;
}> = [];

// Helper to set memory access token
export const setAccessToken = (token: string | null) => {
  accessTokenMemory = token;
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
};

export const getAccessToken = () => accessTokenMemory;

// Request interceptor to attach access token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (accessTokenMemory && config.headers) {
      config.headers['Authorization'] = `Bearer ${accessTokenMemory}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Process failed requests queue
const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Response interceptor for token refresh handling
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config;
    if (!originalRequest) return Promise.reject(error);

    // If 401 response and not already retrying
    const isUnauthorized = error.response?.status === 401;
    const isRefreshRequest = originalRequest.url?.includes('/api/auth/refresh');
    const isLoginRequest = originalRequest.url?.includes('/api/auth/login');

    if (isUnauthorized && !isRefreshRequest && !isLoginRequest) {
      // If we are already refreshing, queue this request
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token: string | null) => {
              if (originalRequest.headers) {
                originalRequest.headers['Authorization'] = `Bearer ${token}`;
              }
              resolve(api(originalRequest));
            },
            reject: (err: any) => {
              reject(err);
            },
          });
        });
      }

      // Start token refreshing
      isRefreshing = true;

      try {
        const refreshResponse = await axios.post(
          '/api/auth/refresh',
          {},
          { withCredentials: true }
        );
        
        const newAccessToken = refreshResponse.data.data?.accessToken;
        
        if (newAccessToken) {
          setAccessToken(newAccessToken);
          processQueue(null, newAccessToken);
          
          if (originalRequest.headers) {
            originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
          }
          return api(originalRequest);
        } else {
          throw new Error('No access token returned');
        }
      } catch (refreshError) {
        processQueue(refreshError, null);
        // Clear tokens and redirect
        setAccessToken(null);
        // Custom window event to notify App to redirect to login
        window.dispatchEvent(new Event('auth_session_expired'));
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);
