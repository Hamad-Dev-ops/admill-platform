import React from 'react';
import { IconButton as PaperIconButton } from 'react-native-paper';
import type { IconButtonProps as PaperIconButtonProps } from 'react-native-paper';

// accessibilityLabel is required (unlike Paper's own optional prop) — an
// icon name like "bell-outline" or "pencil-outline" conveys nothing to a
// screen reader on its own, and every existing call site in this app was
// silently missing one before this fix (accessibility audit, Phase 5).
export type IconButtonProps = PaperIconButtonProps & { accessibilityLabel: string };

export function IconButton(props: IconButtonProps) {
  return <PaperIconButton {...props} />;
}
