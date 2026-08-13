import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Avatar, Button, Card, ErrorState, Header, LoadingState, StatusChip, TextInput } from '../../../components';
import { getApiErrorMessage } from '../../../api/client';
import { approveDriver, getDriverById, rejectDriver } from '../../../api/drivers.api';
import { colors, spacing } from '../../../design-system/tokens';
import type { OwnerStackParamList } from '../../../navigation/owner/types';
import { isPopulatedIdentity } from '../../../types/entities';
import {
  APPROVAL_STATUS_LABEL,
  APPROVAL_STATUS_TONE,
  DRIVER_STATUS_LABEL,
  DRIVER_STATUS_TONE,
} from '../../../utils/statusPresentation';
import { useVehicleLookup } from '../shared/useVehicleLookup';

type Props = NativeStackScreenProps<OwnerStackParamList, 'DriverDetail'>;

export function DriverDetailScreen({ navigation, route }: Props) {
  const { driverId } = route.params;
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);

  const driverQuery = useQuery({
    queryKey: ['drivers', driverId],
    queryFn: () => getDriverById(driverId),
  });
  const { getVehicleAssignedTo } = useVehicleLookup();

  const invalidateDriver = () => {
    queryClient.invalidateQueries({ queryKey: ['drivers'] });
  };

  const approveMutation = useMutation({
    mutationFn: () => approveDriver(driverId),
    onSuccess: invalidateDriver,
    onError: (error) => setActionError(getApiErrorMessage(error, 'Unable to approve driver')),
  });

  const rejectMutation = useMutation({
    mutationFn: () => rejectDriver(driverId, rejectReason || undefined),
    onSuccess: () => {
      invalidateDriver();
      setShowRejectInput(false);
    },
    onError: (error) => setActionError(getApiErrorMessage(error, 'Unable to reject driver')),
  });

  if (driverQuery.isLoading) {
    return (
      <View style={styles.container}>
        <Header title="Driver" onBack={() => navigation.goBack()} />
        <LoadingState />
      </View>
    );
  }

  if (driverQuery.isError || !driverQuery.data) {
    return (
      <View style={styles.container}>
        <Header title="Driver" onBack={() => navigation.goBack()} />
        <ErrorState onRetry={() => driverQuery.refetch()} />
      </View>
    );
  }

  const driver = driverQuery.data;
  const identity = isPopulatedIdentity(driver.userId) ? driver.userId : null;
  const displayName = identity ? `${identity.firstName} ${identity.lastName}` : driver.employeeId;
  const assignedVehicle = getVehicleAssignedTo(driver._id);

  return (
    <View style={styles.container}>
      <Header title={displayName} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content}>
        <Card>
          <Card.Content style={styles.identityRow}>
            <Avatar name={displayName} imageUrl={identity?.profileImage} size={56} />
            <View style={styles.identityInfo}>
              <Text variant="titleLarge">{displayName}</Text>
              <Text variant="bodySmall" style={styles.muted}>
                {driver.employeeId}
              </Text>
              {!!identity && (
                <Text variant="bodySmall" style={styles.muted}>
                  {identity.phone}
                </Text>
              )}
            </View>
          </Card.Content>
        </Card>

        <Card>
          <Card.Content style={styles.cardContent}>
            <View style={styles.row}>
              <Text variant="titleSmall">Status</Text>
              <StatusChip label={DRIVER_STATUS_LABEL[driver.status]} tone={DRIVER_STATUS_TONE[driver.status]} />
            </View>
            <View style={styles.row}>
              <Text variant="titleSmall">Approval</Text>
              <StatusChip
                label={APPROVAL_STATUS_LABEL[driver.approvalStatus]}
                tone={APPROVAL_STATUS_TONE[driver.approvalStatus]}
              />
            </View>
            <DetailRow label="Rating" value={`${driver.rating.toFixed(1)} / 5`} />
            <DetailRow label="Total Trips" value={String(driver.totalTrips)} />
            <DetailRow
              label="Assigned Vehicle"
              value={assignedVehicle ? assignedVehicle.plateNumber : 'None'}
            />
          </Card.Content>
        </Card>

        <Card>
          <Card.Content style={styles.cardContent}>
            <Text variant="titleSmall">Documents</Text>
            <DetailRow label="Emirates ID" value={driver.emiratesId} />
            <DetailRow label="Emirates ID Expiry" value={driver.emiratesIdExpiry.slice(0, 10)} />
            <DetailRow label="Driving License" value={driver.drivingLicenseNumber} />
            <DetailRow
              label="License Expiry"
              value={driver.drivingLicenseExpiry.slice(0, 10)}
            />
            {!!driver.rejectionReason && (
              <DetailRow label="Rejection Reason" value={driver.rejectionReason} />
            )}
          </Card.Content>
        </Card>

        {driver.approvalStatus === 'PENDING_APPROVAL' && (
          <Card>
            <Card.Content style={styles.cardContent}>
              <Text variant="titleSmall">Review Application</Text>
              {!!actionError && (
                <Text style={styles.error} variant="bodySmall">
                  {actionError}
                </Text>
              )}
              {!showRejectInput ? (
                <View style={styles.actionsRow}>
                  <Button
                    variant="primary"
                    onPress={() => approveMutation.mutate()}
                    loading={approveMutation.isPending}
                  >
                    Approve
                  </Button>
                  <Button variant="danger" onPress={() => setShowRejectInput(true)}>
                    Reject
                  </Button>
                </View>
              ) : (
                <View style={styles.cardContent}>
                  <TextInput
                    label="Rejection reason (optional)"
                    value={rejectReason}
                    onChangeText={setRejectReason}
                  />
                  <View style={styles.actionsRow}>
                    <Button
                      variant="danger"
                      onPress={() => rejectMutation.mutate()}
                      loading={rejectMutation.isPending}
                    >
                      Confirm Reject
                    </Button>
                    <Button variant="text" onPress={() => setShowRejectInput(false)}>
                      Cancel
                    </Button>
                  </View>
                </View>
              )}
            </Card.Content>
          </Card>
        )}
      </ScrollView>
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
  identityRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  identityInfo: { gap: 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailRow: { gap: 2 },
  actionsRow: { flexDirection: 'row', gap: spacing.sm },
  muted: { color: colors.inkMuted },
  error: { color: colors.danger },
});
