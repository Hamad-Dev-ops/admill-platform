import { randomUUID } from "crypto";
import { NextFunction, Request, Response } from "express";
import { Checkpoint, logCheckpoint } from "../utils/checkpoint";
import { logger } from "../utils/logger";

const SLOW_REQUEST_MS = 2000;

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  req.requestId = randomUUID();
  const startedAt = Date.now();

  res.on("finish", () => {
    const durationMs = Date.now() - startedAt;
    const base = {
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs,
      userId: req.user?.id,
      role: req.user?.role,
    };

    if (res.statusCode >= 500) {
      logCheckpoint(Checkpoint.HTTP_SERVER_ERROR, base, "error");
    } else if (res.statusCode >= 400) {
      logCheckpoint(Checkpoint.HTTP_CLIENT_ERROR, base, "warn");
    } else if (durationMs >= SLOW_REQUEST_MS) {
      logCheckpoint(Checkpoint.HTTP_SLOW, base, "warn");
    } else {
      logger.info(base, "request completed");
    }
  });

  next();
}
