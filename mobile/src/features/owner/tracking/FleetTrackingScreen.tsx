import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import MapView, { Marker } from 'react-native-maps';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmptyState, ErrorState, Header, LoadingState } from '../../../components';
import { listDrivers } from '../../../api/drivers.api';
import { colors, spacing } from '../../../design-system/tokens';
import { useSocketEvent } from '../../../hooks/useSocketEvent';
import type { OwnerStackParamList } from '../../../navigation/owner/types';
import type { DriverLocationChangedPayload } from '../../../socket/SocketService';
import { DRIVER_STATUS_LABEL } from '../../../utils/statusPresentation';

// Fallback region (Dubai) used only until a real driver location is known —
// never a fabricated "current location", just a sane default map center.
const DEFAULT_REGION = {
  latitude: 25.2,
  longitude: 55.27,
  latitudeDelta: 0.3,
  longitudeDelta: 0.3,
};

const STATUS_MARKER_COLOR: Record<string, string> = {
  AVAILABLE: colors.success,
  ON_JOB: colors.info,
  ON_BREAK: colors.warning,
  OFFLINE: colors.inkMuted,
  ON_LEAVE: colors.warning,
  SUSPENDED: colors.danger,
};

interface LivePosition {
  latitude: number;
  longitude: number;
}

export function FleetTrackingScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<OwnerStackParamList>>();
  const queryClient = useQueryClient();
  // driverId -> most recent live position received over the socket. REST
  // (below) is the source of truth for who exists and their last-known
  // position; this map only ever overrides a position, never adds/removes a
  // driver that REST doesn't already know about (real-time rules —
  // architecture-baseline.md).
  const [livePositions, setLivePositions] = useState<Record<string, LivePosition>>({});

  const driversQuery = useQuery({
    queryKey: ['drivers', 'tracking'],
    queryFn: () => listDrivers({ limit: 100 }),
  });

  const handleLocationChanged = useCallback((payload: DriverLocationChangedPayload) => {
    setLivePositions((current) => ({
      ...current,
      [payload.driverId]: {
        latitude: payload.location.coordinates[1],
        longitude: payload.location.coordinates[0],
      },
    }));
  }, []);
  useSocketEvent('driver:location:changed', handleLocationChanged);

  // A new job for the company may shortly change a driver's status
  // (AVAILABLE -> ON_JOB) — refresh the roster rather than trying to derive
  // that client-side.
  useSocketEvent('job:new-request', () => {
    queryClient.invalidateQueries({ queryKey: ['drivers', 'tracking'] });
  });

  const trackedDrivers = useMemo(() => {
    const drivers = driversQuery.data?.data ?? [];
    return drivers
      .map((driver) => {
        const live = livePositions[driver._id];
        const restCoords = driver.currentLocation?.coordinates;
        const position = live ?? (restCoords ? { latitude: restCoords[1], longitude: restCoords[0] } : null);
        return position ? { driver, position } : null;
      })
      .filter((entry): entry is { driver: (typeof drivers)[number]; position: LivePosition } => !!entry);
  }, [driversQuery.data, livePositions]);

  if (driversQuery.isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Header title="Live Tracking" />
        <LoadingState />
      </SafeAreaView>
    );
  }

  if (driversQuery.isError) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Header title="Live Tracking" />
        <ErrorState onRetry={() => driversQuery.refetch()} />
      </SafeAreaView>
    );
  }

  const initialRegion = trackedDrivers[0]
    ? {
        latitude: trackedDrivers[0].position.latitude,
        longitude: trackedDrivers[0].position.longitude,
        latitudeDelta: 0.3,
        longitudeDelta: 0.3,
      }
    : DEFAULT_REGION;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header title="Live Tracking" />
      {trackedDrivers.length === 0 ? (
        <EmptyState
          icon="map-marker-off-outline"
          title="No driver locations yet"
          description="Drivers will appear here once they go online and share their location."
        />
      ) : (
        <View style={styles.mapWrap}>
          <MapView style={styles.map} initialRegion={initialRegion}>
            {trackedDrivers.map(({ driver, position }) => (
              <Marker
                key={driver._id}
                coordinate={position}
                title={driver.employeeId}
                description={DRIVER_STATUS_LABEL[driver.status]}
                pinColor={STATUS_MARKER_COLOR[driver.status] ?? colors.inkMuted}
                onCalloutPress={() => navigation.navigate('DriverDetail', { driverId: driver._id })}
              />
            ))}
          </MapView>
          <View style={styles.legend}>
            <Text variant="bodySmall" style={styles.legendText}>
              {trackedDrivers.length} driver{trackedDrivers.length === 1 ? '' : 's'} shown
            </Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  mapWrap: { flex: 1 },
  map: { flex: 1 },
  legend: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 8,
  },
  legendText: { color: colors.ink },
});
