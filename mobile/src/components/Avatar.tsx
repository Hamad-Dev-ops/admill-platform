import React from 'react';
import { Avatar as PaperAvatar } from 'react-native-paper';
import { colors } from '../design-system/tokens';

export interface AvatarProps {
  name: string;
  imageUrl?: string;
  size?: number;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

export function Avatar({ name, imageUrl, size = 40 }: AvatarProps) {
  if (imageUrl) {
    return <PaperAvatar.Image size={size} source={{ uri: imageUrl }} />;
  }

  return (
    <PaperAvatar.Text
      size={size}
      label={initials(name) || '?'}
      style={{ backgroundColor: colors.primaryMuted }}
      labelStyle={{ color: colors.ink }}
    />
  );
}
