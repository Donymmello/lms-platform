import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { CourseStatus, Role } from "@prisma/client";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../app";
import { env } from "../../config/env";
import { prisma } from "../../database/prisma";
import { authCookie, createCourse, createLessons, createUser, enroll } from "../../test/factories";

const app = createApp();

/**
 * Lesson materials end to end: an instructor attaching a file, and a student
 * downloading it under the same access rule the lesson's video uses.
 */

const originalDir = env.LOCAL_MATERIAL_DIR;
let storageDir: string;

beforeEach(() => {
  storageDir = path.join(os.tmpdir(), `lms-materials-${randomUUID()}`);
  env.LOCAL_MATERIAL_DIR = storageDir;
});

afterEach(async () => {
  env.LOCAL_MATERIAL_DIR = originalDir;
  await fs.rm(storageDir, { recursive: true, force: true }).catch(() => undefined);
});

function materialsUrl(courseId: string, moduleId: string, lessonId: string): string {
  return `/api/v1/courses/${courseId}/modules/${moduleId}/lessons/${lessonId}/materials`;
}

async function publishedLesson(options: { free?: boolean } = {}) {
  const instructor = await createUser({ role: Role.INSTRUCTOR });
  const course = await createCourse(instructor.id, { status: CourseStatus.PUBLISHED });
  const [lesson] = await createLessons(course.id, 1, {
    withVideo: false,
    freePreviewCount: options.free ? 1 : 0,
  });
  return { instructor, course, lesson: lesson! };
}

/** Attaches a file as the course's owner and returns the material it created. */
async function attach(
  course: { id: string },
  lesson: { id: string; moduleId: string },
  instructor: Parameters<typeof authCookie>[0],
  fileName = "ficha.pdf",
  contents = "exercicios"
) {
  const response = await request(app)
    .post(materialsUrl(course.id, lesson.moduleId, lesson.id))
    .set("Cookie", authCookie(instructor))
    .attach("file", Buffer.from(contents), fileName);

  const material = await prisma.lessonMaterial.findFirst({
    where: { lessonId: lesson.id },
    orderBy: { createdAt: "desc" },
  });
  return { response, material };
}

describe("POST .../lessons/:lessonId/materials", () => {
  it("attaches a file and returns it on the course, with its name and size", async () => {
    const { instructor, course, lesson } = await publishedLesson();

    const { response, material } = await attach(course, lesson, instructor);

    expect(response.status).toBe(201);
    const [returned] = response.body.data.course.modules[0].lessons[0].materials;
    expect(returned).toMatchObject({
      fileName: "ficha.pdf",
      contentType: "application/pdf",
      sizeBytes: "exercicios".length,
    });
    // The bytes are on disk under a generated name, never the uploaded one.
    expect(material!.storedName).not.toContain("ficha");
    await expect(fs.readFile(path.join(storageDir, material!.storedName), "utf8")).resolves.toBe("exercicios");
  });

  it("REFUSES a type that would run script in the API's own origin", async () => {
    const { instructor, course, lesson } = await publishedLesson();

    const response = await request(app)
      .post(materialsUrl(course.id, lesson.moduleId, lesson.id))
      .set("Cookie", authCookie(instructor))
      .attach("file", Buffer.from("<script>alert(1)</script>"), "aula.html");

    expect(response.status).toBe(400);
    expect(await prisma.lessonMaterial.count({ where: { lessonId: lesson.id } })).toBe(0);
  });

  it("REFUSES an instructor who does not own the course", async () => {
    const { course, lesson } = await publishedLesson();
    const other = await createUser({ role: Role.INSTRUCTOR });

    const response = await request(app)
      .post(materialsUrl(course.id, lesson.moduleId, lesson.id))
      .set("Cookie", authCookie(other))
      .attach("file", Buffer.from("x"), "ficha.pdf");

    expect(response.status).toBe(403);
  });
});

