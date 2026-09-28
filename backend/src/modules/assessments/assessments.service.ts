import { NotFoundError, ValidationError } from "../../errors";
import { AuthenticatedUser } from "../../@types/express";
import { courseModulesRepository } from "../courses/course-modules.repository";
import { assertCanAccessCourse, assertCanManage, requireCourse } from "../courses/courses.service";
import {
  AssessmentForEditingDto,
  AssessmentForTakingDto,
  AttemptResultDto,
} from "./dtos/assessment.dto";
import { AssessmentWithQuestions, assessmentsRepository } from "./assessments.repository";
import { SaveAssessmentInput, SubmitAttemptInput } from "./schemas/assessment.schema";

/** Resolves the module and the course it belongs to, both of which the guards need. */
async function requireModuleWithCourse(moduleId: string) {
  const courseModule = await courseModulesRepository.findById(moduleId);
  if (!courseModule) {
    throw new NotFoundError("Module not found");
  }
  return { courseModule, course: await requireCourse(courseModule.courseId) };
}

async function requireAssessment(moduleId: string): Promise<AssessmentWithQuestions> {
  const assessment = await assessmentsRepository.findByModuleId(moduleId);
  if (!assessment) {
    throw new NotFoundError("This module has no assessment");
  }
  return assessment;
}

function toEditingDto(assessment: AssessmentWithQuestions): AssessmentForEditingDto {
  return {
    id: assessment.id,
    moduleId: assessment.moduleId,
    title: assessment.title,
    passScore: assessment.passScore,
    questions: assessment.questions.map((question) => ({
      id: question.id,
      prompt: question.prompt,
      options: question.options.map((option) => ({
        id: option.id,
        text: option.text,
        isCorrect: option.isCorrect,
      })),
    })),
  };
}

export const assessmentsService = {
  /** Creates or replaces the module's assessment. Owner or admin only. */
  async save(
    moduleId: string,
    input: SaveAssessmentInput,
    actingUser: AuthenticatedUser
  ): Promise<AssessmentForEditingDto> {
    const { course } = await requireModuleWithCourse(moduleId);
    assertCanManage(course, actingUser);

    return toEditingDto(await assessmentsRepository.replaceForModule(moduleId, input));
  },

  async remove(moduleId: string, actingUser: AuthenticatedUser): Promise<void> {
    const { course } = await requireModuleWithCourse(moduleId);
    assertCanManage(course, actingUser);
    await requireAssessment(moduleId);

    await assessmentsRepository.deleteForModule(moduleId);
  },

  /** The editing shape, with the correct options marked. Owner or admin only. */
  async getForEditing(moduleId: string, actingUser: AuthenticatedUser): Promise<AssessmentForEditingDto> {
    const { course } = await requireModuleWithCourse(moduleId);
    assertCanManage(course, actingUser);

    return toEditingDto(await requireAssessment(moduleId));
  },

  /**
   * The taking shape: questions and options, with nothing saying which option
   * is right. An instructor previewing their own course gets the same shape —
   * the editing endpoint is where they see the answers.
   */
  async getForTaking(moduleId: string, actingUser: AuthenticatedUser): Promise<AssessmentForTakingDto> {
    const { course } = await requireModuleWithCourse(moduleId);
    await assertCanAccessCourse(
      course,
      actingUser,
      "You need to be enrolled in this course to take its assessments"
    );

    const assessment = await requireAssessment(moduleId);
    const attempts = await assessmentsRepository.findAttempts(assessment.id, actingUser.id);

    return {
      id: assessment.id,
      moduleId: assessment.moduleId,
      title: assessment.title,
      passScore: assessment.passScore,
      questions: assessment.questions.map((question) => ({
        id: question.id,
        prompt: question.prompt,
        options: question.options.map((option) => ({ id: option.id, text: option.text })),
        multiple: question.options.filter((option) => option.isCorrect).length > 1,
      })),
      attempts,
      bestScore: attempts.length === 0 ? null : Math.max(...attempts.map((attempt) => attempt.score)),
    };
  },

  /**
   * Grades a submission and records it. Attempts are unlimited and the best
   * score is what counts, so nothing here compares against or overwrites an
   * earlier one.
   *
   * Grading happens on this side because the correct answers never left it. A
   * question is right only when the chosen set matches the correct set exactly:
   * two of three correct options scores nothing for that question rather than
   * two thirds, which is what stops "selecciona todas as que se aplicam" from
   * being answerable by ticking everything.
   */
  async submitAttempt(
    moduleId: string,
    input: SubmitAttemptInput,
    actingUser: AuthenticatedUser
  ): Promise<AttemptResultDto> {
    const { course } = await requireModuleWithCourse(moduleId);
    await assertCanAccessCourse(
      course,
      actingUser,
      "You need to be enrolled in this course to take its assessments"
    );

    const assessment = await requireAssessment(moduleId);
    const submitted = new Map(input.answers.map((answer) => [answer.questionId, answer.selectedOptionIds]));

    // An answer for a question that is not on this quiz means the client is
    // working from a stale copy — grading it would produce a score neither side
    // could explain.
    const questionIds = new Set(assessment.questions.map((question) => question.id));
    for (const questionId of submitted.keys()) {
      if (!questionIds.has(questionId)) {
        throw new ValidationError("This submission does not match the assessment");
      }
    }

    const graded = assessment.questions.map((question) => {
      const correctOptionIds = question.options
        .filter((option) => option.isCorrect)
        .map((option) => option.id);
      const validOptionIds = new Set(question.options.map((option) => option.id));

      // Options belonging to another question are dropped rather than rejected:
      // they cannot earn a mark, and ignoring them beats failing a whole
      // submission over one stray id.
      const selectedOptionIds = [...new Set(submitted.get(question.id) ?? [])].filter((id) =>
        validOptionIds.has(id)
      );

      const correct =
        selectedOptionIds.length === correctOptionIds.length &&
        selectedOptionIds.every((id) => correctOptionIds.includes(id));

      return { questionId: question.id, selectedOptionIds, correctOptionIds, correct };
    });

    const correctCount = graded.filter((question) => question.correct).length;
    const score = Math.round((correctCount / graded.length) * 100);
    const passed = score >= assessment.passScore;

    const attempt = await assessmentsRepository.recordAttempt({
      assessmentId: assessment.id,
      userId: actingUser.id,
      score,
      passed,
      answers: graded.map((question) => ({
        questionId: question.questionId,
        selectedOptionIds: question.selectedOptionIds,
        correct: question.correct,
      })),
    });

    const attempts = await assessmentsRepository.findAttempts(assessment.id, actingUser.id);

    return {
      attemptId: attempt.id,
      score,
      passed,
      passScore: assessment.passScore,
      correctCount,
      totalQuestions: graded.length,
      bestScore: Math.max(...attempts.map((previous) => previous.score)),
      // The correct answers are fair game now: the attempt is recorded, and
      // seeing what you got wrong is most of the point of sitting it.
      questions: graded,
    };
  },
};
