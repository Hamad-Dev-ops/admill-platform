/**
 * @format
 */

import 'react-native-gesture-handler';
import { AppRegistry } from 'react-native';
import { getMessaging, setBackgroundMessageHandler } from '@react-native-firebase/messaging';
import App from './App';
import { name as appName } from './app.json';

// Must be registered at the top level, before AppRegistry.registerComponent
// (React Native Firebase's own requirement) — this is what lets Android
// invoke the JS engine for a data message while the app is killed. Display
// of the notification itself is automatic (the backend's FCM send already
// includes a `notification` block, not just `data` — see
// notification.service.ts), so this handler is intentionally a no-op; its
// only job is to exist, so RNFirebase doesn't log a missing-handler warning
// and so future background-side logic has a place to go without touching
// this file again.
//
// Wrapped in try/catch: on a cold start, this runs before Firebase's native
// App has necessarily finished auto-initializing via its ContentProvider —
// a well-documented Android RN-Firebase race ("No Firebase App '[DEFAULT]'
// has been created") that can hit some launches and not others (more likely
// on an authenticated relaunch, since the silent session-restore path fires
// real network/socket/push work immediately, versus a fresh unauthenticated
// launch which just shows the login screen). Since this call sits before
// AppRegistry.registerComponent, an uncaught throw here means the app never
// registers its root component at all — the exact "app doesn't open after
// being backgrounded, needs a reinstall" failure mode. Losing background
// push handling for that one cold start is a vastly better outcome than the
// whole app failing to boot.
try {
  setBackgroundMessageHandler(getMessaging(), async () => {});
} catch {
  // Best-effort, matching every other Firebase call site in this app
  // (src/notifications/pushRegistration.ts) — never allowed to block app
  // startup.
}

AppRegistry.registerComponent(appName, () => App);
