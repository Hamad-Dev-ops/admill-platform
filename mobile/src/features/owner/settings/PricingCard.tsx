import React, { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, ErrorState, LoadingState, TextInput } from '../../../components';
import { getApiErrorMessage } from '../../../api/client';
import { createPricingConfigVersion, getPricingConfig } from '../../../api/pricing.api';
import { colors, spacing } from '../../../design-system/tokens';

export function PricingCard() {
  const queryClient = useQueryClient();
  const configQuery = useQuery({ queryKey: ['pricing', 'config'], queryFn: getPricingConfig });
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string> | null>(null);

  const mutation = useMutation({
    mutationFn: createPricingConfigVersion,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricing', 'config'] });
      setFields(null);
    },
    onError: (error) => setSubmitError(getApiErrorMessage(error, 'Unable to save pricing config')),
  });

  if (configQuery.isLoading) {
    return (
      <Card>
        <Card.Content>
          <LoadingState />
        </Card.Content>
      </Card>
    );
  }

  if (configQuery.isError || !configQuery.data) {
    return (
      <Card>
        <Card.Content>
          <ErrorState onRetry={() => configQuery.refetch()} />
        </Card.Content>
      </Card>
    );
  }

  const config = configQuery.data;
  const values = fields ?? {
    currentFuelPrice: String(config.currentFuelPrice),
    fuelConsumptionPerKm: String(config.fuelConsumptionPerKm),
    perKmRate: String(config.perKmRate),
    peakHourSurcharge: String(config.peakHourSurcharge),
    lowSupplyThreshold: String(config.lowSupplyThreshold),
    maxDemandSurcharge: String(config.maxDemandSurcharge),
  };

  const setField = (key: string, value: string) => setFields({ ...values, [key]: value });

  const confirmAndSave = () => {
    Alert.alert(
      'Platform-Wide Pricing Change',
      'This pricing configuration is shared by every company on Admill, not just yours. Saving changes affects all companies immediately. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save Anyway',
          style: 'destructive',
          onPress: () => {
            setSubmitError(null);
            mutation.mutate({
              currentFuelPrice: Number(values.currentFuelPrice),
              fuelConsumptionPerKm: Number(values.fuelConsumptionPerKm),
              perKmRate: Number(values.perKmRate),
              peakHourSurcharge: Number(values.peakHourSurcharge),
              lowSupplyThreshold: Number(values.lowSupplyThreshold),
              maxDemandSurcharge: Number(values.maxDemandSurcharge),
            });
          },
        },
      ],
    );
  };

  return (
    <Card>
      <Card.Content style={styles.content}>
        <Text variant="titleSmall">Pricing Configuration</Text>
        <View style={styles.warningBanner}>
          <Icon source="alert-outline" size={18} color={colors.warning} />
          <Text variant="bodySmall" style={styles.warningText}>
            This pricing configuration is platform-wide. It is not isolated to your company —
            changes here affect every company using Admill (version {config.version}).
          </Text>
        </View>

        <TextInput
          label="Fuel Price (per unit)"
          value={values.currentFuelPrice}
          onChangeText={(v) => setField('currentFuelPrice', v)}
          keyboardType="numeric"
        />
        <TextInput
          label="Fuel Consumption (per km)"
          value={values.fuelConsumptionPerKm}
          onChangeText={(v) => setField('fuelConsumptionPerKm', v)}
          keyboardType="numeric"
        />
        <TextInput
          label="Rate per km"
          value={values.perKmRate}
          onChangeText={(v) => setField('perKmRate', v)}
          keyboardType="numeric"
        />
        <TextInput
          label="Peak Hour Surcharge"
          value={values.peakHourSurcharge}
          onChangeText={(v) => setField('peakHourSurcharge', v)}
          keyboardType="numeric"
        />
        <TextInput
          label="Low Supply Threshold"
          value={values.lowSupplyThreshold}
          onChangeText={(v) => setField('lowSupplyThreshold', v)}
          keyboardType="numeric"
        />
        <TextInput
          label="Max Demand Surcharge"
          value={values.maxDemandSurcharge}
          onChangeText={(v) => setField('maxDemandSurcharge', v)}
          keyboardType="numeric"
        />

        {!!submitError && (
          <Text style={styles.error} variant="bodySmall">
            {submitError}
          </Text>
        )}

        <Button variant="danger" loading={mutation.isPending} onPress={confirmAndSave}>
          Save Pricing (Platform-Wide)
        </Button>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.sm },
  warningBanner: {
    flexDirection: 'row',
    gap: spacing.xs,
    backgroundColor: `${colors.warning}18`,
    padding: spacing.sm,
    borderRadius: 8,
    alignItems: 'flex-start',
  },
  warningText: { flex: 1, color: colors.ink },
  error: { color: colors.danger },
});
