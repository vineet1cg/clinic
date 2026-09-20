import axios from 'axios';

function readCookie(name) {
  const prefix = `${encodeURIComponent(name)}=`;
  const cookie = document.cookie.split('; ').find((item) => item.startsWith(prefix));
  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : null;
}

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  withCredentials: true,
  timeout: 12_000,
  headers: { Accept: 'application/json' },
});

http.interceptors.request.use((config) => {
  const method = config.method?.toUpperCase();
  if (method && !['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const csrfToken = readCookie('clinicos_csrf');
    if (csrfToken) config.headers.set('X-CSRF-Token', csrfToken);
  }
  return config;
});

export function getApiError(error) {
  const apiError = error.response?.data?.error;
  return {
    code: apiError?.code || 'NETWORK_ERROR',
    message:
      apiError?.message ||
      (error.code === 'ECONNABORTED'
        ? 'The request took too long. Check the clinic network and try again.'
        : 'ClinicOS could not reach the server. Check the connection and try again.'),
    details: apiError?.details || [],
    requestId: apiError?.requestId,
    status: error.response?.status,
  };
}
