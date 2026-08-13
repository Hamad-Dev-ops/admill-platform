import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { List, Text } from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar, Card, ErrorState, Header, LoadingState } from '../../../components';
import { getMyCustomerProfile } from '../../../api/customers.api';
import { listJobs } from '../../../api/jobs.api';
import { useAuth } from '../../../auth/AuthContext';
import { colors, spacing } from '../../../design-system/tokens';
import type { CustomerStackParamList } from '../../../navigation/customer/types';
import { isPopulatedIdentity } from '../../../types/entities';

type ListLeftIconProps = { color: string; style: StyleProp<ViewStyle> };

function editIcon(props: ListLeftIconProps) {
  return <List.Icon {...props} icon="account-edit-outline" />;
}
function notificationsIcon(props: ListLeftIconProps) {
  return <List.Icon {...props} icon="bell-outline" />;
}
function logoutIcon(props: ListLeftIconProps) {
  return <List.Icon {...props} icon="logout" />;
}

export function CustomerProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<CustomerStackParamList>>();
  const { logout } = useAuth();

  const customerQuery = useQuery({
    queryKey: ['customers', 'me'],
    queryFn: getMyCustomerProfile,
  });

  // Customer.averageRating/.totalJobs are dead fields on the backend, never
  // written by any code path (Phase 4 preflight audit, GAP-REPORT.md gap
  // #13) — derive a real completed-trips count from GET /jobs instead,
  // same pattern Driver's earnings screen uses for its own totals.
  const completedJobsQuery = useQuery({
    queryKey: ['jobs', 'completed-count'],
    queryFn: () => listJobs({ status: 'COMPLETED', limit: 1 }),
    enabled: !!customerQuery.data,
  });

  const customer = customerQuery.data;
  const identity = customer && isPopulatedIdentity(customer.userId) ? customer.userId : null;
  const fullName = identity ? `${identity.firstName} ${identity.lastName}` : 'Customer';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header title="Profile" />

      {customerQuery.isLoading && <LoadingState />}
      {!customerQuery.isLoading && (customerQuery.isError || !customer) && (
        <ErrorState onRetry={() => customerQuery.refetch()} />
      )}

      {!customerQuery.isLoading && customer && (
        <ScrollView contentContainerStyle={styles.content}>
          <Card>
            <Card.Content style={styles.headerCardContent}>
              <Avatar name={fullName} imageUrl={identity?.profileImage} size={56} />
              <View style={styles.headerText}>
                <Text variant="titleMedium">{fullName}</Text>
                <Text variant="bodySmall" style={styles.muted}>
                  {customer.customerCode}
                </Text>
              </View>
            </Card.Content>
          </Card>

          <Card>
            <Card.Content style={styles.detailCardContent}>
              {identity && <DetailRow label="Email" value={identity.email} />}
              {identity && <DetailRow label="Phone" value={identity.phone} />}
              <DetailRow label="National ID" value={customer.nationalId} />
              <DetailRow label="Address" value={customer.address ?? 'Not provided'} />
              <DetailRow
                label="Completed trips"
                value={completedJobsQuery.isLoading ? '…' : String(completedJobsQuery.data?.meta.total ?? 0)}
              />
            </Card.Content>
          </Card>

          <List.Section>
            <List.Item title="Edit Profile" left={editIcon} onPress={() => navigation.navigate('EditProfile')} />
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
