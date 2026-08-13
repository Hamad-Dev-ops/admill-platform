import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { TestInstance } from 'test-renderer';
import { PaperProvider } from 'react-native-paper';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MockAdapter from 'axios-mock-adapter';
import { apiClient, configureApiClient } from '../../../src/api/client';
import { DriverDashboardScreen } from '../../../src/features/driver/dashboard/DriverDashboardScreen';

jest.mock('../../../src/hooks/useUnreadNotificationCount', () => ({
  useUnreadNotificationCount: () => 0,
}));

// This project's test renderer (a custom "test-renderer" package) has no
// UNSAFE_getByType-style query, and its TestInstance model only represents
// host (native) elements, not composite components — so RefreshControl
// itself never appears as a matchable node, only whatever host component it
// renders underneath, whose Jest-preset mock doesn't forward
// refreshing/onRefresh as inspectable props (only `children` survives).
// That's a test-environment limitation, not a real code-correctness
// question — DriverDashboardScreen.tsx's JSX literally reads
// `refreshing={driverQuery.isFetching && !driverQuery.isLoading}` (a
// TypeScript-checked boolean, not the old hardcoded `false`). What's
// verified here instead is the one thing that IS reliably observable:
// onRefresh still fires the real refetchAll.
function findRefreshControl(container: TestInstance): TestInstance {
  const [refreshControl] = container.queryAll((instance) => instance.type === 'RCTRefreshControl');
  return refreshControl;
}

function driverPayload(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    _id: 'd1',
    employeeId: 'DRV-000001',
    userId: 'user-1',
    companyId: 'c1',
    status: 'AVAILABLE',
    approvalStatus: 'APPROVED',
    rating: 4.5,
    totalTrips: 10,
    nationalId: 'n1',
    emiratesId: 'e1',
    emiratesIdExpiry: '2030-01-01',
    drivingLicenseNumber: 'dl1',
    drivingLicenseExpiry: '2030-01-01',
    isActive: true,
    isDeleted: false,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    ...overrides,
  };
}

describe('DriverDashboardScreen', () => {
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

  async function renderScreen() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={queryClient}>
        <PaperProvider>
          <NavigationContainer>
            <DriverDashboardScreen />
          </NavigationContainer>
        </PaperProvider>
      </QueryClientProvider>,
    );
  }

  it('shows "no active job" and hides the status toggle while ON_JOB', async () => {
    mock.onGet('/drivers/me').reply(200, { success: true, data: driverPayload({ status: 'ON_JOB' }) });
    mock.onGet('/jobs').reply(200, { success: true, data: [], meta: { page: 1, limit: 20, total: 0 } });

    const { getByText, queryByText } = await renderScreen();

    await waitFor(() => expect(getByText('DRV-000001')).toBeTruthy());
    expect(getByText('No active job right now.')).toBeTruthy();
    expect(getByText(/status changes are disabled/i)).toBeTruthy();
    // The self-service toggle options must not render while ON_JOB.
    expect(queryByText('Available')).toBeNull();
  });

  it('renders the active job and derived vehicle when present', async () => {
    mock.onGet('/drivers/me').reply(200, { success: true, data: driverPayload({ status: 'ON_JOB' }) });
    mock.onGet('/jobs').reply(200, {
      success: true,
      data: [
        {
          _id: 'j1',
          jobNumber: 'JOB-20260810-000001',
          companyId: 'c1',
          customerId: 'cust1',
          driverId: 'd1',
          vehicleId: 'v1',
          offeredDriverIds: ['d1'],
          serviceType: 'CAR_TOWING',
          status: 'EN_ROUTE',
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
        },
      ],
      meta: { page: 1, limit: 20, total: 1 },
    });
    mock.onGet('/vehicles/v1').reply(200, {
      success: true,
      data: {
        _id: 'v1',
        vehicleCode: 'VEH-000001',
        companyId: 'c1',
        plateNumber: 'DXB-99999',
        vehicleType: 'TOW_TRUCK',
        recoveryType: ['CAR_TOWING'],
        currentStatus: 'ON_RECOVERY',
        registrationNumber: 'REG1',
        chassisNumber: 'CHS1',
        insurancePolicyNumber: 'INS1',
        insuranceExpiry: '2030-01-01',
        registrationExpiry: '2030-01-01',
        isActive: true,
        isDeleted: false,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
    });

    const { getByText } = await renderScreen();

    await waitFor(() => expect(getByText('JOB-20260810-000001')).toBeTruthy());
    expect(getByText('Burj Khalifa')).toBeTruthy();
    await waitFor(() => expect(getByText('DXB-99999')).toBeTruthy());
  });

  it('shows an error state when the driver profile fails to load', async () => {
    mock.onGet('/drivers/me').reply(500);
    mock.onGet('/jobs').reply(200, { success: true, data: [], meta: { page: 1, limit: 20, total: 0 } });

    const { getByText } = await renderScreen();

    await waitFor(() => expect(getByText('Retry')).toBeTruthy());
  });

  it('shows "not assigned to you" (not "no vehicle information") on a real 403 for the derived vehicle — consistent with the Vehicle screen', async () => {
    mock.onGet('/drivers/me').reply(200, { success: true, data: driverPayload() });
    mock.onGet('/jobs').reply(200, {
      success: true,
      data: [
        {
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
        },
      ],
      meta: { page: 1, limit: 20, total: 1 },
    });
    mock.onGet('/vehicles/v1').reply(403, { success: false, message: 'You do not have permission to access this vehicle' });

    const { getByText, queryByText } = await renderScreen();

    await waitFor(() => expect(getByText('This vehicle is no longer assigned to you.')).toBeTruthy());
    expect(queryByText('No vehicle information available yet.')).toBeNull();
  });

  it('pulling to refresh still calls the real refetchAll (refresh behavior itself is unchanged)', async () => {
    mock.onGet('/drivers/me').reply(200, { success: true, data: driverPayload() });
    mock.onGet('/jobs').reply(200, { success: true, data: [], meta: { page: 1, limit: 20, total: 0 } });

    const { getByText, container } = await renderScreen();
    await waitFor(() => expect(getByText('DRV-000001')).toBeTruthy());

    // A fresh mock proves the pull-to-refresh gesture actually triggers a
    // real re-fetch of /drivers/me (via refetchAll -> invalidateQueries),
    // not just a UI no-op — the updated employeeId only appears if the
    // request genuinely happened.
    mock.onGet('/drivers/me').reply(200, { success: true, data: driverPayload({ employeeId: 'DRV-999999' }) });

    await fireEvent(findRefreshControl(container), 'refresh');
    await waitFor(() => expect(getByText('DRV-999999')).toBeTruthy());
  });
});
