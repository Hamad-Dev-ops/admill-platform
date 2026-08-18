import http from "http";
import { app } from "./src/app";
import { env } from "./src/config/env";
import { connectDatabase } from "./src/config/database";
import { initSocket } from "./src/config/socket";
import { registerSocketHandlers } from "./src/socket";
import { Checkpoint, logCheckpoint } from "./src/utils/checkpoint";
import { logger } from "./src/utils/logger";

async function bootstrap(): Promise<void> {
  await connectDatabase();

  // Gap #14 (GAP-REPORT.md) — Customer job creation resolves the
  // operational company from this at request time (job.service.ts's
  // resolveOperationalCompany), not through the validated `env` singleton
  // (see that function's comment for why). A non-blocking boot-time check
  // here surfaces a misconfigured deployment in the logs immediately,
  // without making it a hard startup failure the way env.ts's required
  // vars are — this one is intentionally reconfigurable without a restart.
  if (!process.env.DEFAULT_COMPANY_CODE) {
    logger.warn("DEFAULT_COMPANY_CODE is not set — Customer job creation will fail until it is configured");
  }

  const httpServer = http.createServer(app);
  initSocket(httpServer);
  registerSocketHandlers();

  httpServer.listen(env.PORT, () => {
    logCheckpoint(Checkpoint.SERVER_READY, {
      port: env.PORT,
      nodeEnv: env.NODE_ENV,
      logLevel: env.LOG_LEVEL,
      defaultCompanyConfigured: Boolean(process.env.DEFAULT_COMPANY_CODE),
    });
    logger.info(`Admill backend running on http://localhost:${env.PORT}`);
  });
}

bootstrap().catch((err) => {
  logger.error({ err }, "Failed to start server");
  process.exit(1);
});
