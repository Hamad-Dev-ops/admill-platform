import { apiClient, isNotFoundError } from './client';
import type { ApiSuccess, GeoPoint, PaginationMeta } from '../types/api';
import type { DriverApprovalStatus } from '../types/enums';
import type { Driver } from '../types/entities';

// frontend-docs/API-CONTRACT.md §Driver.

export interface RegisterDriverPayload {
  companyCode: string;
  nationalId: string;
  emiratesId: string;
  emiratesIdExpiry: string;
  drivingLicenseNumber: string;
  drivingLicenseExpiry: string;
}

export async function registerDriverProfile(payload: RegisterDriverPayload): Promise<Driver> {
  const { data } = await apiClient.post<ApiSuccess<Driver>>('/drivers', payload);
  return data.data;
}

// Added in Phase 3 (frontend-docs/GAP-REPORT.md gap #10, now resolved) —
// resolved entirely server-side from the JWT, no client-cached id needed
// anymore. Returns null (not a thrown error) when this DRIVER-role user
// never completed POST /drivers, so callers can branch on
// "profile incomplete" without a try/catch at every call site.
export async function getMyDriverProfile(): Promise<Driver | null> {
  try {
    const { data } = await apiClient.get<ApiSuccess<Driver>>('/drivers/me');
    return data.data;
  } catch (error) {
    if (isNotFoundError(error)) return null;
    throw error;
  }
}

export async function getDriverById(driverId: string): Promise<Driver | null> {
  try {
    const { data } = await apiClient.get<ApiSuccess<Driver>>(`/drivers/${driverId}`);
    return data.data;
  } catch (error) {
    if (isNotFoundError(error)) return null;
    throw error;
  }
}

export interface UpdateDriverPayload {
  nationalId?: string;
  emiratesId?: string;
  emiratesIdExpiry?: string;
  drivingLicenseNumber?: string;
  drivingLicenseExpiry?: string;
  profileImage?: string;
}

export async function updateDriverById(
  driverId: string,
  payload: UpdateDriverPayload,
): Promise<Driver> {
  const { data } = await apiClient.patch<ApiSuccess<Driver>>(`/drivers/${driverId}`, payload);
  return data.data;
}

// --- Driver self-service (status/location) ---
// Self-service subset only — AVAILABLE/OFFLINE/ON_BREAK. ON_JOB is
// system-set on job accept/complete; ON_LEAVE/SUSPENDED have no endpoint at
// all (ROLE-PERMISSION-MATRIX.md) — do not expose those as selectable here.
export type SelfServiceDriverStatus = 'AVAILABLE' | 'OFFLINE' | 'ON_BREAK';

export async function updateMyDriverStatus(status: SelfServiceDriverStatus): Promise<Driver> {
  const { data } = await apiClient.patch<ApiSuccess<Driver>>('/drivers/me/status', { status });
  return data.data;
}

export interface DriverPositionUpdate {
  location: GeoPoint;
  speed?: number;
  heading?: number;
  accuracy?: number;
  timestamp?: string;
}

// REST fallback for GPS — the socket path (driver:location:update) is
// preferred while connected; this exists for when the socket happens to be
// disconnected (SOCKET-CONTRACT.md — both paths share one backend service).
export async function updateMyDriverLocation(payload: DriverPositionUpdate): Promise<Driver> {
  const { data } = await apiClient.patch<ApiSuccess<Driver>>('/drivers/me/location', payload);
  return data.data;
}

// Self / owning OWNER / a CUSTOMER currently on an in-progress job with this
// driver (ACCEPTED, EN_ROUTE, ARRIVED, or STARTED). Callers must expect a 403
// outside that window and treat it as "not available yet", not an error.
export interface DriverLocationResult {
  driverId: string;
  location: GeoPoint | null;
}

export async function getDriverLocation(driverId: string): Promise<DriverLocationResult> {
  const { data } = await apiClient.get<ApiSuccess<DriverLocationResult>>(`/drivers/${driverId}/location`);
  return data.data;
}

// --- Owner-facing ---
// GET /drivers (list) does NOT populate userId (verified against
// driver.repository.ts) — every entry's userId is a raw string, unlike
// getDriverById/getMyDriverProfile above. Do not destructure
// userId.firstName off a list item.

export async function listDrivers(params?: {
  page?: number;
  limit?: number;
  approvalStatus?: DriverApprovalStatus;
}): Promise<{ data: Driver[]; meta: PaginationMeta }> {
  const { data } = await apiClient.get<ApiSuccess<Driver[]>>('/drivers', { params });
  return { data: data.data, meta: data.meta! };
}

export async function approveDriver(driverId: string): Promise<Driver> {
  const { data } = await apiClient.patch<ApiSuccess<Driver>>(`/drivers/${driverId}/approve`);
  return data.data;
}

export async function rejectDriver(driverId: string, reason?: string): Promise<Driver> {
  const { data } = await apiClient.patch<ApiSuccess<Driver>>(`/drivers/${driverId}/reject`, {
    reason,
  });
  return data.data;
}
