import { Router } from "express";
import { UserRole } from "../../constants/role.enum";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/rbac.middleware";
import { uploadDocument } from "../../middlewares/upload.middleware";
import { validate } from "../../middlewares/validation.middleware";
import { driverPositionUpdateSchema } from "../../utils/geo";
import { uploadDocumentSchema } from "../document/document.validator";
import { DriverController } from "./driver.controller";
import { registerDriverSchema, rejectDriverSchema, updateDriverSchema, updateDriverStatusSchema } from "./driver.validator";

const router = Router();

router.use(authMiddleware);

router.post("/", requireRole(UserRole.DRIVER), validate(registerDriverSchema), DriverController.register);
router.get("/", requireRole(UserRole.OWNER), DriverController.listMine);

router.patch(
  "/me/location",
  requireRole(UserRole.DRIVER),
  validate(driverPositionUpdateSchema),
  DriverController.updateMyLocation
);

router.patch(
  "/me/status",
  requireRole(UserRole.DRIVER),
  validate(updateDriverStatusSchema),
  DriverController.updateMyStatus
);

// Must be registered before "/:id" — otherwise Express would match "me" as the :id
// param. Mirrors customer.routes.ts's GET /me exactly (Phase 3 mobile gap #10).
router.get("/me", requireRole(UserRole.DRIVER), DriverController.getMe);

// Self (the driver) or the owner of the driver's company — enforced in the service layer.
router.get("/:id", DriverController.getById);
router.patch("/:id", validate(updateDriverSchema), DriverController.updateById);

// Driver (self), the customer on that driver's active job, or the owning company's
// owner — enforced in TrackingService, not middleware, same layering as every other
// record-level check in this file.
router.get("/:id/location", DriverController.getLocation);
router.get("/:id/ratings", DriverController.listRatings);

router.patch("/:id/approve", requireRole(UserRole.OWNER), DriverController.approve);
router.patch("/:id/reject", requireRole(UserRole.OWNER), validate(rejectDriverSchema), DriverController.reject);

router.post("/:id/documents", uploadDocument, validate(uploadDocumentSchema), DriverController.uploadDocument);
router.get("/:id/documents", DriverController.listDocuments);

export default router;
