import { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma";

const withQuestions = {
  questions: {
    orderBy: { order: "asc" },
    include: { options: { orderBy: { order: "asc" } } },
  },
} satisfies Prisma.AssessmentInclude;

export type AssessmentWithQuestions = Prisma.AssessmentGetPayload<{ include: typeof withQuestions }>;

export const assessmentsRepository = {
  findByModuleId(moduleId: string): Promise<AssessmentWithQuestions | null> {
    return prisma.assessment.findUnique({ where: { moduleId }, include: withQuestions });
  },

  /**
   * Creates or replaces the module's assessment whole.
   *
   * Replacing rather than diffing question by question: editing a quiz is a
   * whole-form act, and the alternative is six endpoints and a client that has
   * to track which question ids it invented. Past attempts keep their score and
   * pass/fail — those live on the attempt — but their per-question answers
   * cascade away with the questions they referred to, so a replaced quiz cannot
   * be reviewed answer by answer afterwards.
   */
  replaceForModule(
    moduleId: string,
    data: {
      title: string;
      passScore: number;
      questions: { prompt: string; options: { text: string; isCorrect: boolean }[] }[];
    }
  ): Promise<AssessmentWithQuestions> {
    const questions = {
      create: data.questions.map((question, questionIndex) => ({
        prompt: question.prompt,
        order: questionIndex,
        options: {
          create: question.options.map((option, optionIndex) => ({
            text: option.text,
            isCorrect: option.isCorrect,
            order: optionIndex,
          })),
        },
      })),
    };

    return prisma.assessment.upsert({
      where: { moduleId },
      create: { moduleId, title: data.title, passScore: data.passScore, questions },
      update: {
        title: data.title,
        passScore: data.passScore,
        // deleteMany with no filter clears this assessment's questions only.
        questions: { deleteMany: {}, ...questions },
      },
      include: withQuestions,
    });
  },

  async deleteForModule(moduleId: string): Promise<void> {
    await prisma.assessment.delete({ where: { moduleId } });
  },

  recordAttempt(data: {
    assessmentId: string;
    userId: string;
    score: number;
    passed: boolean;
    answers: { questionId: string; selectedOptionIds: string[]; correct: boolean }[];
  }) {
    return prisma.assessmentAttempt.create({
      data: {
        assessmentId: data.assessmentId,
        userId: data.userId,
        score: data.score,
        passed: data.passed,
        answers: { create: data.answers },
      },
    });
  },

  /** Every attempt this user has made at this assessment, newest first. */
  findAttempts(assessmentId: string, userId: string) {
    return prisma.assessmentAttempt.findMany({
      where: { assessmentId, userId },
      orderBy: { createdAt: "desc" },
      select: { id: true, score: true, passed: true, createdAt: true },
    });
  },

  /** Which modules of these courses have an assessment, and how many questions — for the course tree. */
  async summarise(moduleIds: string[]): Promise<Record<string, { title: string; questionCount: number }>> {
    if (moduleIds.length === 0) return {};
    const rows = await prisma.assessment.findMany({
      where: { moduleId: { in: moduleIds } },
      select: { moduleId: true, title: true, _count: { select: { questions: true } } },
    });

    const byModule: Record<string, { title: string; questionCount: number }> = {};
    for (const row of rows) {
      byModule[row.moduleId] = { title: row.title, questionCount: row._count.questions };
    }
    return byModule;
  },
};
