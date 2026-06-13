import axios from 'axios';

export const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !err.config.url.includes('/auth/login')) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/login') window.location.href = '/login';
    }
    return Promise.reject(err);
  },
);

export function apiError(err) {
  return err.response?.data?.error || err.message || 'هەڵەیەک ڕوویدا';
}

// Convenience formatters
export function money(value) {
  const n = Number(value) || 0;
  return `${n.toLocaleString('en-US', { maximumFractionDigits: 0 })} د.ع`;
}

export function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('en-GB', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}
