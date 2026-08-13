import { apiClient } from './client';
import type { ApiSuccess, PaginationMeta } from '../types/api';
import type { ServiceType, VehicleType } from '../types/enums';
import type { Vehicle } from '../types/entities';

// frontend-docs/API-CONTRACT.md §Vehicle. All OWNER-scoped except GET /:id.

export interface CreateVehiclePayload {
  plateNumber: string;
  registrationNumber: string;
  chassisNumber: string;
  vehicleType: VehicleType;
  recoveryType: ServiceType[];
  insurancePolicyNumber: string;
  insuranceExpiry: string;
  registrationExpiry: string;
}

export type UpdateVehiclePayload = Partial<CreateVehiclePayload>;

export async function listVehicles(params?: {
  page?: number;
  limit?: number;
}): Promise<{ data: Vehicle[]; meta: PaginationMeta }> {
  const { data } = await apiClient.get<ApiSuccess<Vehicle[]>>('/vehicles', { params });
  return { data: data.data, meta: data.meta! };
}

export async function getVehicleById(vehicleId: string): Promise<Vehicle> {
  const { data } = await apiClient.get<ApiSuccess<Vehicle>>(`/vehicles/${vehicleId}`);
  return data.data;
}

export async function createVehicle(payload: CreateVehiclePayload): Promise<Vehicle> {
  const { data } = await apiClient.post<ApiSuccess<Vehicle>>('/vehicles', payload);
  return data.data;
}

export async function updateVehicle(
  vehicleId: string,
  payload: UpdateVehiclePayload,
): Promise<Vehicle> {
  const { data } = await apiClient.patch<ApiSuccess<Vehicle>>(`/vehicles/${vehicleId}`, payload);
  return data.data;
}

export async function assignDriverToVehicle(
  vehicleId: string,
  driverId: string,
): Promise<Vehicle> {
  const { data } = await apiClient.post<ApiSuccess<Vehicle>>(
    `/vehicles/${vehicleId}/assign-driver`,
    { driverId },
  );
  return data.data;
}
