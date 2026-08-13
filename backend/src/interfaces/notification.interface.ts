import { Types } from "mongoose";
import { NotificationPriority, NotificationType } from "../constants/notification.enum";
import { IBase } from "./base.interface";

export interface INotification extends IBase {
  receiverId: Types.ObjectId;

  title: string;

  message: string;

  type: NotificationType;

  priority: NotificationPriority;

  isRead: boolean;
}
