import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import helmet from "helmet";
import { env } from "./config/env";
import { AppError } from "./errors/AppError";
import { errorMiddleware } from "./middlewares/error.middleware";
import { requestLogger } from "./middlewares/logger.middleware";
import { ApiResponse } from "./responses/ApiResponse";
import routes from "./routes";

export const app = express();

// Render (and virtually every PaaS) terminates TLS and proxies requests through its
// own edge — without this, express-rate-limit (and any req.ip-based logic) sees the
// proxy's IP for every request instead of the real client's. `1` trusts exactly one
// hop, matching a single reverse proxy in front of the app (not an open trust of the
// whole X-Forwarded-For chain).
app.set("trust proxy", 1);

app.use(helmet());
app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
app.use(compression());
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json(ApiResponse.success({ status: "OK", timestamp: new Date().toISOString() }));
});

app.use("/api", routes);

app.use((req: Request, _res: Response, next: NextFunction) => {
  next(new AppError(404, `Route ${req.method} ${req.originalUrl} not found`));
});

app.use(errorMiddleware);
