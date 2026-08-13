import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Icon } from 'react-native-paper';
import { colors, spacing } from '../design-system/tokens';

export interface StarRatingInputProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  size?: number;
}

const STARS = [1, 2, 3, 4, 5];

// Generic 1-5 tappable star input — no rating-tag/category concept, since
// the backend's POST /jobs/:id/rating body is exactly {stars, review?}
// (frontend-docs/GAP-REPORT.md's Phase 4 preflight, re-verified against
// rating.validator.ts). Shared, not Customer-specific, since nothing about
// it depends on a role.
export function StarRatingInput({ value, onChange, disabled, size = 36 }: StarRatingInputProps) {
  return (
    <View style={styles.row} accessibilityRole="adjustable">
      {STARS.map((star) => (
        <Pressable
          key={star}
          onPress={() => !disabled && onChange(star)}
          disabled={disabled}
          accessibilityLabel={`${star} star${star > 1 ? 's' : ''}`}
          hitSlop={8}
        >
          <Icon
            source={star <= value ? 'star' : 'star-outline'}
            size={size}
            color={star <= value ? colors.primary : colors.border}
          />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.xs },
});
