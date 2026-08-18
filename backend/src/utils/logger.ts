import pino from "pino";
import { env, isProduction } from "../config/env";

export const logger = pino({
  level: env.NODE_ENV === "test" ? "silent" : env.LOG_LEVEL,
  redact: ["req.headers.authorization", "*.password", "*.token", "*.refreshToken"],
  transport: isProduction
    ? undefined
    : {
        target: require.resolve("pino-pretty"),
        options: { colorize: true, translateTime: "HH:MM:ss", ignore: "pid,hostname" },
      },
});
