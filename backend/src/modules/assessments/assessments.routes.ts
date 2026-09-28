import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate";
import { validate } from "../../middlewares/validate";
import { assessmentsController } from "./assessments.controller";
import {
  moduleIdParamSchema,
  saveAssessmentSchema,
  submitAttemptSchema,
} from "./schemas/assessment.schema";

export const assessmentsRouter = Router();

/**
 * Keyed on the module rather than nested under the course, because a module id
 * already says which course it belongs to — the service looks it up to run the
 * ownership and enrollment checks. Nothing here is public: taking a quiz, and
 * having a score recorded against your name, needs a name.
 */
assessmentsRouter.use(authenticate);

// The editing shape, with the correct options marked. Owner or admin only.
assessmentsRouter.get(
  "/:moduleId/assessment/edit",
  validate(moduleIdParamSchema, "params"),
  assessmentsController.getForEditing
);

assessmentsRouter.put(
  "/:moduleId/assessment",
  validate(moduleIdParamSchema, "params"),
  validate(saveAssessmentSchema, "body"),
  assessmentsController.saveAssessment
);

assessmentsRouter.delete(
  "/:moduleId/assessment",
  validate(moduleIdParamSchema, "params"),
  assessmentsController.removeAssessment
);

// The taking shape. Same route for everyone who can reach the course, and it
// never carries which option is correct.
assessmentsRouter.get(
  "/:moduleId/assessment",
  validate(moduleIdParamSchema, "params"),
  assessmentsController.getForTaking
);

assessmentsRouter.post(
  "/:moduleId/assessment/attempts",
  validate(moduleIdParamSchema, "params"),
  validate(submitAttemptSchema, "body"),
  assessmentsController.submitAttempt
);
