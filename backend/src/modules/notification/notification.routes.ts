import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { NotificationController } from "./notification.controller";

const router = Router();

router.use(authMiddleware);

// Self-only — every user (any role) sees and manages only their own notifications;
// enforced in NotificationService.markAsRead, same layering as every other
// record-level check in this codebase.
router.get("/", NotificationController.list);
router.patch("/:id/read", NotificationController.markAsRead);

export default router;
