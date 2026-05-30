import { get, post } from './client';
import type {
  AuthResponse,
  User,
  LoginRequest,
  RegisterRequest,
} from 'shared';

export const authApi = {
  register: (data: RegisterRequest & { captchaId?: string; captchaCode?: string }) =>
    post<AuthResponse>('/auth/register', data),
  login: (data: LoginRequest & { captchaId?: string; captchaCode?: string }) =>
    post<AuthResponse>('/auth/login', data),
  getMe: () => get<User>('/auth/me'),
  getCaptcha: () => get<{ id: string; svg: string }>('/auth/captcha'),
};
