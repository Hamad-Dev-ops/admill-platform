import React from 'react';
import { TextInput as PaperTextInput } from 'react-native-paper';
import type { TextInputProps as PaperTextInputProps } from 'react-native-paper';

export interface SearchInputProps
  extends Omit<PaperTextInputProps, 'mode' | 'left' | 'right'> {
  onClear?: () => void;
}

export function SearchInput({ value, onClear, ...rest }: SearchInputProps) {
  return (
    <PaperTextInput
      mode="outlined"
      value={value}
      left={<PaperTextInput.Icon icon="magnify" />}
      right={
        value ? <PaperTextInput.Icon icon="close" onPress={onClear} /> : undefined
      }
      {...rest}
    />
  );
}
