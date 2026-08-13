import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { List, Text } from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar, Card, ErrorState, Header, LoadingState, StatusChip } from '../../../components';
import { getMyDriverProfile } from '../../../api/drivers.api';
import { useAuth } from '../../../auth/AuthContext';
import { colors, spacing } from '../../../design-system/tokens';
import type { DriverStackParamList } from '../../../navigation/driver/types';
import { isPopulatedIdentity } from '../../../types/entities';
import { APPROVAL_STATUS_LABEL, APPROVAL_STATUS_TONE } from '../../../utils/statusPresentation';

type ListLeftIconProps = { color: string; style: StyleProp<ViewStyle> };

function editIcon(props: ListLeftIconProps) {
  return <List.Icon {...props} icon="account-edit-outline" />;
}
function vehicleIcon(props: ListLeftIconProps) {
  return <List.Icon {...props} icon="truck-outline" />;
}
function documentsIcon(props: ListLeftIconProps) {
  return <List.Icon {...props} icon="file-document-outline" />;
}
function notificationsIcon(props: ListLeftIconProps) {
  return <List.Icon {...props} icon="bell-outline" />;
}
function logoutIcon(props: ListLeftIconProps) {
  return <List.Icon {...props} icon="logout" />;
}

export function DriverProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<DriverStackParamList>>();
  const { logout } = useAuth();

  const driverQuery = useQuery({
    queryKey: ['drivers', 'me'],
    queryFn: getMyDriverProfile,
  });

  const driver = driverQuery.data;
  const identity = driver && isPopulatedIdentity(driver.userId) ? driver.userId : null;
  const fullName = identity ? `${identity.firstName} ${identity.lastName}` : 'Driver';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header title="Profile" />

      {driverQuery.isLoading && <LoadingState />}
      {!driverQuery.isLoading && (driverQuery.isError || !driver) && (
        <ErrorState onRetry={() => driverQuery.refetch()} />
      )}

      {!driverQuery.isLoading && driver && (
        <ScrollView contentContainerStyle={styles.content}>
          <Card>
            <Card.Content style={styles.headerCardContent}>
              <Avatar name={fullName} imageUrl={driver.profileImage} size={56} />
              <View style={styles.headerText}>
                <Text variant="titleMedium">{fullName}</Text>
                <Text variant="bodySmall" style={styles.muted}>
                  {driver.employeeId}
                </Text>
              </View>
              <StatusChip
                label={APPROVAL_STATUS_LABEL[driver.approvalStatus]}
                tone={APPROVAL_STATUS_TONE[driver.approvalStatus]}
              />
            </Card.Content>
          </Card>

          <Card>
            <Card.Content style={styles.detailCardContent}>
              {identity && <DetailRow label="Email" value={identity.email} />}
              {identity && <DetailRow label="Phone" value={identity.phone} />}
              <DetailRow label="Rating" value={driver.rating > 0 ? driver.rating.toFixed(1) : 'No ratings yet'} />
              <DetailRow label="Total Trips" value={String(driver.totalTrips)} />
              <DetailRow label="Driving License" value={driver.drivingLicenseNumber} />
              <DetailRow label="License Expiry" value={driver.drivingLicenseExpiry.slice(0, 10)} />
            </Card.Content>
          </Card>

          <List.Section>
            <List.Item title="Edit Profile" left={editIcon} onPress={() => navigation.navigate('EditProfile')} />
            <List.Item title="Vehicle" left={vehicleIcon} onPress={() => navigation.navigate('Vehicle')} />
            <List.Item
              title="Documents"
              left={documentsIcon}
              onPress={() => navigation.navigate('Documents')}
            />
            <List.Item
              title="Notifications"
              left={notificationsIcon}
              onPress={() => navigation.navigate('Notifications')}
            />
            <List.Item title="Log out" left={logoutIcon} onPress={() => logout().catch(() => {})} />
          </List.Section>
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
  headerCardContent: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerText: { flex: 1, gap: 2 },
  detailCardContent: { gap: spacing.xs },
  detailRow: { gap: 2 },
  muted: { color: colors.inkMuted },
});
