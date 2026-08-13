import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, InlineError, TextInput } from '../../../components';
import { getApiErrorMessage } from '../../../api/client';
import { registerCustomerProfile } from '../../../api/customers.api';
import { useAuth } from '../../../auth/AuthContext';
import { colors, spacing } from '../../../design-system/tokens';
import { customerRegistrationSchema, type CustomerRegistrationValues } from './schemas';

const EMPTY_VALUES: CustomerRegistrationValues = {
  nationalId: '',
  address: '',
};

// Shown for the "no-profile" branch of CustomerNavigator — a real
// registration form, not a static placeholder message, since a
// CUSTOMER-role user needs a concrete path to complete POST /customers
// before anything else in the app is usable (ROLE-PERMISSION-MATRIX.md
// "two-step profile creation").
export function CustomerRegistrationScreen() {
  const queryClient = useQueryClient();
  const { logout } = useAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<CustomerRegistrationValues>({
    resolver: zodResolver(customerRegistrationSchema),
    defaultValues: EMPTY_VALUES,
  });

  const mutation = useMutation({
    mutationFn: registerCustomerProfile,
    onSuccess: () => {
      // Re-drives useProfileStatus, which will now see the new profile and
      // move the navigator on to the tab shell automatically. The create
      // response isn't identity-populated (customers.api.ts) so this
      // invalidate-and-refetch is the correct next step, not reading
      // fields off the mutation result.
      queryClient.invalidateQueries({ queryKey: ['customers', 'me'] });
    },
    onError: (error) => setSubmitError(getApiErrorMessage(error, 'Unable to complete your profile')),
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text variant="headlineSmall" style={styles.title}>
            Complete your profile
          </Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            A few more details are needed before you can request recovery services.
          </Text>

          <View style={styles.form}>
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
              name="address"
              render={({ field, fieldState }) => (
                <TextInput
                  testID="address-input"
                  label="Address (optional)"
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
                mutation.mutate({
                  nationalId: values.nationalId,
                  address: values.address?.trim() ? values.address.trim() : undefined,
                });
              })}
              loading={isSubmitting || mutation.isPending}
              disabled={isSubmitting || mutation.isPending}
            >
              Continue
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
