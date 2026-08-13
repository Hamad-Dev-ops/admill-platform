import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import { Card } from './Card';
import { colors, spacing } from '../design-system/tokens';

export interface MetricCardProps {
  label: string;
  value: string | number;
  icon: string;
  accentColor?: string;
  onPress?: () => void;
}

export function MetricCard({ label, value, icon, accentColor = colors.primary, onPress }: MetricCardProps) {
  return (
    <Card style={styles.card} onPress={onPress}>
      <Card.Content style={styles.content}>
        <View style={[styles.iconWrap, { backgroundColor: `${accentColor}22` }]}>
          <Icon source={icon} size={20} color={accentColor} />
        </View>
        <Text variant="headlineSmall" style={styles.value}>
          {value}
        </Text>
        <Text variant="bodySmall" style={styles.label} numberOfLines={1}>
          {label}
        </Text>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    minWidth: 140,
    flexGrow: 1,
  },
  content: {
    gap: spacing.xs,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    color: colors.ink,
  },
  label: {
    color: colors.inkMuted,
  },
});
