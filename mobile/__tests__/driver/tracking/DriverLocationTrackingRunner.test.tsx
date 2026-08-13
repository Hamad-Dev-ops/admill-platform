import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DriverLocationTrackingRunner } from '../../../src/features/driver/tracking/DriverLocationTrackingRunner';
import { useDriverLocationTracking } from '../../../src/features/driver/tracking/useDriverLocationTracking';

jest.mock('../../../src/features/driver/tracking/useDriverLocationTracking');
jest.mock('../../../src/api/drivers.api', () => ({
  getMyDriverProfile: jest.fn().mockResolvedValue({ status: 'AVAILABLE' }),
}));

const mockUseDriverLocationTracking = useDriverLocationTracking as jest.Mock;

function renderRunner() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <PaperProvider>
        <DriverLocationTrackingRunner />
      </PaperProvider>
    </QueryClientProvider>,
  );
}

describe('DriverLocationTrackingRunner', () => {
  afterEach(() => {
    mockUseDriverLocationTracking.mockReset();
  });

  it('renders nothing while not tracking (e.g. driver OFFLINE)', async () => {
    mockUseDriverLocationTracking.mockReturnValue({
      permissionStatus: 'granted',
      lastError: null,
      lastErrorCode: null,
      isTracking: false,
      retryNow: jest.fn(),
    });

    await renderRunner();

    expect(screen.queryByText(/Location/i)).toBeNull();
  });

  it('shows a blocked-permission banner with a Settings action when permission is blocked', async () => {
    mockUseDriverLocationTracking.mockReturnValue({
      permissionStatus: 'blocked',
      lastError: null,
      lastErrorCode: null,
      isTracking: true,
      retryNow: jest.fn(),
    });

    await renderRunner();

    await waitFor(() =>
      expect(
        screen.getByText("Location access is blocked. Enable it in Settings so dispatch can see you're online."),
      ).toBeTruthy(),
    );
    expect(screen.getByText('Open Settings')).toBeTruthy();
  });

  // The exact copy requirement #2 of the stability task calls for: never
  // silently substitute an old/fallback location when a real fix can't be
  // obtained — surface this instead.
  it('shows the "location services disabled" message (not a generic error) for POSITION_UNAVAILABLE (code 2)', async () => {
    mockUseDriverLocationTracking.mockReturnValue({
      permissionStatus: 'granted',
      lastError: 'Location services are disabled',
      lastErrorCode: 2,
      isTracking: true,
      retryNow: jest.fn(),
    });

    await renderRunner();

    await waitFor(() =>
      expect(
        screen.getByText('Location unavailable. Please enable location services to receive nearby jobs.'),
      ).toBeTruthy(),
    );
  });

  it('shows a generic retry message for a non-location-services error (e.g. TIMEOUT)', async () => {
    mockUseDriverLocationTracking.mockReturnValue({
      permissionStatus: 'granted',
      lastError: 'Request timed out',
      lastErrorCode: 3,
      isTracking: true,
      retryNow: jest.fn(),
    });

    await renderRunner();

    await waitFor(() =>
      expect(screen.getByText("Couldn't get your current location. Retrying automatically…")).toBeTruthy(),
    );
  });

  it('renders nothing once permission is granted and there is no error', async () => {
    mockUseDriverLocationTracking.mockReturnValue({
      permissionStatus: 'granted',
      lastError: null,
      lastErrorCode: null,
      isTracking: true,
      retryNow: jest.fn(),
    });

    await renderRunner();

    expect(screen.queryByText(/Location/i)).toBeNull();
  });
});