describe("GET /lessons/:lessonId/materials/:materialId", () => {
  it("serves the file to an enrolled student as a download, not as a page", async () => {
    const { instructor, course, lesson } = await publishedLesson();
    const { material } = await attach(course, lesson, instructor);
    const student = await createUser();
    await enroll(student.id, course.id);

    const response = await request(app)
      .get(`/api/v1/lessons/${lesson.id}/materials/${material!.id}`)
      .set("Cookie", authCookie(student));

    expect(response.status).toBe(200);
    expect(response.headers["content-disposition"]).toContain('attachment; filename="ficha.pdf"');
    // Both of these keep an uploaded file from being rendered in the origin
    // that holds the session cookie.
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.body.toString()).toBe("exercicios");
  });

  it("keeps an accented name intact, from the upload to the download header", async () => {
    const { instructor, course, lesson } = await publishedLesson();
    // Portuguese file names are the normal case here, and multipart hands them
    // over as latin1 — without repairing that this arrives as "liÃ§Ã£o.pdf".
    const { material } = await attach(course, lesson, instructor, "lição.pdf");
    const student = await createUser();
    await enroll(student.id, course.id);

    expect(material!.fileName).toBe("lição.pdf");

    const response = await request(app)
      .get(`/api/v1/lessons/${lesson.id}/materials/${material!.id}`)
      .set("Cookie", authCookie(student));

    const disposition = response.headers["content-disposition"]!;
    expect(decodeURIComponent(disposition.split("filename*=UTF-8''")[1]!)).toBe("lição.pdf");
  });

  it("REFUSES a student who is not enrolled", async () => {
    const { instructor, course, lesson } = await publishedLesson();
    const { material } = await attach(course, lesson, instructor);
    const outsider = await createUser();

    const response = await request(app)
      .get(`/api/v1/lessons/${lesson.id}/materials/${material!.id}`)
      .set("Cookie", authCookie(outsider));

    // The paywall covers the worksheets, not just the video.
    expect(response.status).toBe(403);
  });

  it("serves a free preview lesson's material to anyone, as its video is", async () => {
    const { instructor, course, lesson } = await publishedLesson({ free: true });
    const { material } = await attach(course, lesson, instructor);

    const response = await request(app).get(`/api/v1/lessons/${lesson.id}/materials/${material!.id}`);

    expect(response.status).toBe(200);
  });

  it("404s for a material that belongs to a different lesson", async () => {
    const { instructor, course, lesson } = await publishedLesson({ free: true });
    const { material } = await attach(course, lesson, instructor);
    const other = await publishedLesson({ free: true });

    const response = await request(app).get(
      `/api/v1/lessons/${other.lesson.id}/materials/${material!.id}`
    );

    // Otherwise a lesson anyone may watch would unlock every material there is.
    expect(response.status).toBe(404);
  });
});

describe("DELETE .../materials/:materialId", () => {
  it("removes the row and the file from disk", async () => {
    const { instructor, course, lesson } = await publishedLesson();
    const { material } = await attach(course, lesson, instructor);

    const response = await request(app)
      .delete(`${materialsUrl(course.id, lesson.moduleId, lesson.id)}/${material!.id}`)
      .set("Cookie", authCookie(instructor));

    expect(response.status).toBe(200);
    expect(await prisma.lessonMaterial.count({ where: { id: material!.id } })).toBe(0);
    await expect(fs.stat(path.join(storageDir, material!.storedName))).rejects.toThrow();
  });

  it("REFUSES an instructor who does not own the course", async () => {
    const { instructor, course, lesson } = await publishedLesson();
    const { material } = await attach(course, lesson, instructor);
    const other = await createUser({ role: Role.INSTRUCTOR });

    const response = await request(app)
      .delete(`${materialsUrl(course.id, lesson.moduleId, lesson.id)}/${material!.id}`)
      .set("Cookie", authCookie(other));

    expect(response.status).toBe(403);
    expect(await prisma.lessonMaterial.count({ where: { id: material!.id } })).toBe(1);
  });
});
