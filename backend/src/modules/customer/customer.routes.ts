import { Router } from "express";
import { UserRole } from "../../constants/role.enum";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/rbac.middleware";
import { validate } from "../../middlewares/validation.middleware";
import { CustomerController } from "./customer.controller";
import { registerCustomerSchema, updateCustomerSchema } from "./customer.validator";

const router = Router();

router.use(authMiddleware, requireRole(UserRole.CUSTOMER));

router.post("/", validate(registerCustomerSchema), CustomerController.register);
router.get("/me", CustomerController.getMe);
router.patch("/me", validate(updateCustomerSchema), CustomerController.updateMe);

export default router;
