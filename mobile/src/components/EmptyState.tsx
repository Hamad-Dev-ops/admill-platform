import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import { colors, spacing } from '../design-system/tokens';
import { Button } from './Button';

export interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon = 'tray-outline',
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Icon source={icon} size={48} color={colors.inkMuted} />
      <Text variant="titleMedium" style={styles.title}>
        {title}
      </Text>
      {!!description && (
        <Text variant="bodyMedium" style={styles.description}>
          {description}
        </Text>
      )}
      {!!actionLabel && !!onAction && (
        <Button variant="secondary" onPress={onAction} style={styles.action}>
          {actionLabel}
        </Button>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.xs,
  },
  title: {
    color: colors.ink,
    marginTop: spacing.sm,
  },
  description: {
    color: colors.inkMuted,
    textAlign: 'center',
  },
  action: {
    marginTop: spacing.md,
  },
});
