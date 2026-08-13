import React, { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Card, InlineError, TextInput } from '../../../components';
import { getApiErrorMessage } from '../../../api/client';
import { updateMyCompany } from '../../../api/companies.api';
import { colors, spacing } from '../../../design-system/tokens';
import type { CompanySummary } from '../../../types/entities';
import { companyProfileSchema, type CompanyProfileValues } from './schemas';

export function CompanyProfileCard({ company }: { company: CompanySummary }) {
  const queryClient = useQueryClient();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting, isDirty },
  } = useForm<CompanyProfileValues>({
    resolver: zodResolver(companyProfileSchema),
    defaultValues: {
      companyName: company.companyName,
      email: company.email,
      phone: company.phone,
      address: company.address,
      city: company.city,
      country: company.country,
    },
  });

  useEffect(() => {
    reset({
      companyName: company.companyName,
      email: company.email,
      phone: company.phone,
      address: company.address,
      city: company.city,
      country: company.country,
    });
  }, [company, reset]);

  const mutation = useMutation({
    mutationFn: updateMyCompany,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies', 'me'] });
    },
    onError: (error) => setSubmitError(getApiErrorMessage(error, 'Unable to save company profile')),
  });

  return (
    <Card>
      <Card.Content style={styles.content}>
        <Text variant="titleSmall">Company Profile</Text>
        <Field control={control} name="companyName" label="Company Name" />
        <Field control={control} name="email" label="Email" keyboardType="email-address" />
        <Field control={control} name="phone" label="Phone" keyboardType="phone-pad" />
        <Field control={control} name="address" label="Address" />
        <Field control={control} name="city" label="City" />
        <Field control={control} name="country" label="Country" />

        {!!submitError && <InlineError>{submitError}</InlineError>}

        <Button
          variant="primary"
          disabled={!isDirty || isSubmitting || mutation.isPending}
          loading={isSubmitting || mutation.isPending}
          onPress={handleSubmit((values) => {
            setSubmitError(null);
            mutation.mutate(values);
          })}
        >
          Save Company Profile
        </Button>
      </Card.Content>
    </Card>
  );
}

function Field({
  control,
  name,
  label,
  keyboardType,
}: {
  control: ReturnType<typeof useForm<CompanyProfileValues>>['control'];
  name: keyof CompanyProfileValues;
  label: string;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <TextInput
          label={label}
          value={field.value}
          onChangeText={field.onChange}
          keyboardType={keyboardType}
          errorText={fieldState.error?.message}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.sm },
  error: { color: colors.danger },
});
