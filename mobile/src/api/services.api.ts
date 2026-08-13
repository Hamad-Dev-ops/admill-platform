import { apiClient } from './client';
import type { ApiSuccess } from '../types/api';
import type { ServiceType } from '../types/enums';

// frontend-docs/API-CONTRACT.md §Service catalog. Global catalog, not
// per-company. GET /services does NOT filter isAvailable server-side
// (re-verified directly against service.repository.ts's findAll — plain
// {isDeleted:false} query) — callers must filter it out themselves before
// presenting entries as bookable.
export interface AppService {
  _id: string;
  serviceCode: string;
  serviceType: ServiceType;
  displayName: string;
  description?: string;
  baseFare: number;
  isAvailable: boolean;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function listServices(): Promise<AppService[]> {
  const { data } = await apiClient.get<ApiSuccess<AppService[]>>('/services');
  return data.data;
}
