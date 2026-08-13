import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validation.middleware";
import { DeviceTokenController } from "./deviceToken.controller";
import { registerDeviceTokenSchema } from "./deviceToken.validator";

const router = Router();

router.use(authMiddleware);

// Register on app login (architecture-baseline §23) — any authenticated role.
router.post("/", validate(registerDeviceTokenSchema), DeviceTokenController.register);

export default router;
