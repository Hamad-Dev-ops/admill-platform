import { apiClient } from './client';
import type { ApiSuccess } from '../types/api';
import type { AuthResult } from '../types/entities';
import type { UserRole } from '../types/enums';

// Mirrors frontend-docs/API-CONTRACT.md §Auth exactly.

export interface RegisterPayload {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  role: UserRole;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export async function register(payload: RegisterPayload): Promise<AuthResult> {
  const { data } = await apiClient.post<ApiSuccess<AuthResult>>('/auth/register', payload);
  return data.data;
}

export async function login(payload: LoginPayload): Promise<AuthResult> {
  const { data } = await apiClient.post<ApiSuccess<AuthResult>>('/auth/login', payload);
  return data.data;
}

export async function refresh(refreshToken: string): Promise<AuthResult> {
  const { data } = await apiClient.post<ApiSuccess<AuthResult>>('/auth/refresh', {
    refreshToken,
  });
  return data.data;
}

export async function logout(refreshToken: string): Promise<void> {
  await apiClient.post('/auth/logout', { refreshToken });
}

export async function logoutAll(): Promise<void> {
  await apiClient.post('/auth/logout-all');
}
