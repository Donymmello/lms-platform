import { CourseStatus, Role } from "@prisma/client";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../app";
import { prisma } from "../../database/prisma";
import {
  authCookie,
  completeLesson,
  createCourse,
  createLessons,
  createUser,
  enroll,
} from "../../test/factories";

const app = createApp();

describe("PUT /progress/lessons/:lessonId", () => {
  it("marks a lesson complete for an enrolled student", async () => {
    const instructor = await createUser({ role: Role.INSTRUCTOR });
    const course = await createCourse(instructor.id);
    const [lesson] = await createLessons(course.id, 2);
    const student = await createUser();
    await enroll(student.id, course.id);

    const response = await request(app)
      .put(`/api/v1/progress/lessons/${lesson!.id}`)
      .set("Cookie", authCookie(student))
      .send({ completed: true });

    expect(response.status).toBe(200);
    const row = await prisma.lessonProgress.findUnique({
      where: { userId_lessonId: { userId: student.id, lessonId: lesson!.id } },
    });
    expect(row?.completedAt).toBeInstanceOf(Date);
  });

  it("unmarks a previously completed lesson", async () => {
    const instructor = await createUser({ role: Role.INSTRUCTOR });
    const course = await createCourse(instructor.id);
    const [lesson] = await createLessons(course.id, 1);
    const student = await createUser();
    await enroll(student.id, course.id);
    await completeLesson(student.id, lesson!.id);

    const response = await request(app)
      .put(`/api/v1/progress/lessons/${lesson!.id}`)
      .set("Cookie", authCookie(student))
      .send({ completed: false });

    expect(response.status).toBe(200);
    const row = await prisma.lessonProgress.findUnique({
      where: { userId_lessonId: { userId: student.id, lessonId: lesson!.id } },
    });
    expect(row?.completedAt).toBeNull();
  });

  it("refuses a student who is not enrolled", async () => {
    const instructor = await createUser({ role: Role.INSTRUCTOR });
    const course = await createCourse(instructor.id);
    const [lesson] = await createLessons(course.id, 1);
    const outsider = await createUser();

    const response = await request(app)
      .put(`/api/v1/progress/lessons/${lesson!.id}`)
      .set("Cookie", authCookie(outsider))
      .send({ completed: true });

    expect(response.status).toBe(403);
  });

  it("requires a session — unlike playback, there is no anonymous case", async () => {
    const instructor = await createUser({ role: Role.INSTRUCTOR });
    const course = await createCourse(instructor.id);
    const [preview] = await createLessons(course.id, 1, { freePreviewCount: 1 });

    const response = await request(app)
      .put(`/api/v1/progress/lessons/${preview!.id}`)
      .send({ completed: true });

    expect(response.status).toBe(401);
  });

  it("rejects a non-boolean `completed`", async () => {
    const instructor = await createUser({ role: Role.INSTRUCTOR });
    const course = await createCourse(instructor.id);
    const [lesson] = await createLessons(course.id, 1);
    const student = await createUser();
    await enroll(student.id, course.id);

    const response = await request(app)
      .put(`/api/v1/progress/lessons/${lesson!.id}`)
      .set("Cookie", authCookie(student))
      .send({ completed: "yes" });

    expect(response.status).toBe(400);
  });
});

