import { apiClient, isNotFoundError } from './client';
import type { ApiSuccess } from '../types/api';
import type { Customer } from '../types/entities';

// frontend-docs/API-CONTRACT.md §Customer. Source-reconfirmed directly
// (Phase 4.2, 2026-08-10) against customer.routes.ts/.validator.ts/.service.ts
// — exactly {nationalId (required), address? (optional)} on both create and
// update, nothing else.

export interface RegisterCustomerPayload {
  nationalId: string;
  address?: string;
}

// Response is NOT identity-populated (register() returns the raw create()
// result) — callers should invalidate ['customers','me'] and let
// getMyCustomerProfile re-fetch rather than reading userId off this.
export async function registerCustomerProfile(payload: RegisterCustomerPayload): Promise<Customer> {
  const { data } = await apiClient.post<ApiSuccess<Customer>>('/customers', payload);
  return data.data;
}

// Returns null (not a thrown error) on 404, so callers can branch on
// "profile incomplete" without a try/catch at every call site — same
// convention as getMyDriverProfile.
export async function getMyCustomerProfile(): Promise<Customer | null> {
  try {
    const { data } = await apiClient.get<ApiSuccess<Customer>>('/customers/me');
    return data.data;
  } catch (error) {
    if (isNotFoundError(error)) return null;
    throw error;
  }
}

export interface UpdateCustomerPayload {
  nationalId?: string;
  address?: string;
}

export async function updateMyCustomerProfile(payload: UpdateCustomerPayload): Promise<Customer> {
  const { data } = await apiClient.patch<ApiSuccess<Customer>>('/customers/me', payload);
  return data.data;
}
