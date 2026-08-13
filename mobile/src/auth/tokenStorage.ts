import * as Keychain from 'react-native-keychain';

// Refresh tokens are the only long-lived credential this app persists —
// access tokens live in memory only (~15min lifetime, not worth the risk of
// persisting). See architecture-baseline.md §5.3.
const SERVICE = 'admill-mobile.refreshToken';

export async function saveRefreshToken(refreshToken: string): Promise<void> {
  await Keychain.setGenericPassword('refreshToken', refreshToken, { service: SERVICE });
}

export async function getRefreshToken(): Promise<string | null> {
  const result = await Keychain.getGenericPassword({ service: SERVICE });
  return result ? result.password : null;
}

export async function clearRefreshToken(): Promise<void> {
  await Keychain.resetGenericPassword({ service: SERVICE });
}
