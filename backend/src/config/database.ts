import mongoose from "mongoose";
import { env } from "./env";
import { Checkpoint, logCheckpoint } from "../utils/checkpoint";
import { logger } from "../utils/logger";

export async function connectDatabase(): Promise<void> {
  mongoose.set("strictQuery", true);

  mongoose.connection.on("disconnected", () => {
    logCheckpoint(Checkpoint.DB_DISCONNECTED, { host: mongoose.connection.host }, "warn");
  });

  mongoose.connection.on("reconnected", () => {
    logCheckpoint(Checkpoint.DB_CONNECTED, { host: mongoose.connection.host, event: "reconnected" });
  });

  await mongoose.connect(env.MONGO_URI);

  logCheckpoint(Checkpoint.DB_CONNECTED, {
    host: mongoose.connection.host,
    readyState: mongoose.connection.readyState,
  });
  logger.info({ host: mongoose.connection.host }, "MongoDB connected");
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}

export function isDatabaseReady(): boolean {
  return mongoose.connection.readyState === 1;
}
