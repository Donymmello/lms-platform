import { CourseStatus, Role } from "@prisma/client";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../app";
import { authCookie, createCourse, createLessons, createUser, enroll } from "../../test/factories";

const app = createApp();

function playbackUrl(lessonId: string): string {
  return `/api/v1/lessons/${lessonId}/playback`;
}

describe("GET /lessons/:lessonId/playback", () => {
  it("serves a signed URL for a free-preview lesson without any session", async () => {
    const instructor = await createUser({ role: Role.INSTRUCTOR });
    const course = await createCourse(instructor.id);
    const [preview] = await createLessons(course.id, 2, { freePreviewCount: 1 });

    const response = await request(app).get(playbackUrl(preview!.id));

    expect(response.status).toBe(200);
    expect(response.body.data.embedUrl).toContain("iframe.mediadelivery.net");
    expect(response.body.data.embedUrl).toContain("token=");
  });

  it("refuses an anonymous viewer on a lesson that is not a free preview", async () => {
    const instructor = await createUser({ role: Role.INSTRUCTOR });
    const course = await createCourse(instructor.id);
    const [, paid] = await createLessons(course.id, 2, { freePreviewCount: 1 });

    const response = await request(app).get(playbackUrl(paid!.id));

    expect(response.status).toBe(403);
  });

  it("refuses a logged-in student who is not enrolled", async () => {
    const instructor = await createUser({ role: Role.INSTRUCTOR });
    const course = await createCourse(instructor.id);
    const [lesson] = await createLessons(course.id, 1);
    const student = await createUser();

    const response = await request(app)
      .get(playbackUrl(lesson!.id))
      .set("Cookie", authCookie(student));

    expect(response.status).toBe(403);
  });

  it("serves a signed URL once the student is enrolled", async () => {
    const instructor = await createUser({ role: Role.INSTRUCTOR });
    const course = await createCourse(instructor.id);
    const [lesson] = await createLessons(course.id, 1);
    const student = await createUser();
    await enroll(student.id, course.id);

    const response = await request(app)
      .get(playbackUrl(lesson!.id))
      .set("Cookie", authCookie(student));

    expect(response.status).toBe(200);
    expect(response.body.data.embedUrl).toContain("token=");
  });

  it("lets the owning instructor and an admin watch without enrolling", async () => {
    const instructor = await createUser({ role: Role.INSTRUCTOR });
    const admin = await createUser({ role: Role.ADMIN });
    const course = await createCourse(instructor.id);
    const [lesson] = await createLessons(course.id, 1);

    const asInstructor = await request(app)
      .get(playbackUrl(lesson!.id))
      .set("Cookie", authCookie(instructor));
    const asAdmin = await request(app).get(playbackUrl(lesson!.id)).set("Cookie", authCookie(admin));

    expect(asInstructor.status).toBe(200);
    expect(asAdmin.status).toBe(200);
  });

  it("refuses an instructor who does not own the course", async () => {
    const owner = await createUser({ role: Role.INSTRUCTOR });
    const other = await createUser({ role: Role.INSTRUCTOR });
    const course = await createCourse(owner.id);
    const [lesson] = await createLessons(course.id, 1);

    const response = await request(app)
      .get(playbackUrl(lesson!.id))
      .set("Cookie", authCookie(other));

    expect(response.status).toBe(403);
  });

  it("hides a DRAFT course behind a 404 rather than a 403", async () => {
    const instructor = await createUser({ role: Role.INSTRUCTOR });
    const course = await createCourse(instructor.id, { status: CourseStatus.DRAFT });
    const [lesson] = await createLessons(course.id, 1);
    const student = await createUser();
    await enroll(student.id, course.id);

    const response = await request(app)
      .get(playbackUrl(lesson!.id))
      .set("Cookie", authCookie(student));

    expect(response.status).toBe(404);
  });

  it("returns 404 for an enrolled student when the lesson has no video yet", async () => {
    const instructor = await createUser({ role: Role.INSTRUCTOR });
    const course = await createCourse(instructor.id);
    const [lesson] = await createLessons(course.id, 1, { withVideo: false });
    const student = await createUser();
    await enroll(student.id, course.id);

    const response = await request(app)
      .get(playbackUrl(lesson!.id))
      .set("Cookie", authCookie(student));

    expect(response.status).toBe(404);
  });

  it("rejects a malformed lesson id before touching the database", async () => {
    const response = await request(app).get(playbackUrl("not-a-uuid"));

    expect(response.status).toBe(400);
  });
});
