import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { useAuth } from '../auth/AuthContext';
import { LoadingState } from '../components';
import { ProfileIncompleteScreen } from '../features/profile/ProfileIncompleteScreen';
import { AuthNavigator } from './AuthNavigator';
import { CustomerNavigator } from './CustomerNavigator';
import { DriverNavigator } from './DriverNavigator';
import { OwnerNavigator } from './OwnerNavigator';

// The one and only place role branches into a navigator
// (architecture-baseline.md §5.1) — no role-switcher, ever.
export function RootNavigator() {
  const { status, user, startupError, retryStartup } = useAuth();

  return (
    <NavigationContainer>
      {status === 'loading' && <LoadingState />}
      {/* A stored session exists but couldn't be validated because the
          network/server was unreachable — distinct from a genuinely expired
          session (status 'unauthenticated'), so a dropped connection at
          launch never silently signs the user out of an otherwise-valid
          session (the same "don't collapse failure states" principle issue
          #2 established for useProfileStatus, applied to the one startup
          path that fix doesn't cover). The stored refresh token is left
          untouched — Retry re-attempts the exact same restore. */}
      {status === 'error' && (
        <ProfileIncompleteScreen
          icon="wifi-off"
          title="Connection problem"
          description={startupError ?? "We couldn't reach the server. Check your connection and try again."}
          actionLabel="Retry"
          onAction={retryStartup}
        />
      )}
      {status === 'unauthenticated' && <AuthNavigator />}
      {status === 'authenticated' && user?.role === 'OWNER' && <OwnerNavigator />}
      {status === 'authenticated' && user?.role === 'DRIVER' && <DriverNavigator />}
      {status === 'authenticated' && user?.role === 'CUSTOMER' && <CustomerNavigator />}
    </NavigationContainer>
  );
}
