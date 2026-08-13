import {
  AuthorizationStatus,
  getMessaging,
  getToken,
  onMessage,
  onTokenRefresh,
  requestPermission,
} from '@react-native-firebase/messaging';
import { initializePushNotifications } from '../../src/notifications/pushRegistration';
import { registerDeviceToken } from '../../src/api/deviceTokens.api';

jest.mock('../../src/api/deviceTokens.api', () => ({
  registerDeviceToken: jest.fn().mockResolvedValue(undefined),
}));

const mockGetMessaging = getMessaging as jest.Mock;
const mockGetToken = getToken as jest.Mock;
const mockRequestPermission = requestPermission as jest.Mock;
const mockOnTokenRefresh = onTokenRefresh as jest.Mock;
const mockOnMessage = onMessage as jest.Mock;

describe('initializePushNotifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetMessaging.mockReturnValue({ __mock: 'messaging-instance' });
    mockRequestPermission.mockResolvedValue(AuthorizationStatus.DENIED);
    mockGetToken.mockResolvedValue('mock-fcm-token');
    mockOnTokenRefresh.mockReturnValue(jest.fn());
    mockOnMessage.mockReturnValue(jest.fn());
  });

  // The concrete cause identified for "app won't reopen without reinstalling"
  // — getMessaging() throwing synchronously during Firebase's native-init
  // race must never propagate out of this function.
  it('never throws — returns a no-op unsubscribe — if getMessaging() itself throws', () => {
    mockGetMessaging.mockImplementation(() => {
      throw new Error('Firebase native App not ready');
    });

    let unsubscribe!: () => void;
    expect(() => {
      unsubscribe = initializePushNotifications();
    }).not.toThrow();
    expect(() => unsubscribe()).not.toThrow();
    expect(mockOnTokenRefresh).not.toHaveBeenCalled();
  });

  it('never throws if onTokenRefresh/onMessage subscription itself throws', () => {
    mockOnTokenRefresh.mockImplementation(() => {
      throw new Error('boom');
    });

    let unsubscribe!: () => void;
    expect(() => {
      unsubscribe = initializePushNotifications();
    }).not.toThrow();
    expect(() => unsubscribe()).not.toThrow();
  });

  it('registers the device token when permission is granted', async () => {
    mockRequestPermission.mockResolvedValue(AuthorizationStatus.AUTHORIZED);

    initializePushNotifications();
    await Promise.resolve();
    await Promise.resolve();

    expect(registerDeviceToken).toHaveBeenCalledWith(
      expect.objectContaining({ fcmToken: 'mock-fcm-token' }),
    );
  });

  it('does not register a token when permission is denied', async () => {
    mockRequestPermission.mockResolvedValue(AuthorizationStatus.DENIED);

    initializePushNotifications();
    await Promise.resolve();
    await Promise.resolve();

    expect(registerDeviceToken).not.toHaveBeenCalled();
  });

  it('re-registers the token on FCM token refresh', async () => {
    let refreshHandler: (() => void) | undefined;
    mockOnTokenRefresh.mockImplementation((_instance: unknown, handler: () => void) => {
      refreshHandler = handler;
      return jest.fn();
    });

    initializePushNotifications();
    refreshHandler?.();
    await Promise.resolve();
    await Promise.resolve();

    expect(registerDeviceToken).toHaveBeenCalled();
  });

  it('unsubscribe() tears down both listeners without throwing even if they throw', () => {
    const unsubTokenRefresh = jest.fn(() => {
      throw new Error('teardown failure');
    });
    mockOnTokenRefresh.mockReturnValue(unsubTokenRefresh);

    const unsubscribe = initializePushNotifications();

    expect(() => unsubscribe()).not.toThrow();
    expect(unsubTokenRefresh).toHaveBeenCalled();
  });
});
