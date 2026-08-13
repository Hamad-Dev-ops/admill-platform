import { useCallback, useEffect, useRef, useState } from 'react';
import Geolocation from '@react-native-community/geolocation';
import { updateMyDriverLocation } from '../../../api/drivers.api';
import { SocketService } from '../../../socket/SocketService';
import type { DriverStatus } from '../../../types/enums';
import {
  checkLocationPermission,
  requestLocationPermission,
  type LocationPermissionStatus,
} from '../../../utils/locationPermissions';

// Design-handoff cadence (SOCKET-CONTRACT.md, frontend-docs/DESIGN-MAPPING.md):
// 4s while on an active job, 15s while idle/available, nothing otherwise —
// entirely client-side, the backend enforces no cadence of its own.
function cadenceForStatus(status: DriverStatus | undefined): number | null {
  if (status === 'ON_JOB') return 4000;
  if (status === 'AVAILABLE') return 15000;
  return null; // OFFLINE / ON_BREAK / ON_LEAVE / SUSPENDED / unknown — no tracking
}

// Standard W3C-style Geolocation error codes (this library follows the same
// convention): 1 = PERMISSION_DENIED, 2 = POSITION_UNAVAILABLE (location
// services off, or genuinely no fix — this is what fires when GPS is
// disabled at the OS level even though the app itself has permission),
// 3 = TIMEOUT.
export const POSITION_UNAVAILABLE_CODE = 2;

export interface DriverLocationTrackingState {
  permissionStatus: LocationPermissionStatus;
  lastError: string | null;
  lastErrorCode: number | null;
  isTracking: boolean;
  retryNow: () => void;
}

// Uses one getCurrentPosition call per cadence tick (not watchPosition) —
// a direct, predictable match for "send a position every N seconds" rather
// than reacting to the device's own (differently-paced) location-change
// events. Sends via the existing SocketService when connected, falling back
// to the REST endpoint otherwise (both funnel through the same backend
// TrackingService — SOCKET-CONTRACT.md). Never sends anything but a real,
// freshly-read device coordinate — there is no fallback/default location
// anywhere in this loop; if a position can't be obtained, nothing is sent
// and lastError/lastErrorCode surface why, for DriverLocationTrackingRunner
// to show real feedback instead of the driver silently appearing stuck at
// an old location.
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
      ensurePermission().then((granted) => {
        if (!granted || cancelled) return;

        Geolocation.getCurrentPosition(
          (position) => {
            if (cancelled) return;
            const payload = {
              location: {
                type: 'Point' as const,
                coordinates: [position.coords.longitude, position.coords.latitude] as [
                  number,
                  number,
                ],
              },
              speed: position.coords.speed ?? undefined,
              heading: position.coords.heading ?? undefined,
              accuracy: position.coords.accuracy ?? undefined,
              timestamp: new Date(position.timestamp).toISOString(),
            };

            if (SocketService.isConnected) {
              SocketService.sendLocationUpdate(payload);
            } else {
              // Best-effort REST fallback — never blocks the tracking loop on
              // a slow/failed request.
              updateMyDriverLocation(payload).catch(() => {});
            }
            setLastError(null);
            setLastErrorCode(null);
          },
          (error) => {
            if (cancelled) return;
            setLastError(error.message);
            setLastErrorCode(error.code);
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 },
        );
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
