/**
 * Admill Fleet Management System — mobile entry point.
 *
 * @format
 */

import React from 'react';
import { StatusBar, StyleSheet, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PaperProvider } from 'react-native-paper';
import { QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/auth/AuthContext';
import { queryClient } from './src/config/queryClient';
import { paperTheme } from './src/design-system/theme';
import { RootNavigator } from './src/navigation/RootNavigator';
import { configureDeviceLocation } from './src/utils/deviceLocation';

configureDeviceLocation();

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <PaperProvider theme={paperTheme}>
            <AuthProvider>
              <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
              <RootNavigator />
            </AuthProvider>
          </PaperProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});

export default App;
