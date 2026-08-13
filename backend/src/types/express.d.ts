import "express";
import { UserRole } from "../constants/role.enum";

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      user?: {
        id: string;
        role: UserRole;
      };
    }
  }
}

export {};
