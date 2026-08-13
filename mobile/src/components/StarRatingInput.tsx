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
    // Not accessibilityRole="adjustable" — that role implies swipe
    // up/down/left/right changes the value (via accessibilityActions),
    // which isn't implemented here; each star is its own direct-tap target
    // instead, so each gets its own accessibilityRole="button" below.
    // Declaring "adjustable" without the matching gesture support would
    // mislead a screen reader user into swiping and getting nothing.
    <View style={styles.row}>
      {STARS.map((star) => (
        <Pressable
          key={star}
          onPress={() => !disabled && onChange(star)}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={`${star} star${star > 1 ? 's' : ''}`}
          accessibilityState={{ disabled, selected: star <= value }}
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
