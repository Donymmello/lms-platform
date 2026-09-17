import { CourseStatus, PaymentStatus, Role } from "@prisma/client";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../app";
import {
  authCookie,
  completeLesson,
  createCourse,
  createLessons,
  createPayment,
  createUser,
  enroll,
} from "../../test/factories";

const app = createApp();

describe("analytics access control", () => {
  it("requires a session", async () => {
    const response = await request(app).get("/api/v1/analytics/overview");
    expect(response.status).toBe(401);
  });

  it("refuses a STUDENT", async () => {
    const student = await createUser();
    const response = await request(app)
      .get("/api/v1/analytics/overview")
      .set("Cookie", authCookie(student));
    expect(response.status).toBe(403);
  });

  it("allows ADMIN and INSTRUCTOR", async () => {
    const admin = await createUser({ role: Role.ADMIN });
    const instructor = await createUser({ role: Role.INSTRUCTOR });

    const asAdmin = await request(app).get("/api/v1/analytics/overview").set("Cookie", authCookie(admin));
    const asInstructor = await request(app)
      .get("/api/v1/analytics/overview")
      .set("Cookie", authCookie(instructor));

    expect(asAdmin.status).toBe(200);
    expect(asInstructor.status).toBe(200);
  });
});

describe("GET /analytics/overview", () => {
  it("counts only COMPLETED payments as revenue", async () => {
    const admin = await createUser({ role: Role.ADMIN });
    const course = await createCourse(admin.id);
    const buyer = await createUser();

    await createPayment(buyer.id, course.id, { amountCents: 30_000, status: PaymentStatus.COMPLETED });
    await createPayment(buyer.id, course.id, { amountCents: 99_000, status: PaymentStatus.PENDING });
    await createPayment(buyer.id, course.id, { amountCents: 77_000, status: PaymentStatus.FAILED });

    const response = await request(app).get("/api/v1/analytics/overview").set("Cookie", authCookie(admin));

    expect(response.body.data.totalRevenueCents).toBe(30_000);
    expect(response.body.data.totalPayments).toBe(1);
  });

  it("counts a student enrolled in two courses once", async () => {
    const admin = await createUser({ role: Role.ADMIN });
    const first = await createCourse(admin.id);
    const second = await createCourse(admin.id);
    const student = await createUser();
    await enroll(student.id, first.id);
    await enroll(student.id, second.id);

    const response = await request(app).get("/api/v1/analytics/overview").set("Cookie", authCookie(admin));

    expect(response.body.data.totalEnrollments).toBe(2);
    expect(response.body.data.totalStudents).toBe(1);
  });

  it("separates published from draft courses", async () => {
    const admin = await createUser({ role: Role.ADMIN });
    await createCourse(admin.id, { status: CourseStatus.PUBLISHED });
    await createCourse(admin.id, { status: CourseStatus.DRAFT });

    const response = await request(app).get("/api/v1/analytics/overview").set("Cookie", authCookie(admin));

    expect(response.body.data.totalCourses).toBe(2);
    expect(response.body.data.publishedCourses).toBe(1);
  });

  it("scopes an INSTRUCTOR to their own courses only", async () => {
    const mine = await createUser({ role: Role.INSTRUCTOR });
    const theirs = await createUser({ role: Role.INSTRUCTOR });
    const myCourse = await createCourse(mine.id);
    const theirCourse = await createCourse(theirs.id);
    const buyer = await createUser();

    await createPayment(buyer.id, myCourse.id, { amountCents: 10_000 });
    await createPayment(buyer.id, theirCourse.id, { amountCents: 50_000 });

    const response = await request(app).get("/api/v1/analytics/overview").set("Cookie", authCookie(mine));

    expect(response.body.data.totalCourses).toBe(1);
    expect(response.body.data.totalRevenueCents).toBe(10_000);
  });

  it("sees everything as ADMIN, including other instructors' courses", async () => {
    const admin = await createUser({ role: Role.ADMIN });
    const instructor = await createUser({ role: Role.INSTRUCTOR });
    const course = await createCourse(instructor.id);
    const buyer = await createUser();
    await createPayment(buyer.id, course.id, { amountCents: 50_000 });

    const response = await request(app).get("/api/v1/analytics/overview").set("Cookie", authCookie(admin));

    expect(response.body.data.totalCourses).toBe(1);
    expect(response.body.data.totalRevenueCents).toBe(50_000);
  });
});

