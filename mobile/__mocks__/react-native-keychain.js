// Manual Jest mock — react-native-keychain has no native module available
// in the test environment. In-memory store is enough for auth flow tests.
let store = {};

module.exports = {
  setGenericPassword: jest.fn(async (username, password, options) => {
    store[options?.service ?? 'default'] = { username, password };
    return true;
  }),
  getGenericPassword: jest.fn(async (options) => {
    return store[options?.service ?? 'default'] ?? false;
  }),
  resetGenericPassword: jest.fn(async (options) => {
    delete store[options?.service ?? 'default'];
    return true;
  }),
  __reset: () => {
    store = {};
  },
};
