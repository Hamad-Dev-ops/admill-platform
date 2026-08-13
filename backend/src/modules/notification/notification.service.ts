import { Types } from "mongoose";
import { NotificationPriority, NotificationType } from "../../constants/notification.enum";
import { AppError } from "../../errors/AppError";
import { pushProvider } from "../../infrastructure/providers/push/firebase.provider";
import { DeviceTokenRepository } from "../../repositories/deviceToken.repository";
import { NotificationRepository } from "../../repositories/notification.repository";
import { emitNotificationNew } from "../../socket/notification.socket";
import { logger } from "../../utils/logger";

interface INotifyPayload {
  title: string;
  message: string;
  priority?: NotificationPriority;
}

export const NotificationService = {
  // Single entry point every other service calls (CLAUDE.md §16) — never called from
  // controllers directly. Persists, then best-effort pushes and best-effort emits.
  // Deliberately never throws: a notification failure (persist, token lookup, push,
  // or socket) must never block or fail the business action that triggered it (e.g. a
  // job status update still succeeds even if every part of this fails).
  async notify(userId: string | Types.ObjectId, type: NotificationType, payload: INotifyPayload): Promise<void> {
    try {
      const receiverId = new Types.ObjectId(userId);

      const notification = await NotificationRepository.create({
        receiverId,
        title: payload.title,
        message: payload.message,
        type,
        priority: payload.priority ?? NotificationPriority.MEDIUM,
      });

      const tokens = await DeviceTokenRepository.findByUserId(receiverId);
      if (tokens.length > 0) {
        await pushProvider.sendToTokens(
          tokens.map((t) => t.fcmToken),
          { title: payload.title, body: payload.message }
        );
      }

      emitNotificationNew(receiverId, notification);
    } catch (err) {
      logger.warn({ err }, "NotificationService.notify failed — business action was not blocked");
    }
  },

  async listForUser(
    userId: string,
    filter: { isRead?: boolean },
    pagination: { skip: number; limit: number }
  ) {
    return NotificationRepository.findManyByReceiver(userId, filter, pagination);
  },

  async markAsRead(userId: string, notificationId: string) {
    const notification = await NotificationRepository.findById(notificationId);

    if (!notification) {
      throw new AppError(404, "Notification not found");
    }

    if (notification.receiverId.toString() !== userId) {
      throw new AppError(403, "You do not have permission to access this notification");
    }

    return NotificationRepository.updateById(notificationId, { isRead: true });
  },
};
