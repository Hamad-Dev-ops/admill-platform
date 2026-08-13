import { Router } from "express";
import { UserRole } from "../../constants/role.enum";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/rbac.middleware";
import { validate } from "../../middlewares/validation.middleware";
import { PricingController } from "./pricing.controller";
import { estimateFareSchema, updatePricingConfigSchema } from "./pricing.validator";

const router = Router();

router.use(authMiddleware);

router.post("/estimate", validate(estimateFareSchema), PricingController.estimate);

// PricingConfig is global (no per-company scoping) and there's no Platform Admin role
// yet — gated to OWNER as the only privileged role that exists today. This means any
// owner can currently change pricing for every company; a real gap worth addressing
// before multi-owner production use, not silently swept under the rug.
router.get("/config", requireRole(UserRole.OWNER), PricingController.getConfig);
router.post(
  "/config",
  requireRole(UserRole.OWNER),
  validate(updatePricingConfigSchema),
  PricingController.updateConfig
);

export default router;
