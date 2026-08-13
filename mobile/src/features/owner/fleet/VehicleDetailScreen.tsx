import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Button,
  Card,
  ErrorState,
  Header,
  IconButton,
  LoadingState,
  Modal,
  StatusChip,
} from '../../../components';
import { getApiErrorMessage } from '../../../api/client';
import { assignDriverToVehicle, getVehicleById } from '../../../api/vehicles.api';
import { colors, spacing } from '../../../design-system/tokens';
import type { OwnerStackParamList } from '../../../navigation/owner/types';
import { VEHICLE_STATUS_LABEL, VEHICLE_STATUS_TONE } from '../../../utils/statusPresentation';
import { useDriverLookup } from '../shared/useDriverLookup';
import { SERVICE_TYPE_LABEL, VEHICLE_TYPE_LABEL } from './vehicleLabels';

type Props = NativeStackScreenProps<OwnerStackParamList, 'VehicleDetail'>;

export function VehicleDetailScreen({ navigation, route }: Props) {
  const { vehicleId } = route.params;
  const queryClient = useQueryClient();
  const [assignSheetVisible, setAssignSheetVisible] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  const vehicleQuery = useQuery({
    queryKey: ['vehicles', vehicleId],
    queryFn: () => getVehicleById(vehicleId),
  });
  const { drivers, getDriverLabel, isLoading: driversLoading } = useDriverLookup();

  const assignMutation = useMutation({
    mutationFn: (driverId: string) => assignDriverToVehicle(vehicleId, driverId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      setAssignSheetVisible(false);
    },
    onError: (error) => setAssignError(getApiErrorMessage(error, 'Unable to assign driver')),
  });

  if (vehicleQuery.isLoading) {
    return (
      <View style={styles.container}>
        <Header title="Vehicle" onBack={() => navigation.goBack()} />
        <LoadingState />
      </View>
    );
  }

  if (vehicleQuery.isError || !vehicleQuery.data) {
    return (
      <View style={styles.container}>
        <Header title="Vehicle" onBack={() => navigation.goBack()} />
        <ErrorState onRetry={() => vehicleQuery.refetch()} />
      </View>
    );
  }

  const vehicle = vehicleQuery.data;
  // Only approved drivers can be usefully assigned — an unapproved driver
  // can't go AVAILABLE at all (ROLE-PERMISSION-MATRIX.md).
  const availableDrivers = drivers.filter((driver) => driver.approvalStatus === 'APPROVED');

  return (
    <View style={styles.container}>
      <Header
        title={vehicle.vehicleCode}
        onBack={() => navigation.goBack()}
        right={
          <IconButton
            icon="pencil-outline"
            onPress={() => navigation.navigate('VehicleForm', { vehicleId })}
          />
        }
      />
      <ScrollView contentContainerStyle={styles.content}>
        <Card>
          <Card.Content style={styles.cardContent}>
            <View style={styles.row}>
              <Text variant="titleLarge">{vehicle.plateNumber}</Text>
              <StatusChip
                label={VEHICLE_STATUS_LABEL[vehicle.currentStatus]}
                tone={VEHICLE_STATUS_TONE[vehicle.currentStatus]}
              />
            </View>
            <Text variant="bodyMedium" style={styles.muted}>
              {VEHICLE_TYPE_LABEL[vehicle.vehicleType]}
            </Text>
          </Card.Content>
        </Card>

        <Card>
          <Card.Content style={styles.cardContent}>
            <Text variant="titleSmall">Assigned Driver</Text>
            <Text variant="bodyMedium">{getDriverLabel(vehicle.assignedDriver)}</Text>
            <Button
              variant="secondary"
              onPress={() => setAssignSheetVisible(true)}
              loading={driversLoading}
            >
              {vehicle.assignedDriver ? 'Reassign Driver' : 'Assign Driver'}
            </Button>
          </Card.Content>
        </Card>

        <Card>
          <Card.Content style={styles.cardContent}>
            <Text variant="titleSmall">Vehicle Details</Text>
            <DetailRow label="Registration Number" value={vehicle.registrationNumber} />
            <DetailRow label="Chassis Number" value={vehicle.chassisNumber} />
            <DetailRow label="Insurance Policy" value={vehicle.insurancePolicyNumber} />
            <DetailRow label="Insurance Expiry" value={vehicle.insuranceExpiry.slice(0, 10)} />
            <DetailRow label="Registration Expiry" value={vehicle.registrationExpiry.slice(0, 10)} />
          </Card.Content>
        </Card>

        <Card>
          <Card.Content style={styles.cardContent}>
            <Text variant="titleSmall">Recovery Services</Text>
            <Text variant="bodyMedium">
              {vehicle.recoveryType.map((type) => SERVICE_TYPE_LABEL[type]).join(', ')}
            </Text>
          </Card.Content>
        </Card>
      </ScrollView>

      <Modal visible={assignSheetVisible} onDismiss={() => setAssignSheetVisible(false)}>
        <Text variant="titleMedium" style={styles.sheetTitle}>
          Assign Driver
        </Text>
        {!!assignError && (
          <Text style={styles.error} variant="bodySmall">
            {assignError}
          </Text>
        )}
        <ScrollView style={styles.sheetList}>
          {availableDrivers.length === 0 && (
            <Text style={styles.muted}>No drivers available to assign.</Text>
          )}
          {availableDrivers.map((driver) => (
            <Button
              key={driver._id}
              variant="text"
              onPress={() => assignMutation.mutate(driver._id)}
              loading={assignMutation.isPending}
            >
              {getDriverLabel(driver._id)}
            </Button>
          ))}
        </ScrollView>
      </Modal>
    </View>
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
  muted: { color: colors.inkMuted },
  detailRow: { gap: 2 },
  sheetTitle: { color: colors.ink, marginBottom: spacing.sm },
  sheetList: { maxHeight: 300 },
  error: { color: colors.danger, marginBottom: spacing.xs },
});
