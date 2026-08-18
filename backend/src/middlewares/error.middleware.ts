import { NextFunction, Request, Response } from "express";
import { AppError } from "../errors/AppError";
import { logger } from "../utils/logger";

export function errorMiddleware(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const isAppError = err instanceof AppError;
  const statusCode = isAppError ? err.statusCode : 500;
  const isOperational = isAppError ? err.isOperational : false;

  logger.error(
    {
      checkpoint: "http.error",
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      userId: req.user?.id,
      role: req.user?.role,
      statusCode,
      stack: err.stack,
    },
    err.message
  );

  res.status(statusCode).json({
    success: false,
    message: isOperational ? err.message : "Something went wrong",
  });
}
