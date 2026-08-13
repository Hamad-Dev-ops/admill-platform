import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Card, EmptyState, ErrorState, LoadingState, SearchInput, SelectableChipGroup, StatusChip } from '../../../components';
import { listVehicles } from '../../../api/vehicles.api';
import { colors, spacing } from '../../../design-system/tokens';
import type { OwnerStackParamList } from '../../../navigation/owner/types';
import type { Vehicle } from '../../../types/entities';
import type { VehicleStatus } from '../../../types/enums';
import { VEHICLE_STATUS_LABEL, VEHICLE_STATUS_TONE } from '../../../utils/statusPresentation';
import { useDriverLookup } from '../shared/useDriverLookup';
import { VEHICLE_TYPE_LABEL } from './vehicleLabels';

const STATUS_FILTER_OPTIONS = (Object.keys(VEHICLE_STATUS_LABEL) as VehicleStatus[]).map(
  (value) => ({ value, label: VEHICLE_STATUS_LABEL[value] }),
);

export function VehiclesTabContent() {
  const navigation = useNavigation<NativeStackNavigationProp<OwnerStackParamList>>();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<VehicleStatus | null>(null);

  const vehiclesQuery = useQuery({
    queryKey: ['vehicles', 'list'],
    queryFn: () => listVehicles({ limit: 100 }),
  });
  const { getDriverLabel } = useDriverLookup();

  const filtered = useMemo(() => {
    const vehicles = vehiclesQuery.data?.data ?? [];
    return vehicles.filter((vehicle) => {
      const matchesStatus = !statusFilter || vehicle.currentStatus === statusFilter;
      const query = search.trim().toLowerCase();
      const matchesSearch =
        !query ||
        vehicle.plateNumber.toLowerCase().includes(query) ||
        vehicle.vehicleCode.toLowerCase().includes(query);
      return matchesStatus && matchesSearch;
    });
  }, [vehiclesQuery.data, search, statusFilter]);

  return (
    <View style={styles.container}>
      <View style={styles.filters}>
        <SearchInput
          placeholder="Search plate or vehicle code"
          value={search}
          onChangeText={setSearch}
          onClear={() => setSearch('')}
        />
        <SelectableChipGroup
          options={STATUS_FILTER_OPTIONS}
          selectedValues={statusFilter ? [statusFilter] : []}
          onToggle={(value) =>
            setStatusFilter((current) => (current === value ? null : (value as VehicleStatus)))
          }
        />
      </View>

      {vehiclesQuery.isLoading && <LoadingState />}
      {vehiclesQuery.isError && <ErrorState onRetry={() => vehiclesQuery.refetch()} />}
      {!vehiclesQuery.isLoading && !vehiclesQuery.isError && filtered.length === 0 && (
        <EmptyState
          icon="truck-outline"
          title="No vehicles found"
          description="Add your first vehicle to start building your fleet."
          actionLabel="Add Vehicle"
          onAction={() => navigation.navigate('VehicleForm', {})}
        />
      )}
      {!vehiclesQuery.isLoading && !vehiclesQuery.isError && filtered.length > 0 && (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <VehicleRow
              vehicle={item}
              driverLabel={getDriverLabel(item.assignedDriver)}
              onPress={() => navigation.navigate('VehicleDetail', { vehicleId: item._id })}
            />
          )}
        />
      )}
    </View>
  );
}

function VehicleRow({
  vehicle,
  driverLabel,
  onPress,
}: {
  vehicle: Vehicle;
  driverLabel: string;
  onPress: () => void;
}) {
  return (
    <Card style={styles.card} onPress={onPress}>
      <Card.Content style={styles.cardContent}>
        <View style={styles.rowBetween}>
          <Text variant="titleSmall">{vehicle.plateNumber}</Text>
          <StatusChip
            label={VEHICLE_STATUS_LABEL[vehicle.currentStatus]}
            tone={VEHICLE_STATUS_TONE[vehicle.currentStatus]}
          />
        </View>
        <Text variant="bodySmall" style={styles.muted}>
          {VEHICLE_TYPE_LABEL[vehicle.vehicleType]} · {driverLabel}
        </Text>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  filters: { paddingHorizontal: spacing.md, gap: spacing.sm, paddingBottom: spacing.sm },
  list: { padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xl },
  card: { marginBottom: spacing.sm },
  cardContent: { gap: 2 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  muted: { color: colors.inkMuted },
});
