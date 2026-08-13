import { NextFunction, Request, Response } from "express";
import { ZodType } from "zod";
import { AppError } from "../errors/AppError";

export function validate(schema: ZodType) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const message = result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
      throw new AppError(400, message);
    }

    req.body = result.data;
    next();
  };
}
