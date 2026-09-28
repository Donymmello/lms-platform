import { CourseStatus, Role } from "@prisma/client";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../app";
import { prisma } from "../../database/prisma";
import { authCookie, createCourse, createLessons, createUser, enroll } from "../../test/factories";

const app = createApp();

/**
 * The end-of-module quiz. The thing most worth pinning down is that the taking
 * shape never says which option is correct — grading happens on this side
 * precisely because the answers do not leave it.
 */

/** Two questions: one single-answer, one "select all that apply". */
const QUIZ = {
  title: "Avaliação do módulo 1",
  passScore: 70,
  questions: [
    {
      prompt: "Qual porta usa HTTPS?",
      options: [
        { text: "443", isCorrect: true },
        { text: "80", isCorrect: false },
        { text: "22", isCorrect: false },
      ],
    },
    {
      prompt: "Selecciona todos os protocolos de camada de transporte",
      options: [
        { text: "TCP", isCorrect: true },
        { text: "UDP", isCorrect: true },
        { text: "IP", isCorrect: false },
      ],
    },
  ],
};

async function moduleWithQuiz(quiz: unknown = QUIZ) {
  const instructor = await createUser({ role: Role.INSTRUCTOR });
  const course = await createCourse(instructor.id, { status: CourseStatus.PUBLISHED });
  const [lesson] = await createLessons(course.id, 1);
  const moduleId = lesson!.moduleId;

  const saved = await request(app)
    .put(`/api/v1/modules/${moduleId}/assessment`)
    .set("Cookie", authCookie(instructor))
    .send(quiz);

  return { instructor, course, moduleId, saved };
}

/** An enrolled student, and the quiz as they see it. */
async function studentAt(course: { id: string }, moduleId: string) {
  const student = await createUser();
  await enroll(student.id, course.id);

  const response = await request(app)
    .get(`/api/v1/modules/${moduleId}/assessment`)
    .set("Cookie", authCookie(student));

  return { student, assessment: response.body.data?.assessment, response };
}

/** Picks option ids by their text, which is how the tests express an answer. */
function optionIds(question: { options: { id: string; text: string }[] }, ...texts: string[]): string[] {
  return texts.map((text) => question.options.find((option) => option.text === text)!.id);
}

describe("PUT /modules/:moduleId/assessment", () => {
  it("creates the assessment and reports it on the course tree", async () => {
    const { course, moduleId, saved } = await moduleWithQuiz();

    expect(saved.status).toBe(200);
    expect(saved.body.data.assessment.questions).toHaveLength(2);

    const detail = await request(app).get(`/api/v1/public/courses/${course.slug}`);
    const courseModule = detail.body.data.course.modules.find((m: { id: string }) => m.id === moduleId);
    // The tree says a quiz exists and how big it is, and stops there.
    expect(courseModule.assessment).toEqual({ title: QUIZ.title, questionCount: 2 });
    expect(JSON.stringify(courseModule.assessment)).not.toContain("isCorrect");
  });

  it("replaces the questions rather than adding to them", async () => {
    const { instructor, moduleId } = await moduleWithQuiz();

    await request(app)
      .put(`/api/v1/modules/${moduleId}/assessment`)
      .set("Cookie", authCookie(instructor))
      .send({
        title: "Reescrita",
        passScore: 50,
        questions: [
          {
            prompt: "Só uma pergunta agora",
            options: [
              { text: "Certo", isCorrect: true },
              { text: "Errado", isCorrect: false },
            ],
          },
        ],
      });

    const assessment = await prisma.assessment.findUnique({
      where: { moduleId },
      include: { questions: true },
    });
    expect(assessment!.title).toBe("Reescrita");
    expect(assessment!.passScore).toBe(50);
    expect(assessment!.questions).toHaveLength(1);
  });

  it("REFUSES an instructor who does not own the course", async () => {
    const { moduleId } = await moduleWithQuiz();
    const other = await createUser({ role: Role.INSTRUCTOR });

    const response = await request(app)
      .put(`/api/v1/modules/${moduleId}/assessment`)
      .set("Cookie", authCookie(other))
      .send(QUIZ);

    expect(response.status).toBe(403);
  });

  it("rejects a question whose every option is correct, since it asks nothing", async () => {
    const instructor = await createUser({ role: Role.INSTRUCTOR });
    const course = await createCourse(instructor.id);
    const [lesson] = await createLessons(course.id, 1);

    const response = await request(app)
      .put(`/api/v1/modules/${lesson!.moduleId}/assessment`)
      .set("Cookie", authCookie(instructor))
      .send({
        title: "Má",
        questions: [
          {
            prompt: "Tudo certo?",
            options: [
              { text: "A", isCorrect: true },
              { text: "B", isCorrect: true },
            ],
          },
        ],
      });

    expect(response.status).toBe(400);
  });
});

