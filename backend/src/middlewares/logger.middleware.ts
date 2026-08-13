import { randomUUID } from "crypto";
import { NextFunction, Request, Response } from "express";
import { logger } from "../utils/logger";

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  req.requestId = randomUUID();
  const startedAt = Date.now();

  res.on("finish", () => {
    logger.info(
      {
        requestId: req.requestId,
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        durationMs: Date.now() - startedAt,
      },
      "request completed"
    );
  });

  next();
}
