import Geolocation from '@react-native-community/geolocation';

export type DevicePosition = {
  coords: {
    latitude: number;
    longitude: number;
    speed: number | null;
    heading: number | null;
    accuracy: number;
  };
  timestamp: number;
};

let configured = false;

export function configureDeviceLocation(): void {
  if (configured) return;
  Geolocation.setRNConfiguration({
    skipPermissionRequests: true,
    locationProvider: 'auto',
  });
  configured = true;
}

function getPosition(options: {
  enableHighAccuracy: boolean;
  timeout: number;
  maximumAge: number;
}): Promise<DevicePosition> {
  return new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      resolve as (position: DevicePosition) => void,
      (error) => {
        const message =
          error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
            ? error.message
            : 'Unable to get current location';
        const wrapped = new Error(message);
        if (error && typeof error === 'object' && 'code' in error) {
          (wrapped as Error & { code?: number }).code = Number(error.code);
        }
        reject(wrapped);
      },
      options,
    );
  });
}

/**
 * Attempt 1: GPS / high accuracy. Attempt 2: network/cached if the first times out
 * or is unavailable. Never fabricates a coordinate.
 */
export async function getDevicePosition(): Promise<DevicePosition> {
  configureDeviceLocation();

  try {
    return await getPosition({ enableHighAccuracy: true, timeout: 20000, maximumAge: 10000 });
  } catch (highAccuracyError) {
    try {
      return await getPosition({ enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 });
    } catch {
      throw highAccuracyError;
    }
  }
}
