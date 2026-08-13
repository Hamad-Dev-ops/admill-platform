import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SegmentedButtons } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header, IconButton } from '../../../components';
import { colors, spacing } from '../../../design-system/tokens';
import type { OwnerStackParamList } from '../../../navigation/owner/types';
import { DriversTabContent } from '../drivers/DriversTabContent';
import { VehiclesTabContent } from './VehiclesTabContent';

type FleetTab = 'vehicles' | 'drivers';

// Vehicle and Driver management share one bottom-tab slot via this internal
// segmented toggle rather than a 6th bottom tab (5 is the practical max) or
// a material-top-tabs dependency we don't otherwise need.
export function FleetListScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<OwnerStackParamList>>();
  const [tab, setTab] = useState<FleetTab>('vehicles');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header
        title="Fleet"
        right={
          tab === 'vehicles' ? (
            <IconButton
              icon="plus"
              accessibilityLabel="Add vehicle"
              onPress={() => navigation.navigate('VehicleForm', {})}
            />
          ) : undefined
        }
      />
      <View style={styles.toggle}>
        <SegmentedButtons
          value={tab}
          onValueChange={(value) => setTab(value as FleetTab)}
          buttons={[
            { value: 'vehicles', label: 'Vehicles' },
            { value: 'drivers', label: 'Drivers' },
          ]}
        />
      </View>
      {tab === 'vehicles' ? <VehiclesTabContent /> : <DriversTabContent />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  toggle: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
});
