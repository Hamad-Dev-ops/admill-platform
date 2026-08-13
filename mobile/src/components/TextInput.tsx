import React from 'react';
import { HelperText, TextInput as PaperTextInput } from 'react-native-paper';
import type { TextInputProps as PaperTextInputProps } from 'react-native-paper';
import { View } from 'react-native';

export interface TextInputProps extends PaperTextInputProps {
  errorText?: string;
}

export function TextInput({ errorText, ...rest }: TextInputProps) {
  return (
    <View>
      <PaperTextInput mode="outlined" error={!!errorText} {...rest} />
      {!!errorText && (
        <HelperText type="error" visible>
          {errorText}
        </HelperText>
      )}
    </View>
  );
}
