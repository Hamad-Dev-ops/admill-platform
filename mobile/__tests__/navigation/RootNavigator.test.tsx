import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RootNavigator } from '../../src/navigation/RootNavigator';

jest.mock('../../src/hooks/useProfileStatus', () => ({
  useProfileStatus: () => ({ kind: 'ready' }),
}));

jest.mock('../../src/features/owner/dashboard/useDashboardData', () => ({
  useDashboardData: () => ({
    isLoading: false,
    isError: false,
    fleet: { totalVehicles: 0, statusBreakdown: {} },
    revenue: { totalRevenue: 0, completedJobsCount: 0, averageFare: 0 },
    pendingJobsCount: 0,
    activeJobsCount: 0,
    completedJobsToday: 0,
    recentJobs: [],
    refetchAll: () => {},
  }),
}));

jest.mock('../../src/hooks/useUnreadNotificationCount', () => ({
  useUnreadNotificationCount: () => 0,
}));

const mockUseAuth = jest.fn();
jest.mock('../../src/auth/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

function renderRoot() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <PaperProvider>
        <RootNavigator />
      </PaperProvider>
    </QueryClientProvider>,
  );
}

describe('RootNavigator role routing', () => {
  it('renders the Auth flow when unauthenticated', async () => {
    mockUseAuth.mockReturnValue({ status: 'unauthenticated', user: null });
    await renderRoot();
    await waitFor(() => expect(screen.getByText('Welcome back')).toBeTruthy());
  });

  it('renders OwnerNavigator for an OWNER session', async () => {
    mockUseAuth.mockReturnValue({
      status: 'authenticated',
      user: { id: '1', firstName: 'Owen', lastName: 'Er', email: 'o@x.com', phone: '1', role: 'OWNER' },
    });
    await renderRoot();
    await waitFor(() => expect(screen.getByText('Command Dashboard')).toBeTruthy());
  });

  it('renders DriverNavigator for a DRIVER session', async () => {
    mockUseAuth.mockReturnValue({
      status: 'authenticated',
      user: { id: '2', firstName: 'Dana', lastName: 'Er', email: 'd@x.com', phone: '1', role: 'DRIVER' },
    });
    await renderRoot();
    // "Dashboard" appears twice (screen header + tab label) by design.
    await waitFor(() => expect(screen.getAllByText('Dashboard').length).toBeGreaterThan(0));
  });

  it('renders CustomerNavigator for a CUSTOMER session', async () => {
    mockUseAuth.mockReturnValue({
      status: 'authenticated',
      user: { id: '3', firstName: 'Cara', lastName: 'Er', email: 'c@x.com', phone: '1', role: 'CUSTOMER' },
    });
    await renderRoot();
    // "Home" appears twice (screen header + tab label) by design.
    await waitFor(() => expect(screen.getAllByText('Home').length).toBeGreaterThan(0));
  });

  // A stored session that couldn't be validated because the server was
  // unreachable at launch must show a retryable connection screen — never
  // the login screen (that would silently discard a still-valid session)
  // and never an infinite spinner (final hardening pass, requirement #8).
  it('renders a retryable connection-problem screen for status "error", distinct from "unauthenticated"', async () => {
    const retryStartup = jest.fn();
    mockUseAuth.mockReturnValue({
      status: 'error',
      user: null,
      startupError: 'Network request failed',
      retryStartup,
      logout: jest.fn().mockResolvedValue(undefined),
    });
    await renderRoot();

    await waitFor(() => expect(screen.getByText('Connection problem')).toBeTruthy());
    expect(screen.getByText('Network request failed')).toBeTruthy();
    expect(screen.queryByText('Welcome back')).toBeNull();

    await fireEvent.press(screen.getByText('Retry'));
    expect(retryStartup).toHaveBeenCalledTimes(1);
  });
});
