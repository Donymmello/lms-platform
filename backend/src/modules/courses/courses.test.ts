import { CourseStatus, Role } from "@prisma/client";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../app";
import { prisma } from "../../database/prisma";
import { authCookie, createCourse, createLessons, createUser } from "../../test/factories";

const app = createApp();

describe("courses access control", () => {
  it("requires a session", async () => {
    const response = await request(app).get("/api/v1/courses");
    expect(response.status).toBe(401);
  });

  it("refuses a STUDENT — authoring is ADMIN/INSTRUCTOR only", async () => {
    const student = await createUser();
    const response = await request(app).get("/api/v1/courses").set("Cookie", authCookie(student));
    expect(response.status).toBe(403);
  });
});

describe("GET /courses", () => {
  it("shows an INSTRUCTOR only their own courses", async () => {
    const mine = await createUser({ role: Role.INSTRUCTOR });
    const theirs = await createUser({ role: Role.INSTRUCTOR });
    const myCourse = await createCourse(mine.id);
    await createCourse(theirs.id);

    const response = await request(app).get("/api/v1/courses").set("Cookie", authCookie(mine));

    expect(response.status).toBe(200);
    expect(response.body.data.courses).toHaveLength(1);
    expect(response.body.data.courses[0].id).toBe(myCourse.id);
  });

  it("shows an ADMIN every instructor's courses", async () => {
    const admin = await createUser({ role: Role.ADMIN });
    const instructor = await createUser({ role: Role.INSTRUCTOR });
    await createCourse(instructor.id);
    await createCourse(admin.id);

    const response = await request(app).get("/api/v1/courses").set("Cookie", authCookie(admin));

    expect(response.body.data.courses).toHaveLength(2);
  });

  it("paginates and reports the totals", async () => {
    const admin = await createUser({ role: Role.ADMIN });
    for (let index = 0; index < 3; index += 1) {
      await createCourse(admin.id);
    }

    const response = await request(app)
      .get("/api/v1/courses?page=1&pageSize=2")
      .set("Cookie", authCookie(admin));

    expect(response.body.data.courses).toHaveLength(2);
    expect(response.body.data.pagination).toMatchObject({ page: 1, pageSize: 2, total: 3, totalPages: 2 });
  });

  it("filters by status", async () => {
    const admin = await createUser({ role: Role.ADMIN });
    await createCourse(admin.id, { status: CourseStatus.PUBLISHED });
    const draft = await createCourse(admin.id, { status: CourseStatus.DRAFT });

    const response = await request(app)
      .get("/api/v1/courses?status=DRAFT")
      .set("Cookie", authCookie(admin));

    expect(response.body.data.courses).toHaveLength(1);
    expect(response.body.data.courses[0].id).toBe(draft.id);
  });

  it("rejects an out-of-range pageSize", async () => {
    const admin = await createUser({ role: Role.ADMIN });
    const response = await request(app)
      .get("/api/v1/courses?pageSize=5000")
      .set("Cookie", authCookie(admin));
    expect(response.status).toBe(400);
  });
});

describe("POST /courses", () => {
  it("creates a DRAFT course owned by the acting instructor", async () => {
    const instructor = await createUser({ role: Role.INSTRUCTOR });

    const response = await request(app)
      .post("/api/v1/courses")
      .set("Cookie", authCookie(instructor))
      .send({ title: "Curso de Node", description: "Backend", priceCents: 50_000 });

    expect(response.status).toBe(201);
    expect(response.body.data.course).toMatchObject({
      title: "Curso de Node",
      slug: "curso-de-node",
      status: CourseStatus.DRAFT,
      priceCents: 50_000,
    });

    const stored = await prisma.course.findUnique({ where: { id: response.body.data.course.id } });
    expect(stored?.instructorId).toBe(instructor.id);
  });

  it("derives a unique slug when two courses share a title", async () => {
    const instructor = await createUser({ role: Role.INSTRUCTOR });
    const body = { title: "Curso Repetido" };

    const first = await request(app)
      .post("/api/v1/courses")
      .set("Cookie", authCookie(instructor))
      .send(body);
    const second = await request(app)
      .post("/api/v1/courses")
      .set("Cookie", authCookie(instructor))
      .send(body);

    expect(first.body.data.course.slug).toBe("curso-repetido");
    expect(second.body.data.course.slug).toBe("curso-repetido-2");
  });

  it("rejects a title that is too short and a negative price", async () => {
    const instructor = await createUser({ role: Role.INSTRUCTOR });

    const shortTitle = await request(app)
      .post("/api/v1/courses")
      .set("Cookie", authCookie(instructor))
      .send({ title: "ab" });
    const negativePrice = await request(app)
      .post("/api/v1/courses")
      .set("Cookie", authCookie(instructor))
      .send({ title: "Preço inválido", priceCents: -1 });

    expect(shortTitle.status).toBe(400);
    expect(negativePrice.status).toBe(400);
  });
});

