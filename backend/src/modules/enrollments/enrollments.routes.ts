import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate";
import { validate } from "../../middlewares/validate";
import { enrollmentsController } from "./enrollments.controller";
import { createEnrollmentSchema } from "./schemas/enrollment.schema";

export const enrollmentsRouter = Router();

// Any authenticated role may self-enroll — there is no ownership concept to
// gate here beyond "the acting user enrolls themselves" (enforced by using
// req.user in the service, never a body-supplied userId).
enrollmentsRouter.use(authenticate);

enrollmentsRouter.post("/", validate(createEnrollmentSchema, "body"), enrollmentsController.create);
enrollmentsRouter.get("/me", enrollmentsController.listMine);
