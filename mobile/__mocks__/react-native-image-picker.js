// Manual Jest mock — picker UI has no JS-side implementation available to
// the test renderer. Tests that need a specific selected asset (or a
// cancelled/error response) should override this per-test via jest.spyOn.
module.exports = {
  launchImageLibrary: jest.fn().mockResolvedValue({ didCancel: true }),
  launchCamera: jest.fn().mockResolvedValue({ didCancel: true }),
};
