import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, InlineError, TextInput } from '../../../components';
import { getApiErrorMessage } from '../../../api/client';
import { createCompany } from '../../../api/companies.api';
import { useAuth } from '../../../auth/AuthContext';
import { colors, spacing } from '../../../design-system/tokens';
import { companySetupSchema, type CompanySetupValues } from './schemas';

const EMPTY_VALUES: CompanySetupValues = {
  companyName: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  country: '',
  tradeLicenseNumber: '',
  tradeLicenseExpiry: '',
  serviceAreas: '',
};

// Shown for the "no-profile" branch of OwnerNavigator — a real registration
// form, not a static placeholder message, since an OWNER-role user needs a
// concrete path to complete POST /companies before anything else in the app
// is usable. Mirrors DriverRegistrationScreen's shape exactly (same
// no-profile pattern, ROLE-PERMISSION-MATRIX.md "two-step profile creation").
export function CompanySetupScreen() {
  const queryClient = useQueryClient();
  const { logout } = useAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<CompanySetupValues>({
    resolver: zodResolver(companySetupSchema),
    defaultValues: EMPTY_VALUES,
  });

  const mutation = useMutation({
    mutationFn: createCompany,
    onSuccess: () => {
      // Re-drives useProfileStatus, which will now see the new company and
      // move the navigator on to the real Owner dashboard automatically.
      queryClient.invalidateQueries({ queryKey: ['companies', 'me'] });
    },
    onError: (error) => setSubmitError(getApiErrorMessage(error, 'Unable to create company')),
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text variant="headlineSmall" style={styles.title}>
            Set up your company
          </Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            Create your company profile to start managing your fleet. This is the operational
            company drivers will join and customers will be served by.
          </Text>

          <View style={styles.form}>
            <Controller
              control={control}
              name="companyName"
              render={({ field, fieldState }) => (
                <TextInput
                  testID="companyName-input"
                  label="Company Name"
                  value={field.value}
                  onChangeText={field.onChange}
                  errorText={fieldState.error?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="email"
              render={({ field, fieldState }) => (
                <TextInput
                  testID="email-input"
                  label="Company Email"
                  value={field.value}
                  onChangeText={field.onChange}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  errorText={fieldState.error?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="phone"
              render={({ field, fieldState }) => (
                <TextInput
                  testID="phone-input"
                  label="Company Phone"
                  value={field.value}
                  onChangeText={field.onChange}
                  keyboardType="phone-pad"
                  errorText={fieldState.error?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="address"
              render={({ field, fieldState }) => (
                <TextInput
                  testID="address-input"
                  label="Address"
                  value={field.value}
                  onChangeText={field.onChange}
                  errorText={fieldState.error?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="city"
              render={({ field, fieldState }) => (
                <TextInput
                  testID="city-input"
                  label="City"
                  value={field.value}
                  onChangeText={field.onChange}
                  errorText={fieldState.error?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="country"
              render={({ field, fieldState }) => (
                <TextInput
                  testID="country-input"
                  label="Country"
                  value={field.value}
                  onChangeText={field.onChange}
                  errorText={fieldState.error?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="tradeLicenseNumber"
              render={({ field, fieldState }) => (
                <TextInput
                  testID="tradeLicenseNumber-input"
                  label="Trade License Number"
                  value={field.value}
                  onChangeText={field.onChange}
                  errorText={fieldState.error?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="tradeLicenseExpiry"
              render={({ field, fieldState }) => (
                <TextInput
                  testID="tradeLicenseExpiry-input"
                  label="Trade License Expiry (YYYY-MM-DD)"
                  value={field.value}
                  onChangeText={field.onChange}
                  errorText={fieldState.error?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="serviceAreas"
              render={({ field, fieldState }) => (
                <TextInput
                  testID="serviceAreas-input"
                  label="Service Areas (comma-separated, e.g. Dubai, Sharjah)"
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
                const serviceAreas = values.serviceAreas
                  .split(',')
                  .map((area) => area.trim())
                  .filter((area) => area.length > 0);
                mutation.mutate({ ...values, serviceAreas });
              })}
              loading={isSubmitting || mutation.isPending}
              disabled={isSubmitting || mutation.isPending}
            >
              Create Company
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
