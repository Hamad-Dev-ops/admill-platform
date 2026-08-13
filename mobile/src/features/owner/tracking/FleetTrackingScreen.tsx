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
import type { DriverStatus } from '../../../types/enums';
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

interface DriverMarkerProps {
  driverId: string;
  employeeId: string;
  status: DriverStatus;
  position: LivePosition;
  onCalloutPress: (driverId: string) => void;
}

// Performance Audit finding F2: previously, a location update for ANY one
// driver replaced the whole trackedDrivers array (see the useMemo below),
// which — combined with an inline, unmemoized Marker per driver — meant
// every driver's marker re-rendered on every single driver's update, not
// just the one that moved. Extracting this as its own React.memo'd
// component fixes it: trackedDrivers' unaffected entries keep the exact
// same `position`/`driver` object references across a re-render (the
// spread in handleLocationChanged below only replaces the one driver's
// entry), so React.memo's default shallow prop comparison correctly skips
// re-rendering every marker except the one whose driver actually moved.
// onCalloutPress is passed down as a stable (useCallback'd) function taking
// driverId as an argument, rather than a fresh per-driver closure, so it
// never itself defeats the memo comparison.
const DriverMarker = React.memo(function DriverMarkerImpl({
  driverId,
  employeeId,
  status,
  position,
  onCalloutPress,
}: DriverMarkerProps) {
  return (
    <Marker
      coordinate={position}
      title={employeeId}
      description={DRIVER_STATUS_LABEL[status]}
      accessibilityLabel={`Driver ${employeeId}, ${DRIVER_STATUS_LABEL[status]}`}
      pinColor={STATUS_MARKER_COLOR[status] ?? colors.inkMuted}
      onCalloutPress={() => onCalloutPress(driverId)}
    />
  );
});

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

  // Stable across renders so it never itself defeats DriverMarker's memo
  // comparison (an inline `() => navigation.navigate(...)` per-driver
  // closure, as this used to be, would recreate a "changed" prop on every
  // render regardless of whether that driver's own data changed).
  const handleCalloutPress = useCallback(
    (driverId: string) => navigation.navigate('DriverDetail', { driverId }),
    [navigation],
  );

  // A new job for the company may shortly change a driver's status
  // (AVAILABLE -> ON_JOB) — refresh the roster rather than trying to derive
  // that client-side.
  useSocketEvent('job:new-request', () => {
    queryClient.invalidateQueries({ queryKey: ['drivers', 'tracking'] });
  });

  // Kept as its own memo, separate from trackedDrivers below, specifically
  // so it only recomputes when the REST roster itself changes — NOT on
  // every livePositions update. Without this split, a REST-sourced position
  // object (any driver not yet touched by a live socket update) would get a
  // brand-new object literal on every single trackedDrivers recompute, even
  // though its actual value never changed — silently defeating
  // DriverMarker's React.memo for every driver except the one that just
  // moved (Performance Audit finding F2 — caught by a referential-stability
  // test, not just inferred from the extraction alone).
  const restPositions = useMemo(() => {
    const drivers = driversQuery.data?.data ?? [];
    const positions: Record<string, LivePosition> = {};
    for (const driver of drivers) {
      const coords = driver.currentLocation?.coordinates;
      if (coords) {
        positions[driver._id] = { latitude: coords[1], longitude: coords[0] };
      }
    }
    return positions;
  }, [driversQuery.data]);

  const trackedDrivers = useMemo(() => {
    const drivers = driversQuery.data?.data ?? [];
    return drivers
      .map((driver) => {
        const position = livePositions[driver._id] ?? restPositions[driver._id] ?? null;
        return position ? { driver, position } : null;
      })
      .filter((entry): entry is { driver: (typeof drivers)[number]; position: LivePosition } => !!entry);
  }, [driversQuery.data, livePositions, restPositions]);

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
              <DriverMarker
                key={driver._id}
                driverId={driver._id}
                employeeId={driver.employeeId}
                status={driver.status}
                position={position}
                onCalloutPress={handleCalloutPress}
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