describe("course ownership", () => {
  it("refuses an instructor reading another instructor's course", async () => {
    const owner = await createUser({ role: Role.INSTRUCTOR });
    const other = await createUser({ role: Role.INSTRUCTOR });
    const course = await createCourse(owner.id);

    const response = await request(app)
      .get(`/api/v1/courses/${course.id}`)
      .set("Cookie", authCookie(other));

    expect(response.status).toBe(403);
  });

  it("refuses an instructor updating another instructor's course", async () => {
    const owner = await createUser({ role: Role.INSTRUCTOR });
    const other = await createUser({ role: Role.INSTRUCTOR });
    const course = await createCourse(owner.id);

    const response = await request(app)
      .patch(`/api/v1/courses/${course.id}`)
      .set("Cookie", authCookie(other))
      .send({ title: "Roubado" });

    expect(response.status).toBe(403);
    const stored = await prisma.course.findUnique({ where: { id: course.id } });
    expect(stored?.title).toBe(course.title);
  });

  it("refuses an instructor deleting another instructor's course", async () => {
    const owner = await createUser({ role: Role.INSTRUCTOR });
    const other = await createUser({ role: Role.INSTRUCTOR });
    const course = await createCourse(owner.id);

    const response = await request(app)
      .delete(`/api/v1/courses/${course.id}`)
      .set("Cookie", authCookie(other));

    expect(response.status).toBe(403);
    expect(await prisma.course.count({ where: { id: course.id } })).toBe(1);
  });

  it("lets an ADMIN manage a course they do not own", async () => {
    const instructor = await createUser({ role: Role.INSTRUCTOR });
    const admin = await createUser({ role: Role.ADMIN });
    const course = await createCourse(instructor.id);

    const response = await request(app)
      .patch(`/api/v1/courses/${course.id}`)
      .set("Cookie", authCookie(admin))
      .send({ title: "Corrigido pelo admin" });

    expect(response.status).toBe(200);
    expect(response.body.data.course.title).toBe("Corrigido pelo admin");
  });

  it("returns 404 for a course that does not exist", async () => {
    const admin = await createUser({ role: Role.ADMIN });
    const response = await request(app)
      .get("/api/v1/courses/11111111-1111-4111-8111-111111111111")
      .set("Cookie", authCookie(admin));
    expect(response.status).toBe(404);
  });
});

describe("PATCH /courses/:courseId/status", () => {
  it("publishes a draft course", async () => {
    const instructor = await createUser({ role: Role.INSTRUCTOR });
    const course = await createCourse(instructor.id, { status: CourseStatus.DRAFT });

    const response = await request(app)
      .patch(`/api/v1/courses/${course.id}/status`)
      .set("Cookie", authCookie(instructor))
      .send({ status: CourseStatus.PUBLISHED });

    expect(response.status).toBe(200);
    expect(response.body.data.course.status).toBe(CourseStatus.PUBLISHED);
  });

  it("rejects a status outside the enum", async () => {
    const instructor = await createUser({ role: Role.INSTRUCTOR });
    const course = await createCourse(instructor.id);

    const response = await request(app)
      .patch(`/api/v1/courses/${course.id}/status`)
      .set("Cookie", authCookie(instructor))
      .send({ status: "ARCHIVED" });

    expect(response.status).toBe(400);
  });
});

describe("DELETE /courses/:courseId", () => {
  it("cascades to the course's modules and lessons", async () => {
    const instructor = await createUser({ role: Role.INSTRUCTOR });
    const course = await createCourse(instructor.id);
    await createLessons(course.id, 2);

    const response = await request(app)
      .delete(`/api/v1/courses/${course.id}`)
      .set("Cookie", authCookie(instructor));

    expect(response.status).toBe(204);
    expect(await prisma.course.count()).toBe(0);
    expect(await prisma.courseModule.count()).toBe(0);
    expect(await prisma.lesson.count()).toBe(0);
  });
});

