import { Platform } from 'react-native';
import {
  AuthorizationStatus,
  getMessaging,
  getToken,
  onMessage,
  onTokenRefresh,
  requestPermission,
} from '@react-native-firebase/messaging';
import { registerDeviceToken } from '../api/deviceTokens.api';

// Milestone 8 mobile gap — the backend (NotificationService.notify) already
// persists every notification and emits it over Socket.IO regardless of
// whether this ever runs; this module only adds the second, independent
// delivery path (FCM) for when the app isn't foregrounded to receive that
// socket event. Foreground UX is intentionally untouched: the existing
// notification:new socket listener (NotificationsScreen, useIncomingJobOffer,
// etc.) remains the only thing driving foreground UI, so onMessage below
// deliberately does nothing but log — a background/killed-state push must
// never also pop a duplicate notification while the app is open.
//
// Best-effort throughout, matching the backend's own contract (CLAUDE.md
// §16, firebase.provider.ts) and every other background call in this app
// (DriverLocationTrackingRunner, etc.): a failure here must never block
// login or crash the app, including the expected case where
// android/app/google-services.json hasn't been added yet.
//
// v26's modular API (getMessaging/getToken/onMessage/... as free functions
// taking a Messaging instance) is what's actually installed here — not the
// older `messaging()` namespaced object some docs/examples still show.

function currentPlatform(): 'IOS' | 'ANDROID' | 'WEB' {
  return Platform.OS === 'ios' ? 'IOS' : 'ANDROID';
}

async function registerCurrentToken(): Promise<void> {
  const fcmToken = await getToken(getMessaging());
  await registerDeviceToken({ fcmToken, platform: currentPlatform() });
}

// Called once per authenticated session, alongside SocketService.connect —
// same lifecycle point (src/auth/AuthContext.tsx's applySession). Returns an
// unsubscribe for the listeners that must not outlive the session (a
// different account logging in on the same device shouldn't keep the
// previous account's refresh/message handlers alive).
export function initializePushNotifications(): () => void {
  let cancelled = false;
  let messagingInstance: ReturnType<typeof getMessaging>;
  try {
    // getMessaging() can throw synchronously on a cold start if Firebase's
    // native App hasn't finished auto-initializing yet (the same race
    // index.js's top-level handler now guards against) — this call site is
    // reached from three places (applySession/refreshSession/attemptStartup
    // in AuthContext.tsx), not all of which used to have a surrounding
    // try/catch, so this function's own "never blocks login or crashes the
    // app" contract needs to hold unconditionally, not just for its async
    // half.
    messagingInstance = getMessaging();
  } catch {
    return () => {};
  }

  (async () => {
    try {
      const authStatus = await requestPermission(messagingInstance);
      const enabled =
        authStatus === AuthorizationStatus.AUTHORIZED || authStatus === AuthorizationStatus.PROVISIONAL;

      if (!enabled || cancelled) return;

      await registerCurrentToken();
    } catch {
      // No google-services.json yet, permission denied, or a real network
      // failure — none of these should be surfaced to the user or block
      // login, same as every other best-effort background call here.
    }
  })();

  let unsubscribeTokenRefresh = () => {};
  let unsubscribeForegroundMessage = () => {};
  try {
    unsubscribeTokenRefresh = onTokenRefresh(messagingInstance, () => {
      registerCurrentToken().catch(() => {});
    });
    unsubscribeForegroundMessage = onMessage(messagingInstance, async () => {
      // Intentionally a no-op — see module comment. Foreground delivery is
      // the existing Socket.IO notification:new event's job, not this one's.
    });
  } catch {
    // Same best-effort contract as everything else here.
  }

  return () => {
    cancelled = true;
    try {
      unsubscribeTokenRefresh();
      unsubscribeForegroundMessage();
    } catch {
      // Never let teardown itself throw during logout/session-swap.
    }
  };
}
