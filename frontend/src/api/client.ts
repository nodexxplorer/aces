import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const API_PREFIX = '/api/v1';

const apiClient = axios.create({
  baseURL: API_BASE_URL + API_PREFIX,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

export async function safeRequest<T>(request: () => Promise<{ data: { data: T } }>): Promise<T> {
  try {
    const response = await request();
    return response.data.data;
  } catch (err) {
    if (axios.isAxiosError(err)) {
      if (err.code === 'ECONNABORTED') {
        throw new Error('Request timed out. Please try again.');
      }
      if (!err.response) {
        throw new Error('Network error. Please check your connection.');
      }
      if (err.response.data?.error) {
        throw new Error(err.response.data.error);
      }
      if (err.response.data?.message) {
        throw new Error(err.response.data.message);
      }
      throw new Error(`Request failed with status ${err.response.status}`);
    }
    if (err instanceof Error) throw err;
    throw new Error('An unexpected error occurred');
  }
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        await axios.post(`${API_BASE_URL}${API_PREFIX}/auth/refresh`, {}, { withCredentials: true });
        return apiClient(originalRequest);
      } catch {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export function unwrap<T>(response: { data: any }): T {
  const body = response.data;
  if (body === null || body === undefined) return [] as unknown as T;
  if (Array.isArray(body)) return body as T;
  if (body && typeof body === 'object' && 'data' in body) {
    const d = body.data;
    if (d === null || d === undefined) return [] as unknown as T;
    return d as T;
  }
  return body as T;
}

export default apiClient;
