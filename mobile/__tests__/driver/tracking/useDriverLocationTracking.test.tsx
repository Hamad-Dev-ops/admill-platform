import { renderHook, waitFor } from '@testing-library/react-native';
import Geolocation from '@react-native-community/geolocation';
import { useDriverLocationTracking } from '../../../src/features/driver/tracking/useDriverLocationTracking';
import { SocketService } from '../../../src/socket/SocketService';
import { updateMyDriverLocation } from '../../../src/api/drivers.api';

jest.mock('../../../src/utils/locationPermissions', () => ({
  checkLocationPermission: jest.fn().mockResolvedValue('granted'),
  requestLocationPermission: jest.fn().mockResolvedValue('granted'),
}));

jest.mock('../../../src/api/drivers.api', () => ({
  updateMyDriverLocation: jest.fn().mockResolvedValue(undefined),
}));

// Geolocation's manual mock (__mocks__/@react-native-community/geolocation.js)
// already provides getCurrentPosition as a jest.fn(). jest.spyOn on a value
// that is already a mock function just returns that same mock without
// registering it for jest.restoreAllMocks() — so call history/implementation
// leaks across tests unless cleared explicitly. Cast + mockClear/mockReset
// directly instead of relying on spyOn/restoreAllMocks for this one.
const mockGetCurrentPosition = Geolocation.getCurrentPosition as jest.Mock;

describe('useDriverLocationTracking', () => {
  let currentUnmount: (() => Promise<void>) | null = null;

  afterEach(async () => {
    await currentUnmount?.();
    currentUnmount = null;
    mockGetCurrentPosition.mockReset();
    (updateMyDriverLocation as jest.Mock).mockClear();
    jest.restoreAllMocks();
  });

  it('sends an immediate position via the socket when status is ON_JOB and the socket is connected', async () => {
    mockGetCurrentPosition.mockImplementation((success) => {
      success!({
        coords: { latitude: 25.2, longitude: 55.27, altitude: null, accuracy: 5, altitudeAccuracy: null, heading: 10, speed: 2 },
        timestamp: Date.now(),
      });
    });
    jest.spyOn(SocketService, 'isConnected', 'get').mockReturnValue(true);
    const sendSpy = jest.spyOn(SocketService, 'sendLocationUpdate').mockImplementation(() => {});

    const { result, unmount } = await renderHook(() => useDriverLocationTracking('ON_JOB'));
    currentUnmount = unmount;

    await waitFor(() => expect(sendSpy).toHaveBeenCalledTimes(1));
    expect(sendSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        location: { type: 'Point', coordinates: [55.27, 25.2] },
      }),
    );
    expect(result.current.isTracking).toBe(true);
  });

  it('does not send anything and reports isTracking:false when the driver is OFFLINE', async () => {
    const { result, unmount } = await renderHook(() => useDriverLocationTracking('OFFLINE'));
    currentUnmount = unmount;

    await new Promise<void>((resolve) => setTimeout(() => resolve(), 20));
    expect(mockGetCurrentPosition).not.toHaveBeenCalled();
    expect(result.current.isTracking).toBe(false);
  });

  it('falls back to the REST endpoint when the socket is not connected', async () => {
    mockGetCurrentPosition.mockImplementation((success) => {
      success!({
        coords: { latitude: 25.2, longitude: 55.27, altitude: null, accuracy: 5, altitudeAccuracy: null, heading: null, speed: null },
        timestamp: Date.now(),
      });
    });
    jest.spyOn(SocketService, 'isConnected', 'get').mockReturnValue(false);

    const { unmount } = await renderHook(() => useDriverLocationTracking('AVAILABLE'));
    currentUnmount = unmount;

    await waitFor(() => expect(updateMyDriverLocation).toHaveBeenCalledTimes(1));
  });

  it('surfaces lastError/lastErrorCode (never a fallback location) when the device reports POSITION_UNAVAILABLE', async () => {
    mockGetCurrentPosition.mockImplementation((_success, error) => {
      error!({ code: 2, message: 'Location services are disabled', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 });
    });
    jest.spyOn(SocketService, 'isConnected', 'get').mockReturnValue(true);
    const sendSpy = jest.spyOn(SocketService, 'sendLocationUpdate').mockImplementation(() => {});

    const { result, unmount } = await renderHook(() => useDriverLocationTracking('AVAILABLE'));
    currentUnmount = unmount;

    await waitFor(() => expect(result.current.lastErrorCode).toBe(2));
    expect(result.current.lastError).toBe('Location services are disabled');
    expect(sendSpy).not.toHaveBeenCalled();
    expect(updateMyDriverLocation).not.toHaveBeenCalled();
  });

  it('retryNow() immediately re-attempts a position fetch and clears a prior error once it succeeds', async () => {
    mockGetCurrentPosition.mockImplementationOnce((_success, error) => {
      error!({ code: 2, message: 'Location services are disabled', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 });
    });
    jest.spyOn(SocketService, 'isConnected', 'get').mockReturnValue(true);
    const sendSpy = jest.spyOn(SocketService, 'sendLocationUpdate').mockImplementation(() => {});

    const { result, unmount } = await renderHook(() => useDriverLocationTracking('AVAILABLE'));
    currentUnmount = unmount;

    await waitFor(() => expect(result.current.lastErrorCode).toBe(2));

    mockGetCurrentPosition.mockImplementation((success) => {
      success!({
        coords: { latitude: 33.6, longitude: 73.0, altitude: null, accuracy: 5, altitudeAccuracy: null, heading: null, speed: null },
        timestamp: Date.now(),
      });
    });
    result.current.retryNow();

    await waitFor(() => expect(sendSpy).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current.lastErrorCode).toBeNull());
    expect(result.current.lastError).toBeNull();
  });
});
