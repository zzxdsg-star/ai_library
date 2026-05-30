import axios from 'axios';
import type { ApiResponse } from 'shared';

const client = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

/**
 * 请求拦截器：自动附带 JWT token。
 */
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * 响应拦截器：401 时清除登录态并跳转登录页。
 */
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    // 提取服务端返回的错误消息，避免前端拿到 axios 默认的 "Request failed with status code 400"
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message;
    return Promise.reject(new Error(message));
  },
);

export async function get<T>(
  url: string,
  params?: Record<string, unknown>,
): Promise<ApiResponse<T>> {
  const { data } = await client.get<ApiResponse<T>>(url, { params });
  return data;
}

export async function post<T>(
  url: string,
  body?: unknown,
): Promise<ApiResponse<T>> {
  const { data } = await client.post<ApiResponse<T>>(url, body);
  return data;
}

export async function put<T>(
  url: string,
  body?: unknown,
): Promise<ApiResponse<T>> {
  const { data } = await client.put<ApiResponse<T>>(url, body);
  return data;
}

export async function del<T>(
  url: string,
): Promise<ApiResponse<T>> {
  const { data } = await client.delete<ApiResponse<T>>(url);
  return data;
}

export async function patch<T>(
  url: string,
  body?: unknown,
): Promise<ApiResponse<T>> {
  const { data } = await client.patch<ApiResponse<T>>(url, body);
  return data;
}

/**
 * SSE 流式请求（使用原生 fetch，axios 不支持流式读取）。
 * 返回 AsyncGenerator，逐条产出解析后的 JSON 事件。
 */
export async function* postStream<T>(
  url: string,
  body: unknown,
): AsyncGenerator<T> {
  const token = localStorage.getItem('token');
  const response = await fetch(`/api${url}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6).trim();
        if (data) {
          try {
            yield JSON.parse(data);
          } catch {
            /* 跳过解析失败的行 */
          }
        }
      }
    }
  }
}

export { client };