describe("GET /modules/:moduleId/assessment", () => {
  it("NEVER tells a student which option is correct", async () => {
    const { course, moduleId } = await moduleWithQuiz();

    const { assessment, response } = await studentAt(course, moduleId);

    expect(response.status).toBe(200);
    // The single most important assertion in this file.
    expect(JSON.stringify(assessment)).not.toContain("isCorrect");
    expect(assessment.questions[0].options[0]).toEqual({
      id: expect.any(String),
      text: expect.any(String),
    });
  });

  it("marks the multi-answer question so the UI can offer checkboxes", async () => {
    const { course, moduleId } = await moduleWithQuiz();

    const { assessment } = await studentAt(course, moduleId);

    expect(assessment.questions[0].multiple).toBe(false);
    expect(assessment.questions[1].multiple).toBe(true);
  });

  it("REFUSES a student who is not enrolled", async () => {
    const { moduleId } = await moduleWithQuiz();
    const outsider = await createUser();

    const response = await request(app)
      .get(`/api/v1/modules/${moduleId}/assessment`)
      .set("Cookie", authCookie(outsider));

    expect(response.status).toBe(403);
  });

  it("404s for a module with no assessment", async () => {
    const instructor = await createUser({ role: Role.INSTRUCTOR });
    const course = await createCourse(instructor.id, { status: CourseStatus.PUBLISHED });
    const [lesson] = await createLessons(course.id, 1);
    const student = await createUser();
    await enroll(student.id, course.id);

    const response = await request(app)
      .get(`/api/v1/modules/${lesson!.moduleId}/assessment`)
      .set("Cookie", authCookie(student));

    expect(response.status).toBe(404);
  });

  it("gives the owner the answers on the editing route, and REFUSES anyone else", async () => {
    const { instructor, course, moduleId } = await moduleWithQuiz();
    const student = await createUser();
    await enroll(student.id, course.id);

    const asOwner = await request(app)
      .get(`/api/v1/modules/${moduleId}/assessment/edit`)
      .set("Cookie", authCookie(instructor));
    const asStudent = await request(app)
      .get(`/api/v1/modules/${moduleId}/assessment/edit`)
      .set("Cookie", authCookie(student));

    expect(asOwner.status).toBe(200);
    expect(asOwner.body.data.assessment.questions[0].options[0].isCorrect).toBe(true);
    // Enrolled is not the same as entitled to the answer key.
    expect(asStudent.status).toBe(403);
  });
});

