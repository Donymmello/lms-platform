import { Role } from "@prisma/client";
import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate";
import { checkRole } from "../../middlewares/checkRole";
import { validate } from "../../middlewares/validate";
import { analyticsController } from "./analytics.controller";
import { revenueQuerySchema } from "./schemas/analytics.schema";

export const analyticsRouter = Router();

// Reporting is ADMIN/INSTRUCTOR only. Which rows each of them may see
// (everything vs. their own courses) is decided in the service layer, since
// it depends on course.instructorId — data middleware can't reach.
analyticsRouter.use(authenticate, checkRole([Role.ADMIN, Role.INSTRUCTOR]));

analyticsRouter.get("/overview", analyticsController.getOverview);
analyticsRouter.get("/revenue", validate(revenueQuerySchema, "query"), analyticsController.getRevenueSeries);
analyticsRouter.get("/courses", analyticsController.getCourseBreakdown);
