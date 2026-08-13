import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import axios from 'axios';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button, InlineError, TextInput } from '../../components';
import { useAuth } from '../../auth/AuthContext';
import { getApiErrorMessage } from '../../api/client';
import { colors, spacing } from '../../design-system/tokens';
import type { AuthStackParamList } from '../../navigation/types';
import { loginSchema, type LoginFormValues } from './schemas';

// Backend rate-limits login per-account (authRateLimiter, 5 attempts/15min —
// see rateLimiter.middleware.ts) and already sends the standard
// RateLimit-Remaining header on every response through it, success or
// failure. A wrong-password 401 is the one case worth surfacing it for —
// tells the user how much room they have left before the account locks out,
// rather than finding out only once it happens.
function describeLoginError(error: unknown): string {
  const message = getApiErrorMessage(error, 'Unable to log in');

  if (axios.isAxiosError(error) && error.response?.status === 401) {
    const remainingHeader = error.response.headers?.['ratelimit-remaining'];
    const remaining = typeof remainingHeader === 'string' ? Number(remainingHeader) : NaN;
    if (Number.isFinite(remaining) && remaining >= 0) {
      const attemptWord = remaining === 1 ? 'attempt' : 'attempts';
      return `${message} (${remaining} ${attemptWord} remaining)`;
    }
  }

  return message;
}

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const { login } = useAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (values: LoginFormValues) => {
    setSubmitError(null);
    try {
      await login(values.email, values.password);
    } catch (error) {
      setSubmitError(describeLoginError(error));
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text variant="headlineMedium" style={styles.title}>
          Welcome back
        </Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          Log in to Admill Vehicle Recovery
        </Text>

        <View style={styles.form}>
          <Controller
            control={control}
            name="email"
            render={({ field, fieldState }) => (
              <TextInput
                testID="email-input"
                label="Email"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                autoCapitalize="none"
                keyboardType="email-address"
                errorText={fieldState.error?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="password"
            render={({ field, fieldState }) => (
              <TextInput
                testID="password-input"
                label="Password"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                secureTextEntry
                errorText={fieldState.error?.message}
              />
            )}
          />

          {!!submitError && <InlineError>{submitError}</InlineError>}

          <Button
            variant="primary"
            onPress={handleSubmit(onSubmit)}
            loading={isSubmitting}
            disabled={isSubmitting}
          >
            Log in
          </Button>
          <Button variant="text" onPress={() => navigation.navigate('Register')}>
            Don't have an account? Register
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, padding: spacing.lg, justifyContent: 'center' },
  title: { color: colors.ink },
  subtitle: { color: colors.inkMuted, marginBottom: spacing.lg },
  form: { gap: spacing.md },
});
