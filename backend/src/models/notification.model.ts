import { model, Schema } from "mongoose";
import { NotificationPriority, NotificationType } from "../constants/notification.enum";
import { INotification } from "../interfaces/notification.interface";
import { mongooseOptions } from "../utils/schema/mongooseOptions";
import { softDeleteDefinition } from "../utils/schema/softDelete";

const notificationSchema = new Schema<INotification>(
  {
    receiverId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },

    title: { type: String, required: true },
    message: { type: String, required: true },

    type: { type: String, enum: Object.values(NotificationType), required: true },
    priority: { type: String, enum: Object.values(NotificationPriority), default: NotificationPriority.MEDIUM },

    isRead: { type: Boolean, default: false },

    ...softDeleteDefinition,
  },
  mongooseOptions
);

// A user's notification list, most recent first, optionally filtered to unread —
// the same shape as every other list/pagination query in this codebase.
notificationSchema.index({ receiverId: 1, isRead: 1, createdAt: -1 });

export const NotificationModel = model<INotification>("Notification", notificationSchema);
