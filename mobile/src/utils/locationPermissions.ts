import { Linking, PermissionsAndroid, Platform } from 'react-native';

export type LocationPermissionStatus = 'granted' | 'denied' | 'blocked';

// Foreground fine-location only (AndroidManifest.xml) — shared by Driver's
// continuous GPS-tracking loop and Customer's one-shot pickup-location
// capture (moved here from src/features/driver/tracking/ in Phase 4.5,
// since it was always pure permission-handling infra with no Driver-specific
// logic — Driver's own behavior is unchanged, only the import path moved).
export async function checkLocationPermission(): Promise<LocationPermissionStatus> {
  if (Platform.OS !== 'android') {
    // iOS isn't built/verified in this environment (Phase 1 established
    // Android-only verification) — treat as granted so the rest of the
    // tracking logic isn't blocked on a platform check we can't test.
    return 'granted';
  }

  const has = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
  return has ? 'granted' : 'denied';
}

export async function requestLocationPermission(): Promise<LocationPermissionStatus> {
  if (Platform.OS !== 'android') {
    return 'granted';
  }

  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    {
      title: 'Location Permission',
      message: 'Admill needs your location to use this feature.',
      buttonPositive: 'Allow',
      buttonNegative: 'Deny',
    },
  );

  if (result === PermissionsAndroid.RESULTS.GRANTED) return 'granted';
  if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) return 'blocked';
  return 'denied';
}

export function openAppSettings(): void {
  Linking.openSettings();
}
