import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SegmentedButtons } from 'react-native-paper';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getApiErrorMessage } from '../../../api/client';
import { updateMyDriverStatus, type SelfServiceDriverStatus } from '../../../api/drivers.api';
import { InlineError } from '../../../components';
import { spacing } from '../../../design-system/tokens';

const STATUS_OPTIONS: { value: SelfServiceDriverStatus; label: string }[] = [
  { value: 'AVAILABLE', label: 'Available' },
  { value: 'ON_BREAK', label: 'On Break' },
  { value: 'OFFLINE', label: 'Offline' },
];

export interface DriverStatusToggleProps {
  currentStatus: SelfServiceDriverStatus;
  // ON_JOB is not selectable here (system-set) — the toggle simply isn't
  // rendered by the caller while a job is active. See DriverDashboardScreen.
  disabled?: boolean;
}

export function DriverStatusToggle({ currentStatus, disabled }: DriverStatusToggleProps) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: updateMyDriverStatus,
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['drivers', 'me'] });
    },
    onError: (err) => setError(getApiErrorMessage(err, 'Unable to update status')),
  });

  return (
    <View style={styles.container}>
      <SegmentedButtons
        value={mutation.isPending ? (mutation.variables ?? currentStatus) : currentStatus}
        onValueChange={(value) => {
          // Prevent duplicate/overlapping requests while one is already in
          // flight, and skip a no-op tap on the already-active status.
          if (mutation.isPending || value === currentStatus) return;
          mutation.mutate(value as SelfServiceDriverStatus);
        }}
        buttons={STATUS_OPTIONS.map((option) => ({
          ...option,
          disabled: disabled || mutation.isPending,
        }))}
      />
      {!!error && <InlineError>{error}</InlineError>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
});
