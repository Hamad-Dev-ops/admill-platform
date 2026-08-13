import { Router } from "express";
import { UserRole } from "../../constants/role.enum";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/rbac.middleware";
import { validate } from "../../middlewares/validation.middleware";
import { ServiceController } from "./service.controller";
import { createServiceSchema } from "./service.validator";

const router = Router();

router.use(authMiddleware);

router.get("/", ServiceController.list);
router.post("/", requireRole(UserRole.OWNER), validate(createServiceSchema), ServiceController.create);

export default router;
