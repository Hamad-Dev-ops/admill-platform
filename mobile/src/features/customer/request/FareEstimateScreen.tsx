import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import Geolocation from '@react-native-community/geolocation';
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
import { checkLocationPermission, openAppSettings, requestLocationPermission } from '../../../utils/locationPermissions';
import { SERVICE_TYPE_LABEL } from '../../owner/fleet/vehicleLabels';
import { isOnSiteService } from './onSiteServiceTypes';

type Props = NativeStackScreenProps<CustomerStackParamList, 'FareEstimate'>;

interface LocationPoint {
  latitude: number;
  longitude: number;
}

export function FareEstimateScreen({ route }: Props) {
  const navigation = useNavigation<NativeStackNavigationProp<CustomerStackParamList>>();
  const queryClient = useQueryClient();
  const { serviceType } = route.params;
  const needsDestination = !isOnSiteService(serviceType);

  const [permissionStatus, setPermissionStatus] = useState<'checking' | 'granted' | 'denied' | 'blocked'>('checking');
  const [locationError, setLocationError] = useState<string | null>(null);
  const [pickup, setPickup] = useState<LocationPoint | null>(null);
  const [destination, setDestination] = useState<LocationPoint | null>(null);
  const [destinationLabel, setDestinationLabel] = useState('');
  const [bookingError, setBookingError] = useState<string | null>(null);

  // One-shot pickup capture, not continuous tracking — Customer Home
  // deliberately skips requesting permission, so this screen is the actual
  // point of first use, matching the design's map-first request flow.
  useEffect(() => {
    let cancelled = false;

    async function capturePickup() {
      let status = await checkLocationPermission();
      if (status !== 'granted') {
        status = await requestLocationPermission();
      }
      if (cancelled) return;
      setPermissionStatus(status);
      if (status !== 'granted') return;

      Geolocation.getCurrentPosition(
        (position) => {
          if (cancelled) return;
          setPickup({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        },
        (error) => {
          if (!cancelled) setLocationError(error.message);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 },
      );
    }

    capturePickup();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!needsDestination && pickup) {
      setDestination(pickup);
    }
  }, [needsDestination, pickup]);

  const readyForEstimate = !!pickup && (!needsDestination || !!destination);

  const estimateQuery = useQuery({
    queryKey: ['pricing', 'estimate', serviceType, pickup?.latitude, pickup?.longitude, destination?.latitude, destination?.longitude],
    queryFn: () =>
      estimateFare({
        serviceType,
        pickupLocation: { type: 'Point', coordinates: [pickup!.longitude, pickup!.latitude] },
        destinationLocation: { type: 'Point', coordinates: [destination!.longitude, destination!.latitude] },
      }),
    enabled: readyForEstimate,
  });

  // Gap #14 resolved — the backend now resolves the operational company
  // itself; this request carries no company concept at all
  // (frontend-docs/GAP-REPORT.md, frontend-docs/API-CONTRACT.md).
  const createJobMutation = useMutation({
    mutationFn: () => {
      const pickupAddress = 'Current location';
      const destinationPoint = needsDestination ? destination! : pickup!;
      const destinationAddress = needsDestination
        ? destinationLabel.trim() || 'Selected location'
        : pickupAddress;

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
      setBookingError(null);
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      // replace, not navigate — a submitted request has nothing to "go back"
      // to on this screen; FindingDriver is the real next state (4.7).
      navigation.replace('FindingDriver', { jobId: job._id });
    },
    onError: (error) => setBookingError(getApiErrorMessage(error, 'Unable to request recovery')),
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
          onRetry={permissionStatus === 'blocked' ? openAppSettings : () => requestLocationPermission().then(setPermissionStatus)}
        />
      )}

      {!!locationError && permissionStatus === 'granted' && !pickup && (
        <ErrorState message={locationError} onRetry={() => setLocationError(null)} />
      )}

      {permissionStatus === 'granted' && (pickup || locationError) && (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.mapWrap}>
            <MapView
              style={styles.map}
              initialRegion={
                pickup
                  ? { ...pickup, latitudeDelta: 0.05, longitudeDelta: 0.05 }
                  : { latitude: 25.2048, longitude: 55.2708, latitudeDelta: 0.1, longitudeDelta: 0.1 }
              }
              onPress={
                needsDestination
                  ? (event) => setDestination(event.nativeEvent.coordinate)
                  : undefined
              }
            >
              {pickup && <Marker coordinate={pickup} title="Pickup" pinColor={colors.success} />}
              {destination && needsDestination && (
                <Marker coordinate={destination} title="Destination" pinColor={colors.danger} />
              )}
            </MapView>
          </View>

          {needsDestination && !destination && (
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

          <Card>
            <Card.Content style={styles.cardContent}>
              <Text variant="titleSmall">Estimated fare</Text>
              {!readyForEstimate && (
                <Text variant="bodySmall" style={styles.muted}>
                  {needsDestination ? 'Set a drop-off location to see your fare.' : 'Getting your location…'}
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
