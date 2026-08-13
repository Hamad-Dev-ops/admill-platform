import { Router } from "express";
import { UserRole } from "../../constants/role.enum";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/rbac.middleware";
import { validate } from "../../middlewares/validation.middleware";
import { DocumentController } from "./document.controller";
import { verifyDocumentSchema } from "./document.validator";

const router = Router();

router.patch(
  "/:id/verify",
  authMiddleware,
  requireRole(UserRole.OWNER),
  validate(verifyDocumentSchema),
  DocumentController.verify
);

export default router;
