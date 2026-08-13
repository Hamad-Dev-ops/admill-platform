import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MockAdapter from 'axios-mock-adapter';
import { apiClient, configureApiClient } from '../../../src/api/client';
import { useMyAssignedVehicle } from '../../../src/features/driver/vehicle/useMyAssignedVehicle';

function jobPayload(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    _id: 'j1',
    jobNumber: 'JOB-20260810-000001',
    companyId: 'c1',
    customerId: 'cust1',
    driverId: 'd1',
    vehicleId: 'v1',
    offeredDriverIds: ['d1'],
    serviceType: 'CAR_TOWING',
    status: 'COMPLETED',
    pickupLocation: { geo: { type: 'Point', coordinates: [55.27, 25.2] }, address: 'Burj Khalifa' },
    destinationLocation: { geo: { type: 'Point', coordinates: [55.14, 25.08] }, address: 'Marina' },
    distanceKm: 12,
    durationMinutes: 20,
    estimatedFare: 80,
    expiresAt: '2030-01-01',
    isActive: true,
    isDeleted: false,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    ...overrides,
  };
}

function vehiclePayload(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    _id: 'v1',
    vehicleCode: 'VEH-000001',
    companyId: 'c1',
    plateNumber: 'DXB-99999',
    vehicleType: 'TOW_TRUCK',
    recoveryType: ['CAR_TOWING'],
    currentStatus: 'AVAILABLE',
    registrationNumber: 'REG1',
    chassisNumber: 'CHS1',
    insurancePolicyNumber: 'INS1',
    insuranceExpiry: '2030-01-01',
    registrationExpiry: '2030-01-01',
    isActive: true,
    isDeleted: false,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    ...overrides,
  };
}

describe('useMyAssignedVehicle', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(apiClient);
    configureApiClient({
      getAccessToken: () => 'test-token',
      refreshSession: jest.fn(),
      onAuthExpired: jest.fn(),
    });
  });

  afterEach(() => {
    mock.restore();
  });

  function wrapper({ children }: { children: React.ReactNode }) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  it('resolves to no-vehicle/no-job-history when nothing in job history has a vehicleId', async () => {
    mock.onGet('/jobs').reply(200, { success: true, data: [], meta: { page: 1, limit: 20, total: 0 } });
    const { result } = await renderHook(() => useMyAssignedVehicle(), { wrapper });
    await waitFor(() => expect(result.current.kind).not.toBe('loading'));
    expect(result.current).toEqual({ kind: 'no-vehicle', reason: 'no-job-history' });
  });

  it('resolves to ready with the real vehicle when the lookup succeeds', async () => {
    mock.onGet('/jobs').reply(200, { success: true, data: [jobPayload()], meta: { page: 1, limit: 20, total: 1 } });
    mock.onGet('/vehicles/v1').reply(200, { success: true, data: vehiclePayload() });
    const { result } = await renderHook(() => useMyAssignedVehicle(), { wrapper });
    await waitFor(() => expect(result.current.kind).toBe('ready'));
    expect(result.current.kind === 'ready' && result.current.vehicle.plateNumber).toBe('DXB-99999');
  });

  it('resolves to no-vehicle/vehicle-not-found on a genuine 404 for the vehicle itself', async () => {
    mock.onGet('/jobs').reply(200, { success: true, data: [jobPayload()], meta: { page: 1, limit: 20, total: 1 } });
    mock.onGet('/vehicles/v1').reply(404, { success: false, message: 'Vehicle not found' });
    const { result } = await renderHook(() => useMyAssignedVehicle(), { wrapper });
    await waitFor(() => expect(result.current.kind).not.toBe('loading'));
    expect(result.current).toEqual({ kind: 'no-vehicle', reason: 'vehicle-not-found' });
  });

  it('resolves to unauthorized (never no-vehicle, never a raw error) on a real 403 — vehicle reassigned to another driver', async () => {
    mock.onGet('/jobs').reply(200, { success: true, data: [jobPayload()], meta: { page: 1, limit: 20, total: 1 } });
    mock.onGet('/vehicles/v1').reply(403, { success: false, message: 'You do not have permission to access this vehicle' });
    const { result } = await renderHook(() => useMyAssignedVehicle(), { wrapper });
    await waitFor(() => expect(result.current.kind).not.toBe('loading'));
    expect(result.current.kind).toBe('unauthorized');
  });

  it('resolves to a retryable error on a network failure fetching job history', async () => {
    mock.onGet('/jobs').networkError();
    const { result } = await renderHook(() => useMyAssignedVehicle(), { wrapper });
    await waitFor(() => expect(result.current.kind).toBe('error'));
  });

  it('resolves to a retryable error (never unauthorized, never no-vehicle) on a backend 500 fetching the vehicle', async () => {
    mock.onGet('/jobs').reply(200, { success: true, data: [jobPayload()], meta: { page: 1, limit: 20, total: 1 } });
    mock.onGet('/vehicles/v1').reply(500, { success: false, message: 'Internal error' });
    const { result } = await renderHook(() => useMyAssignedVehicle(), { wrapper });
    await waitFor(() => expect(result.current.kind).toBe('error'));
  });

  it('recovers to ready after retry() once the vehicle fetch succeeds', async () => {
    mock.onGet('/jobs').reply(200, { success: true, data: [jobPayload()], meta: { page: 1, limit: 20, total: 1 } });
    let attempt = 0;
    mock.onGet('/vehicles/v1').reply(() => {
      attempt += 1;
      if (attempt === 1) return [500, { success: false, message: 'Internal error' }];
      return [200, { success: true, data: vehiclePayload() }];
    });

    const { result } = await renderHook(() => useMyAssignedVehicle(), { wrapper });
    await waitFor(() => expect(result.current.kind).toBe('error'));

    await act(async () => {
      if (result.current.kind === 'error') {
        await result.current.retry();
      }
    });

    await waitFor(() => expect(result.current.kind).toBe('ready'));
    expect(attempt).toBe(2);
  });
});
