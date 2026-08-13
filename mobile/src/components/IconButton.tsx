import React from 'react';
import { IconButton as PaperIconButton } from 'react-native-paper';
import type { IconButtonProps as PaperIconButtonProps } from 'react-native-paper';

export type IconButtonProps = PaperIconButtonProps;

export function IconButton(props: IconButtonProps) {
  return <PaperIconButton {...props} />;
}
