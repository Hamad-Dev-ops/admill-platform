import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Avatar, Card, EmptyState, ErrorState, LoadingState, SearchInput, SelectableChipGroup, StatusChip } from '../../../components';
import { listDrivers } from '../../../api/drivers.api';
import { colors, spacing } from '../../../design-system/tokens';
import type { OwnerStackParamList } from '../../../navigation/owner/types';
import type { Driver } from '../../../types/entities';
import type { DriverApprovalStatus } from '../../../types/enums';
import { APPROVAL_STATUS_LABEL, APPROVAL_STATUS_TONE } from '../../../utils/statusPresentation';

const APPROVAL_FILTER_OPTIONS = (
  Object.keys(APPROVAL_STATUS_LABEL) as DriverApprovalStatus[]
).map((value) => ({ value, label: APPROVAL_STATUS_LABEL[value] }));

export function DriversTabContent() {
  const navigation = useNavigation<NativeStackNavigationProp<OwnerStackParamList>>();
  const [search, setSearch] = useState('');
  const [approvalFilter, setApprovalFilter] = useState<DriverApprovalStatus | null>(null);

  const driversQuery = useQuery({
    queryKey: ['drivers', 'list', approvalFilter],
    queryFn: () => listDrivers({ limit: 100, approvalStatus: approvalFilter ?? undefined }),
  });

  const filtered = useMemo(() => {
    const drivers = driversQuery.data?.data ?? [];
    const query = search.trim().toLowerCase();
    if (!query) return drivers;
    return drivers.filter((driver) => driver.employeeId.toLowerCase().includes(query));
  }, [driversQuery.data, search]);

  return (
    <View style={styles.container}>
      <View style={styles.filters}>
        <SearchInput
          placeholder="Search employee id"
          value={search}
          onChangeText={setSearch}
          onClear={() => setSearch('')}
        />
        <SelectableChipGroup
          options={APPROVAL_FILTER_OPTIONS}
          selectedValues={approvalFilter ? [approvalFilter] : []}
          onToggle={(value) =>
            setApprovalFilter((current) =>
              current === value ? null : (value as DriverApprovalStatus),
            )
          }
        />
      </View>

      {driversQuery.isLoading && <LoadingState />}
      {driversQuery.isError && <ErrorState onRetry={() => driversQuery.refetch()} />}
      {!driversQuery.isLoading && !driversQuery.isError && filtered.length === 0 && (
        <EmptyState icon="account-group-outline" title="No drivers found" />
      )}
      {!driversQuery.isLoading && !driversQuery.isError && filtered.length > 0 && (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <DriverRow
              driver={item}
              onPress={() => navigation.navigate('DriverDetail', { driverId: item._id })}
            />
          )}
        />
      )}
    </View>
  );
}

function DriverRow({ driver, onPress }: { driver: Driver; onPress: () => void }) {
  return (
    <Card style={styles.card} onPress={onPress}>
      <Card.Content style={styles.cardRow}>
        <Avatar name={driver.employeeId} />
        <View style={styles.driverInfo}>
          <View style={styles.rowBetween}>
            <Text variant="titleSmall">{driver.employeeId}</Text>
            <StatusChip
              label={APPROVAL_STATUS_LABEL[driver.approvalStatus]}
              tone={APPROVAL_STATUS_TONE[driver.approvalStatus]}
            />
          </View>
          <Text variant="bodySmall" style={styles.muted}>
            Rating {driver.rating.toFixed(1)} · {driver.totalTrips} trips
          </Text>
        </View>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  filters: { paddingHorizontal: spacing.md, gap: spacing.sm, paddingBottom: spacing.sm },
  list: { padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xl },
  card: { marginBottom: spacing.sm },
  cardRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  driverInfo: { flex: 1, gap: 2 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  muted: { color: colors.inkMuted },
});
