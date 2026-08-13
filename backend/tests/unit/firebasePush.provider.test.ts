import { describe, expect, it, vi } from "vitest";
import { FirebasePushProvider } from "../../src/infrastructure/providers/push/firebase.provider";

const NOTIFICATION = { title: "Job update", body: "Your job status changed." };

describe("FirebasePushProvider", () => {
  it("does not call send and does not throw when no credentials are configured", async () => {
    const send = vi.fn();
    const provider = new FirebasePushProvider(send, false);

    await expect(provider.sendToTokens(["token-1"], NOTIFICATION)).resolves.toBeUndefined();
    expect(send).not.toHaveBeenCalled();
  });

  it("calls send with all given tokens when credentials are configured", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const provider = new FirebasePushProvider(send, true);

    await provider.sendToTokens(["token-1", "token-2"], NOTIFICATION);

    expect(send).toHaveBeenCalledWith(["token-1", "token-2"], NOTIFICATION);
  });

  it("does not throw when configured but the real send fails — push is always best-effort", async () => {
    const send = vi.fn().mockRejectedValue(new Error("FCM unavailable"));
    const provider = new FirebasePushProvider(send, true);

    await expect(provider.sendToTokens(["token-1"], NOTIFICATION)).resolves.toBeUndefined();
    expect(send).toHaveBeenCalled();
  });

  it("skips calling send entirely when there are no tokens, even if configured", async () => {
    const send = vi.fn();
    const provider = new FirebasePushProvider(send, true);

    await provider.sendToTokens([], NOTIFICATION);

    expect(send).not.toHaveBeenCalled();
  });
});
