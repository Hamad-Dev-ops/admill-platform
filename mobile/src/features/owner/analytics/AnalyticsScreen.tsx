import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SegmentedButtons, Text } from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Card, ErrorState, Header, LoadingState, MetricCard } from '../../../components';
import { getDriverStats, getFleetUtilization, getRevenueSummary } from '../../../api/analytics.api';
import { colors, spacing } from '../../../design-system/tokens';
import type { OwnerStackParamList } from '../../../navigation/owner/types';
import type { DriverStat } from '../../../types/entities';
import type { VehicleStatus } from '../../../types/enums';
import { VEHICLE_STATUS_LABEL } from '../../../utils/statusPresentation';
import { DATE_RANGE_OPTIONS, resolveDateRange, type DateRangePreset } from './dateRanges';

type Props = NativeStackScreenProps<OwnerStackParamList, 'Analytics'>;

export function AnalyticsScreen({ navigation }: Props) {
  const [preset, setPreset] = useState<DateRangePreset>('month');
  const range = resolveDateRange(preset);

  const revenueQuery = useQuery({
    queryKey: ['analytics', 'revenue', preset],
    queryFn: () => getRevenueSummary(range),
  });
  const driversQuery = useQuery({
    queryKey: ['analytics', 'drivers', preset],
    queryFn: () => getDriverStats(range),
  });
  const fleetQuery = useQuery({
    queryKey: ['analytics', 'fleet-utilization', preset],
    queryFn: () => getFleetUtilization(range),
  });

  const isLoading = revenueQuery.isLoading || driversQuery.isLoading || fleetQuery.isLoading;
  const isError = revenueQuery.isError || driversQuery.isError || fleetQuery.isError;

  const topDrivers = [...(driversQuery.data ?? [])].sort((a, b) => b.revenue - a.revenue);
  const statusEntries = Object.entries(fleetQuery.data?.statusBreakdown ?? {}) as [
    VehicleStatus,
    number,
  ][];
  const totalVehicles = fleetQuery.data?.totalVehicles ?? 0;
  // completedJobsCount here is scoped to the selected date range (unlike
  // statusBreakdown above, which is always current-state) — verified
  // directly against analytics.service.ts's getFleetUtilization, which
  // derives it from JobRepository.getCompletedJobStatsByVehicle(companyId,
  // range.startDate, range.endDate). Already fetched by fleetQuery; this
  // screen just never rendered it (QA audit finding #7).
  const vehiclesByJobs = [...(fleetQuery.data?.vehicles ?? [])].sort(
    (a, b) => b.completedJobsCount - a.completedJobsCount,
  );

  return (
    <View style={styles.container}>
      <Header title="Reports & Analytics" onBack={() => navigation.goBack()} />
      <View style={styles.rangeSelector}>
        <SegmentedButtons
          value={preset}
          onValueChange={(value) => setPreset(value as DateRangePreset)}
          buttons={DATE_RANGE_OPTIONS}
        />
      </View>

      {isLoading && <LoadingState />}
      {!isLoading && isError && (
        <ErrorState
          onRetry={() => {
            revenueQuery.refetch();
            driversQuery.refetch();
            fleetQuery.refetch();
          }}
        />
      )}

      {!isLoading && !isError && (
        <ScrollView contentContainerStyle={styles.content}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Revenue
          </Text>
          <View style={styles.metricsRow}>
            <MetricCard
              label="Total Revenue"
              value={`AED ${(revenueQuery.data?.totalRevenue ?? 0).toFixed(0)}`}
              icon="cash-multiple"
              accentColor={colors.success}
            />
            <MetricCard
              label="Completed Jobs"
              value={revenueQuery.data?.completedJobsCount ?? 0}
              icon="check-circle-outline"
            />
          </View>
          <View style={styles.metricsRow}>
            <MetricCard
              label="Average Fare"
              value={`AED ${(revenueQuery.data?.averageFare ?? 0).toFixed(0)}`}
              icon="calculator-variant-outline"
            />
          </View>

          <Text variant="titleMedium" style={styles.sectionTitle}>
            Fleet Utilization
          </Text>
          <Card>
            <Card.Content style={styles.cardContent}>
              <Text variant="bodyMedium">{totalVehicles} total vehicles</Text>
              {statusEntries.length === 0 && (
                <Text style={styles.muted}>No vehicles yet.</Text>
              )}
              {statusEntries.map(([status, count]) => (
                <UtilizationBar
                  key={status}
                  label={VEHICLE_STATUS_LABEL[status]}
                  count={count}
                  total={totalVehicles}
                />
              ))}
            </Card.Content>
          </Card>

          <Text variant="titleMedium" style={styles.sectionTitle}>
            Vehicle Utilization
          </Text>
          {vehiclesByJobs.length === 0 && (
            <Text style={styles.muted}>No vehicle activity in this range.</Text>
          )}
          {vehiclesByJobs.map((vehicle) => (
            <VehicleUtilizationRow key={vehicle.vehicleId} vehicle={vehicle} />
          ))}

          <Text variant="titleMedium" style={styles.sectionTitle}>
            Driver Performance
          </Text>
          {topDrivers.length === 0 && (
            <Text style={styles.muted}>No driver activity in this range.</Text>
          )}
          {topDrivers.map((stat) => (
            <DriverStatRow key={stat.driverId} stat={stat} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function UtilizationBar({ label, count, total }: { label: string; count: number; total: number }) {
  const percent = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <View style={styles.barRow}>
      <View style={styles.barLabelRow}>
        <Text variant="bodySmall">{label}</Text>
        <Text variant="bodySmall" style={styles.muted}>
          {count}
        </Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${percent}%` }]} />
      </View>
    </View>
  );
}

function VehicleUtilizationRow({
  vehicle,
}: {
  vehicle: { vehicleId: string; vehicleCode: string; completedJobsCount: number };
}) {
  return (
    <Card style={styles.driverCard}>
      <Card.Content style={styles.driverRow}>
        <Text variant="titleSmall">{vehicle.vehicleCode}</Text>
        <Text variant="bodySmall" style={styles.muted}>
          {vehicle.completedJobsCount} completed job{vehicle.completedJobsCount === 1 ? '' : 's'}
        </Text>
      </Card.Content>
    </Card>
  );
}

function DriverStatRow({ stat }: { stat: DriverStat }) {
  return (
    <Card style={styles.driverCard}>
      <Card.Content style={styles.driverRow}>
        <View style={styles.driverInfo}>
          <Text variant="titleSmall">{stat.employeeId}</Text>
          <Text variant="bodySmall" style={styles.muted}>
            {stat.completedJobsCount} jobs · {stat.totalTrips} lifetime trips · {stat.rating.toFixed(1)}★
          </Text>
        </View>
        <Text variant="titleSmall" style={styles.revenueText}>
          AED {stat.revenue.toFixed(0)}
        </Text>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  rangeSelector: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  content: { padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xl },
  sectionTitle: { color: colors.ink, marginTop: spacing.sm },
  metricsRow: { flexDirection: 'row', gap: spacing.sm },
  cardContent: { gap: spacing.sm },
  muted: { color: colors.inkMuted },
  barRow: { gap: 4 },
  barLabelRow: { flexDirection: 'row', justifyContent: 'space-between' },
  barTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  barFill: {
    height: 8,
    backgroundColor: colors.primary,
  },
  driverCard: { marginBottom: spacing.xs },
  driverRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  driverInfo: { gap: 2 },
  revenueText: { color: colors.success },
});
