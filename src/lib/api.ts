import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 15000,
});

// Add token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Queue of callers waiting while a refresh is in-flight
let isRefreshing = false;
let waitQueue: Array<{ resolve: (t: string) => void; reject: (e: any) => void }> = [];

function drainQueue(err: any, token: string | null) {
  waitQueue.forEach((p) => (err ? p.reject(err) : p.resolve(token!)));
  waitQueue = [];
}

function clearSession() {
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
  window.location.href = '/login';
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config as any;

    // Retry on 5xx (up to 2 times with backoff)
    const is5xx = error.response?.status >= 500 && error.response?.status < 600;
    if (is5xx && config && !config.__retried) {
      config.__retryCount = (config.__retryCount || 0) + 1;
      if (config.__retryCount <= 2) {
        await new Promise((r) => setTimeout(r, 300 * config.__retryCount));
        return api(config);
      }
    }

    // Auto-refresh on 401
    if (error.response?.status === 401 && config && !config.__isRefreshRetry) {
      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) {
        clearSession();
        return Promise.reject(error);
      }

      // If a refresh is already in-flight, queue this request
      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          waitQueue.push({ resolve, reject });
        }).then((newToken) => {
          config.headers.Authorization = `Bearer ${newToken}`;
          config.__isRefreshRetry = true;
          return api(config);
        });
      }

      isRefreshing = true;
      try {
        const res = await axios.post(
          `${import.meta.env.VITE_API_BASE_URL || '/api'}/auth/refresh`,
          { refreshToken }
        );
        const newToken: string = res.data.data.token;
        localStorage.setItem('token', newToken);
        api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
        drainQueue(null, newToken);
        config.headers.Authorization = `Bearer ${newToken}`;
        config.__isRefreshRetry = true;
        return api(config);
      } catch (refreshErr) {
        drainQueue(refreshErr, null);
        clearSession();
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
