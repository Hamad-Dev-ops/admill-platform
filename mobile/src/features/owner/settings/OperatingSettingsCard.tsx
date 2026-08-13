import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Switch, Text } from 'react-native-paper';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Card, InlineError, TextInput } from '../../../components';
import { getApiErrorMessage } from '../../../api/client';
import { updateMyCompanySettings } from '../../../api/companies.api';
import { colors, spacing } from '../../../design-system/tokens';
import type { CompanySettings } from '../../../types/entities';

export function OperatingSettingsCard({ settings }: { settings: CompanySettings }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(settings.operatingHours.open);
  const [close, setClose] = useState(settings.operatingHours.close);
  const [radius, setRadius] = useState(String(settings.defaultServiceRadiusKm));
  const [email, setEmail] = useState(settings.notificationPreferences.email);
  const [sms, setSms] = useState(settings.notificationPreferences.sms);
  const [push, setPush] = useState(settings.notificationPreferences.push);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: updateMyCompanySettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies', 'me', 'settings'] });
    },
    onError: (error) => setSubmitError(getApiErrorMessage(error, 'Unable to save settings')),
  });

  const parsedRadius = Number(radius);
  const radiusValid = Number.isFinite(parsedRadius) && parsedRadius > 0;

  return (
    <Card>
      <Card.Content style={styles.content}>
        <Text variant="titleSmall">Operating Hours</Text>
        <View style={styles.row}>
          <View style={styles.half}>
            <TextInput label="Opens" value={open} onChangeText={setOpen} />
          </View>
          <View style={styles.half}>
            <TextInput label="Closes" value={close} onChangeText={setClose} />
          </View>
        </View>

        <TextInput
          label="Default Service Radius (km)"
          value={radius}
          onChangeText={setRadius}
          keyboardType="numeric"
          errorText={radiusValid ? undefined : 'Enter a positive number'}
        />

        <Text variant="titleSmall" style={styles.sectionSpacing}>
          Notification Preferences
        </Text>
        <PreferenceRow label="Email" value={email} onChange={setEmail} />
        <PreferenceRow label="SMS" value={sms} onChange={setSms} />
        <PreferenceRow label="Push" value={push} onChange={setPush} />

        {!!submitError && <InlineError>{submitError}</InlineError>}

        <Button
          variant="primary"
          disabled={!radiusValid || !open.trim() || !close.trim() || mutation.isPending}
          loading={mutation.isPending}
          onPress={() => {
            setSubmitError(null);
            mutation.mutate({
              operatingHours: { open, close },
              defaultServiceRadiusKm: parsedRadius,
              notificationPreferences: { email, sms, push },
            });
          }}
        >
          Save Settings
        </Button>
      </Card.Content>
    </Card>
  );
}

function PreferenceRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.preferenceRow}>
      <Text variant="bodyMedium">{label}</Text>
      <Switch value={value} onValueChange={onChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  half: { flex: 1 },
  sectionSpacing: { marginTop: spacing.xs },
  preferenceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  error: { color: colors.danger },
});
