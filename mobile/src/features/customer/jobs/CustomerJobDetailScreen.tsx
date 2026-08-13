import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Avatar,
  Button,
  Card,
  ErrorState,
  Header,
  InlineError,
  LoadingState,
  StarRatingInput,
  StatusChip,
  TextInput,
} from '../../../components';
import { getApiErrorMessage, isConflictError } from '../../../api/client';
import { getDriverLocation } from '../../../api/drivers.api';
import { cancelJob, getJobById, rateJob } from '../../../api/jobs.api';
import { colors, spacing } from '../../../design-system/tokens';
import { useSocketEvent } from '../../../hooks/useSocketEvent';
import type { CustomerStackParamList } from '../../../navigation/customer/types';
import { SocketService } from '../../../socket/SocketService';
import type { GeoPoint } from '../../../types/api';
import type { Job } from '../../../types/entities';
import { getRoute } from '../../../utils/directions';
import { JOB_STATUS_LABEL, JOB_STATUS_TONE } from '../../../utils/statusPresentation';
import { SERVICE_TYPE_LABEL } from '../../owner/fleet/vehicleLabels';

type Props = NativeStackScreenProps<CustomerStackParamList, 'JobDetail'>;

const TERMINAL_STATUSES = ['COMPLETED', 'CANCELLED', 'EXPIRED'];
// Narrower than "non-terminal" — GAP-REPORT.md gap #13, re-verified
// directly against tracking.service.ts's assertCanViewDriverLocation: a
// customer can only ever see driver location while the job is EN_ROUTE or
// STARTED, not ACCEPTED/ARRIVED.
const LOCATION_VISIBLE_STATUSES = ['EN_ROUTE', 'STARTED'];

