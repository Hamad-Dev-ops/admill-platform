import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, EmptyState, ErrorState, Header, LoadingState } from '../../../components';
import { getApiErrorMessage } from '../../../api/client';
import { cancelJob, getJobById } from '../../../api/jobs.api';
import { colors, spacing } from '../../../design-system/tokens';
import { useSocketEvent } from '../../../hooks/useSocketEvent';
import type { CustomerStackParamList } from '../../../navigation/customer/types';
import { SocketService } from '../../../socket/SocketService';

type Props = NativeStackScreenProps<CustomerStackParamList, 'FindingDriver'>;

// No socket event exists for expiry — PENDING→EXPIRED is lazy on the
// backend, flipped only on next read (JOB-LIFECYCLE.md). Rather than
// polling (which the architecture explicitly avoids when a socket channel
// exists), this counts down to the job's own real `expiresAt` from
// GET /jobs/:id and treats reaching it, client-side, as the honest signal
// to stop waiting — not a guess, the exact real timestamp the backend
// already committed to at creation.
export function FindingDriverScreen({ route }: Props) {
  const navigation = useNavigation<NativeStackNavigationProp<CustomerStackParamList>>();
  const queryClient = useQueryClient();
  const { jobId } = route.params;
  const [timedOut, setTimedOut] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const jobQuery = useQuery({
    queryKey: ['jobs', jobId],
    queryFn: () => getJobById(jobId),
  });

  useEffect(() => {
    SocketService.subscribeToJob(jobId);
  }, [jobId]);

  useSocketEvent('job:accepted', (job) => {
    if (job._id === jobId) {
      navigation.replace('JobDetail', { jobId });
    }
  });

  useSocketEvent('job:status-changed', (job) => {
    if (job._id === jobId && job.status !== 'PENDING') {
      navigation.replace('JobDetail', { jobId });
    }
  });

  const expiresAt = jobQuery.data?.expiresAt;

  useEffect(() => {
    if (!expiresAt) return undefined;

    const msRemaining = new Date(expiresAt).getTime() - Date.now();
    if (msRemaining <= 0) {
      setTimedOut(true);
      return undefined;
    }

    const timer = setTimeout(() => setTimedOut(true), msRemaining);
    return () => clearTimeout(timer);
  }, [expiresAt]);

  const cancelMutation = useMutation({
    mutationFn: () => cancelJob(jobId, 'Customer cancelled while waiting for a driver'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      navigation.navigate('CustomerTabs');
    },
    onError: (error) => setCancelError(getApiErrorMessage(error, 'Unable to cancel')),
  });

  if (jobQuery.isLoading) {
    return (
      <View style={styles.container}>
        <Header title="Finding driver" />
        <LoadingState />
      </View>
    );
  }

  if (jobQuery.isError || !jobQuery.data) {
    return (
      <View style={styles.container}>
        <Header title="Finding driver" />
        <ErrorState onRetry={() => jobQuery.refetch()} />
      </View>
    );
  }

  const job = jobQuery.data;
  const alreadyResolved = job.status !== 'PENDING';

  if (timedOut || job.status === 'EXPIRED') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Header title="Finding driver" />
        <EmptyState
          icon="clock-alert-outline"
          title="No driver found in time"
          description="No driver accepted this request before it expired. You can try again."
          actionLabel="Back to Home"
          onAction={() => navigation.navigate('CustomerTabs')}
        />
      </SafeAreaView>
    );
  }

  if (alreadyResolved) {
    // job:status-changed/job:accepted should have already navigated us away
    // — this only renders in the brief gap before that happens, or if the
    // socket event was missed and REST is now the recovery path.
    navigation.replace('JobDetail', { jobId });
    return null;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header title="Finding driver" />
      <View style={styles.content}>
        <View style={styles.pulse} />
        <Text variant="headlineSmall" style={styles.title}>
          Finding your driver...
        </Text>
        <Text variant="bodyMedium" style={styles.muted}>
          We've notified nearby drivers. This usually takes a few minutes.
        </Text>

        {!!cancelError && (
          <Text variant="bodySmall" style={styles.error}>
            {cancelError}
          </Text>
        )}

        <Button
          variant="secondary"
          onPress={() => cancelMutation.mutate()}
          loading={cancelMutation.isPending}
          disabled={cancelMutation.isPending}
        >
          Cancel Request
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: spacing.sm },
  pulse: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primaryMuted,
    marginBottom: spacing.md,
  },
  title: { color: colors.ink },
  muted: { color: colors.inkMuted, textAlign: 'center' },
  error: { color: colors.danger },
});
