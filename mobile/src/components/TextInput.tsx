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
        // A validation error appearing (e.g. after blur, or a failed
        // submit) needs to be announced — it isn't automatically linked to
        // the field above the way an HTML aria-describedby would be.
        <HelperText type="error" visible accessibilityLiveRegion="polite">
          {errorText}
        </HelperText>
      )}
    </View>
  );
}
