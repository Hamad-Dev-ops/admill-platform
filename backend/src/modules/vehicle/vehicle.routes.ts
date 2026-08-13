import { Router } from "express";
import { UserRole } from "../../constants/role.enum";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/rbac.middleware";
import { uploadDocument } from "../../middlewares/upload.middleware";
import { validate } from "../../middlewares/validation.middleware";
import { uploadDocumentSchema } from "../document/document.validator";
import { assignDriverSchema, createVehicleSchema, updateVehicleSchema } from "./vehicle.validator";
import { VehicleController } from "./vehicle.controller";

const router = Router();

router.use(authMiddleware);

router.post("/", requireRole(UserRole.OWNER), validate(createVehicleSchema), VehicleController.create);
router.get("/", requireRole(UserRole.OWNER), VehicleController.listMine);

// Owner (own company) or the vehicle's assigned driver — enforced in the service layer.
router.get("/:id", VehicleController.getById);
router.patch("/:id", requireRole(UserRole.OWNER), validate(updateVehicleSchema), VehicleController.updateById);

router.post(
  "/:id/assign-driver",
  requireRole(UserRole.OWNER),
  validate(assignDriverSchema),
  VehicleController.assignDriver
);

router.post(
  "/:id/documents",
  requireRole(UserRole.OWNER),
  uploadDocument,
  validate(uploadDocumentSchema),
  VehicleController.uploadDocument
);
router.get("/:id/documents", VehicleController.listDocuments);

export default router;
