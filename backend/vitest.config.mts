import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Integration tests share one real Atlas cluster (not an isolated per-file DB), so
    // files must not run concurrently — parallel bcrypt-heavy suites also blow past the
    // default timeout just from CPU contention, not from any actual bug.
    fileParallelism: false,
    // Milestone 6's job tests each register 2-4 real users (bcrypt + real Atlas round
    // trips per registration) plus several driver location/status calls — comfortably
    // exceeds the old 15s default even with no bug involved, same class of headroom
    // hookTimeout already gets below.
    testTimeout: 30000,
    // Defaults to 10s, tighter than testTimeout — a real Atlas connect/disconnect in
    // beforeAll/afterAll occasionally needs more than that under real network variance.
    hookTimeout: 20000,
  },
});
