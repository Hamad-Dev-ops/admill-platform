import { useCallback, useEffect, useRef, useState } from 'react';
import { updateMyDriverLocation } from '../../../api/drivers.api';
import { SocketService } from '../../../socket/SocketService';
import type { DriverStatus } from '../../../types/enums';
import { getDevicePosition } from '../../../utils/deviceLocation';
import { flowLog } from '../../../utils/flowLog';
import {
  checkLocationPermission,
  requestLocationPermission,
  type LocationPermissionStatus,
} from '../../../utils/locationPermissions';

function cadenceForStatus(status: DriverStatus | undefined): number | null {
  if (status === 'ON_JOB') return 4000;
  if (status === 'AVAILABLE') return 15000;
  return null;
}

export const POSITION_UNAVAILABLE_CODE = 2;

export interface DriverLocationTrackingState {
  permissionStatus: LocationPermissionStatus;
  lastError: string | null;
  lastErrorCode: number | null;
  isTracking: boolean;
  retryNow: () => void;
}

export function useDriverLocationTracking(
  driverStatus: DriverStatus | undefined,
): DriverLocationTrackingState {
  const [permissionStatus, setPermissionStatus] = useState<LocationPermissionStatus>('denied');
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastErrorCode, setLastErrorCode] = useState<number | null>(null);
  const hasRequestedRef = useRef(false);
  const sendTickRef = useRef<() => void>(() => {});
  const cadenceMs = cadenceForStatus(driverStatus);

  useEffect(() => {
    if (!cadenceMs) return undefined;

    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    async function ensurePermission(): Promise<boolean> {
      let status = await checkLocationPermission();
      if (status !== 'granted' && !hasRequestedRef.current) {
        hasRequestedRef.current = true;
        status = await requestLocationPermission();
      }
      if (!cancelled) setPermissionStatus(status);
      return status === 'granted';
    }

    function sendTick() {
      ensurePermission().then(async (granted) => {
        if (!granted || cancelled) return;

        try {
          const position = await getDevicePosition();
          if (cancelled) return;

          const speed =
            position.coords.speed != null && position.coords.speed >= 0
              ? position.coords.speed
              : undefined;
          const heading =
            position.coords.heading != null &&
            position.coords.heading >= 0 &&
            position.coords.heading <= 360
              ? position.coords.heading
              : undefined;

          const payload = {
            location: {
              type: 'Point' as const,
              coordinates: [position.coords.longitude, position.coords.latitude] as [number, number],
            },
            speed,
            heading,
            accuracy: position.coords.accuracy ?? undefined,
            timestamp: new Date(position.timestamp).toISOString(),
          };

          if (SocketService.isConnected) {
            SocketService.sendLocationUpdate(payload);
          } else {
            updateMyDriverLocation(payload).catch(() => {});
          }
          setLastError(null);
          setLastErrorCode(null);
        } catch (error) {
          if (cancelled) return;
          const message = error instanceof Error ? error.message : 'Location unavailable';
          const code =
            error && typeof error === 'object' && 'code' in error && typeof error.code === 'number'
              ? error.code
              : null;
          setLastError(message);
          setLastErrorCode(code);
          flowLog('driver.location.failure', { message, code: code ?? undefined });
        }
      });
    }

    sendTickRef.current = sendTick;
    sendTick();
    intervalId = setInterval(sendTick, cadenceMs);

    return () => {
      cancelled = true;
      sendTickRef.current = () => {};
      if (intervalId) clearInterval(intervalId);
    };
  }, [cadenceMs]);

  const retryNow = useCallback(() => {
    sendTickRef.current();
  }, []);

  return {
    permissionStatus,
    lastError,
    lastErrorCode,
    isTracking: cadenceMs !== null,
    retryNow,
  };
}
