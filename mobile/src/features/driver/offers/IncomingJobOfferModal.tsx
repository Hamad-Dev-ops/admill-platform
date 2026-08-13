import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Modal } from '../../../components';
import { acceptJob, rejectJob } from '../../../api/jobs.api';
import { getApiErrorMessage, isConflictError, isGoneError } from '../../../api/client';
import { colors, spacing } from '../../../design-system/tokens';
import { SERVICE_TYPE_LABEL } from '../../owner/fleet/vehicleLabels';
import type { Job } from '../../../types/entities';
import type { JobPayload } from '../../../socket/SocketService';

export interface IncomingJobOfferModalProps {
  offer: JobPayload | null;
  onDismiss: () => void;
  onAccepted: (jobId: string) => void;
}

function secondsRemaining(expiresAt: string): number {
  return Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 1000));
}

export function IncomingJobOfferModal({ offer, onDismiss, onAccepted }: IncomingJobOfferModalProps) {
  const queryClient = useQueryClient();
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  // The 10-minute expiry (JOB-LIFECYCLE.md) is enforced server-side — this
  // countdown is purely informational UX, not a substitute for the real
  // 410 the backend returns once it's actually past.
  const [remaining, setRemaining] = useState(0);

  const job = offer as unknown as Job | null;

  useEffect(() => {
    if (!job) return;
    setStatusMessage(null);
    setRemaining(secondsRemaining(job.expiresAt));
    const interval = setInterval(() => {
      setRemaining((current) => {
        if (current <= 1) {
          clearInterval(interval);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?._id]);

  const acceptMutation = useMutation({
    mutationFn: (jobId: string) => acceptJob(jobId),
    onSuccess: (acceptedJob) => {
      queryClient.invalidateQueries({ queryKey: ['drivers', 'me'] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      onAccepted(acceptedJob._id);
    },
    onError: (error) => {
      // A lost race or expiry are expected, real outcomes here — not bugs
      // (JOB-LIFECYCLE.md) — shown as a plain informational message, then
      // the offer is cleared either way since it's no longer actionable.
      if (isConflictError(error)) {
        setStatusMessage('Another driver already accepted this job.');
      } else if (isGoneError(error)) {
        setStatusMessage('This job offer has expired.');
      } else {
        setStatusMessage(getApiErrorMessage(error, 'Unable to accept this job.'));
      }
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (jobId: string) => rejectJob(jobId),
    onSettled: onDismiss,
  });

  if (!job) return null;

  // Once accept has failed with an explanatory message, hide the offer
  // details/actions and show only the message + a close button — the offer
  // is no longer actionable (already taken, expired, or rejected outright).
  const isResolvedAway = !!statusMessage;

  return (
    <Modal visible={!!offer} onDismiss={onDismiss}>
      <Text variant="headlineSmall" style={styles.title}>
        New Job Offer
      </Text>

      {!!statusMessage && (
        <View style={styles.statusBanner}>
          <Text
            variant="bodyMedium"
            style={styles.statusText}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
          >
            {statusMessage}
          </Text>
          <Button variant="text" onPress={onDismiss}>
            Close
          </Button>
        </View>
      )}

      {!isResolvedAway && (
        <View style={styles.content}>
          <Text variant="titleMedium">{SERVICE_TYPE_LABEL[job.serviceType]}</Text>

          <DetailRow label="Pickup" value={job.pickupLocation.address} />
          <DetailRow label="Destination" value={job.destinationLocation.address} />
          <DetailRow label="Distance" value={`${job.distanceKm.toFixed(1)} km`} />
          <DetailRow label="Duration" value={`${job.durationMinutes} min`} />
          <DetailRow label="Estimated Fare" value={`AED ${job.estimatedFare.toFixed(2)}`} />
          <DetailRow
            label="Expires In"
            value={remaining > 0 ? `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}` : 'Expired'}
          />

          <View style={styles.actions}>
            <Button
              variant="primary"
              onPress={() => acceptMutation.mutate(job._id)}
              loading={acceptMutation.isPending}
              disabled={acceptMutation.isPending || rejectMutation.isPending || remaining === 0}
            >
              Accept
            </Button>
            <Button
              variant="secondary"
              onPress={() => rejectMutation.mutate(job._id)}
              loading={rejectMutation.isPending}
              disabled={acceptMutation.isPending || rejectMutation.isPending}
            >
              Decline
            </Button>
          </View>
        </View>
      )}
    </Modal>
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
  title: { color: colors.ink, marginBottom: spacing.sm },
  content: { gap: spacing.xs },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between' },
  muted: { color: colors.inkMuted },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  statusBanner: { gap: spacing.xs, marginBottom: spacing.sm },
  statusText: { color: colors.ink },
});
