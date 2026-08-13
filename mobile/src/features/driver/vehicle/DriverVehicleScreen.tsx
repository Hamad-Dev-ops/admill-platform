import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, EmptyState, ErrorState, Header, LoadingState, StatusChip } from '../../../components';
import { colors, spacing } from '../../../design-system/tokens';
import { VEHICLE_STATUS_LABEL, VEHICLE_STATUS_TONE } from '../../../utils/statusPresentation';
import { SERVICE_TYPE_LABEL, VEHICLE_TYPE_LABEL } from '../../owner/fleet/vehicleLabels';
import { useMyAssignedVehicle } from './useMyAssignedVehicle';

export function DriverVehicleScreen() {
  const navigation = useNavigation();
  const status = useMyAssignedVehicle();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header title="Vehicle" onBack={() => navigation.goBack()} />

      {status.kind === 'loading' && <LoadingState />}

      {status.kind === 'error' && <ErrorState onRetry={status.retry} />}

      {status.kind === 'no-vehicle' && (
        <EmptyState
          icon="truck-outline"
          title="No vehicle found"
          description={
            status.reason === 'no-job-history'
              ? "You haven't completed any jobs yet, so we can't determine your assigned vehicle."
              : 'The vehicle from your last job is no longer available.'
          }
        />
      )}

      {status.kind === 'unauthorized' && (
        <EmptyState
          icon="account-alert-outline"
          title="Not assigned to you"
          description="This vehicle is now assigned to a different driver. Contact your company owner if you think this is a mistake."
        />
      )}

      {status.kind === 'ready' && (
        <ScrollView contentContainerStyle={styles.content}>
          <Text variant="bodySmall" style={styles.notice}>
            This shows the vehicle from your most recent job. Admill doesn't yet have a direct
            "my vehicle" lookup — contact your company owner if this looks out of date.
          </Text>

          <Card>
            <Card.Content style={styles.cardContent}>
              <View style={styles.row}>
                <Text variant="titleLarge">{status.vehicle.plateNumber}</Text>
                <StatusChip
                  label={VEHICLE_STATUS_LABEL[status.vehicle.currentStatus]}
                  tone={VEHICLE_STATUS_TONE[status.vehicle.currentStatus]}
                />
              </View>
              <Text variant="bodyMedium" style={styles.muted}>
                {VEHICLE_TYPE_LABEL[status.vehicle.vehicleType]}
              </Text>
            </Card.Content>
          </Card>

          <Card>
            <Card.Content style={styles.cardContent}>
              <Text variant="titleSmall">Vehicle Details</Text>
              <DetailRow label="Vehicle Code" value={status.vehicle.vehicleCode} />
              <DetailRow label="Registration Number" value={status.vehicle.registrationNumber} />
              <DetailRow label="Chassis Number" value={status.vehicle.chassisNumber} />
              <DetailRow label="Insurance Expiry" value={status.vehicle.insuranceExpiry.slice(0, 10)} />
              <DetailRow label="Registration Expiry" value={status.vehicle.registrationExpiry.slice(0, 10)} />
            </Card.Content>
          </Card>

          <Card>
            <Card.Content style={styles.cardContent}>
              <Text variant="titleSmall">Recovery Services</Text>
              <Text variant="bodyMedium">
                {status.vehicle.recoveryType.map((type) => SERVICE_TYPE_LABEL[type]).join(', ')}
              </Text>
            </Card.Content>
          </Card>
        </ScrollView>
      )}
    </SafeAreaView>
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
  muted: { color: colors.inkMuted },
  notice: { color: colors.inkMuted },
});
