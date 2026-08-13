import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Menu, Text, TouchableRipple } from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, EmptyState, ErrorState, Header, LoadingState } from '../../../components';
import { listServices, type AppService } from '../../../api/services.api';
import { colors, radius, spacing } from '../../../design-system/tokens';
import type { CustomerStackParamList } from '../../../navigation/customer/types';

// GET /services is a global catalog and does NOT filter isAvailable
// server-side (services.api.ts) — filtered here before anything is shown
// as bookable, per the Phase 4 approval's instruction #4.4.
export function ServiceSelectionScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<CustomerStackParamList>>();
  const [menuVisible, setMenuVisible] = useState(false);
  const [selected, setSelected] = useState<AppService | null>(null);

  const servicesQuery = useQuery({
    queryKey: ['services'],
    queryFn: listServices,
  });

  const availableServices = (servicesQuery.data ?? []).filter((service) => service.isAvailable);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header title="Select service" onBack={() => navigation.goBack()} />

      {servicesQuery.isLoading && <LoadingState />}
      {!servicesQuery.isLoading && servicesQuery.isError && (
        <ErrorState onRetry={() => servicesQuery.refetch()} />
      )}
      {!servicesQuery.isLoading && !servicesQuery.isError && availableServices.length === 0 && (
        <EmptyState
          icon="truck-outline"
          title="No services available"
          description="There are no recovery services available to book right now."
        />
      )}
      {!servicesQuery.isLoading && !servicesQuery.isError && availableServices.length > 0 && (
        <View style={styles.content}>
          <Text variant="bodyMedium" style={styles.label}>
            What do you need help with?
          </Text>

          <Menu
            visible={menuVisible}
            onDismiss={() => setMenuVisible(false)}
            anchor={
              <TouchableRipple
                testID="service-dropdown-trigger"
                onPress={() => setMenuVisible(true)}
                style={styles.dropdown}
                accessibilityRole="button"
                accessibilityLabel="Select a service"
              >
                <View style={styles.dropdownRow}>
                  <Text variant="bodyLarge" style={selected ? styles.dropdownText : styles.placeholderText}>
                    {selected ? selected.displayName : 'Select a service'}
                  </Text>
                  <Text style={styles.chevron}>▾</Text>
                </View>
              </TouchableRipple>
            }
          >
            {availableServices.map((service) => (
              <Menu.Item
                key={service._id}
                title={`${service.displayName} — from AED ${service.baseFare.toFixed(2)}`}
                onPress={() => {
                  setSelected(service);
                  setMenuVisible(false);
                }}
              />
            ))}
          </Menu>

          {!!selected?.description && (
            <Text variant="bodySmall" style={styles.muted}>
              {selected.description}
            </Text>
          )}

          <Button
            variant="primary"
            disabled={!selected}
            onPress={() => {
              if (selected) {
                navigation.navigate('FareEstimate', { serviceType: selected.serviceType });
              }
            }}
          >
            Continue
          </Button>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md },
  label: { color: colors.inkMuted },
  dropdown: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  dropdownRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dropdownText: { color: colors.ink },
  placeholderText: { color: colors.inkMuted },
  chevron: { color: colors.inkMuted, fontSize: 16 },
  muted: { color: colors.inkMuted },
});
