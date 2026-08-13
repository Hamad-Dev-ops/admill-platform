import { NextFunction, Request, Response } from "express";
import { UserRole } from "../constants/role.enum";
import { AppError } from "../errors/AppError";

export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw new AppError(403, "You do not have permission to perform this action");
    }

    next();
  };
}
