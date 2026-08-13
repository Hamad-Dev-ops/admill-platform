import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LoadingState } from '../components';
import { DriverRegistrationScreen } from '../features/driver/onboarding/DriverRegistrationScreen';
import { DriverDocumentsScreen } from '../features/driver/documents/DriverDocumentsScreen';
import { IncomingJobOfferModal } from '../features/driver/offers/IncomingJobOfferModal';
import { useIncomingJobOffer } from '../features/driver/offers/useIncomingJobOffer';
import { DriverEditProfileScreen } from '../features/driver/profile/DriverEditProfileScreen';
import { DriverJobDetailScreen } from '../features/driver/jobs/DriverJobDetailScreen';
import { DriverLocationTrackingRunner } from '../features/driver/tracking/DriverLocationTrackingRunner';
import { DriverVehicleScreen } from '../features/driver/vehicle/DriverVehicleScreen';
import { NotificationsScreen } from '../features/shared/notifications/NotificationsScreen';
import { ProfileIncompleteScreen } from '../features/profile/ProfileIncompleteScreen';
import { useProfileStatus } from '../hooks/useProfileStatus';
import { DriverTabNavigator } from './driver/DriverTabNavigator';
import type { DriverStackParamList } from './driver/types';

const Stack = createNativeStackNavigator<DriverStackParamList>();

export function DriverNavigator() {
  const profileStatus = useProfileStatus();

  return (
    <>
      {profileStatus.kind === 'loading' && <LoadingState />}

      {profileStatus.kind === 'error' && (
        <ProfileIncompleteScreen
          icon="wifi-off"
          title="Connection problem"
          description="We couldn't load your profile. Check your connection and try again."
          actionLabel="Retry"
          onAction={profileStatus.retry}
        />
      )}

      {profileStatus.kind === 'no-profile' && <DriverRegistrationScreen />}

      {profileStatus.kind === 'pending-approval' && (
        <ProfileIncompleteScreen
          icon="clock-outline"
          title="Approval pending"
          description="Your company owner is reviewing your documents. You'll be notified once approved."
        />
      )}

      {profileStatus.kind === 'rejected' && (
        <ProfileIncompleteScreen
          icon="close-circle-outline"
          title="Application rejected"
          description="Your driver application wasn't approved. Contact your company owner for details."
        />
      )}

      {profileStatus.kind === 'ready' && (
        <>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="DriverTabs" component={DriverTabNavigator} />
            <Stack.Screen name="JobDetail" component={DriverJobDetailScreen} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} />
            <Stack.Screen name="Vehicle" component={DriverVehicleScreen} />
            <Stack.Screen name="Documents" component={DriverDocumentsScreen} />
            <Stack.Screen name="EditProfile" component={DriverEditProfileScreen} />
          </Stack.Navigator>
          {/* One GPS-sending loop for the whole app, not per-screen — see the
              component's own comment for why. Deliberately still gated to
              'ready' only, unlike DriverOfferOverlay below — GPS reporting
              needs a real driver status to report against, and is a separate
              concern from "don't miss a job offer that arrives early". */}
          <DriverLocationTrackingRunner />
        </>
      )}

      {/* Mounted unconditionally, outside every profileStatus branch above —
          not gated behind 'ready' — so its socket listener registers as
          early as this navigator itself mounts (essentially the same moment
          SocketService.connect() fires in AuthContext), instead of waiting
          for the driver-profile fetch that gates every other branch here.
          QA audit finding #4: that gate used to be the dominant real window
          in which a genuine job:new-request could reach the socket with no
          listener attached at all to catch it. Holds no navigation state of
          its own, just overlays, and is safe to mount even before the
          driver's profile is known to be ready — useIncomingJobOffer's own
          "not offered to me" filter (and its buffer for "don't know my own
          ID yet") handles every state correctly on its own. */}
      <DriverOfferOverlay />
    </>
  );
}

function DriverOfferOverlay() {
  const { offer, dismiss } = useIncomingJobOffer();
  return <IncomingJobOfferModal offer={offer} onDismiss={dismiss} onAccepted={dismiss} />;
}
