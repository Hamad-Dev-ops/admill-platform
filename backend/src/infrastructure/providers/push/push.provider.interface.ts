export interface IPushNotification {
  title: string;
  body: string;
}

export interface IPushProvider {
  // Best-effort by contract (CLAUDE.md §16) — implementations must never throw; an
  // unconfigured or failed send is swallowed internally, not surfaced to the caller.
  sendToTokens(tokens: string[], notification: IPushNotification): Promise<void>;
}
