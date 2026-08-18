import { Types } from "mongoose";
import { UserRole } from "../../constants/role.enum";
import { AppError } from "../../errors/AppError";
import { RefreshTokenRepository } from "../../repositories/refreshToken.repository";
import { UserRepository } from "../../repositories/user.repository";
import { comparePassword, hashPassword } from "../../utils/bcrypt";
import { generateRefreshToken, hashRefreshToken, signAccessToken } from "../../utils/jwt";
import { Checkpoint, logCheckpoint } from "../../utils/checkpoint";
import { LoginInput, RegisterInput } from "./auth.validator";

interface ITokenPair {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

function toPublicUser(user: {
  _id: Types.ObjectId;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: UserRole;
}) {
  return {
    id: user._id.toString(),
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone,
    role: user.role,
  };
}

async function issueTokenPair(userId: Types.ObjectId, role: UserRole, deviceInfo?: string): Promise<ITokenPair> {
  const accessToken = signAccessToken({ sub: userId.toString(), role });
  const { token, tokenHash, expiresAt } = generateRefreshToken();

  await RefreshTokenRepository.create({ userId, tokenHash, expiresAt, deviceInfo });

  return { accessToken, refreshToken: token, refreshTokenExpiresAt: expiresAt };
}

export const AuthService = {
  async register(input: RegisterInput, deviceInfo?: string) {
    const existing = await UserRepository.findByEmailOrPhone(input.email, input.phone);

    if (existing) {
      throw new AppError(409, "Email or phone is already registered");
    }

    const password = await hashPassword(input.password);

    const user = await UserRepository.create({
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phone: input.phone,
      password,
      role: input.role,
    });

    const tokens = await issueTokenPair(user._id, user.role, deviceInfo);

    return { user: toPublicUser(user), ...tokens };
  },

  async login(input: LoginInput, deviceInfo?: string) {
    const user = await UserRepository.findByEmailWithPassword(input.email);

    if (!user || !(await comparePassword(input.password, user.password))) {
      logCheckpoint(Checkpoint.AUTH_LOGIN_FAILURE, { reason: "invalid_credentials" }, "warn");
      throw new AppError(401, "Invalid email or password");
    }

    await UserRepository.updateLastLogin(user._id.toString());

    const tokens = await issueTokenPair(user._id, user.role, deviceInfo);
    logCheckpoint(Checkpoint.AUTH_LOGIN_SUCCESS, { userId: user._id.toString(), role: user.role });

    return { user: toPublicUser(user), ...tokens };
  },

  async refresh(presentedToken: string, deviceInfo?: string): Promise<ITokenPair> {
    const tokenHash = hashRefreshToken(presentedToken);
    const existing = await RefreshTokenRepository.findByTokenHash(tokenHash);

    if (!existing || existing.revokedAt || existing.expiresAt < new Date()) {
      throw new AppError(401, "Invalid or expired refresh token");
    }

    await RefreshTokenRepository.revokeById(existing._id);

    const user = await UserRepository.findById(existing.userId.toString());

    if (!user) {
      throw new AppError(401, "Invalid or expired refresh token");
    }

    return issueTokenPair(user._id, user.role, deviceInfo);
  },

  async logout(presentedToken: string): Promise<void> {
    const tokenHash = hashRefreshToken(presentedToken);
    const existing = await RefreshTokenRepository.findByTokenHash(tokenHash);

    if (existing && !existing.revokedAt) {
      await RefreshTokenRepository.revokeById(existing._id);
    }
  },

  async logoutAll(userId: string): Promise<void> {
    await RefreshTokenRepository.revokeAllForUser(userId);
  },
};
