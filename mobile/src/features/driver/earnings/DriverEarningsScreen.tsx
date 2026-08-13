import React from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, EmptyState, ErrorState, Header, LoadingState, MetricCard } from '../../../components';
import { colors, spacing } from '../../../design-system/tokens';
import type { Job } from '../../../types/entities';
import { SERVICE_TYPE_LABEL } from '../../owner/fleet/vehicleLabels';
import { useDriverEarnings } from './useDriverEarnings';

export function DriverEarningsScreen() {
  const { jobs, totalEarnings, completedTripsCount, isLoading, isError, refetch } = useDriverEarnings();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header title="Earnings" />

      {isLoading && <LoadingState />}
      {!isLoading && isError && <ErrorState onRetry={() => refetch()} />}

      {!isLoading && !isError && (
        <FlatList
          data={jobs}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.content}
          ListHeaderComponent={
            <View style={styles.summaryRow}>
              <MetricCard label="Total Earnings" value={`AED ${totalEarnings.toFixed(2)}`} icon="cash-multiple" />
              <MetricCard label="Completed Trips" value={completedTripsCount} icon="check-circle-outline" />
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              icon="cash-multiple"
              title="No completed trips yet"
              description="Your earnings will show up here once you complete a job."
            />
          }
          renderItem={({ item }) => <EarningsRow job={item} />}
        />
      )}
    </SafeAreaView>
  );
}

function EarningsRow({ job }: { job: Job }) {
  const fare = job.finalFare ?? job.estimatedFare;
  const date = (job.completedAt ?? job.updatedAt).slice(0, 10);
  return (
    <Card style={styles.rowCard}>
      <Card.Content style={styles.rowContent}>
        <View style={styles.rowText}>
          <Text variant="titleSmall">{job.jobNumber}</Text>
          <Text variant="bodySmall" style={styles.muted}>
            {SERVICE_TYPE_LABEL[job.serviceType]} · {date}
          </Text>
        </View>
        <Text variant="titleSmall">AED {fare.toFixed(2)}</Text>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xl },
  summaryRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  rowCard: { marginBottom: spacing.sm },
  rowContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowText: { gap: 2 },
  muted: { color: colors.inkMuted },
});
