import { http } from './http.js';

export async function getCurrentUser() {
  try {
    const response = await http.get('/auth/me');
    return response.data.user;
  } catch (error) {
    if (error.response?.status === 401) return null;
    throw error;
  }
}

export async function signIn(credentials) {
  const response = await http.post('/auth/login', credentials);
  return response.data.user;
}

export async function signOut() {
  await http.post('/auth/logout');
}

export async function changePassword(input) {
  const response = await http.post('/auth/change-password', input);
  return response.data.user;
}