export function CustomerJobDetailScreen({ navigation, route }: Props) {
  const { jobId } = route.params;
  const queryClient = useQueryClient();
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [ratingStars, setRatingStars] = useState(0);
  const [ratingReview, setRatingReview] = useState('');
  const [alreadyRated, setAlreadyRated] = useState(false);
  const [liveDriverLocation, setLiveDriverLocation] = useState<GeoPoint | null>(null);

  const jobQuery = useQuery({
    queryKey: ['jobs', jobId],
    queryFn: () => getJobById(jobId),
  });

  useEffect(() => {
    SocketService.subscribeToJob(jobId);
  }, [jobId]);

  const refetchJob = () => queryClient.invalidateQueries({ queryKey: ['jobs', jobId] });
  useSocketEvent('job:status-changed', (job) => {
    if (job._id === jobId) refetchJob();
  });
  useSocketEvent('job:accepted', (job) => {
    if (job._id === jobId) refetchJob();
  });

  const job = jobQuery.data;
  const canShowLocation = !!job && LOCATION_VISIBLE_STATUSES.includes(job.status) && !!job.driverId;

  const driverLocationQuery = useQuery({
    queryKey: ['drivers', job?.driverId, 'location'],
    queryFn: () => getDriverLocation(job!.driverId!),
    enabled: canShowLocation,
    retry: false,
  });

  useSocketEvent('driver:location:changed', (payload) => {
    if (job?.driverId && payload.driverId === job.driverId) {
      setLiveDriverLocation(payload.location);
    }
  });

  // Pickup/destination are set at job creation and never change, so this is
  // stable for the job's whole lifetime — unlike driver location, no status
  // gating needed. getRoute() never throws; a null result (Directions/Routes
  // API not configured, quota, timeout, no route found, ...) just means no
  // polyline is drawn — the map already works fine without one (gap #6).
  const routeQuery = useQuery({
    queryKey: ['directions', jobId],
    queryFn: () => getRoute(job!.pickupLocation.geo, job!.destinationLocation.geo),
    enabled: !!job,
    retry: false,
  });

  const cancelMutation = useMutation({
    mutationFn: (reason: string) => cancelJob(jobId, reason),
    onSuccess: () => {
      setShowCancelForm(false);
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
    onError: (error) => setActionError(getApiErrorMessage(error, 'Unable to cancel job')),
  });

  const ratingMutation = useMutation({
    mutationFn: () => rateJob(jobId, { stars: ratingStars as 1 | 2 | 3 | 4 | 5, review: ratingReview.trim() || undefined }),
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
    onError: (error) => {
      if (isConflictError(error)) {
        setAlreadyRated(true);
      } else {
        setActionError(getApiErrorMessage(error, 'Unable to submit rating'));
      }
    },
  });

  if (jobQuery.isLoading) {
    return (
      <View style={styles.container}>
        <Header title="Job" onBack={() => navigation.goBack()} />
        <LoadingState />
      </View>
    );
  }

  if (jobQuery.isError || !job) {
    return (
      <View style={styles.container}>
        <Header title="Job" onBack={() => navigation.goBack()} />
        <ErrorState onRetry={() => jobQuery.refetch()} />
      </View>
    );
  }

  const isTerminal = TERMINAL_STATUSES.includes(job.status);
  const canCancel = !isTerminal;
  const isAlreadyAccepted = job.status !== 'PENDING';
  const needsRating = job.status === 'COMPLETED' && !alreadyRated && !ratingMutation.isSuccess;
  const driverMarker = liveDriverLocation ?? driverLocationQuery.data?.location ?? null;

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

        {/* Pickup/destination markers always shown; the route line (gap #6)
            only renders once routeQuery actually resolves real geometry —
            markers-only remains the fallback for a missing/misconfigured
            key, quota, timeout, or no-route-found (src/utils/directions.ts
            never throws, just resolves null). */}
        <View style={styles.mapWrap}>
          <MapView style={styles.map} initialRegion={regionFor(job)}>
            {!!routeQuery.data && (
              <Polyline coordinates={routeQuery.data} strokeColor={colors.ink} strokeWidth={4} />
            )}
            <Marker
              coordinate={{
                latitude: job.pickupLocation.geo.coordinates[1],
                longitude: job.pickupLocation.geo.coordinates[0],
              }}
              title="Pickup"
              accessibilityLabel="Pickup location"
              pinColor={colors.success}
            />
            <Marker
              coordinate={{
                latitude: job.destinationLocation.geo.coordinates[1],
                longitude: job.destinationLocation.geo.coordinates[0],
              }}
              title="Destination"
              accessibilityLabel="Destination location"
              pinColor={colors.danger}
            />
            {driverMarker && (
              <Marker
                coordinate={{ latitude: driverMarker.coordinates[1], longitude: driverMarker.coordinates[0] }}
                title="Your driver"
                accessibilityLabel="Your driver's current location"
                pinColor={colors.primary}
              />
            )}
          </MapView>
        </View>
        {!!job.driverId && !canShowLocation && (
          <Text variant="bodySmall" style={styles.muted}>
            Live location isn't available until your driver is on the way.
          </Text>
        )}

        {job.assignedDriver && (
          <Card>
            <Card.Content style={[styles.cardContent, styles.driverRow]}>
              <Avatar
                name={`${job.assignedDriver.firstName} ${job.assignedDriver.lastName}`}
                imageUrl={job.assignedDriver.profileImage}
                size={48}
              />
              <View style={styles.driverInfo}>
                <Text variant="titleSmall">
                  {job.assignedDriver.firstName} {job.assignedDriver.lastName}
                </Text>
                <Text variant="bodySmall" style={styles.muted}>
                  {job.assignedDriver.rating.toFixed(1)}★
                </Text>
              </View>
            </Card.Content>
          </Card>
        )}

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
            <Text variant="titleSmall">Fare</Text>
            <DetailRow label="Estimated Fare" value={`AED ${job.estimatedFare.toFixed(2)}`} />
            {job.finalFare !== undefined && (
              <DetailRow label="Total Charged" value={`AED ${job.finalFare.toFixed(2)}`} />
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

        {!!actionError && <InlineError>{actionError}</InlineError>}

        {needsRating && (
          <Card>
            <Card.Content style={styles.cardContent}>
              <Text variant="titleSmall">Rate your trip</Text>
              <StarRatingInput value={ratingStars} onChange={setRatingStars} />
              <TextInput
                testID="rating-review-input"
                label="Review (optional)"
                value={ratingReview}
                onChangeText={setRatingReview}
              />
              <Button
                variant="primary"
                disabled={ratingStars === 0 || ratingMutation.isPending}
                loading={ratingMutation.isPending}
                onPress={() => ratingMutation.mutate()}
              >
                Submit Rating
              </Button>
            </Card.Content>
          </Card>
        )}

        {job.status === 'COMPLETED' && (alreadyRated || ratingMutation.isSuccess) && (
          <Card>
            <Card.Content style={styles.cardContent}>
              <Text variant="bodyMedium">Thanks — you've already rated this trip.</Text>
            </Card.Content>
          </Card>
        )}

        {canCancel && (
          <Card>
            <Card.Content style={styles.cardContent}>
              {!showCancelForm ? (
                <Button variant="danger" onPress={() => setShowCancelForm(true)}>
                  Cancel Request
                </Button>
              ) : (
                <View style={styles.cardContent}>
                  <Text variant="bodySmall" style={styles.muted}>
                    {isAlreadyAccepted
                      ? 'A driver has already been assigned to this job. Are you sure you want to cancel?'
                      : 'Cancel this recovery request?'}
                  </Text>
                  <TextInput
                    testID="cancel-reason-input"
                    label="Cancellation reason"
                    value={cancelReason}
                    onChangeText={setCancelReason}
                  />
                  <View style={styles.actionsRow}>
                    <Button
                      variant="danger"
                      disabled={!cancelReason.trim() || cancelMutation.isPending}
                      loading={cancelMutation.isPending}
                      onPress={() => cancelMutation.mutate(cancelReason)}
                    >
                      Confirm Cancellation
                    </Button>
                    <Button variant="text" onPress={() => setShowCancelForm(false)}>
                      Keep Request
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

function regionFor(job: Job) {
  const [pLng, pLat] = job.pickupLocation.geo.coordinates;
  const [dLng, dLat] = job.destinationLocation.geo.coordinates;
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
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  driverInfo: { gap: 2 },
  mapWrap: { height: 200, borderRadius: 12, overflow: 'hidden' },
  map: { flex: 1 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailRow: { gap: 2 },
  actionsRow: { flexDirection: 'row', gap: spacing.sm },
  muted: { color: colors.inkMuted },
  error: { color: colors.danger },
});
