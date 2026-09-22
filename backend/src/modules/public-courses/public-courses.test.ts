import { CourseStatus, Role } from "@prisma/client";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../app";
import { createCourse, createLessons, createUser } from "../../test/factories";

const app = createApp();

describe("GET /public/courses", () => {
  it("serves the catalogue without any session", async () => {
    const instructor = await createUser({ role: Role.INSTRUCTOR });
    await createCourse(instructor.id, { status: CourseStatus.PUBLISHED });

    const response = await request(app).get("/api/v1/public/courses");

    expect(response.status).toBe(200);
    expect(response.body.data.courses).toHaveLength(1);
  });

  it("never lists a DRAFT course", async () => {
    const instructor = await createUser({ role: Role.INSTRUCTOR });
    const published = await createCourse(instructor.id, { status: CourseStatus.PUBLISHED });
    await createCourse(instructor.id, { status: CourseStatus.DRAFT });

    const response = await request(app).get("/api/v1/public/courses");

    expect(response.body.data.courses).toHaveLength(1);
    expect(response.body.data.courses[0].id).toBe(published.id);
  });

  it("paginates and reports the totals", async () => {
    const instructor = await createUser({ role: Role.INSTRUCTOR });
    for (let index = 0; index < 3; index += 1) {
      await createCourse(instructor.id, { status: CourseStatus.PUBLISHED });
    }

    const response = await request(app).get("/api/v1/public/courses?page=1&pageSize=2");

    expect(response.body.data.courses).toHaveLength(2);
    expect(response.body.data.pagination).toMatchObject({ page: 1, pageSize: 2, total: 3, totalPages: 2 });
  });

  it("searches by title", async () => {
    const instructor = await createUser({ role: Role.INSTRUCTOR });
    const target = await createCourse(instructor.id, { title: "Curso de Kotlin" });
    await createCourse(instructor.id, { title: "Outra coisa" });

    const response = await request(app).get("/api/v1/public/courses?search=Kotlin");

    expect(response.body.data.courses).toHaveLength(1);
    expect(response.body.data.courses[0].id).toBe(target.id);
  });

  it("does not let a caller ask for drafts through the query string", async () => {
    const instructor = await createUser({ role: Role.INSTRUCTOR });
    await createCourse(instructor.id, { status: CourseStatus.DRAFT });

    // `status` is not part of the public schema; Zod strips it rather than
    // letting it reach the repository.
    const response = await request(app).get("/api/v1/public/courses?status=DRAFT");

    expect(response.status).toBe(200);
    expect(response.body.data.courses).toHaveLength(0);
  });

  it("rejects an out-of-range pageSize", async () => {
    const response = await request(app).get("/api/v1/public/courses?pageSize=5000");
    expect(response.status).toBe(400);
  });
});

describe("GET /public/courses/:slug", () => {
  it("returns a published course with its curriculum, unauthenticated", async () => {
    const instructor = await createUser({ role: Role.INSTRUCTOR });
    const course = await createCourse(instructor.id, { slug: "curso-publico" });
    await createLessons(course.id, 3, { freePreviewCount: 1 });

    const response = await request(app).get("/api/v1/public/courses/curso-publico");

    expect(response.status).toBe(200);
    expect(response.body.data.course).toMatchObject({ id: course.id, slug: "curso-publico" });
    expect(response.body.data.course.modules[0].lessons).toHaveLength(3);
    expect(response.body.data.course.modules[0].lessons[0].isFreePreview).toBe(true);
  });

  it("hides a DRAFT course behind a 404", async () => {
    const instructor = await createUser({ role: Role.INSTRUCTOR });
    await createCourse(instructor.id, { slug: "rascunho", status: CourseStatus.DRAFT });

    const response = await request(app).get("/api/v1/public/courses/rascunho");

    expect(response.status).toBe(404);
  });

  it("returns 404 for an unknown slug", async () => {
    const response = await request(app).get("/api/v1/public/courses/nao-existe");
    expect(response.status).toBe(404);
  });

  it("exposes hasVideo but never the bunnyVideoId", async () => {
    const instructor = await createUser({ role: Role.INSTRUCTOR });
    const course = await createCourse(instructor.id, { slug: "com-video" });
    await createLessons(course.id, 1, { withVideo: true });

    const response = await request(app).get("/api/v1/public/courses/com-video");

    const lesson = response.body.data.course.modules[0].lessons[0];
    expect(lesson.hasVideo).toBe(true);
    expect(lesson.bunnyVideoId).toBeUndefined();
    // The factory prefixes generated ids with "video-"; nothing of the sort
    // may reach an anonymous visitor.
    expect(JSON.stringify(response.body)).not.toContain("video-");
  });
});
