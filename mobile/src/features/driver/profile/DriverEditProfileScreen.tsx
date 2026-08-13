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
import { getMyDriverProfile, updateDriverById } from '../../../api/drivers.api';
import { colors, spacing } from '../../../design-system/tokens';
import { driverEditProfileSchema, type DriverEditProfileValues } from './schemas';

// Only the fields the backend's PATCH /drivers/:id (self-or-owner, enforced
// in the service layer) actually accepts — see updateDriverSchema. Name,
// email, and phone live on the User record, not Driver, and there is no
// self-service User-update endpoint, so they aren't editable here.
export function DriverEditProfileScreen() {
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const driverQuery = useQuery({
    queryKey: ['drivers', 'me'],
    queryFn: getMyDriverProfile,
  });
  const driver = driverQuery.data;

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<DriverEditProfileValues>({
    resolver: zodResolver(driverEditProfileSchema),
    values: driver
      ? {
          nationalId: driver.nationalId,
          emiratesId: driver.emiratesId,
          emiratesIdExpiry: driver.emiratesIdExpiry.slice(0, 10),
          drivingLicenseNumber: driver.drivingLicenseNumber,
          drivingLicenseExpiry: driver.drivingLicenseExpiry.slice(0, 10),
        }
      : undefined,
  });

  const mutation = useMutation({
    mutationFn: (values: DriverEditProfileValues) => updateDriverById(driver!._id, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers', 'me'] });
      navigation.goBack();
    },
    onError: (error) => setSubmitError(getApiErrorMessage(error, 'Unable to update profile')),
  });

  if (driverQuery.isLoading) {
    return (
      <View style={styles.container}>
        <Header title="Edit Profile" onBack={() => navigation.goBack()} />
        <LoadingState />
      </View>
    );
  }

  if (driverQuery.isError || !driver) {
    return (
      <View style={styles.container}>
        <Header title="Edit Profile" onBack={() => navigation.goBack()} />
        <ErrorState onRetry={() => driverQuery.refetch()} />
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
              name="emiratesId"
              render={({ field, fieldState }) => (
                <TextInput
                  testID="edit-emiratesId-input"
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
                  testID="edit-emiratesIdExpiry-input"
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
                  testID="edit-drivingLicenseNumber-input"
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
                  testID="edit-drivingLicenseExpiry-input"
                  label="Driving License Expiry (YYYY-MM-DD)"
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
