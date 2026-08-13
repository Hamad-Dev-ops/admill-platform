import React from 'react';
import { StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { colors } from '../design-system/tokens';

export interface InlineErrorProps {
  children: React.ReactNode;
}

// The one shared shape behind the ~20 screens that each used to hand-roll
// <Text variant="bodySmall" style={{color: colors.danger}}>...</Text> for a
// submit/action error — same visual result, but announced to screen readers
// as soon as it appears (accessibility audit, Phase 5) rather than requiring
// the user to manually discover it by exploring the screen.
export function InlineError({ children }: InlineErrorProps) {
  return (
    <Text variant="bodySmall" style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="polite">
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({ error: { color: colors.danger } });
