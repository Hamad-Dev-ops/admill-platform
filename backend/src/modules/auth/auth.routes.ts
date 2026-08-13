import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { authRateLimiter } from "../../middlewares/rateLimiter.middleware";
import { validate } from "../../middlewares/validation.middleware";
import { AuthController } from "./auth.controller";
import { loginSchema, logoutSchema, refreshSchema, registerSchema } from "./auth.validator";

const router = Router();

router.post("/register", authRateLimiter, validate(registerSchema), AuthController.register);
router.post("/login", authRateLimiter, validate(loginSchema), AuthController.login);
router.post("/refresh", authRateLimiter, validate(refreshSchema), AuthController.refresh);
router.post("/logout", validate(logoutSchema), AuthController.logout);
router.post("/logout-all", authMiddleware, AuthController.logoutAll);

export default router;
