import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, ErrorState, Header, LoadingState, TextInput } from '../../../components';
import { getApiErrorMessage } from '../../../api/client';
import { getMyCustomerProfile, updateMyCustomerProfile } from '../../../api/customers.api';
import { colors, spacing } from '../../../design-system/tokens';
import { customerRegistrationSchema, type CustomerRegistrationValues } from '../onboarding/schemas';

// Reuses the exact same schema/field set as registration — PATCH
// /customers/me accepts the identical {nationalId?, address?} shape as
// POST /customers (customer.validator.ts's updateCustomerSchema).
export function CustomerEditProfileScreen() {
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const customerQuery = useQuery({
    queryKey: ['customers', 'me'],
    queryFn: getMyCustomerProfile,
  });
  const customer = customerQuery.data;

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<CustomerRegistrationValues>({
    resolver: zodResolver(customerRegistrationSchema),
    values: customer
      ? {
          nationalId: customer.nationalId,
          address: customer.address ?? '',
        }
      : undefined,
  });

  const mutation = useMutation({
    mutationFn: (values: CustomerRegistrationValues) =>
      updateMyCustomerProfile({
        nationalId: values.nationalId,
        address: values.address?.trim() ? values.address.trim() : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers', 'me'] });
      navigation.goBack();
    },
    onError: (error) => setSubmitError(getApiErrorMessage(error, 'Unable to update profile')),
  });

  if (customerQuery.isLoading) {
    return (
      <View style={styles.container}>
        <Header title="Edit Profile" onBack={() => navigation.goBack()} />
        <LoadingState />
      </View>
    );
  }

  if (customerQuery.isError || !customer) {
    return (
      <View style={styles.container}>
        <Header title="Edit Profile" onBack={() => navigation.goBack()} />
        <ErrorState onRetry={() => customerQuery.refetch()} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header title="Edit Profile" onBack={() => navigation.goBack()} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.form}>
            <Controller
              control={control}
              name="nationalId"
              render={({ field, fieldState }) => (
                <TextInput
                  testID="edit-nationalId-input"
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
                  testID="edit-address-input"
                  label="Address (optional)"
                  value={field.value}
                  onChangeText={field.onChange}
                  errorText={fieldState.error?.message}
                />
              )}
            />

            {!!submitError && (
              <Text style={styles.error} variant="bodySmall">
                {submitError}
              </Text>
            )}

            <Button
              variant="primary"
              onPress={handleSubmit((values) => {
                setSubmitError(null);
                mutation.mutate(values);
              })}
              loading={isSubmitting || mutation.isPending}
              disabled={isSubmitting || mutation.isPending}
            >
              Save Changes
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
  form: { gap: spacing.md },
  error: { color: colors.danger },
});
