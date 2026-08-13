import React from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Card as PaperCard } from 'react-native-paper';
import { radius, spacing } from '../design-system/tokens';

// A deliberately minimal prop surface rather than the full Paper Card union
// (mode/elevation vary per-mode in a way that doesn't survive Omit cleanly)
// — this wrapper only ever renders as an elevated card.
export interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  testID?: string;
}

export function Card({ style, children, onPress, testID }: CardProps) {
  return (
    <PaperCard mode="elevated" style={[styles.card, style]} onPress={onPress} testID={testID}>
      {children}
    </PaperCard>
  );
}

Card.Content = PaperCard.Content;
Card.Actions = PaperCard.Actions;
Card.Cover = PaperCard.Cover;
Card.Title = PaperCard.Title;

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.md,
    padding: spacing.xs,
  },
});
