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
    <View style={styles.container} accessibilityLiveRegion="polite">
      {/* Decorative — the title/description text below already conveys the
          meaning; an icon name like "alert-circle-outline" adds nothing for
          a screen reader and would just be redundant noise. Paper's Icon
          doesn't accept accessibility props directly, hence the wrapping
          View. */}
      <View accessibilityElementsHidden importantForAccessibility="no">
        <Icon source={icon} size={48} color={colors.inkMuted} />
      </View>
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
