import { Router } from "express";
import { UserRole } from "../../constants/role.enum";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { jobCreationRateLimiter } from "../../middlewares/rateLimiter.middleware";
import { requireRole } from "../../middlewares/rbac.middleware";
import { validate } from "../../middlewares/validation.middleware";
import { createRatingSchema } from "../rating/rating.validator";
import { JobController } from "./job.controller";
import { createJobSchema, updateJobStatusSchema } from "./job.validator";

const router = Router();

router.use(authMiddleware);

router.post(
  "/",
  requireRole(UserRole.CUSTOMER),
  jobCreationRateLimiter,
  validate(createJobSchema),
  JobController.create
);
router.get("/", JobController.list);
router.get("/:id", JobController.getById);

router.post("/:id/accept", requireRole(UserRole.DRIVER), JobController.accept);
router.post("/:id/reject", requireRole(UserRole.DRIVER), JobController.reject);
router.patch("/:id/status", validate(updateJobStatusSchema), JobController.updateStatus);

// Customer-only — RatingService itself enforces the job is COMPLETED, belongs to this
// customer, and hasn't already been rated (matches the role-at-route,
// ownership-at-service split used everywhere else in this file).
router.post("/:id/rating", requireRole(UserRole.CUSTOMER), validate(createRatingSchema), JobController.rate);

export default router;
