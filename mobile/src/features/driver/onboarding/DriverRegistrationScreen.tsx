import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, InlineError, TextInput } from '../../../components';
import { getApiErrorMessage } from '../../../api/client';
import { registerDriverProfile } from '../../../api/drivers.api';
import { useAuth } from '../../../auth/AuthContext';
import { colors, spacing } from '../../../design-system/tokens';
import { driverRegistrationSchema, type DriverRegistrationValues } from './schemas';

const EMPTY_VALUES: DriverRegistrationValues = {
  companyCode: '',
  nationalId: '',
  emiratesId: '',
  emiratesIdExpiry: '',
  drivingLicenseNumber: '',
  drivingLicenseExpiry: '',
};

// Shown for the "no-profile" branch of DriverNavigator — a real registration
// form, not a static placeholder message, since a DRIVER-role user needs a
// concrete path to complete POST /drivers before anything else in the app
// is usable (ROLE-PERMISSION-MATRIX.md "two-step profile creation").
export function DriverRegistrationScreen() {
  const queryClient = useQueryClient();
  const { logout } = useAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<DriverRegistrationValues>({
    resolver: zodResolver(driverRegistrationSchema),
    defaultValues: EMPTY_VALUES,
  });

  const mutation = useMutation({
    mutationFn: registerDriverProfile,
    onSuccess: () => {
      // Re-drives useProfileStatus, which will now see the new profile and
      // move the navigator on to the pending-approval branch automatically.
      queryClient.invalidateQueries({ queryKey: ['drivers', 'me'] });
    },
    onError: (error) => setSubmitError(getApiErrorMessage(error, 'Unable to register as a driver')),
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text variant="headlineSmall" style={styles.title}>
            Register as a Driver
          </Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            Enter your company code and identification details to join a fleet. Your company
            owner will review and approve your application before you can go online.
          </Text>

          <View style={styles.form}>
            <Controller
              control={control}
              name="companyCode"
              render={({ field, fieldState }) => (
                <TextInput
                  testID="companyCode-input"
                  label="Company Code"
                  value={field.value}
                  onChangeText={field.onChange}
                  autoCapitalize="characters"
                  errorText={fieldState.error?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="nationalId"
              render={({ field, fieldState }) => (
                <TextInput
                  testID="nationalId-input"
                  label="National ID"
                  value={field.value}
                  onChangeText={field.onChange}
                  errorText={fieldState.error?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="emiratesId"
              render={({ field, fieldState }) => (
                <TextInput
                  testID="emiratesId-input"
                  label="Emirates ID"
                  value={field.value}
                  onChangeText={field.onChange}
                  errorText={fieldState.error?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="emiratesIdExpiry"
              render={({ field, fieldState }) => (
                <TextInput
                  testID="emiratesIdExpiry-input"
                  label="Emirates ID Expiry (YYYY-MM-DD)"
                  value={field.value}
                  onChangeText={field.onChange}
                  errorText={fieldState.error?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="drivingLicenseNumber"
              render={({ field, fieldState }) => (
                <TextInput
                  testID="drivingLicenseNumber-input"
                  label="Driving License Number"
                  value={field.value}
                  onChangeText={field.onChange}
                  errorText={fieldState.error?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="drivingLicenseExpiry"
              render={({ field, fieldState }) => (
                <TextInput
                  testID="drivingLicenseExpiry-input"
                  label="Driving License Expiry (YYYY-MM-DD)"
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
              Submit Application
            </Button>
            <Button variant="text" onPress={() => logout().catch(() => {})}>
              Log out
            </Button>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.md },
  title: { color: colors.ink },
  subtitle: { color: colors.inkMuted },
  form: { gap: spacing.md },
  error: { color: colors.danger },
});
