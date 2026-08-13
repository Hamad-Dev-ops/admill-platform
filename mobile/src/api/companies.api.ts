import { apiClient, isNotFoundError } from './client';
import type { ApiSuccess } from '../types/api';
import type { CompanySettings, CompanySummary } from '../types/entities';

// frontend-docs/API-CONTRACT.md §Company.

export async function getMyCompany(): Promise<CompanySummary | null> {
  try {
    const { data } = await apiClient.get<ApiSuccess<CompanySummary>>('/companies/me');
    return data.data;
  } catch (error) {
    if (isNotFoundError(error)) return null;
    throw error;
  }
}

export interface UpdateCompanyPayload {
  companyName?: string;
  email?: string;
  phone?: string;
  logo?: string;
  address?: string;
  city?: string;
  country?: string;
  tradeLicenseNumber?: string;
  tradeLicenseExpiry?: string;
  serviceAreas?: string[];
}

export async function updateMyCompany(payload: UpdateCompanyPayload): Promise<CompanySummary> {
  const { data } = await apiClient.patch<ApiSuccess<CompanySummary>>('/companies/me', payload);
  return data.data;
}

// createCompanySchema (backend company.validator.ts) — unlike the PATCH above,
// every one of these is required; there is no company yet to default from.
export interface CreateCompanyPayload {
  companyName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  tradeLicenseNumber: string;
  tradeLicenseExpiry: string;
  serviceAreas: string[];
}

export async function createCompany(payload: CreateCompanyPayload): Promise<CompanySummary> {
  const { data } = await apiClient.post<ApiSuccess<CompanySummary>>('/companies', payload);
  return data.data;
}

export async function getMyCompanySettings(): Promise<CompanySettings> {
  const { data } = await apiClient.get<ApiSuccess<CompanySettings>>('/companies/me/settings');
  return data.data;
}

export interface UpdateCompanySettingsPayload {
  operatingHours?: { open?: string; close?: string };
  defaultServiceRadiusKm?: number;
  notificationPreferences?: { email?: boolean; sms?: boolean; push?: boolean };
  invoiceBranding?: { logoUrl?: string; invoicePrefix?: string };
}

export async function updateMyCompanySettings(
  payload: UpdateCompanySettingsPayload,
): Promise<CompanySettings> {
  const { data } = await apiClient.patch<ApiSuccess<CompanySettings>>(
    '/companies/me/settings',
    payload,
  );
  return data.data;
}
