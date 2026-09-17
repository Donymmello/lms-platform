import { CourseStatus, Role } from "@prisma/client";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../app";
import { prisma } from "../../database/prisma";
import { authCookie, createCourse, createUser, enroll } from "../../test/factories";

const app = createApp();

describe("POST /enrollments", () => {
  it("enrolls a student in a free published course", async () => {
    const instructor = await createUser({ role: Role.INSTRUCTOR });
    const course = await createCourse(instructor.id, { priceCents: 0 });
    const student = await createUser();

    const response = await request(app)
      .post("/api/v1/enrollments")
      .set("Cookie", authCookie(student))
      .send({ courseId: course.id });

    expect(response.status).toBe(201);
    expect(response.body.data.enrollment.courseId).toBe(course.id);

    const stored = await prisma.enrollment.findFirst({ where: { userId: student.id } });
    // A free enrollment has no payment behind it.
    expect(stored?.paymentId).toBeNull();
  });

  it("refuses a priced course — that path goes through checkout", async () => {
    const instructor = await createUser({ role: Role.INSTRUCTOR });
    const course = await createCourse(instructor.id, { priceCents: 50_000 });
    const student = await createUser();

    const response = await request(app)
      .post("/api/v1/enrollments")
      .set("Cookie", authCookie(student))
      .send({ courseId: course.id });

    expect(response.status).toBe(403);
    expect(await prisma.enrollment.count()).toBe(0);
  });

  it("refuses a course that is still a draft", async () => {
    const instructor = await createUser({ role: Role.INSTRUCTOR });
    const course = await createCourse(instructor.id, { status: CourseStatus.DRAFT, priceCents: 0 });
    const student = await createUser();

    const response = await request(app)
      .post("/api/v1/enrollments")
      .set("Cookie", authCookie(student))
      .send({ courseId: course.id });

    expect(response.status).toBe(403);
  });

  it("returns 409 on a second enrollment instead of creating a duplicate", async () => {
    const instructor = await createUser({ role: Role.INSTRUCTOR });
    const course = await createCourse(instructor.id, { priceCents: 0 });
    const student = await createUser();
    await enroll(student.id, course.id);

    const response = await request(app)
      .post("/api/v1/enrollments")
      .set("Cookie", authCookie(student))
      .send({ courseId: course.id });

    expect(response.status).toBe(409);
    expect(await prisma.enrollment.count()).toBe(1);
  });

  it("returns 404 for a course that does not exist", async () => {
    const student = await createUser();

    const response = await request(app)
      .post("/api/v1/enrollments")
      .set("Cookie", authCookie(student))
      .send({ courseId: "11111111-1111-4111-8111-111111111111" });

    expect(response.status).toBe(404);
  });

  it("requires a session", async () => {
    const instructor = await createUser({ role: Role.INSTRUCTOR });
    const course = await createCourse(instructor.id, { priceCents: 0 });

    const response = await request(app).post("/api/v1/enrollments").send({ courseId: course.id });

    expect(response.status).toBe(401);
  });

  it("enrolls the acting user, ignoring any userId supplied in the body", async () => {
    const instructor = await createUser({ role: Role.INSTRUCTOR });
    const course = await createCourse(instructor.id, { priceCents: 0 });
    const student = await createUser();
    const victim = await createUser();

    await request(app)
      .post("/api/v1/enrollments")
      .set("Cookie", authCookie(student))
      .send({ courseId: course.id, userId: victim.id });

    const enrollments = await prisma.enrollment.findMany();
    expect(enrollments).toHaveLength(1);
    expect(enrollments[0]!.userId).toBe(student.id);
  });

  it("rejects a malformed courseId", async () => {
    const student = await createUser();

    const response = await request(app)
      .post("/api/v1/enrollments")
      .set("Cookie", authCookie(student))
      .send({ courseId: "not-a-uuid" });

    expect(response.status).toBe(400);
  });
});

describe("GET /enrollments/me", () => {
  it("returns only the acting user's enrollments", async () => {
    const instructor = await createUser({ role: Role.INSTRUCTOR });
    const mine = await createCourse(instructor.id);
    const theirs = await createCourse(instructor.id);
    const student = await createUser();
    const other = await createUser();
    await enroll(student.id, mine.id);
    await enroll(other.id, theirs.id);

    const response = await request(app)
      .get("/api/v1/enrollments/me")
      .set("Cookie", authCookie(student));

    expect(response.status).toBe(200);
    expect(response.body.data.enrollments).toHaveLength(1);
    expect(response.body.data.enrollments[0].course.id).toBe(mine.id);
  });

  it("returns an empty list for a student with no enrollments", async () => {
    const student = await createUser();

    const response = await request(app)
      .get("/api/v1/enrollments/me")
      .set("Cookie", authCookie(student));

    expect(response.body.data.enrollments).toEqual([]);
  });
});
