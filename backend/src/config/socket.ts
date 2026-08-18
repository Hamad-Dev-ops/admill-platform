import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { Checkpoint, logCheckpoint } from "../utils/checkpoint";
import { verifyAccessToken } from "../utils/jwt";
import { env } from "./env";

let io: Server | null = null;

// §17: every socket connection authenticates once via the same JWT access token used
// by REST (verifyAccessToken), at handshake — never re-verified per event.
export function initSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: { origin: env.FRONTEND_URL, credentials: true },
  });

  io.engine.on("connection_error", (err) => {
    logCheckpoint(
      Checkpoint.SOCKET_AUTH_FAIL,
      {
        code: err.code,
        message: err.message,
        context: err.context,
      },
      "warn"
    );
  });

  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;

    if (!token) {
      logCheckpoint(Checkpoint.SOCKET_AUTH_FAIL, { reason: "missing_token", socketId: socket.id }, "warn");
      next(new Error("Authentication required"));
      return;
    }

    try {
      const payload = verifyAccessToken(token);
      socket.user = { id: payload.sub, role: payload.role };
      next();
    } catch {
      logCheckpoint(Checkpoint.SOCKET_AUTH_FAIL, { reason: "invalid_token", socketId: socket.id }, "warn");
      next(new Error("Invalid or expired token"));
    }
  });

  return io;
}

// Every emit helper (e.g. socket/job.socket.ts) goes through this instead of holding
// its own reference — same "one seam, swap later" shape as ITrackingStore will use.
export function getIO(): Server {
  if (!io) {
    throw new Error("Socket.IO server has not been initialized yet");
  }

  return io;
}
