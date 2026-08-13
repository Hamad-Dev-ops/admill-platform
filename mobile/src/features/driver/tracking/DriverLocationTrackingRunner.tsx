import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';
import { Button } from '../../../components';
import { getMyDriverProfile } from '../../../api/drivers.api';
import { colors, spacing } from '../../../design-system/tokens';
import { openAppSettings } from '../../../utils/locationPermissions';
import { POSITION_UNAVAILABLE_CODE, useDriverLocationTracking } from './useDriverLocationTracking';

// Mounted once, globally, in DriverNavigator (never per-screen — one GPS
// loop for the whole app, architecture-baseline.md real-time rules). Reads
// the driver's live status from the same cached ['drivers','me'] query the
// Dashboard uses, so toggling status anywhere immediately changes the
// tracking cadence here without a second fetch.
export function DriverLocationTrackingRunner() {
  const driverQuery = useQuery({
    queryKey: ['drivers', 'me'],
    queryFn: getMyDriverProfile,
  });

  const { permissionStatus, lastError, lastErrorCode, isTracking, retryNow } =
    useDriverLocationTracking(driverQuery.data?.status);

  if (!isTracking) {
    return null;
  }

  if (permissionStatus !== 'granted') {
    return (
      <Banner
        text={
          permissionStatus === 'blocked'
            ? "Location access is blocked. Enable it in Settings so dispatch can see you're online."
            : 'Location access is needed to share your position while online.'
        }
        actionLabel={permissionStatus === 'blocked' ? 'Open Settings' : undefined}
        onAction={permissionStatus === 'blocked' ? openAppSettings : undefined}
      />
    );
  }

  // Permission is granted but the most recent position fetch itself still
  // failed — previously silent (no UI at all once permissionStatus reached
  // 'granted'), leaving the driver with no idea their position wasn't
  // actually reaching dispatch, and no reason offered for why nearby jobs
  // might never arrive. code 2 (POSITION_UNAVAILABLE) is what Android
  // reports when Location Services are off at the OS level, or a fix
  // genuinely can't be obtained — distinct from a slow fix (TIMEOUT, code
  // 3), which gets a lighter-weight message since the next automatic retry
  // (every 4s/15s already) is likely to just succeed on its own.
  if (lastError) {
    const isLocationServicesIssue = lastErrorCode === POSITION_UNAVAILABLE_CODE;
    return (
      <Banner
        text={
          isLocationServicesIssue
            ? 'Location unavailable. Please enable location services to receive nearby jobs.'
            : "Couldn't get your current location. Retrying automatically…"
        }
        actionLabel="Retry now"
        onAction={retryNow}
      />
    );
  }

  return null;
}

function Banner({
  text,
  actionLabel,
  onAction,
}: {
  text: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.banner} pointerEvents="box-none">
      <View style={styles.card}>
        <Text variant="bodySmall" style={styles.text}>
          {text}
        </Text>
        {!!actionLabel && !!onAction && (
          <Button variant="text" onPress={onAction}>
            {actionLabel}
          </Button>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    padding: spacing.sm,
    zIndex: 10,
  },
  card: {
    backgroundColor: colors.ink,
    borderRadius: 8,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  text: { color: colors.surface },
});
