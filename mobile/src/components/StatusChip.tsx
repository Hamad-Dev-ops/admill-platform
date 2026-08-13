import React from 'react';
import { Chip } from 'react-native-paper';
import { colors } from '../design-system/tokens';

export type ChipTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const TONE_COLOR: Record<ChipTone, string> = {
  success: colors.success,
  warning: colors.warning,
  danger: colors.danger,
  info: colors.info,
  neutral: colors.inkMuted,
};

export interface StatusChipProps {
  label: string;
  tone: ChipTone;
}

export function StatusChip({ label, tone }: StatusChipProps) {
  const color = TONE_COLOR[tone];

  return (
    <Chip compact style={{ backgroundColor: `${color}22` }} textStyle={{ color }}>
      {label}
    </Chip>
  );
}
