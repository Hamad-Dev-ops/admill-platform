import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LoadingState } from '../components';
import { DriverDetailScreen } from '../features/owner/drivers/DriverDetailScreen';
import { VehicleDetailScreen } from '../features/owner/fleet/VehicleDetailScreen';
import { VehicleFormScreen } from '../features/owner/fleet/VehicleFormScreen';
import { JobDetailScreen } from '../features/owner/jobs/JobDetailScreen';
import { AnalyticsScreen } from '../features/owner/analytics/AnalyticsScreen';
import { CompanySetupScreen } from '../features/owner/onboarding/CompanySetupScreen';
import { NotificationsScreen } from '../features/shared/notifications/NotificationsScreen';
import { ProfileIncompleteScreen } from '../features/profile/ProfileIncompleteScreen';
import { SettingsScreen } from '../features/owner/settings/SettingsScreen';
import { useProfileStatus } from '../hooks/useProfileStatus';
import { OwnerTabNavigator } from './owner/OwnerTabNavigator';
import type { OwnerStackParamList } from './owner/types';

const Stack = createNativeStackNavigator<OwnerStackParamList>();

export function OwnerNavigator() {
  const profileStatus = useProfileStatus();

  if (profileStatus.kind === 'loading') {
    return <LoadingState />;
  }

  if (profileStatus.kind === 'error') {
    return (
      <ProfileIncompleteScreen
        icon="wifi-off"
        title="Connection problem"
        description="We couldn't load your company profile. Check your connection and try again."
        actionLabel="Retry"
        onAction={profileStatus.retry}
      />
    );
  }

  if (profileStatus.kind === 'no-profile') {
    return <CompanySetupScreen />;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="OwnerTabs" component={OwnerTabNavigator} />
      <Stack.Screen name="VehicleDetail" component={VehicleDetailScreen} />
      <Stack.Screen name="VehicleForm" component={VehicleFormScreen} />
      <Stack.Screen name="DriverDetail" component={DriverDetailScreen} />
      <Stack.Screen name="JobDetail" component={JobDetailScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="Analytics" component={AnalyticsScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
    </Stack.Navigator>
  );
}
