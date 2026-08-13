// Manual Jest mock — Geolocation is a native module with no JS-side
// implementation available to the test renderer. Tests that need specific
// position/error behavior should mock individual methods per-test via
// jest.spyOn; this default never resolves on its own, which is safer than a
// fake pinning it near a real coordinate.
module.exports = {
  setRNConfiguration: jest.fn(),
  requestAuthorization: jest.fn(),
  getCurrentPosition: jest.fn(),
  watchPosition: jest.fn(() => 0),
  clearWatch: jest.fn(),
  stopObserving: jest.fn(),
};
