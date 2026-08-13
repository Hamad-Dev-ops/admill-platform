import React from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, ErrorState, Header, IconButton, LoadingState, StatusChip } from '../../../components';
import { getMyDriverProfile } from '../../../api/drivers.api';
import { colors, spacing } from '../../../design-system/tokens';
import { useUnreadNotificationCount } from '../../../hooks/useUnreadNotificationCount';
import type { DriverStackParamList } from '../../../navigation/driver/types';
import {
  DRIVER_STATUS_LABEL,
  DRIVER_STATUS_TONE,
  JOB_STATUS_LABEL,
  JOB_STATUS_TONE,
} from '../../../utils/statusPresentation';
import { SERVICE_TYPE_LABEL } from '../../owner/fleet/vehicleLabels';
import { useMyActiveJob } from '../shared/useMyActiveJob';
import { useMyAssignedVehicle } from '../vehicle/useMyAssignedVehicle';
import { DriverStatusToggle } from './DriverStatusToggle';

export function DriverDashboardScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<DriverStackParamList>>();
  const queryClient = useQueryClient();
  const unreadCount = useUnreadNotificationCount();

  const driverQuery = useQuery({
    queryKey: ['drivers', 'me'],
    queryFn: getMyDriverProfile,
  });
  const { activeJob, isLoading: activeJobLoading } = useMyActiveJob();
  const vehicleStatus = useMyAssignedVehicle();

  const refetchAll = () => {
    queryClient.invalidateQueries({ queryKey: ['drivers', 'me'] });
    queryClient.invalidateQueries({ queryKey: ['jobs'] });
  };

  const driver = driverQuery.data;
  const isLoading = driverQuery.isLoading;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header
        title="Dashboard"
        right={
          <IconButton
            icon={unreadCount > 0 ? 'bell-badge' : 'bell-outline'}
            accessibilityLabel={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
            onPress={() => navigation.navigate('Notifications')}
          />
        }
      />

      {isLoading && <LoadingState />}
      {!isLoading && (driverQuery.isError || !driver) && <ErrorState onRetry={refetchAll} />}

      {!isLoading && driver && (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={driverQuery.isFetching && !driverQuery.isLoading}
              onRefresh={refetchAll}
            />
          }
        >
          <Card>
            <Card.Content style={styles.statusCardContent}>
              <View style={styles.rowBetween}>
                <Text variant="titleMedium">{driver.employeeId}</Text>
                <StatusChip
                  label={DRIVER_STATUS_LABEL[driver.status]}
                  tone={DRIVER_STATUS_TONE[driver.status]}
                />
              </View>
              {driver.status === 'ON_JOB' ? (
                <Text variant="bodySmall" style={styles.muted}>
                  You're on an active job — status changes are disabled until it's complete.
                </Text>
              ) : (
                <DriverStatusToggle
                  currentStatus={driver.status as 'AVAILABLE' | 'OFFLINE' | 'ON_BREAK'}
                />
              )}
            </Card.Content>
          </Card>

          <Text variant="titleMedium" style={styles.sectionTitle}>
            Active Job
          </Text>
          {activeJobLoading && <LoadingState />}
          {!activeJobLoading && !activeJob && (
            <Text style={styles.muted}>No active job right now.</Text>
          )}
          {!activeJobLoading && activeJob && (
            <Card onPress={() => navigation.navigate('JobDetail', { jobId: activeJob._id })}>
              <Card.Content style={styles.statusCardContent}>
                <View style={styles.rowBetween}>
                  <Text variant="titleSmall">{activeJob.jobNumber}</Text>
                  <StatusChip
                    label={JOB_STATUS_LABEL[activeJob.status]}
                    tone={JOB_STATUS_TONE[activeJob.status]}
                  />
                </View>
                <Text variant="bodySmall" style={styles.muted}>
                  {SERVICE_TYPE_LABEL[activeJob.serviceType]}
                </Text>
                <Text variant="bodySmall" style={styles.muted} numberOfLines={1}>
                  {activeJob.pickupLocation.address}
                </Text>
              </Card.Content>
            </Card>
          )}

          <Text variant="titleMedium" style={styles.sectionTitle}>
            Vehicle
          </Text>
          {vehicleStatus.kind === 'loading' && <LoadingState />}
          {vehicleStatus.kind === 'no-vehicle' && (
            <Text style={styles.muted}>
              {vehicleStatus.reason === 'no-job-history'
                ? 'No vehicle information available yet.'
                : 'The vehicle from your last job is no longer available.'}
            </Text>
          )}
          {vehicleStatus.kind === 'unauthorized' && (
            <Text style={styles.muted}>This vehicle is no longer assigned to you.</Text>
          )}
          {vehicleStatus.kind === 'error' && (
            <View style={styles.rowBetween}>
              <Text style={styles.muted}>Unable to load vehicle information.</Text>
              <Button variant="text" onPress={vehicleStatus.retry}>
                Retry
              </Button>
            </View>
          )}
          {vehicleStatus.kind === 'ready' && (
            <Card onPress={() => navigation.navigate('Vehicle')}>
              <Card.Content style={styles.statusCardContent}>
                <Text variant="titleSmall">{vehicleStatus.vehicle.plateNumber}</Text>
                <Text variant="bodySmall" style={styles.muted}>
                  {vehicleStatus.vehicle.vehicleCode}
                </Text>
              </Card.Content>
            </Card>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xl },
  statusCardContent: { gap: spacing.sm },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { color: colors.ink, marginTop: spacing.sm },
  muted: { color: colors.inkMuted },
});
