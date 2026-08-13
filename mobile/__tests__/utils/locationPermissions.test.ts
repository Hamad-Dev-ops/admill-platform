import { PermissionsAndroid, Platform } from 'react-native';
import {
  checkLocationPermission,
  requestLocationPermission,
} from '../../src/utils/locationPermissions';

// The installed @react-native/jest-preset resolves Platform.OS to 'ios' by
// default, but checkLocationPermission/requestLocationPermission both
// short-circuit to 'granted' for any non-android platform. Force 'android'
// here so the PermissionsAndroid.check/request branches actually run.
describe('locationPermissions', () => {
  const originalOS = Platform.OS;

  beforeEach(() => {
    Platform.OS = 'android';
  });

  afterEach(() => {
    Platform.OS = originalOS;
    jest.restoreAllMocks();
  });

  it('reports granted when PermissionsAndroid.check resolves true', async () => {
    jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(true);
    await expect(checkLocationPermission()).resolves.toBe('granted');
  });

  it('reports denied when PermissionsAndroid.check resolves false', async () => {
    jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(false);
    await expect(checkLocationPermission()).resolves.toBe('denied');
  });

  it('maps the GRANTED request result to "granted"', async () => {
    jest.spyOn(PermissionsAndroid, 'request').mockResolvedValue(PermissionsAndroid.RESULTS.GRANTED);
    await expect(requestLocationPermission()).resolves.toBe('granted');
  });

  it('maps NEVER_ASK_AGAIN to "blocked"', async () => {
    jest
      .spyOn(PermissionsAndroid, 'request')
      .mockResolvedValue(PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN);
    await expect(requestLocationPermission()).resolves.toBe('blocked');
  });

  it('maps a plain denial to "denied"', async () => {
    jest.spyOn(PermissionsAndroid, 'request').mockResolvedValue(PermissionsAndroid.RESULTS.DENIED);
    await expect(requestLocationPermission()).resolves.toBe('denied');
  });
});
