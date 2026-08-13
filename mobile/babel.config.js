module.exports = {
  presets: ['module:@react-native/babel-preset'],
  // zod v4's ESM build uses `export * as ns from '...'` — only actually exercised by
  // a full ahead-of-time bundle (release builds' createBundleReleaseJsAndAssets task;
  // debug builds normally fetch live from Metro and never hit this path). Already a
  // transitive dependency in node_modules (pulled in elsewhere), just not wired in.
  plugins: ['@babel/plugin-transform-export-namespace-from'],
};
