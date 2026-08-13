import { Types } from "mongoose";
import { INotification } from "../interfaces/notification.interface";
import { NotificationModel } from "../models/notification.model";
import { omitUndefined } from "../utils/object";

export const NotificationRepository = {
  async create(data: Pick<INotification, "receiverId" | "title" | "message" | "type" | "priority">) {
    return NotificationModel.create(data);
  },

  async findById(id: string | Types.ObjectId) {
    return NotificationModel.findOne({ _id: id, isDeleted: false });
  },

  async updateById(id: string | Types.ObjectId, data: Partial<INotification>) {
    return NotificationModel.findOneAndUpdate({ _id: id, isDeleted: false }, data, { returnDocument: "after" });
  },

  async findManyByReceiver(
    receiverId: string | Types.ObjectId,
    filter: { isRead?: boolean },
    pagination: { skip: number; limit: number }
  ) {
    const query = { receiverId, isDeleted: false, ...omitUndefined(filter) };

    const [data, total] = await Promise.all([
      NotificationModel.find(query).sort({ createdAt: -1 }).skip(pagination.skip).limit(pagination.limit),
      NotificationModel.countDocuments(query),
    ]);

    return { data, total };
  },
};
