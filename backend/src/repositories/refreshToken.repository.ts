import { Types } from "mongoose";
import { IRefreshToken } from "../interfaces/refreshToken.interface";
import { RefreshTokenModel } from "../models/refreshToken.model";

export const RefreshTokenRepository = {
  async create(data: Pick<IRefreshToken, "userId" | "tokenHash" | "expiresAt"> & { deviceInfo?: string }) {
    return RefreshTokenModel.create(data);
  },

  async findByTokenHash(tokenHash: string) {
    return RefreshTokenModel.findOne({ tokenHash });
  },

  async revokeById(id: string | Types.ObjectId) {
    return RefreshTokenModel.findByIdAndUpdate(id, { revokedAt: new Date() });
  },

  async revokeAllForUser(userId: string | Types.ObjectId) {
    return RefreshTokenModel.updateMany({ userId, revokedAt: { $exists: false } }, { revokedAt: new Date() });
  },
};