describe("GET /progress/courses/:courseId", () => {
  it("reports percent and the next lesson to resume", async () => {
    const instructor = await createUser({ role: Role.INSTRUCTOR });
    const course = await createCourse(instructor.id);
    const lessons = await createLessons(course.id, 4);
    const student = await createUser();
    await enroll(student.id, course.id);
    await completeLesson(student.id, lessons[0]!.id);

    const response = await request(app)
      .get(`/api/v1/progress/courses/${course.id}`)
      .set("Cookie", authCookie(student));

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      courseId: course.id,
      totalLessons: 4,
      completedLessons: 1,
      percent: 25,
      // First lesson is done, so the second is where they pick up.
      resumeLessonId: lessons[1]!.id,
    });
  });

  it("resumes at the first lesson once everything is complete", async () => {
    const instructor = await createUser({ role: Role.INSTRUCTOR });
    const course = await createCourse(instructor.id);
    const lessons = await createLessons(course.id, 2);
    const student = await createUser();
    await enroll(student.id, course.id);
    for (const lesson of lessons) {
      await completeLesson(student.id, lesson.id);
    }

    const response = await request(app)
      .get(`/api/v1/progress/courses/${course.id}`)
      .set("Cookie", authCookie(student));

    expect(response.body.data.percent).toBe(100);
    expect(response.body.data.resumeLessonId).toBe(lessons[0]!.id);
  });

  it("reports 0% for a course with no lessons instead of dividing by zero", async () => {
    const instructor = await createUser({ role: Role.INSTRUCTOR });
    const course = await createCourse(instructor.id);
    const student = await createUser();
    await enroll(student.id, course.id);

    const response = await request(app)
      .get(`/api/v1/progress/courses/${course.id}`)
      .set("Cookie", authCookie(student));

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ totalLessons: 0, percent: 0, resumeLessonId: null });
  });

  it("counts only the acting user's progress, never another student's", async () => {
    const instructor = await createUser({ role: Role.INSTRUCTOR });
    const course = await createCourse(instructor.id);
    const lessons = await createLessons(course.id, 2);
    const [mine, theirs] = [await createUser(), await createUser()];
    await enroll(mine.id, course.id);
    await enroll(theirs.id, course.id);
    await completeLesson(theirs.id, lessons[0]!.id);

    const response = await request(app)
      .get(`/api/v1/progress/courses/${course.id}`)
      .set("Cookie", authCookie(mine));

    expect(response.body.data.completedLessons).toBe(0);
    expect(response.body.data.percent).toBe(0);
  });

  it("refuses a student who is not enrolled", async () => {
    const instructor = await createUser({ role: Role.INSTRUCTOR });
    const course = await createCourse(instructor.id);
    await createLessons(course.id, 1);
    const outsider = await createUser();

    const response = await request(app)
      .get(`/api/v1/progress/courses/${course.id}`)
      .set("Cookie", authCookie(outsider));

    expect(response.status).toBe(403);
  });

  it("lets the owning instructor read progress without enrolling", async () => {
    const instructor = await createUser({ role: Role.INSTRUCTOR });
    const course = await createCourse(instructor.id);
    await createLessons(course.id, 2);

    const response = await request(app)
      .get(`/api/v1/progress/courses/${course.id}`)
      .set("Cookie", authCookie(instructor));

    expect(response.status).toBe(200);
  });
});

describe("GET /progress/me", () => {
  it("returns one summary per enrolled course", async () => {
    const instructor = await createUser({ role: Role.INSTRUCTOR });
    const enrolled = await createCourse(instructor.id);
    const other = await createCourse(instructor.id);
    const lessons = await createLessons(enrolled.id, 2);
    await createLessons(other.id, 3);

    const student = await createUser();
    await enroll(student.id, enrolled.id);
    await completeLesson(student.id, lessons[0]!.id);

    const response = await request(app).get("/api/v1/progress/me").set("Cookie", authCookie(student));

    expect(response.status).toBe(200);
    expect(response.body.data.courses).toHaveLength(1);
    expect(response.body.data.courses[0]).toMatchObject({
      courseId: enrolled.id,
      totalLessons: 2,
      completedLessons: 1,
      percent: 50,
    });
  });

  it("returns an empty list for a student with no enrollments", async () => {
    const student = await createUser();

    const response = await request(app).get("/api/v1/progress/me").set("Cookie", authCookie(student));

    expect(response.status).toBe(200);
    expect(response.body.data.courses).toEqual([]);
  });
});

describe("playback side effects", () => {
  it("records a lastAccessed row when a signed URL is issued, without marking it complete", async () => {
    const instructor = await createUser({ role: Role.INSTRUCTOR });
    const course = await createCourse(instructor.id, { status: CourseStatus.PUBLISHED });
    const [lesson] = await createLessons(course.id, 1);
    const student = await createUser();
    await enroll(student.id, course.id);

    await request(app)
      .get(`/api/v1/lessons/${lesson!.id}/playback`)
      .set("Cookie", authCookie(student));

    // The touch is fire-and-forget in playback.service, so give it a tick to land.
    await new Promise((resolve) => setTimeout(resolve, 250));

    const row = await prisma.lessonProgress.findUnique({
      where: { userId_lessonId: { userId: student.id, lessonId: lesson!.id } },
    });
    expect(row).not.toBeNull();
    expect(row?.completedAt).toBeNull();
  });

  it("creates no progress row for an anonymous free-preview viewer", async () => {
    const instructor = await createUser({ role: Role.INSTRUCTOR });
    const course = await createCourse(instructor.id);
    const [preview] = await createLessons(course.id, 1, { freePreviewCount: 1 });

    await request(app).get(`/api/v1/lessons/${preview!.id}/playback`);
    await new Promise((resolve) => setTimeout(resolve, 250));

    expect(await prisma.lessonProgress.count()).toBe(0);
  });
});

