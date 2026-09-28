import { z } from "zod";

export const moduleIdParamSchema = z.object({
  moduleId: z.string().uuid("Invalid module id"),
});
export type ModuleIdParam = z.infer<typeof moduleIdParamSchema>;

const optionSchema = z.object({
  text: z.string().trim().min(1, "Every option needs text").max(500),
  isCorrect: z.boolean(),
});

const questionSchema = z
  .object({
    prompt: z.string().trim().min(1, "Every question needs a prompt").max(2000),
    // Two is the floor: one option is not a question. True/false is this with
    // the two options named Verdadeiro and Falso.
    options: z.array(optionSchema).min(2, "A question needs at least two options").max(10),
  })
  .refine((question) => question.options.some((option) => option.isCorrect), {
    message: "A question needs at least one correct option",
    path: ["options"],
  })
  .refine((question) => question.options.some((option) => !option.isCorrect), {
    // Every option correct means nothing is being asked.
    message: "A question needs at least one incorrect option",
    path: ["options"],
  });

export const saveAssessmentSchema = z.object({
  title: z.string().trim().min(1, "The assessment needs a title").max(200),
  passScore: z.number().int().min(1).max(100).default(70),
  questions: z.array(questionSchema).min(1, "An assessment needs at least one question").max(100),
});
export type SaveAssessmentInput = z.infer<typeof saveAssessmentSchema>;

export const submitAttemptSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.string().uuid(),
        // Empty is allowed: leaving a question blank is an answer, and a wrong one.
        selectedOptionIds: z.array(z.string().uuid()).max(10),
      })
    )
    .min(1),
});
export type SubmitAttemptInput = z.infer<typeof submitAttemptSchema>;
