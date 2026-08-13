module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: ['react-native-gesture-handler/jestSetup'],
  moduleNameMapper: {
    '^@react-native-async-storage/async-storage$':
      '@react-native-async-storage/async-storage/jest',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community|-async-storage)?|@react-navigation|react-native-.*|@tanstack)/)',
  ],
};