describe("PUT /progress/lessons/:lessonId/position", () => {
  /** An enrolled student sitting in front of one lesson. */
  async function watcher() {
    const instructor = await createUser({ role: Role.INSTRUCTOR });
    const course = await createCourse(instructor.id);
    const lessons = await createLessons(course.id, 3);
    const student = await createUser();
    await enroll(student.id, course.id);
    return { course, lessons, student };
  }

  function report(lessonId: string, student: { id: string }, body: object) {
    return request(app)
      .put(`/api/v1/progress/lessons/${lessonId}/position`)
      .set("Cookie", authCookie(student as Parameters<typeof authCookie>[0]))
      .send(body);
  }

  it("stores the position without completing the lesson mid-way", async () => {
    const { lessons, student } = await watcher();

    const response = await report(lessons[0]!.id, student, {
      positionSeconds: 120,
      durationSeconds: 600,
    });

    expect(response.status).toBe(200);
    expect(response.body.data.completed).toBe(false);
    const row = await prisma.lessonProgress.findUnique({
      where: { userId_lessonId: { userId: student.id, lessonId: lessons[0]!.id } },
    });
    expect(row?.positionSeconds).toBe(120);
    expect(row?.completedAt).toBeNull();
  });

  it("completes the lesson at 90%, without waiting for the last frame", async () => {
    const { lessons, student } = await watcher();

    const response = await report(lessons[0]!.id, student, {
      positionSeconds: 540,
      durationSeconds: 600,
    });

    expect(response.body.data.completed).toBe(true);
    const row = await prisma.lessonProgress.findUnique({
      where: { userId_lessonId: { userId: student.id, lessonId: lessons[0]!.id } },
    });
    expect(row?.completedAt).toBeInstanceOf(Date);
  });

  it("does not un-complete a lesson the student rewinds, nor move its completion date", async () => {
    const { lessons, student } = await watcher();
    await report(lessons[0]!.id, student, { positionSeconds: 600, durationSeconds: 600 });
    const first = await prisma.lessonProgress.findUnique({
      where: { userId_lessonId: { userId: student.id, lessonId: lessons[0]!.id } },
    });

    // Watching it again from the start.
    await report(lessons[0]!.id, student, { positionSeconds: 10, durationSeconds: 600 });

    const after = await prisma.lessonProgress.findUnique({
      where: { userId_lessonId: { userId: student.id, lessonId: lessons[0]!.id } },
    });
    expect(after?.positionSeconds).toBe(10);
    expect(after?.completedAt).toEqual(first?.completedAt);
  });

  it("clamps a position that runs past the end of the video", async () => {
    const { lessons, student } = await watcher();

    const response = await report(lessons[0]!.id, student, {
      positionSeconds: 9999,
      durationSeconds: 600,
    });

    expect(response.body.data.positionSeconds).toBe(600);
  });

  it("rejects a duration of zero rather than dividing by it", async () => {
    const { lessons, student } = await watcher();

    const response = await report(lessons[0]!.id, student, {
      positionSeconds: 0,
      durationSeconds: 0,
    });

    expect(response.status).toBe(400);
  });

  it("REFUSES a student who is not enrolled", async () => {
    const { lessons } = await watcher();
    const outsider = await createUser();

    const response = await report(lessons[0]!.id, outsider, {
      positionSeconds: 10,
      durationSeconds: 600,
    });

    expect(response.status).toBe(403);
  });

  it("resumes the unfinished lesson last watched, at the second it stopped", async () => {
    const { course, lessons, student } = await watcher();
    // Skips ahead to the third lesson and stops part-way through it.
    await report(lessons[0]!.id, student, { positionSeconds: 600, durationSeconds: 600 });
    await report(lessons[2]!.id, student, { positionSeconds: 75, durationSeconds: 600 });

    const response = await request(app)
      .get(`/api/v1/progress/courses/${course.id}`)
      .set("Cookie", authCookie(student));

    // Not lesson 2, which is where the curriculum order would send them.
    expect(response.body.data.resumeLessonId).toBe(lessons[2]!.id);
    expect(response.body.data.resumePositionSeconds).toBe(75);
    expect(response.body.data.lessonPositions[lessons[2]!.id]).toBe(75);
  });
});
