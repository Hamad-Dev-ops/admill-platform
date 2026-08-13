import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LoadingState } from '../components';
import { CustomerJobDetailScreen } from '../features/customer/jobs/CustomerJobDetailScreen';
import { FindingDriverScreen } from '../features/customer/matching/FindingDriverScreen';
import { CustomerRegistrationScreen } from '../features/customer/onboarding/CustomerRegistrationScreen';
import { CustomerEditProfileScreen } from '../features/customer/profile/CustomerEditProfileScreen';
import { ProfileIncompleteScreen } from '../features/profile/ProfileIncompleteScreen';
import { FareEstimateScreen } from '../features/customer/request/FareEstimateScreen';
import { ServiceSelectionScreen } from '../features/customer/request/ServiceSelectionScreen';
import { NotificationsScreen } from '../features/shared/notifications/NotificationsScreen';
import { useProfileStatus } from '../hooks/useProfileStatus';
import { CustomerTabNavigator } from './customer/CustomerTabNavigator';
import type { CustomerStackParamList } from './customer/types';

const Stack = createNativeStackNavigator<CustomerStackParamList>();

export function CustomerNavigator() {
  const profileStatus = useProfileStatus();

  if (profileStatus.kind === 'loading') {
    return <LoadingState />;
  }

  if (profileStatus.kind === 'error') {
    return (
      <ProfileIncompleteScreen
        icon="wifi-off"
        title="Connection problem"
        description="We couldn't load your profile. Check your connection and try again."
        actionLabel="Retry"
        onAction={profileStatus.retry}
      />
    );
  }

  if (profileStatus.kind === 'no-profile') {
    return <CustomerRegistrationScreen />;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="CustomerTabs" component={CustomerTabNavigator} />
      <Stack.Screen name="JobDetail" component={CustomerJobDetailScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="EditProfile" component={CustomerEditProfileScreen} />
      {/* Design's own note: "The request flow is a modal stack over Home,
          never a tab — you never lose the map." Grouped with a modal
          presentation so these three screens layer over Home instead of
          replacing it in the stack. */}
      <Stack.Group screenOptions={{ presentation: 'modal' }}>
        <Stack.Screen name="ServiceSelection" component={ServiceSelectionScreen} />
        <Stack.Screen name="FareEstimate" component={FareEstimateScreen} />
        <Stack.Screen name="FindingDriver" component={FindingDriverScreen} />
      </Stack.Group>
    </Stack.Navigator>
  );
}