describe("modules and lessons", () => {
  it("creates a module, then a lesson inside it", async () => {
    const instructor = await createUser({ role: Role.INSTRUCTOR });
    const course = await createCourse(instructor.id);

    const moduleResponse = await request(app)
      .post(`/api/v1/courses/${course.id}/modules`)
      .set("Cookie", authCookie(instructor))
      .send({ title: "Módulo 1" });

    expect(moduleResponse.status).toBe(201);
    const moduleId = (await prisma.courseModule.findFirstOrThrow({ where: { courseId: course.id } })).id;

    const lessonResponse = await request(app)
      .post(`/api/v1/courses/${course.id}/modules/${moduleId}/lessons`)
      .set("Cookie", authCookie(instructor))
      .send({ title: "Aula 1", isFreePreview: true });

    expect(lessonResponse.status).toBe(201);
    const lesson = await prisma.lesson.findFirstOrThrow({ where: { moduleId } });
    // `lessonsRepository.nextOrder` is 0-based for the first lesson in a module.
    expect(lesson).toMatchObject({ title: "Aula 1", isFreePreview: true, order: 0 });
  });

  it("numbers new lessons sequentially within a module", async () => {
    const instructor = await createUser({ role: Role.INSTRUCTOR });
    const course = await createCourse(instructor.id);
    const courseModule = await prisma.courseModule.create({
      data: { courseId: course.id, title: "M", order: 1 },
    });

    for (const title of ["Aula A", "Aula B", "Aula C"]) {
      await request(app)
        .post(`/api/v1/courses/${course.id}/modules/${courseModule.id}/lessons`)
        .set("Cookie", authCookie(instructor))
        .send({ title });
    }

    const lessons = await prisma.lesson.findMany({
      where: { moduleId: courseModule.id },
      orderBy: { order: "asc" },
    });
    expect(lessons.map((lesson) => lesson.order)).toEqual([0, 1, 2]);
  });

  it("refuses to add a module to someone else's course", async () => {
    const owner = await createUser({ role: Role.INSTRUCTOR });
    const other = await createUser({ role: Role.INSTRUCTOR });
    const course = await createCourse(owner.id);

    const response = await request(app)
      .post(`/api/v1/courses/${course.id}/modules`)
      .set("Cookie", authCookie(other))
      .send({ title: "Intruso" });

    expect(response.status).toBe(403);
    expect(await prisma.courseModule.count()).toBe(0);
  });

  it("deletes a module and its lessons with it", async () => {
    const instructor = await createUser({ role: Role.INSTRUCTOR });
    const course = await createCourse(instructor.id);
    const lessons = await createLessons(course.id, 2);
    const moduleId = lessons[0]!.moduleId;

    const response = await request(app)
      .delete(`/api/v1/courses/${course.id}/modules/${moduleId}`)
      .set("Cookie", authCookie(instructor));

    // Deleting a module returns the refreshed course (200); only deleting
    // the course itself answers 204.
    expect(response.status).toBe(200);
    expect(await prisma.lesson.count()).toBe(0);
  });

  it("updates a lesson's free-preview flag", async () => {
    const instructor = await createUser({ role: Role.INSTRUCTOR });
    const course = await createCourse(instructor.id);
    const [lesson] = await createLessons(course.id, 1);

    const response = await request(app)
      .patch(`/api/v1/courses/${course.id}/modules/${lesson!.moduleId}/lessons/${lesson!.id}`)
      .set("Cookie", authCookie(instructor))
      .send({ isFreePreview: true });

    expect(response.status).toBe(200);
    const stored = await prisma.lesson.findUnique({ where: { id: lesson!.id } });
    expect(stored?.isFreePreview).toBe(true);
  });

  it("never exposes bunnyVideoId to the client, only hasVideo", async () => {
    const instructor = await createUser({ role: Role.INSTRUCTOR });
    const course = await createCourse(instructor.id);
    await createLessons(course.id, 1, { withVideo: true });

    const response = await request(app)
      .get(`/api/v1/courses/${course.id}`)
      .set("Cookie", authCookie(instructor));

    const lesson = response.body.data.course.modules[0].lessons[0];
    expect(lesson.hasVideo).toBe(true);
    expect(lesson.bunnyVideoId).toBeUndefined();
    expect(JSON.stringify(response.body)).not.toContain("video-");
  });
});
