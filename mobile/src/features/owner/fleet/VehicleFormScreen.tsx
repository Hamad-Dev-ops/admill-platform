import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Button,
  ErrorState,
  Header,
  InlineError,
  LoadingState,
  SelectableChipGroup,
  TextInput,
} from '../../../components';
import { getApiErrorMessage } from '../../../api/client';
import { createVehicle, getVehicleById, updateVehicle } from '../../../api/vehicles.api';
import { colors, spacing } from '../../../design-system/tokens';
import type { OwnerStackParamList } from '../../../navigation/owner/types';
import { vehicleFormSchema, type VehicleFormValues } from './schemas';
import { SERVICE_TYPE_OPTIONS, VEHICLE_TYPE_OPTIONS } from './vehicleLabels';

type Props = NativeStackScreenProps<OwnerStackParamList, 'VehicleForm'>;

const EMPTY_VALUES: VehicleFormValues = {
  plateNumber: '',
  registrationNumber: '',
  chassisNumber: '',
  vehicleType: 'TOW_TRUCK',
  recoveryType: [],
  insurancePolicyNumber: '',
  insuranceExpiry: '',
  registrationExpiry: '',
};

export function VehicleFormScreen({ navigation, route }: Props) {
  const vehicleId = route.params?.vehicleId;
  const isEdit = !!vehicleId;
  const queryClient = useQueryClient();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const existingVehicleQuery = useQuery({
    queryKey: ['vehicles', vehicleId],
    queryFn: () => getVehicleById(vehicleId!),
    enabled: isEdit,
  });

  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<VehicleFormValues>({
    resolver: zodResolver(vehicleFormSchema),
    defaultValues: EMPTY_VALUES,
  });

  useEffect(() => {
    const vehicle = existingVehicleQuery.data;
    if (!vehicle) return;
    reset({
      plateNumber: vehicle.plateNumber,
      registrationNumber: vehicle.registrationNumber,
      chassisNumber: vehicle.chassisNumber,
      vehicleType: vehicle.vehicleType,
      recoveryType: vehicle.recoveryType,
      insurancePolicyNumber: vehicle.insurancePolicyNumber,
      insuranceExpiry: vehicle.insuranceExpiry.slice(0, 10),
      registrationExpiry: vehicle.registrationExpiry.slice(0, 10),
    });
  }, [existingVehicleQuery.data, reset]);

  const mutation = useMutation({
    mutationFn: (values: VehicleFormValues) =>
      isEdit ? updateVehicle(vehicleId!, values) : createVehicle(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['analytics', 'fleet-utilization'] });
      navigation.goBack();
    },
    onError: (error) => setSubmitError(getApiErrorMessage(error, 'Unable to save vehicle')),
  });

  if (isEdit && existingVehicleQuery.isLoading) {
    return (
      <SafeArea>
        <Header title="Edit Vehicle" onBack={() => navigation.goBack()} />
        <LoadingState />
      </SafeArea>
    );
  }

  if (isEdit && existingVehicleQuery.isError) {
    return (
      <SafeArea>
        <Header title="Edit Vehicle" onBack={() => navigation.goBack()} />
        <ErrorState onRetry={() => existingVehicleQuery.refetch()} />
      </SafeArea>
    );
  }

  return (
    <SafeArea>
      <Header title={isEdit ? 'Edit Vehicle' : 'Add Vehicle'} onBack={() => navigation.goBack()} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Controller
            control={control}
            name="plateNumber"
            render={({ field, fieldState }) => (
              <TextInput
                label="Plate Number"
                value={field.value}
                onChangeText={field.onChange}
                errorText={fieldState.error?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="registrationNumber"
            render={({ field, fieldState }) => (
              <TextInput
                label="Registration Number"
                value={field.value}
                onChangeText={field.onChange}
                errorText={fieldState.error?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="chassisNumber"
            render={({ field, fieldState }) => (
              <TextInput
                label="Chassis Number"
                value={field.value}
                onChangeText={field.onChange}
                errorText={fieldState.error?.message}
              />
            )}
          />

          <Text variant="labelLarge" style={styles.groupLabel}>
            Vehicle Type
          </Text>
          <Controller
            control={control}
            name="vehicleType"
            render={({ field }) => (
              <SelectableChipGroup
                options={VEHICLE_TYPE_OPTIONS}
                selectedValues={[field.value]}
                onToggle={(value) => field.onChange(value)}
              />
            )}
          />

          <Text variant="labelLarge" style={styles.groupLabel}>
            Recovery Services Offered
          </Text>
          <Controller
            control={control}
            name="recoveryType"
            render={({ field, fieldState }) => (
              <View>
                <SelectableChipGroup
                  options={SERVICE_TYPE_OPTIONS}
                  selectedValues={field.value}
                  onToggle={(value) => {
                    const next = field.value.includes(value as (typeof field.value)[number])
                      ? field.value.filter((v) => v !== value)
                      : [...field.value, value as (typeof field.value)[number]];
                    field.onChange(next);
                  }}
                />
                {!!fieldState.error && <InlineError>{fieldState.error.message}</InlineError>}
              </View>
            )}
          />

          <Controller
            control={control}
            name="insurancePolicyNumber"
            render={({ field, fieldState }) => (
              <TextInput
                label="Insurance Policy Number"
                value={field.value}
                onChangeText={field.onChange}
                errorText={fieldState.error?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="insuranceExpiry"
            render={({ field, fieldState }) => (
              <TextInput
                label="Insurance Expiry (YYYY-MM-DD)"
                value={field.value}
                onChangeText={field.onChange}
                errorText={fieldState.error?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="registrationExpiry"
            render={({ field, fieldState }) => (
              <TextInput
                label="Registration Expiry (YYYY-MM-DD)"
                value={field.value}
                onChangeText={field.onChange}
                errorText={fieldState.error?.message}
              />
            )}
          />

          {!!submitError && <InlineError>{submitError}</InlineError>}

          <Button
            variant="primary"
            onPress={handleSubmit((values) => {
              setSubmitError(null);
              mutation.mutate(values);
            })}
            loading={isSubmitting || mutation.isPending}
            disabled={isSubmitting || mutation.isPending}
          >
            {isEdit ? 'Save Changes' : 'Add Vehicle'}
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeArea>
  );
}

function SafeArea({ children }: { children: React.ReactNode }) {
  return <View style={styles.container}>{children}</View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  groupLabel: { color: colors.ink, marginTop: spacing.xs },
  error: { color: colors.danger },
});
