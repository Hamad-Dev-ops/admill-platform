import { App, cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { env } from "../../../config/env";
import { logger } from "../../../utils/logger";
import { IPushNotification, IPushProvider } from "./push.provider.interface";

function getFirebaseApp(): App {
  const [existing] = getApps();

  if (existing) {
    return existing;
  }

  return initializeApp({
    credential: cert({
      projectId: env.FCM_PROJECT_ID,
      clientEmail: env.FCM_CLIENT_EMAIL,
      // Env vars can't hold real newlines — the private key is stored with literal
      // "\n" sequences and unescaped here, the standard pattern for this SDK.
      privateKey: env.FCM_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

async function sendViaFirebase(tokens: string[], notification: IPushNotification): Promise<void> {
  await getMessaging(getFirebaseApp()).sendEachForMulticast({ tokens, notification });
}

/**
 * Push is always best-effort (CLAUDE.md §16) — a failed job-status update must never
 * result from a push failure. `hasCredentials` and the sender function are both
 * constructor-injected, decoupled from the real env check, the same testability
 * pattern infrastructure/providers/fuelPrice/config.provider.ts (M5.1) already
 * established — this project has no real FCM project configured, so the
 * "configured" branch is only exercisable this way, without a live Firebase call.
 */
export class FirebasePushProvider implements IPushProvider {
  constructor(
    private readonly send: typeof sendViaFirebase = sendViaFirebase,
    private readonly hasCredentials: boolean = Boolean(env.FCM_PROJECT_ID && env.FCM_CLIENT_EMAIL && env.FCM_PRIVATE_KEY)
  ) {}

  async sendToTokens(tokens: string[], notification: IPushNotification): Promise<void> {
    if (!this.hasCredentials || tokens.length === 0) {
      return;
    }

    try {
      await this.send(tokens, notification);
    } catch (err) {
      logger.warn({ err }, "Push notification send failed");
    }
  }
}

export const pushProvider: IPushProvider = new FirebasePushProvider();
