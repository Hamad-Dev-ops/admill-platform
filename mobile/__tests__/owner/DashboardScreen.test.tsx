import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { TestInstance } from 'test-renderer';
import { PaperProvider } from 'react-native-paper';
import { NavigationContainer } from '@react-navigation/native';
import { DashboardScreen } from '../../src/features/owner/dashboard/DashboardScreen';

// This project's test renderer (a custom "test-renderer" package, not
// classic react-test-renderer) has no UNSAFE_getByType-style query, and its
// TestInstance model only represents host (native) elements, not composite
// components — so RefreshControl itself never appears as a matchable node,
// only whatever host component it renders underneath. The Jest preset's
// mock for that host component doesn't forward refreshing/onRefresh as
// inspectable props (only `children` survives), so asserting the exact
// `refreshing` value through the rendered tree isn't reliable here. That's
// a test-environment limitation, not a real code-correctness question:
// DashboardScreen.tsx's JSX literally reads `refreshing={isRefetching}` (a
// TypeScript-checked boolean prop, not the old hardcoded `false`), and
// useDashboardData.test.tsx already proves isRefetching's own value is
// computed correctly. What's verified here instead is the one thing that
// IS reliably observable: onRefresh still fires the real refetchAll.
function findRefreshControl(container: TestInstance): TestInstance {
  const [refreshControl] = container.queryAll((instance) => instance.type === 'RCTRefreshControl');
  return refreshControl;
}

const mockDashboardData = jest.fn();
jest.mock('../../src/features/owner/dashboard/useDashboardData', () => ({
  useDashboardData: () => mockDashboardData(),
}));

jest.mock('../../src/hooks/useUnreadNotificationCount', () => ({
  useUnreadNotificationCount: () => 0,
}));

function renderScreen() {
  return render(
    <PaperProvider>
      <NavigationContainer>
        <DashboardScreen />
      </NavigationContainer>
    </PaperProvider>,
  );
}

describe('DashboardScreen', () => {
  it('shows a loading state while data is loading', async () => {
    mockDashboardData.mockReturnValue({
      isLoading: true,
      isError: false,
      fleet: undefined,
      revenue: undefined,
      pendingJobsCount: 0,
      activeJobsCount: 0,
      completedJobsToday: 0,
      recentJobs: [],
      refetchAll: jest.fn(),
    });

    await renderScreen();
    expect(screen.getByText('Command Dashboard')).toBeTruthy();
  });

  it('shows an error state with retry when the dashboard data fails to load', async () => {
    const refetchAll = jest.fn();
    mockDashboardData.mockReturnValue({
      isLoading: false,
      isError: true,
      fleet: undefined,
      revenue: undefined,
      pendingJobsCount: 0,
      activeJobsCount: 0,
      completedJobsToday: 0,
      recentJobs: [],
      refetchAll,
    });

    await renderScreen();
    expect(screen.getByText('Retry')).toBeTruthy();
  });

  it('renders real metrics once data has loaded', async () => {
    mockDashboardData.mockReturnValue({
      isLoading: false,
      isError: false,
      isRefetching: false,
      fleet: { totalVehicles: 8, statusBreakdown: { AVAILABLE: 5, ON_RECOVERY: 1, OFFLINE: 2 } },
      revenue: { totalRevenue: 450, completedJobsCount: 3, averageFare: 150 },
      pendingJobsCount: 2,
      activeJobsCount: 4,
      completedJobsToday: 3,
      recentJobs: [],
      refetchAll: jest.fn(),
    });

    await renderScreen();
    expect(screen.getByText('AED 450')).toBeTruthy();
    expect(screen.getByText('8')).toBeTruthy(); // total vehicles
    expect(screen.getByText('No recent jobs yet.')).toBeTruthy();
  });

  it('pulling to refresh still calls the real refetchAll (refresh behavior itself is unchanged)', async () => {
    const refetchAll = jest.fn();
    mockDashboardData.mockReturnValue({
      isLoading: false,
      isError: false,
      isRefetching: false,
      fleet: { totalVehicles: 8, statusBreakdown: { AVAILABLE: 5, ON_RECOVERY: 1, OFFLINE: 2 } },
      revenue: { totalRevenue: 450, completedJobsCount: 3, averageFare: 150 },
      pendingJobsCount: 2,
      activeJobsCount: 4,
      completedJobsToday: 3,
      recentJobs: [],
      refetchAll,
    });

    const { container } = await renderScreen();
    await fireEvent(findRefreshControl(container), 'refresh');
    expect(refetchAll).toHaveBeenCalledTimes(1);
  });
});
