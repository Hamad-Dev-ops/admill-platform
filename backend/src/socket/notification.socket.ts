import { Types } from "mongoose";
import { getIO } from "../config/socket";
import { INotification } from "../interfaces/notification.interface";
import { safeEmit } from "./job.socket";

// No inbound event: notifications are only ever server-initiated (NotificationService),
// so there's nothing to register per-connection here — every socket already joins its
// own `user:${userId}` room on connect (socket/index.ts), which is the only room this
// needs.
export function emitNotificationNew(receiverId: Types.ObjectId, notification: INotification): void {
  safeEmit(() => {
    getIO().to(`user:${receiverId.toString()}`).emit("notification:new", notification);
  });
}
