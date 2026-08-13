import React from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Button,
  Card,
  ErrorState,
  Header,
  IconButton,
  LoadingState,
  MetricCard,
  StatusChip,
} from '../../../components';
import { colors, spacing } from '../../../design-system/tokens';
import { useUnreadNotificationCount } from '../../../hooks/useUnreadNotificationCount';
import type { OwnerStackParamList } from '../../../navigation/owner/types';
import type { Job } from '../../../types/entities';
import { JOB_STATUS_LABEL, JOB_STATUS_TONE } from '../../../utils/statusPresentation';
import { useDashboardData } from './useDashboardData';

export function DashboardScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<OwnerStackParamList>>();
  const unreadCount = useUnreadNotificationCount();
  const {
    isLoading,
    isError,
    isRefetching,
    fleet,
    revenue,
    pendingJobsCount,
    activeJobsCount,
    completedJobsToday,
    recentJobs,
    refetchAll,
  } = useDashboardData();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header
        title="Command Dashboard"
        right={
          <IconButton
            icon={unreadCount > 0 ? 'bell-badge' : 'bell-outline'}
            onPress={() => navigation.navigate('Notifications')}
          />
        }
      />

      {isLoading && <LoadingState label="Loading dashboard…" />}
      {!isLoading && isError && <ErrorState onRetry={refetchAll} />}

      {!isLoading && !isError && (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetchAll} />}
        >
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Today
          </Text>
          <View style={styles.metricsRow}>
            <MetricCard
              label="Today's Revenue"
              value={`AED ${(revenue?.totalRevenue ?? 0).toFixed(0)}`}
              icon="cash-multiple"
              accentColor={colors.success}
            />
            <MetricCard
              label="Completed Today"
              value={completedJobsToday}
              icon="check-circle-outline"
              accentColor={colors.success}
            />
          </View>

          <Text variant="titleMedium" style={styles.sectionTitle}>
            Jobs
          </Text>
          <View style={styles.metricsRow}>
            <MetricCard
              label="Pending"
              value={pendingJobsCount}
              icon="clock-outline"
              accentColor={colors.warning}
              onPress={() => navigation.navigate('OwnerTabs')}
            />
            <MetricCard
              label="Active"
              value={activeJobsCount}
              icon="progress-clock"
              accentColor={colors.info}
              onPress={() => navigation.navigate('OwnerTabs')}
            />
          </View>

          <Text variant="titleMedium" style={styles.sectionTitle}>
            Fleet Overview
          </Text>
          <View style={styles.metricsRow}>
            <MetricCard
              label="Total Vehicles"
              value={fleet?.totalVehicles ?? 0}
              icon="truck-outline"
            />
            <MetricCard
              label="Available"
              value={fleet?.statusBreakdown.AVAILABLE ?? 0}
              icon="truck-check-outline"
              accentColor={colors.success}
            />
          </View>
          <View style={styles.metricsRow}>
            <MetricCard
              label="On Recovery"
              value={fleet?.statusBreakdown.ON_RECOVERY ?? 0}
              icon="truck-fast-outline"
              accentColor={colors.info}
            />
            <MetricCard
              label="Offline"
              value={fleet?.statusBreakdown.OFFLINE ?? 0}
              icon="truck-off-road"
              accentColor={colors.inkMuted}
            />
          </View>

          <Text variant="titleMedium" style={styles.sectionTitle}>
            Quick Actions
          </Text>
          <View style={styles.quickActions}>
            <Button variant="secondary" onPress={() => navigation.navigate('VehicleForm', {})}>
              Add Vehicle
            </Button>
            <Button variant="secondary" onPress={() => navigation.navigate('Analytics')}>
              View Reports
            </Button>
          </View>

          <Text variant="titleMedium" style={styles.sectionTitle}>
            Recent Activity
          </Text>
          {recentJobs.length === 0 && (
            <Text style={styles.emptyText}>No recent jobs yet.</Text>
          )}
          {recentJobs.map((job: Job) => (
            <Card key={job._id} style={styles.activityCard}>
              <Card.Content style={styles.activityContent}>
                <View style={styles.activityHeader}>
                  <Text variant="titleSmall">{job.jobNumber}</Text>
                  <StatusChip label={JOB_STATUS_LABEL[job.status]} tone={JOB_STATUS_TONE[job.status]} />
                </View>
                <Text variant="bodySmall" style={styles.activitySubtitle} numberOfLines={1}>
                  {job.pickupLocation.address}
                </Text>
              </Card.Content>
            </Card>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xl },
  sectionTitle: { color: colors.ink, marginTop: spacing.sm },
  metricsRow: { flexDirection: 'row', gap: spacing.sm },
  quickActions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  activityCard: { marginBottom: spacing.xs },
  activityContent: { gap: 2 },
  activityHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  activitySubtitle: { color: colors.inkMuted },
  emptyText: { color: colors.inkMuted },
});
