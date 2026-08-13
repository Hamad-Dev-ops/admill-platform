import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MockAdapter from 'axios-mock-adapter';
import { apiClient, configureApiClient } from '../../../src/api/client';
import { FleetTrackingScreen } from '../../../src/features/owner/tracking/FleetTrackingScreen';

// Capture socket handlers by event name so tests can simulate a live event
// without a real socket connection (SocketService's internal socket stays
// null in tests, so .on()/.off() are no-ops — see SocketService.ts).
const socketHandlers: Record<string, (payload: unknown) => void> = {};
jest.mock('../../../src/hooks/useSocketEvent', () => ({
  useSocketEvent: (event: string, handler: (payload: unknown) => void) => {
    socketHandlers[event] = handler;
  },
}));

function driverPayload(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    _id: 'd1',
    employeeId: 'DRV-000001',
    userId: 'user-1',
    companyId: 'c1',
    status: 'AVAILABLE',
    approvalStatus: 'APPROVED',
    rating: 4.8,
    totalTrips: 20,
    nationalId: 'n1',
    emiratesId: 'e1',
    emiratesIdExpiry: '2030-01-01',
    drivingLicenseNumber: 'dl1',
    drivingLicenseExpiry: '2030-01-01',
    currentLocation: { type: 'Point', coordinates: [55.27, 25.2] },
    isActive: true,
    isDeleted: false,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    ...overrides,
  };
}

describe('FleetTrackingScreen', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(apiClient);
    configureApiClient({
      getAccessToken: () => 'test-token',
      refreshSession: jest.fn(),
      onAuthExpired: jest.fn(),
    });
    Object.keys(socketHandlers).forEach((key) => delete socketHandlers[key]);
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
            <FleetTrackingScreen />
          </NavigationContainer>
        </PaperProvider>
      </QueryClientProvider>,
    );
  }

  it('shows an empty state when no driver has a known location', async () => {
    mock.onGet('/drivers').reply(200, {
      success: true,
      data: [driverPayload({ currentLocation: undefined })],
      meta: { page: 1, limit: 100, total: 1 },
    });

    await renderScreen();
    await waitFor(() => expect(screen.getByText('No driver locations yet')).toBeTruthy());
  });

  it('renders one marker per driver with a known REST location', async () => {
    mock.onGet('/drivers').reply(200, {
      success: true,
      data: [driverPayload({ _id: 'd1' }), driverPayload({ _id: 'd2', employeeId: 'DRV-000002' })],
      meta: { page: 1, limit: 100, total: 2 },
    });

    await renderScreen();
    await waitFor(() => expect(screen.getAllByTestId('map-marker')).toHaveLength(2));
  });

  it('updates a marker position when a driver:location:changed event arrives', async () => {
    mock.onGet('/drivers').reply(200, {
      success: true,
      data: [driverPayload({ _id: 'd1' })],
      meta: { page: 1, limit: 100, total: 1 },
    });

    await renderScreen();
    await waitFor(() => expect(screen.getAllByTestId('map-marker')).toHaveLength(1));

    const initialCoordinate = screen.getAllByTestId('map-marker')[0].props.coordinate;
    expect(initialCoordinate).toEqual({ latitude: 25.2, longitude: 55.27 });

    await act(async () => {
      socketHandlers['driver:location:changed']({
        driverId: 'd1',
        location: { type: 'Point', coordinates: [55.3, 25.25] },
        timestamp: '2026-01-01T00:00:00.000Z',
      });
    });

    await waitFor(() =>
      expect(screen.getAllByTestId('map-marker')[0].props.coordinate).toEqual({
        latitude: 25.25,
        longitude: 55.3,
      }),
    );
  });

  // Performance Audit finding F2: a location update for one driver used to
  // rebuild the whole trackedDrivers array and recreate every driver's
  // Marker element, regardless of whether that specific driver moved. The
  // fix (React.memo'd DriverMarker) relies on unaffected drivers keeping a
  // referentially-stable `position` object across the update — this test
  // verifies that precondition directly, which is what actually makes
  // React.memo's bailout effective for driver B's marker.
  it('keeps an unrelated driver\'s marker props referentially stable when only a different driver moves', async () => {
    mock.onGet('/drivers').reply(200, {
      success: true,
      data: [driverPayload({ _id: 'd1' }), driverPayload({ _id: 'd2', employeeId: 'DRV-000002' })],
      meta: { page: 1, limit: 100, total: 2 },
    });

    await renderScreen();
    await waitFor(() => expect(screen.getAllByTestId('map-marker')).toHaveLength(2));

    const markersBefore = screen.getAllByTestId('map-marker');
    const d2MarkerBefore = markersBefore.find((m) => m.props.title === 'DRV-000002')!;
    const d2CoordinateBefore = d2MarkerBefore.props.coordinate;

    await act(async () => {
      socketHandlers['driver:location:changed']({
        driverId: 'd1',
        location: { type: 'Point', coordinates: [55.3, 25.25] },
        timestamp: '2026-01-01T00:00:00.000Z',
      });
    });

    await waitFor(() => {
      const d1Marker = screen.getAllByTestId('map-marker').find((m) => m.props.title === 'DRV-000001')!;
      expect(d1Marker.props.coordinate).toEqual({ latitude: 25.25, longitude: 55.3 });
    });

    const d2MarkerAfter = screen.getAllByTestId('map-marker').find((m) => m.props.title === 'DRV-000002')!;
    // Strict reference equality, not toEqual — proves d2's position object
    // was never replaced by the d1-only update, which is what allows
    // DriverMarker's React.memo to skip re-rendering it.
    expect(d2MarkerAfter.props.coordinate).toBe(d2CoordinateBefore);
  });
});
