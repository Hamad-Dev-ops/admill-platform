import React from 'react';
import { Button as PaperButton } from 'react-native-paper';
import type { ButtonProps as PaperButtonProps } from 'react-native-paper';

export type ButtonVariant = 'primary' | 'secondary' | 'text' | 'danger';

export interface ButtonProps extends Omit<PaperButtonProps, 'mode' | 'buttonColor'> {
  variant?: ButtonVariant;
}

const VARIANT_MODE: Record<ButtonVariant, PaperButtonProps['mode']> = {
  primary: 'contained',
  secondary: 'outlined',
  text: 'text',
  danger: 'contained',
};

export function Button({ variant = 'primary', ...rest }: ButtonProps) {
  return (
    <PaperButton
      mode={VARIANT_MODE[variant]}
      buttonColor={variant === 'danger' ? '#DC2626' : undefined}
      {...rest}
    />
  );
}
