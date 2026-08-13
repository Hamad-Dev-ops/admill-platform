import { Router } from "express";
import { UserRole } from "../../constants/role.enum";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/rbac.middleware";
import { AnalyticsController } from "./analytics.controller";

const router = Router();

router.use(authMiddleware);
router.use(requireRole(UserRole.OWNER));

router.get("/revenue", AnalyticsController.getRevenue);
router.get("/drivers", AnalyticsController.getDriverStats);
router.get("/fleet-utilization", AnalyticsController.getFleetUtilization);

export default router;