describe("POST /modules/:moduleId/assessment/attempts", () => {
  /** Submits answers given as option texts per question index. */
  async function attempt(
    moduleId: string,
    assessment: { questions: { id: string; options: { id: string; text: string }[] }[] },
    student: Parameters<typeof authCookie>[0],
    picks: string[][]
  ) {
    return request(app)
      .post(`/api/v1/modules/${moduleId}/assessment/attempts`)
      .set("Cookie", authCookie(student))
      .send({
        answers: assessment.questions.map((question, index) => ({
          questionId: question.id,
          selectedOptionIds: optionIds(question, ...(picks[index] ?? [])),
        })),
      });
  }

  it("scores a perfect attempt and passes it", async () => {
    const { course, moduleId } = await moduleWithQuiz();
    const { student, assessment } = await studentAt(course, moduleId);

    const response = await attempt(moduleId, assessment, student, [["443"], ["TCP", "UDP"]]);

    expect(response.status).toBe(201);
    expect(response.body.data.result).toMatchObject({
      score: 100,
      passed: true,
      correctCount: 2,
      totalQuestions: 2,
      bestScore: 100,
    });
  });

  it("gives nothing for a partly-selected multi-answer question", async () => {
    const { course, moduleId } = await moduleWithQuiz();
    const { student, assessment } = await studentAt(course, moduleId);

    // TCP is right, but UDP is missing.
    const response = await attempt(moduleId, assessment, student, [["443"], ["TCP"]]);

    // Half credit would make "select all that apply" answerable by guessing one.
    expect(response.body.data.result).toMatchObject({ score: 50, passed: false, correctCount: 1 });
  });

  it("scores nothing for ticking every option", async () => {
    const { course, moduleId } = await moduleWithQuiz();
    const { student, assessment } = await studentAt(course, moduleId);

    const response = await attempt(moduleId, assessment, student, [
      ["443", "80", "22"],
      ["TCP", "UDP", "IP"],
    ]);

    expect(response.body.data.result.score).toBe(0);
  });

  it("counts an unanswered question as wrong rather than skipping it", async () => {
    const { course, moduleId } = await moduleWithQuiz();
    const { student, assessment } = await studentAt(course, moduleId);

    const response = await attempt(moduleId, assessment, student, [["443"], []]);

    expect(response.body.data.result).toMatchObject({ score: 50, totalQuestions: 2 });
  });

  it("reveals the correct options once the attempt is in", async () => {
    const { course, moduleId } = await moduleWithQuiz();
    const { student, assessment } = await studentAt(course, moduleId);

    const response = await attempt(moduleId, assessment, student, [["80"], ["TCP", "UDP"]]);

    const [first] = response.body.data.result.questions;
    expect(first.correct).toBe(false);
    // Now it is useful rather than a leak: the score is already recorded.
    expect(first.correctOptionIds).toEqual(optionIds(assessment.questions[0], "443"));
  });

  it("keeps the best score across unlimited attempts, and every attempt", async () => {
    const { course, moduleId } = await moduleWithQuiz();
    const { student, assessment } = await studentAt(course, moduleId);

    await attempt(moduleId, assessment, student, [["80"], ["IP"]]);
    const good = await attempt(moduleId, assessment, student, [["443"], ["TCP", "UDP"]]);
    const worseAgain = await attempt(moduleId, assessment, student, [["22"], ["IP"]]);

    expect(good.body.data.result.bestScore).toBe(100);
    // A bad retake must not undo a pass.
    expect(worseAgain.body.data.result).toMatchObject({ score: 0, bestScore: 100 });

    const reread = await request(app)
      .get(`/api/v1/modules/${moduleId}/assessment`)
      .set("Cookie", authCookie(student));
    expect(reread.body.data.assessment.attempts).toHaveLength(3);
    expect(reread.body.data.assessment.bestScore).toBe(100);
  });

  it("rejects a submission carrying a question from another assessment", async () => {
    const { course, moduleId } = await moduleWithQuiz();
    const { student } = await studentAt(course, moduleId);
    const elsewhere = await moduleWithQuiz();

    const response = await request(app)
      .post(`/api/v1/modules/${moduleId}/assessment/attempts`)
      .set("Cookie", authCookie(student))
      .send({
        answers: [
          {
            questionId: elsewhere.saved.body.data.assessment.questions[0].id,
            selectedOptionIds: [],
          },
        ],
      });

    expect(response.status).toBe(400);
  });

  it("REFUSES a student who is not enrolled", async () => {
    const { moduleId, saved } = await moduleWithQuiz();
    const outsider = await createUser();

    const response = await request(app)
      .post(`/api/v1/modules/${moduleId}/assessment/attempts`)
      .set("Cookie", authCookie(outsider))
      .send({
        answers: [
          { questionId: saved.body.data.assessment.questions[0].id, selectedOptionIds: [] },
        ],
      });

    expect(response.status).toBe(403);
  });
});

describe("DELETE /modules/:moduleId/assessment", () => {
  it("removes the assessment and its questions", async () => {
    const { instructor, moduleId } = await moduleWithQuiz();

    const response = await request(app)
      .delete(`/api/v1/modules/${moduleId}/assessment`)
      .set("Cookie", authCookie(instructor));

    expect(response.status).toBe(204);
    expect(await prisma.assessment.count({ where: { moduleId } })).toBe(0);
    expect(await prisma.assessmentQuestion.count()).toBe(0);
  });

  it("REFUSES an instructor who does not own the course", async () => {
    const { moduleId } = await moduleWithQuiz();
    const other = await createUser({ role: Role.INSTRUCTOR });

    const response = await request(app)
      .delete(`/api/v1/modules/${moduleId}/assessment`)
      .set("Cookie", authCookie(other));

    expect(response.status).toBe(403);
  });
});
