import React, { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { SegmentedButtons, Text } from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, EmptyState, ErrorState, Header, LoadingState, StatusChip } from '../../../components';
import { listJobs } from '../../../api/jobs.api';
import { colors, spacing } from '../../../design-system/tokens';
import type { DriverStackParamList } from '../../../navigation/driver/types';
import type { Job } from '../../../types/entities';
import type { JobStatus } from '../../../types/enums';
import { JOB_STATUS_LABEL, JOB_STATUS_TONE } from '../../../utils/statusPresentation';
import { SERVICE_TYPE_LABEL } from '../../owner/fleet/vehicleLabels';

type Tab = 'active' | 'history';

const ACTIVE_STATUSES: JobStatus[] = ['ACCEPTED', 'EN_ROUTE', 'ARRIVED', 'STARTED'];
const HISTORY_STATUSES: JobStatus[] = ['COMPLETED', 'CANCELLED', 'EXPIRED'];

export function DriverJobsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<DriverStackParamList>>();
  const [tab, setTab] = useState<Tab>('active');

  const jobsQuery = useQuery({
    queryKey: ['jobs', 'driver-list'],
    queryFn: () => listJobs({ limit: 50 }),
  });

  const jobs = (jobsQuery.data?.data ?? []).filter((job) =>
    (tab === 'active' ? ACTIVE_STATUSES : HISTORY_STATUSES).includes(job.status),
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header title="Jobs" />
      <View style={styles.toggle}>
        <SegmentedButtons
          value={tab}
          onValueChange={(value) => setTab(value as Tab)}
          buttons={[
            { value: 'active', label: 'Active' },
            { value: 'history', label: 'History' },
          ]}
        />
      </View>

      {jobsQuery.isLoading && <LoadingState />}
      {jobsQuery.isError && <ErrorState onRetry={() => jobsQuery.refetch()} />}
      {!jobsQuery.isLoading && !jobsQuery.isError && jobs.length === 0 && (
        <EmptyState
          icon="clipboard-list-outline"
          title={tab === 'active' ? 'No active jobs' : 'No job history yet'}
        />
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
  toggle: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  list: { padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xl },
  card: { marginBottom: spacing.sm },
  cardContent: { gap: 2 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  muted: { color: colors.inkMuted },
});
