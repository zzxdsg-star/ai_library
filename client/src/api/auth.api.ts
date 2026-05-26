import { get, post } from './client';
import type {
  AuthResponse,
  User,
  LoginRequest,
  RegisterRequest,
} from 'shared';

export const authApi = {
  register: (data: RegisterRequest) =>
    post<AuthResponse>('/auth/register', data),
  login: (data: LoginRequest) =>
    post<AuthResponse>('/auth/login', data),
  getMe: () => get<User>('/auth/me'),
};
