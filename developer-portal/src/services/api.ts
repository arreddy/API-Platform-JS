import axios from 'axios';
import { store } from '../store';
import { logout } from '../store/slices/authSlice';

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = store.getState().auth.token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      store.dispatch(logout());
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// ── Auth ─────────────────────────────────────────────────────────────
export const authApi = {
  login:    (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  register: (data: Record<string, string>) =>
    api.post('/auth/register', data),
};

// ── APIs ─────────────────────────────────────────────────────────────
export const apisApi = {
  list:       (params?: Record<string, unknown>) => api.get('/apis', { params }),
  get:        (id: string)        => api.get(`/apis/${id}`),
  create:     (data: unknown)     => api.post('/apis', data),
  update:     (id: string, data: unknown) => api.put(`/apis/${id}`, data),
  delete:     (id: string)        => api.delete(`/apis/${id}`),
  versions:   (id: string)        => api.get(`/apis/${id}/versions`),
  addVersion: (id: string, data: unknown) => api.post(`/apis/${id}/versions`, data),
};

// ── Proxies ──────────────────────────────────────────────────────────
export const proxiesApi = {
  list:   (params?: Record<string, unknown>) => api.get('/proxies', { params }),
  get:    (id: string)            => api.get(`/proxies/${id}`),
  create: (data: unknown)         => api.post('/proxies', data),
  update: (id: string, data: unknown) => api.put(`/proxies/${id}`, data),
  delete: (id: string)            => api.delete(`/proxies/${id}`),
  deploy: (id: string)            => api.post(`/proxies/${id}/deploy`),
};

// ── Policies ─────────────────────────────────────────────────────────
export const policiesApi = {
  list:   (params?: Record<string, unknown>) => api.get('/policies', { params }),
  get:    (id: string)            => api.get(`/policies/${id}`),
  create: (data: unknown)         => api.post('/policies', data),
  update: (id: string, data: unknown) => api.put(`/policies/${id}`, data),
  delete: (id: string)            => api.delete(`/policies/${id}`),
};

// ── Credentials ──────────────────────────────────────────────────────
export const credentialsApi = {
  list:   (params?: Record<string, unknown>) => api.get('/credentials', { params }),
  create: (data: unknown)         => api.post('/credentials', data),
  update: (id: string, data: unknown) => api.patch(`/credentials/${id}`, data),
  revoke: (id: string)            => api.delete(`/credentials/${id}`),
};

// ── Analytics ────────────────────────────────────────────────────────
export const analyticsApi = {
  usage:       (params?: Record<string, unknown>) => api.get('/analytics/usage', { params }),
  performance: (params?: Record<string, unknown>) => api.get('/analytics/performance', { params }),
  errors:      (params?: Record<string, unknown>) => api.get('/analytics/errors', { params }),
  auditLogs:   (params?: Record<string, unknown>) => api.get('/analytics/audit-logs', { params }),
};

export default api;
