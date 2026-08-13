import { Router } from "express";
import analyticsRoutes from "../../modules/analytics/analytics.routes";
import authRoutes from "../../modules/auth/auth.routes";
import companyRoutes from "../../modules/company/company.routes";
import customerRoutes from "../../modules/customer/customer.routes";
import deviceTokenRoutes from "../../modules/notification/deviceToken.routes";
import documentRoutes from "../../modules/document/document.routes";
import driverRoutes from "../../modules/driver/driver.routes";
import jobRoutes from "../../modules/job/job.routes";
import notificationRoutes from "../../modules/notification/notification.routes";
import pricingRoutes from "../../modules/pricing/pricing.routes";
import serviceRoutes from "../../modules/service/service.routes";
import vehicleRoutes from "../../modules/vehicle/vehicle.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/companies", companyRoutes);
router.use("/drivers", driverRoutes);
router.use("/vehicles", vehicleRoutes);
router.use("/documents", documentRoutes);
router.use("/customers", customerRoutes);
router.use("/services", serviceRoutes);
router.use("/pricing", pricingRoutes);
router.use("/jobs", jobRoutes);
router.use("/notifications", notificationRoutes);
router.use("/device-tokens", deviceTokenRoutes);
router.use("/analytics", analyticsRoutes);

export default router;
