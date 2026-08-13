import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button, Card, ErrorState, Header, InlineError, LoadingState, StatusChip, TextInput } from '../../../components';
import { getApiErrorMessage } from '../../../api/client';
import { cancelJob, getJobById } from '../../../api/jobs.api';
import { colors, spacing } from '../../../design-system/tokens';
import { useSocketEvent } from '../../../hooks/useSocketEvent';
import type { OwnerStackParamList } from '../../../navigation/owner/types';
import type { JobStatus } from '../../../types/enums';
import { JOB_STATUS_LABEL, JOB_STATUS_TONE } from '../../../utils/statusPresentation';
import { SocketService } from '../../../socket/SocketService';
import { SERVICE_TYPE_LABEL } from '../fleet/vehicleLabels';
import { useDriverLookup } from '../shared/useDriverLookup';
import { useVehicleLookup } from '../shared/useVehicleLookup';

type Props = NativeStackScreenProps<OwnerStackParamList, 'JobDetail'>;

const TERMINAL_STATUSES: JobStatus[] = ['COMPLETED', 'CANCELLED', 'EXPIRED'];

export function JobDetailScreen({ navigation, route }: Props) {
  const { jobId } = route.params;
  const queryClient = useQueryClient();
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState<string | null>(null);

  const jobQuery = useQuery({
    queryKey: ['jobs', jobId],
    queryFn: () => getJobById(jobId),
  });
  const { getDriverLabel } = useDriverLookup();
  const { getVehicleLabel } = useVehicleLookup();

  // REST is the source of truth on mount; the socket subscription only
  // triggers a refetch when this specific job changes, never applies a
  // payload directly (architecture-baseline.md real-time rules — never
  // trust a socket event as guaranteed/complete).
  useEffect(() => {
    SocketService.subscribeToJob(jobId);
  }, [jobId]);

  const refetchJob = () => queryClient.invalidateQueries({ queryKey: ['jobs', jobId] });
  useSocketEvent('job:status-changed', refetchJob);
  useSocketEvent('job:accepted', refetchJob);

  const cancelMutation = useMutation({
    mutationFn: (reason: string) => cancelJob(jobId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      setShowCancelForm(false);
    },
    onError: (error) => setCancelError(getApiErrorMessage(error, 'Unable to cancel job')),
  });

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
  const canCancel = !TERMINAL_STATUSES.includes(job.status);

  return (
    <View style={styles.container}>
      <Header title={job.jobNumber} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content}>
        <Card>
          <Card.Content style={styles.cardContent}>
            <View style={styles.row}>
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

        <Card>
          <Card.Content style={styles.cardContent}>
            <Text variant="titleSmall">Assignment</Text>
            <DetailRow label="Driver" value={getDriverLabel(job.driverId)} />
            <DetailRow label="Vehicle" value={getVehicleLabel(job.vehicleId)} />
            {/* No customer name/phone is available here — the backend has no
                Owner-facing customer lookup (GAP-REPORT.md gap #11). */}
          </Card.Content>
        </Card>

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

        {canCancel && (
          <Card>
            <Card.Content style={styles.cardContent}>
              {!!cancelError && <InlineError>{cancelError}</InlineError>}
              {!showCancelForm ? (
                <Button variant="danger" onPress={() => setShowCancelForm(true)}>
                  Cancel Job
                </Button>
              ) : (
                <View style={styles.cardContent}>
                  <TextInput
                    testID="cancel-reason-input"
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
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailRow: { gap: 2 },
  actionsRow: { flexDirection: 'row', gap: spacing.sm },
  muted: { color: colors.inkMuted },
  error: { color: colors.danger },
});
