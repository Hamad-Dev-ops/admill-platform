import React from 'react';
import { StyleSheet } from 'react-native';
import { Modal as PaperModal, Portal } from 'react-native-paper';
import { colors, radius, spacing } from '../design-system/tokens';

// A simple bottom-anchored sheet built on Paper's Modal/Portal — deliberately
// not pulling in a dedicated bottom-sheet library for Phase 1. Revisit if a
// later phase needs snap points/gesture-drag that this can't reasonably do.
export interface BottomSheetProps {
  visible: boolean;
  onDismiss: () => void;
  children: React.ReactNode;
}

export function BottomSheet({ visible, onDismiss, children }: BottomSheetProps) {
  return (
    <Portal>
      <PaperModal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={styles.sheet}
      >
        {children}
      </PaperModal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: colors.surface,
    marginTop: 'auto',
    padding: spacing.lg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
});
