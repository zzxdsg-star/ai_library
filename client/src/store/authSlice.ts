import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { authApi } from '../api/auth.api';
import type { LoginRequest, RegisterRequest } from 'shared';

interface AuthState {
  user: { id: string; username: string; email: string } | null;
  token: string | null;
  loading: boolean;
}

const initialState: AuthState = {
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  token: localStorage.getItem('token'),
  loading: false,
};

export const login = createAsyncThunk(
  'auth/login',
  async (data: LoginRequest & { captchaId?: string; captchaCode?: string }) => {
    const res = await authApi.login(data);
    return res.data;
  },
);

export const register = createAsyncThunk(
  'auth/register',
  async (data: RegisterRequest & { captchaId?: string; captchaCode?: string }) => {
    const res = await authApi.register(data);
    return res.data;
  },
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout(state) {
      state.user = null;
      state.token = null;
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (s) => {
        s.loading = true;
      })
      .addCase(login.fulfilled, (s, action) => {
        s.loading = false;
        s.token = action.payload.token;
        s.user = action.payload.user;
        localStorage.setItem('token', action.payload.token);
        localStorage.setItem('user', JSON.stringify(action.payload.user));
      })
      .addCase(login.rejected, (s) => {
        s.loading = false;
      })
      .addCase(register.pending, (s) => {
        s.loading = true;
      })
      .addCase(register.fulfilled, (s, action) => {
        s.loading = false;
        s.token = action.payload.token;
        s.user = action.payload.user;
        localStorage.setItem('token', action.payload.token);
        localStorage.setItem('user', JSON.stringify(action.payload.user));
      })
      .addCase(register.rejected, (s) => {
        s.loading = false;
      });
  },
});

export const { logout } = authSlice.actions;
export default authSlice.reducer;
