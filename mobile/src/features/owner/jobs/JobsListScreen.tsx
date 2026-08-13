import React, { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Card,
  EmptyState,
  ErrorState,
  Header,
  LoadingState,
  SelectableChipGroup,
  StatusChip,
} from '../../../components';
import { listJobs } from '../../../api/jobs.api';
import { colors, spacing } from '../../../design-system/tokens';
import { useSocketEvent } from '../../../hooks/useSocketEvent';
import type { OwnerStackParamList } from '../../../navigation/owner/types';
import type { Job } from '../../../types/entities';
import type { JobStatus } from '../../../types/enums';
import { JOB_STATUS_LABEL, JOB_STATUS_TONE } from '../../../utils/statusPresentation';
import { SERVICE_TYPE_LABEL } from '../fleet/vehicleLabels';

const STATUS_FILTER_OPTIONS = (Object.keys(JOB_STATUS_LABEL) as JobStatus[]).map((value) => ({
  value,
  label: JOB_STATUS_LABEL[value],
}));

export function JobsListScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<OwnerStackParamList>>();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<JobStatus | null>(null);

  const jobsQuery = useQuery({
    queryKey: ['jobs', 'list', statusFilter],
    queryFn: () => listJobs({ limit: 50, status: statusFilter ?? undefined }),
  });

  // Owner auto-joins company:<id>:fleet on connect (SOCKET-CONTRACT.md) — a
  // new job offered to this company's drivers arrives here live. Status
  // changes are scoped to job:<jobId> rooms this screen never subscribes
  // to, so a plain invalidate on a light interval isn't attempted here;
  // the list is fresh again on focus/pull-to-refresh instead.
  useSocketEvent('job:new-request', () => {
    queryClient.invalidateQueries({ queryKey: ['jobs', 'list'] });
  });

  const jobs = jobsQuery.data?.data ?? [];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header title="Jobs" />
      <View style={styles.filters}>
        <SelectableChipGroup
          options={STATUS_FILTER_OPTIONS}
          selectedValues={statusFilter ? [statusFilter] : []}
          onToggle={(value) =>
            setStatusFilter((current) => (current === value ? null : (value as JobStatus)))
          }
        />
      </View>

      {jobsQuery.isLoading && <LoadingState />}
      {jobsQuery.isError && <ErrorState onRetry={() => jobsQuery.refetch()} />}
      {!jobsQuery.isLoading && !jobsQuery.isError && jobs.length === 0 && (
        <EmptyState icon="clipboard-list-outline" title="No jobs found" />
      )}
      {!jobsQuery.isLoading && !jobsQuery.isError && jobs.length > 0 && (
        <FlatList
          data={jobs}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <JobRow job={item} onPress={() => navigation.navigate('JobDetail', { jobId: item._id })} />
          )}
        />
      )}
    </SafeAreaView>
  );
}

function JobRow({ job, onPress }: { job: Job; onPress: () => void }) {
  return (
    <Card style={styles.card} onPress={onPress}>
      <Card.Content style={styles.cardContent}>
        <View style={styles.rowBetween}>
          <Text variant="titleSmall">{job.jobNumber}</Text>
          <StatusChip label={JOB_STATUS_LABEL[job.status]} tone={JOB_STATUS_TONE[job.status]} />
        </View>
        <Text variant="bodySmall" style={styles.muted}>
          {SERVICE_TYPE_LABEL[job.serviceType]}
        </Text>
        <Text variant="bodySmall" style={styles.muted} numberOfLines={1}>
          {job.pickupLocation.address}
        </Text>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  filters: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  list: { padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xl },
  card: { marginBottom: spacing.sm },
  cardContent: { gap: 2 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  muted: { color: colors.inkMuted },
});
