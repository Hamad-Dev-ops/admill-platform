import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import MapView, { Marker } from 'react-native-maps';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button, Card, ErrorState, Header, LoadingState, StatusChip, TextInput } from '../../../components';
import { getApiErrorMessage } from '../../../api/client';
import { cancelJob, getJobById, progressJobStatus } from '../../../api/jobs.api';
import { colors, spacing } from '../../../design-system/tokens';
import { useSocketEvent } from '../../../hooks/useSocketEvent';
import type { DriverStackParamList } from '../../../navigation/driver/types';
import { SocketService } from '../../../socket/SocketService';
import { JOB_STATUS_LABEL, JOB_STATUS_TONE } from '../../../utils/statusPresentation';
import { SERVICE_TYPE_LABEL } from '../../owner/fleet/vehicleLabels';
import { NEXT_DRIVER_STATUS, PROGRESS_ACTION_LABEL, isTerminalJobStatus } from './jobProgression';

type Props = NativeStackScreenProps<DriverStackParamList, 'JobDetail'>;

export function DriverJobDetailScreen({ navigation, route }: Props) {
  const { jobId } = route.params;
  const queryClient = useQueryClient();
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const jobQuery = useQuery({
    queryKey: ['jobs', jobId],
    queryFn: () => getJobById(jobId),
  });

  useEffect(() => {
    SocketService.subscribeToJob(jobId);
  }, [jobId]);

  const refetchJob = () => queryClient.invalidateQueries({ queryKey: ['jobs', jobId] });
  useSocketEvent('job:status-changed', refetchJob);
  useSocketEvent('job:accepted', refetchJob);

  const progressMutation = useMutation({
    mutationFn: (status: NonNullable<ReturnType<typeof getNextStatus>>) =>
      progressJobStatus(jobId, status),
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['drivers', 'me'] });
    },
    onError: (error) => setActionError(getApiErrorMessage(error, 'Unable to update job status')),
  });

  const cancelMutation = useMutation({
    mutationFn: (reason: string) => cancelJob(jobId, reason),
    onSuccess: () => {
      setShowCancelForm(false);
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['drivers', 'me'] });
    },
    onError: (error) => setActionError(getApiErrorMessage(error, 'Unable to cancel job')),
  });

  function getNextStatus() {
    return jobQuery.data ? NEXT_DRIVER_STATUS[jobQuery.data.status] : undefined;
  }

  if (jobQuery.isLoading) {
    return (
      <View style={styles.container}>
        <Header title="Job" onBack={() => navigation.goBack()} />
        <LoadingState />
      </View>
    );
  }

  if (jobQuery.isError || !jobQuery.data) {
    return (
      <View style={styles.container}>
        <Header title="Job" onBack={() => navigation.goBack()} />
        <ErrorState onRetry={() => jobQuery.refetch()} />
      </View>
    );
  }

  const job = jobQuery.data;
  const nextStatus = getNextStatus();
  const canCancel = !isTerminalJobStatus(job.status);

  return (
    <View style={styles.container}>
      <Header title={job.jobNumber} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content}>
        <Card>
          <Card.Content style={styles.cardContent}>
            <View style={styles.rowBetween}>
              <Text variant="titleLarge">{SERVICE_TYPE_LABEL[job.serviceType]}</Text>
              <StatusChip label={JOB_STATUS_LABEL[job.status]} tone={JOB_STATUS_TONE[job.status]} />
            </View>
          </Card.Content>
        </Card>

        <Card>
          <Card.Content style={styles.cardContent}>
            <Text variant="titleSmall">Route</Text>
            <DetailRow label="Pickup" value={job.pickupLocation.address} />
            <DetailRow label="Destination" value={job.destinationLocation.address} />
            <DetailRow label="Distance" value={`${job.distanceKm.toFixed(1)} km`} />
            <DetailRow label="Duration" value={`${job.durationMinutes} min`} />
          </Card.Content>
        </Card>

        {/* Pickup/destination markers only — the backend has no route
            geometry (frontend-docs/GAP-REPORT.md #6), so no polyline is
            drawn here; that would require calling a maps/directions
            provider directly, out of scope for this phase. */}
        <View style={styles.mapWrap}>
          <MapView
            style={styles.map}
            initialRegion={regionFor(job.pickupLocation.geo, job.destinationLocation.geo)}
          >
            <Marker
              coordinate={{
                latitude: job.pickupLocation.geo.coordinates[1],
                longitude: job.pickupLocation.geo.coordinates[0],
              }}
              title="Pickup"
              pinColor={colors.success}
            />
            <Marker
              coordinate={{
                latitude: job.destinationLocation.geo.coordinates[1],
                longitude: job.destinationLocation.geo.coordinates[0],
              }}
              title="Destination"
              pinColor={colors.danger}
            />
          </MapView>
        </View>

        <Card>
          <Card.Content style={styles.cardContent}>
            <Text variant="titleSmall">Fare</Text>
            <DetailRow label="Estimated Fare" value={`AED ${job.estimatedFare.toFixed(2)}`} />
            {job.finalFare !== undefined && (
              <DetailRow label="Final Fare" value={`AED ${job.finalFare.toFixed(2)}`} />
            )}
          </Card.Content>
        </Card>

        {job.cancellationReason && (
          <Card>
            <Card.Content style={styles.cardContent}>
              <Text variant="titleSmall">Cancellation</Text>
              <DetailRow label="Reason" value={job.cancellationReason} />
            </Card.Content>
          </Card>
        )}

        {!!actionError && (
          <Text style={styles.error} variant="bodySmall">
            {actionError}
          </Text>
        )}

        {nextStatus && (
          <Button
            variant="primary"
            onPress={() => progressMutation.mutate(nextStatus)}
            loading={progressMutation.isPending}
            disabled={progressMutation.isPending}
          >
            {PROGRESS_ACTION_LABEL[nextStatus]}
          </Button>
        )}

        {canCancel && (
          <Card>
            <Card.Content style={styles.cardContent}>
              {!showCancelForm ? (
                <Button variant="danger" onPress={() => setShowCancelForm(true)}>
                  Cancel Job
                </Button>
              ) : (
                <View style={styles.cardContent}>
                  <TextInput
                    testID="driver-cancel-reason-input"
                    label="Cancellation reason"
                    value={cancelReason}
                    onChangeText={setCancelReason}
                  />
                  <View style={styles.actionsRow}>
                    <Button
                      variant="danger"
                      disabled={!cancelReason.trim()}
                      loading={cancelMutation.isPending}
                      onPress={() => cancelMutation.mutate(cancelReason)}
                    >
                      Confirm Cancellation
                    </Button>
                    <Button variant="text" onPress={() => setShowCancelForm(false)}>
                      Keep Job
                    </Button>
                  </View>
                </View>
              )}
            </Card.Content>
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

function regionFor(
  pickup: { coordinates: [number, number] },
  destination: { coordinates: [number, number] },
) {
  const [pLng, pLat] = pickup.coordinates;
  const [dLng, dLat] = destination.coordinates;
  const latitude = (pLat + dLat) / 2;
  const longitude = (pLng + dLng) / 2;
  return {
    latitude,
    longitude,
    latitudeDelta: Math.max(Math.abs(pLat - dLat) * 1.8, 0.05),
    longitudeDelta: Math.max(Math.abs(pLng - dLng) * 1.8, 0.05),
  };
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text variant="bodySmall" style={styles.muted}>
        {label}
      </Text>
      <Text variant="bodyMedium">{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xl },
  cardContent: { gap: spacing.xs },
  mapWrap: { height: 200, borderRadius: 12, overflow: 'hidden' },
  map: { flex: 1 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailRow: { gap: 2 },
  actionsRow: { flexDirection: 'row', gap: spacing.sm },
  muted: { color: colors.inkMuted },
  error: { color: colors.danger },
});