describe("GET /analytics/revenue", () => {
  it("returns one zero-filled bucket per day, oldest first", async () => {
    const admin = await createUser({ role: Role.ADMIN });

    const response = await request(app)
      .get("/api/v1/analytics/revenue?days=7")
      .set("Cookie", authCookie(admin));

    expect(response.status).toBe(200);
    expect(response.body.data.points).toHaveLength(7);
    expect(response.body.data.totalRevenueCents).toBe(0);

    const dates: string[] = response.body.data.points.map((point: { date: string }) => point.date);
    expect([...dates].sort()).toEqual(dates);
  });

  it("puts today's payment in the last bucket", async () => {
    const admin = await createUser({ role: Role.ADMIN });
    const course = await createCourse(admin.id);
    const buyer = await createUser();
    await createPayment(buyer.id, course.id, { amountCents: 25_000 });

    const response = await request(app)
      .get("/api/v1/analytics/revenue?days=7")
      .set("Cookie", authCookie(admin));

    const points = response.body.data.points;
    expect(response.body.data.totalRevenueCents).toBe(25_000);
    expect(points[points.length - 1]).toMatchObject({ revenueCents: 25_000, payments: 1 });
  });

  it("ignores payments older than the window", async () => {
    const admin = await createUser({ role: Role.ADMIN });
    const course = await createCourse(admin.id);
    const buyer = await createUser();

    const longAgo = new Date();
    longAgo.setUTCDate(longAgo.getUTCDate() - 40);
    await createPayment(buyer.id, course.id, { amountCents: 25_000, createdAt: longAgo });

    const response = await request(app)
      .get("/api/v1/analytics/revenue?days=7")
      .set("Cookie", authCookie(admin));

    expect(response.body.data.totalRevenueCents).toBe(0);
  });

  it("defaults to 30 days and rejects an out-of-range window", async () => {
    const admin = await createUser({ role: Role.ADMIN });

    const defaulted = await request(app).get("/api/v1/analytics/revenue").set("Cookie", authCookie(admin));
    const tooLong = await request(app)
      .get("/api/v1/analytics/revenue?days=9999")
      .set("Cookie", authCookie(admin));

    expect(defaulted.body.data.days).toBe(30);
    expect(defaulted.body.data.points).toHaveLength(30);
    expect(tooLong.status).toBe(400);
  });
});

describe("GET /analytics/courses", () => {
  it("computes completion across enrolled students", async () => {
    const admin = await createUser({ role: Role.ADMIN });
    const course = await createCourse(admin.id);
    const lessons = await createLessons(course.id, 4);

    const first = await createUser();
    const second = await createUser();
    await enroll(first.id, course.id);
    await enroll(second.id, course.id);

    // 3 of a possible 8 (2 students x 4 lessons) => 38%.
    await completeLesson(first.id, lessons[0]!.id);
    await completeLesson(first.id, lessons[1]!.id);
    await completeLesson(second.id, lessons[0]!.id);

    const response = await request(app).get("/api/v1/analytics/courses").set("Cookie", authCookie(admin));

    expect(response.body.data.courses[0]).toMatchObject({
      courseId: course.id,
      enrollments: 2,
      totalLessons: 4,
      completionPercent: 38,
    });
  });

  it("caps completion at 100% when an instructor ticks lessons on their own course", async () => {
    const instructor = await createUser({ role: Role.INSTRUCTOR });
    const course = await createCourse(instructor.id);
    const lessons = await createLessons(course.id, 2);

    const student = await createUser();
    await enroll(student.id, course.id);
    for (const lesson of lessons) {
      await completeLesson(student.id, lesson.id);
      // The instructor is not enrolled, so these rows have no denominator.
      await completeLesson(instructor.id, lesson.id);
    }

    const response = await request(app)
      .get("/api/v1/analytics/courses")
      .set("Cookie", authCookie(instructor));

    expect(response.body.data.courses[0].completionPercent).toBe(100);
  });

  it("reports 0% for a course nobody is enrolled in", async () => {
    const admin = await createUser({ role: Role.ADMIN });
    const course = await createCourse(admin.id);
    await createLessons(course.id, 3);

    const response = await request(app).get("/api/v1/analytics/courses").set("Cookie", authCookie(admin));

    expect(response.body.data.courses[0]).toMatchObject({
      courseId: course.id,
      enrollments: 0,
      totalLessons: 3,
      completionPercent: 0,
    });
  });

  it("orders courses by revenue, highest first", async () => {
    const admin = await createUser({ role: Role.ADMIN });
    const quiet = await createCourse(admin.id);
    const earner = await createCourse(admin.id);
    const buyer = await createUser();

    await createPayment(buyer.id, quiet.id, { amountCents: 1_000 });
    await createPayment(buyer.id, earner.id, { amountCents: 90_000 });

    const response = await request(app).get("/api/v1/analytics/courses").set("Cookie", authCookie(admin));

    expect(response.body.data.courses.map((course: { courseId: string }) => course.courseId)).toEqual([
      earner.id,
      quiet.id,
    ]);
  });
});
