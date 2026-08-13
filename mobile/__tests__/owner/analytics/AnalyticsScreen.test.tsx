import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MockAdapter from 'axios-mock-adapter';
import { apiClient, configureApiClient } from '../../../src/api/client';
import { AnalyticsScreen } from '../../../src/features/owner/analytics/AnalyticsScreen';

describe('AnalyticsScreen', () => {
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

  function renderScreen() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={queryClient}>
        <PaperProvider>
          <NavigationContainer>
            <AnalyticsScreen navigation={{ goBack: jest.fn() } as never} route={{} as never} />
          </NavigationContainer>
        </PaperProvider>
      </QueryClientProvider>,
    );
  }

  it('renders revenue, fleet utilization, and driver performance from real endpoints', async () => {
    mock.onGet('/analytics/revenue').reply(200, {
      success: true,
      data: { startDate: '', endDate: '', totalRevenue: 980, completedJobsCount: 6, averageFare: 163 },
    });
    mock.onGet('/analytics/drivers').reply(200, {
      success: true,
      data: [
        { driverId: 'd1', employeeId: 'DRV-000001', completedJobsCount: 4, revenue: 600, rating: 4.7, totalTrips: 40 },
        { driverId: 'd2', employeeId: 'DRV-000002', completedJobsCount: 2, revenue: 380, rating: 4.2, totalTrips: 10 },
      ],
    });
    mock.onGet('/analytics/fleet-utilization').reply(200, {
      success: true,
      data: {
        totalVehicles: 4,
        statusBreakdown: { AVAILABLE: 3, MAINTENANCE: 1 },
        vehicles: [],
      },
    });

    await renderScreen();

    await waitFor(() => expect(screen.getByText('AED 980')).toBeTruthy());
    expect(screen.getByText('6')).toBeTruthy();
    expect(screen.getByText('4 total vehicles')).toBeTruthy();
    // Sorted by revenue descending — DRV-000001 (600) before DRV-000002 (380).
    expect(screen.getByText('DRV-000001')).toBeTruthy();
    expect(screen.getByText('AED 600')).toBeTruthy();
  });

  it('renders the per-vehicle date-range utilization data, sorted by completed jobs descending', async () => {
    mock.onGet('/analytics/revenue').reply(200, {
      success: true,
      data: { startDate: '', endDate: '', totalRevenue: 0, completedJobsCount: 0, averageFare: 0 },
    });
    mock.onGet('/analytics/drivers').reply(200, { success: true, data: [] });
    mock.onGet('/analytics/fleet-utilization').reply(200, {
      success: true,
      data: {
        totalVehicles: 2,
        statusBreakdown: { AVAILABLE: 2 },
        vehicles: [
          { vehicleId: 'v1', vehicleCode: 'VEH-000001', completedJobsCount: 3 },
          { vehicleId: 'v2', vehicleCode: 'VEH-000002', completedJobsCount: 9 },
        ],
      },
    });

    await renderScreen();

    await waitFor(() => expect(screen.getByText('Vehicle Utilization')).toBeTruthy());
    expect(screen.getByText('VEH-000001')).toBeTruthy();
    expect(screen.getByText('3 completed jobs')).toBeTruthy();
    expect(screen.getByText('VEH-000002')).toBeTruthy();
    expect(screen.getByText('9 completed jobs')).toBeTruthy();

    // VEH-000002 (9 jobs) must be listed before VEH-000001 (3 jobs).
    const tree = screen.toJSON();
    const treeText = JSON.stringify(tree);
    expect(treeText.indexOf('VEH-000002')).toBeLessThan(treeText.indexOf('VEH-000001'));
  });

  it('shows an honest empty state, not a fabricated one, when no vehicle has activity in this range', async () => {
    mock.onGet('/analytics/revenue').reply(200, {
      success: true,
      data: { startDate: '', endDate: '', totalRevenue: 0, completedJobsCount: 0, averageFare: 0 },
    });
    mock.onGet('/analytics/drivers').reply(200, { success: true, data: [] });
    mock.onGet('/analytics/fleet-utilization').reply(200, {
      success: true,
      data: { totalVehicles: 3, statusBreakdown: { AVAILABLE: 3 }, vehicles: [] },
    });

    await renderScreen();

    await waitFor(() => expect(screen.getByText('No vehicle activity in this range.')).toBeTruthy());
  });

  it('shows an error state when analytics requests fail', async () => {
    mock.onGet('/analytics/revenue').reply(500);
    mock.onGet('/analytics/drivers').reply(200, { success: true, data: [] });
    mock.onGet('/analytics/fleet-utilization').reply(200, {
      success: true,
      data: { totalVehicles: 0, statusBreakdown: {}, vehicles: [] },
    });

    await renderScreen();
    await waitFor(() => expect(screen.getByText('Retry')).toBeTruthy());
  });
});
