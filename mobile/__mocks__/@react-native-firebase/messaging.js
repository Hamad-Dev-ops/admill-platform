// Manual Jest mock — @react-native-firebase/messaging has no native module
// available in the test environment (same reasoning as the other manual
// mocks in this folder). Matches the real package's v26 modular API (free
// functions taking a Messaging instance), not the older namespaced
// `messaging()` pattern. Defaults to "permission denied" so
// initializePushNotifications' happy path never silently runs unmocked in a
// test that doesn't care about push; tests that do care override
// requestPermission/getToken via jest.spyOn on the exported functions.
const AuthorizationStatus = {
  NOT_DETERMINED: -1,
  DENIED: 0,
  AUTHORIZED: 1,
  PROVISIONAL: 2,
};

const mockMessagingInstance = { __mock: 'messaging-instance' };

module.exports = {
  __esModule: true,
  AuthorizationStatus,
  getMessaging: jest.fn(() => mockMessagingInstance),
  getToken: jest.fn(async () => 'mock-fcm-token'),
  requestPermission: jest.fn(async () => AuthorizationStatus.DENIED),
  onTokenRefresh: jest.fn(() => jest.fn()),
  onMessage: jest.fn(() => jest.fn()),
  setBackgroundMessageHandler: jest.fn(),
};
