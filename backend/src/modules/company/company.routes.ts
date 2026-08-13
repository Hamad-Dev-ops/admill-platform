import { Router } from "express";
import { UserRole } from "../../constants/role.enum";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/rbac.middleware";
import { uploadDocument } from "../../middlewares/upload.middleware";
import { validate } from "../../middlewares/validation.middleware";
import { uploadDocumentSchema } from "../document/document.validator";
import { CompanyController } from "./company.controller";
import { createCompanySchema, updateCompanySchema, updateCompanySettingsSchema } from "./company.validator";

const router = Router();

router.use(authMiddleware);

// Any authenticated user (e.g. a driver confirming a company before registering).
router.get("/lookup/:companyCode", CompanyController.lookupByCode);

router.use(requireRole(UserRole.OWNER));

router.post("/", validate(createCompanySchema), CompanyController.create);
router.get("/me", CompanyController.getMe);
router.patch("/me", validate(updateCompanySchema), CompanyController.updateMe);
router.get("/me/settings", CompanyController.getMySettings);
router.patch("/me/settings", validate(updateCompanySettingsSchema), CompanyController.updateMySettings);

router.post("/me/documents", uploadDocument, validate(uploadDocumentSchema), CompanyController.uploadDocument);
router.get("/me/documents", CompanyController.listDocuments);

export default router;
