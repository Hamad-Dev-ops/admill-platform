import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import MapView, { Marker } from 'react-native-maps';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, ErrorState, Header, InlineError, LoadingState, TextInput } from '../../../components';
import { getApiErrorMessage } from '../../../api/client';
import { createJob } from '../../../api/jobs.api';
import { estimateFare } from '../../../api/pricing.api';
import { colors, spacing } from '../../../design-system/tokens';
import type { CustomerStackParamList } from '../../../navigation/customer/types';
import { getDevicePosition } from '../../../utils/deviceLocation';
import { flowCoords, flowLog } from '../../../utils/flowLog';
import {
  checkLocationPermission,
  openAppSettings,
  requestLocationPermission,
} from '../../../utils/locationPermissions';
import { SERVICE_TYPE_LABEL } from '../../owner/fleet/vehicleLabels';
import { isOnSiteService } from './onSiteServiceTypes';

type Props = NativeStackScreenProps<CustomerStackParamList, 'FareEstimate'>;

interface LocationPoint {
  latitude: number;
  longitude: number;
}

const DUBAI_FALLBACK = { latitude: 25.2048, longitude: 55.2708, latitudeDelta: 0.1, longitudeDelta: 0.1 };

export function FareEstimateScreen({ route }: Props) {
  const navigation = useNavigation<NativeStackNavigationProp<CustomerStackParamList>>();
  const queryClient = useQueryClient();
  const { serviceType } = route.params;
  const needsDestination = !isOnSiteService(serviceType);

  const [permissionStatus, setPermissionStatus] = useState<'checking' | 'granted' | 'denied' | 'blocked'>('checking');
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [pickup, setPickup] = useState<LocationPoint | null>(null);
  const [destination, setDestination] = useState<LocationPoint | null>(null);
  const [destinationLabel, setDestinationLabel] = useState('');
  const [bookingError, setBookingError] = useState<string | null>(null);

  const capturePickup = useCallback(async () => {
    let status = await checkLocationPermission();
    if (status !== 'granted') {
      status = await requestLocationPermission();
    }
    setPermissionStatus(status);
    flowLog('customer.location.permission', { status });
    if (status !== 'granted') {
      return;
    }

    setLocating(true);
    setLocationError(null);
    flowLog('customer.location.request_start');
    try {
      const position = await getDevicePosition();
      const point = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      setPickup(point);
      flowLog('customer.location.success', flowCoords(point.latitude, point.longitude));
      flowLog('customer.pickup_set', { source: 'gps', ...flowCoords(point.latitude, point.longitude) });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to get current location';
      setLocationError(message);
      flowLog('customer.location.failure', { message });
    } finally {
      setLocating(false);
    }
  }, []);

  useEffect(() => {
    void capturePickup();
  }, [capturePickup]);

  useEffect(() => {
    if (!needsDestination && pickup) {
      setDestination(pickup);
    }
  }, [needsDestination, pickup]);

  const handleMapPress = (coordinate: LocationPoint) => {
    if (!pickup) {
      setPickup(coordinate);
      setLocationError(null);
      flowLog('customer.pickup_set', { source: 'map', ...flowCoords(coordinate.latitude, coordinate.longitude) });
      return;
    }
    if (needsDestination) {
      setDestination(coordinate);
      flowLog('customer.destination_set', flowCoords(coordinate.latitude, coordinate.longitude));
    }
  };

  const readyForEstimate = !!pickup && (!needsDestination || !!destination);

  const estimateQuery = useQuery({
    queryKey: [
      'pricing',
      'estimate',
      serviceType,
      pickup?.latitude,
      pickup?.longitude,
      destination?.latitude,
      destination?.longitude,
    ],
    queryFn: async () => {
      flowLog('pricing.request_start', { serviceType });
      try {
        const result = await estimateFare({
          serviceType,
          pickupLocation: { type: 'Point', coordinates: [pickup!.longitude, pickup!.latitude] },
          destinationLocation: { type: 'Point', coordinates: [destination!.longitude, destination!.latitude] },
        });
        flowLog('pricing.request_success', { total: result.total, distanceKm: result.distanceKm });
        return result;
      } catch (error) {
        flowLog('pricing.request_failure', { message: getApiErrorMessage(error, 'estimate failed') });
        throw error;
      }
    },
    enabled: readyForEstimate,
  });

  const createJobMutation = useMutation({
    mutationFn: () => {
      const pickupAddress = 'Current location';
      const destinationPoint = needsDestination ? destination! : pickup!;
      const destinationAddress = needsDestination
        ? destinationLabel.trim() || 'Selected location'
        : pickupAddress;

      flowLog('job.create_start', { serviceType });
      return createJob({
        serviceType,
        pickupLocation: {
          geo: { type: 'Point', coordinates: [pickup!.longitude, pickup!.latitude] },
          address: pickupAddress,
        },
        destinationLocation: {
          geo: { type: 'Point', coordinates: [destinationPoint.longitude, destinationPoint.latitude] },
          address: destinationAddress,
        },
      });
    },
    onSuccess: (job) => {
      flowLog('job.create_success', { jobId: job._id, jobNumber: job.jobNumber });
      setBookingError(null);
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      navigation.replace('FindingDriver', { jobId: job._id });
    },
    onError: (error) => {
      const message = getApiErrorMessage(error, 'Unable to request recovery');
      flowLog('job.create_failure', { message });
      setBookingError(message);
    },
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header title={SERVICE_TYPE_LABEL[serviceType]} onBack={() => navigation.goBack()} />

      {permissionStatus === 'checking' && <LoadingState />}

      {(permissionStatus === 'denied' || permissionStatus === 'blocked') && (
        <ErrorState
          message={
            permissionStatus === 'blocked'
              ? 'Location access is blocked. Enable it in Settings to set your pickup point.'
              : 'Location access is needed to set your pickup point.'
          }
          onRetry={
            permissionStatus === 'blocked'
              ? openAppSettings
              : () => requestLocationPermission().then((status) => {
                  setPermissionStatus(status);
                  if (status === 'granted') void capturePickup();
                })
          }
        />
      )}

      {permissionStatus === 'granted' && (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.mapWrap}>
            <MapView
              style={styles.map}
              initialRegion={
                pickup ? { ...pickup, latitudeDelta: 0.05, longitudeDelta: 0.05 } : DUBAI_FALLBACK
              }
              onPress={(event) => handleMapPress(event.nativeEvent.coordinate)}
            >
              {pickup && <Marker coordinate={pickup} title="Pickup" pinColor={colors.success} />}
              {destination && needsDestination && (
                <Marker coordinate={destination} title="Destination" pinColor={colors.danger} />
              )}
            </MapView>
          </View>

          {locating && !pickup && (
            <Text variant="bodySmall" style={styles.hint}>
              Getting your current location…
            </Text>
          )}

          {!!locationError && !pickup && (
            <InlineError>{`${locationError} You can retry GPS or tap the map to set pickup.`}</InlineError>
          )}

          {!pickup && !locating && (
            <Text variant="bodySmall" style={styles.hint}>
              Tap the map to set your pickup location.
            </Text>
          )}

          {pickup && needsDestination && !destination && (
            <Text variant="bodySmall" style={styles.hint}>
              Tap the map to set your drop-off location.
            </Text>
          )}

          {needsDestination && destination && (
            <TextInput
              testID="destination-label-input"
              label="Drop-off description (optional)"
              value={destinationLabel}
              onChangeText={setDestinationLabel}
            />
          )}

          {!pickup && (
            <Button variant="secondary" onPress={() => void capturePickup()} loading={locating} disabled={locating}>
              Retry current location
            </Button>
          )}

          <Card>
            <Card.Content style={styles.cardContent}>
              <Text variant="titleSmall">Estimated fare</Text>
              {!readyForEstimate && (
                <Text variant="bodySmall" style={styles.muted}>
                  {!pickup
                    ? 'Set a pickup location to continue.'
                    : needsDestination
                      ? 'Set a drop-off location to see your fare.'
                      : 'Getting your location…'}
                </Text>
              )}
              {readyForEstimate && estimateQuery.isLoading && <LoadingState />}
              {readyForEstimate && estimateQuery.isError && (
                <InlineError>{getApiErrorMessage(estimateQuery.error, 'Unable to get a fare estimate')}</InlineError>
              )}
              {readyForEstimate && estimateQuery.data && (
                <>
                  <Text variant="headlineSmall" style={styles.total}>
                    AED {estimateQuery.data.total.toFixed(2)}
                  </Text>
                  {estimateQuery.data.factors.map((factor) => (
                    <View key={factor.name} style={styles.factorRow}>
                      <Text variant="bodySmall" style={styles.muted}>
                        {factor.description}
                      </Text>
                      <Text variant="bodySmall">AED {factor.amount.toFixed(2)}</Text>
                    </View>
                  ))}
                  <Text variant="bodySmall" style={styles.muted}>
                    {estimateQuery.data.distanceKm.toFixed(1)} km · {estimateQuery.data.durationMinutes} min
                  </Text>
                </>
              )}
            </Card.Content>
          </Card>

          {!!bookingError && <InlineError>{bookingError}</InlineError>}

          <Button
            variant="primary"
            onPress={() => {
              setBookingError(null);
              createJobMutation.mutate();
            }}
            loading={createJobMutation.isPending}
            disabled={!readyForEstimate || !estimateQuery.data || createJobMutation.isPending}
          >
            Request Recovery
          </Button>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xl },
  mapWrap: { height: 240, borderRadius: 12, overflow: 'hidden' },
  map: { flex: 1 },
  hint: { color: colors.inkMuted, textAlign: 'center' },
  cardContent: { gap: spacing.xs },
  muted: { color: colors.inkMuted },
  error: { color: colors.danger },
  total: { color: colors.ink },
  factorRow: { flexDirection: 'row', justifyContent: 'space-between' },
});
