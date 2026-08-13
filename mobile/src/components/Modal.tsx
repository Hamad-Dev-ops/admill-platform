import React from 'react';
import { StyleSheet } from 'react-native';
import { Modal as PaperModal, Portal } from 'react-native-paper';
import { colors, radius, spacing } from '../design-system/tokens';

export interface ModalProps {
  visible: boolean;
  onDismiss: () => void;
  children: React.ReactNode;
}

export function Modal({ visible, onDismiss, children }: ModalProps) {
  return (
    <Portal>
      <PaperModal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={styles.content}
      >
        {children}
      </PaperModal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  content: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.md,
  },
});
