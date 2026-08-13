import { apiClient } from './client';
import type { ApiSuccess, GeoPoint } from '../types/api';
import type { PricingConfig } from '../types/entities';
import type { ServiceType } from '../types/enums';

// frontend-docs/API-CONTRACT.md §Pricing. IMPORTANT: this config is global
// across every company on the platform (see PricingConfig in entities.ts) —
// not scoped to the caller's own company. Never claim otherwise in UI copy.

export interface EstimateFarePayload {
  serviceType: ServiceType;
  // Bare GeoPoints, NOT the {geo,address} shape POST /jobs uses — re-verified
  // directly against pricing.validator.ts's estimateFareSchema (Phase 4.5).
  pickupLocation: GeoPoint;
  destinationLocation: GeoPoint;
}

export interface FareFactor {
  name: string;
  amount: number;
  description: string;
}

export interface FareBreakdown {
  serviceType: ServiceType;
  distanceKm: number;
  durationMinutes: number;
  factors: FareFactor[];
  total: number;
}

export async function estimateFare(payload: EstimateFarePayload): Promise<FareBreakdown> {
  const { data } = await apiClient.post<ApiSuccess<FareBreakdown>>('/pricing/estimate', payload);
  return data.data;
}

export async function getPricingConfig(): Promise<PricingConfig> {
  const { data } = await apiClient.get<ApiSuccess<PricingConfig>>('/pricing/config');
  return data.data;
}

export interface UpdatePricingConfigPayload {
  currentFuelPrice?: number;
  fuelConsumptionPerKm?: number;
  perKmRate?: number;
  peakHourWindows?: Array<{ startHour: number; endHour: number }>;
  peakHourSurcharge?: number;
  lowSupplyThreshold?: number;
  maxDemandSurcharge?: number;
  surgeEnabled?: boolean;
}

// Creates a NEW version — the backend never mutates a config in place
// (JOB-LIFECYCLE-adjacent note in API-CONTRACT.md §Pricing).
export async function createPricingConfigVersion(
  payload: UpdatePricingConfigPayload,
): Promise<PricingConfig> {
  const { data } = await apiClient.post<ApiSuccess<PricingConfig>>('/pricing/config', payload);
  return data.data;
}
