import mongoose from "mongoose";
import { env } from "../../src/config/env";

export async function connectTestDb(): Promise<void> {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(env.MONGO_URI);
  }
}

export async function disconnectTestDb(): Promise<void> {
  await mongoose.disconnect();
}
