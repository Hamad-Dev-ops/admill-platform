import React from 'react';
import { Appbar } from 'react-native-paper';

export interface HeaderProps {
  title: string;
  onBack?: () => void;
  right?: React.ReactNode;
}

export function Header({ title, onBack, right }: HeaderProps) {
  return (
    <Appbar.Header elevated>
      {onBack && <Appbar.BackAction onPress={onBack} />}
      <Appbar.Content title={title} />
      {right}
    </Appbar.Header>
  );
}
