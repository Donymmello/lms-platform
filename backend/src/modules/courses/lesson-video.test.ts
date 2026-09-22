import { Role } from "@prisma/client";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../app";
import { prisma } from "../../database/prisma";
import { authCookie, createCourse, createLessons, createUser } from "../../test/factories";

/**
 * Bunny is faked at the integration boundary only. Everything below it —
 * ownership checks, replacing an existing video, clearing the column, the
 * multer file filter — is the real code path.
 */
const bunny = vi.hoisted(() => ({
  createVideo: vi.fn(),
  uploadVideoFile: vi.fn(),
  deleteVideo: vi.fn(),
  getSignedEmbedUrl: vi.fn(),
}));

vi.mock("../../integrations/bunny-stream", () => ({ bunnyStream: bunny }));

const app = createApp();

beforeEach(() => {
  vi.clearAllMocks();
  bunny.createVideo.mockResolvedValue("bunny-new-video");
  bunny.uploadVideoFile.mockResolvedValue(undefined);
  bunny.deleteVideo.mockResolvedValue(undefined);
});

async function courseWithLesson(instructorId: string, options: { withVideo?: boolean } = {}) {
  const course = await createCourse(instructorId);
  const [lesson] = await createLessons(course.id, 1, { withVideo: options.withVideo ?? false });
  return { course, lesson: lesson! };
}

function videoUrl(courseId: string, moduleId: string, lessonId: string): string {
  return `/api/v1/courses/${courseId}/modules/${moduleId}/lessons/${lessonId}/video`;
}

describe("POST .../lessons/:lessonId/video", () => {
  it("creates a Bunny video, uploads the file and stores the id", async () => {
    const instructor = await createUser({ role: Role.INSTRUCTOR });
    const { course, lesson } = await courseWithLesson(instructor.id);

    const response = await request(app)
      .post(videoUrl(course.id, lesson.moduleId, lesson.id))
      .set("Cookie", authCookie(instructor))
      .attach("video", Buffer.from("fake mp4 bytes"), {
        filename: "aula.mp4",
        contentType: "video/mp4",
      });

    expect(response.status).toBe(200);
    expect(bunny.createVideo).toHaveBeenCalledWith(lesson.title);
    expect(bunny.uploadVideoFile).toHaveBeenCalledWith("bunny-new-video", expect.any(String));

    const stored = await prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } });
    expect(stored.bunnyVideoId).toBe("bunny-new-video");
  });

  it("deletes the previous video before uploading a replacement", async () => {
    const instructor = await createUser({ role: Role.INSTRUCTOR });
    const { course, lesson } = await courseWithLesson(instructor.id, { withVideo: true });
    const previousId = lesson.bunnyVideoId!;

    await request(app)
      .post(videoUrl(course.id, lesson.moduleId, lesson.id))
      .set("Cookie", authCookie(instructor))
      .attach("video", Buffer.from("fake mp4 bytes"), {
        filename: "nova.mp4",
        contentType: "video/mp4",
      });

    expect(bunny.deleteVideo).toHaveBeenCalledWith(previousId);
    const stored = await prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } });
    expect(stored.bunnyVideoId).toBe("bunny-new-video");
  });

  it("rejects a file that is not a video, without calling Bunny", async () => {
    const instructor = await createUser({ role: Role.INSTRUCTOR });
    const { course, lesson } = await courseWithLesson(instructor.id);

    const response = await request(app)
      .post(videoUrl(course.id, lesson.moduleId, lesson.id))
      .set("Cookie", authCookie(instructor))
      .attach("video", Buffer.from("nao sou video"), {
        filename: "malicioso.exe",
        contentType: "application/octet-stream",
      });

    expect(response.status).toBe(400);
    expect(bunny.createVideo).not.toHaveBeenCalled();
  });

  it("rejects a request with no file attached", async () => {
    const instructor = await createUser({ role: Role.INSTRUCTOR });
    const { course, lesson } = await courseWithLesson(instructor.id);

    const response = await request(app)
      .post(videoUrl(course.id, lesson.moduleId, lesson.id))
      .set("Cookie", authCookie(instructor));

    expect(response.status).toBe(400);
    expect(bunny.createVideo).not.toHaveBeenCalled();
  });

  it("refuses an instructor who does not own the course", async () => {
    const owner = await createUser({ role: Role.INSTRUCTOR });
    const other = await createUser({ role: Role.INSTRUCTOR });
    const { course, lesson } = await courseWithLesson(owner.id);

    const response = await request(app)
      .post(videoUrl(course.id, lesson.moduleId, lesson.id))
      .set("Cookie", authCookie(other))
      .attach("video", Buffer.from("fake mp4 bytes"), {
        filename: "aula.mp4",
        contentType: "video/mp4",
      });

    expect(response.status).toBe(403);
    expect(bunny.createVideo).not.toHaveBeenCalled();
  });

  it("refuses a STUDENT outright", async () => {
    const instructor = await createUser({ role: Role.INSTRUCTOR });
    const student = await createUser();
    const { course, lesson } = await courseWithLesson(instructor.id);

    const response = await request(app)
      .post(videoUrl(course.id, lesson.moduleId, lesson.id))
      .set("Cookie", authCookie(student))
      .attach("video", Buffer.from("fake mp4 bytes"), {
        filename: "aula.mp4",
        contentType: "video/mp4",
      });

    expect(response.status).toBe(403);
  });

  it("404s when the lesson belongs to a different module", async () => {
    const instructor = await createUser({ role: Role.INSTRUCTOR });
    const { course, lesson } = await courseWithLesson(instructor.id);
    const strayModule = await prisma.courseModule.create({
      data: { courseId: course.id, title: "Outro módulo", order: 1 },
    });

    const response = await request(app)
      .post(videoUrl(course.id, strayModule.id, lesson.id))
      .set("Cookie", authCookie(instructor))
      .attach("video", Buffer.from("fake mp4 bytes"), {
        filename: "aula.mp4",
        contentType: "video/mp4",
      });

    expect(response.status).toBe(404);
  });
});

describe("DELETE .../lessons/:lessonId/video", () => {
  it("deletes the Bunny video and clears the column", async () => {
    const instructor = await createUser({ role: Role.INSTRUCTOR });
    const { course, lesson } = await courseWithLesson(instructor.id, { withVideo: true });

    const response = await request(app)
      .delete(videoUrl(course.id, lesson.moduleId, lesson.id))
      .set("Cookie", authCookie(instructor));

    expect(response.status).toBe(200);
    expect(bunny.deleteVideo).toHaveBeenCalledWith(lesson.bunnyVideoId);

    const stored = await prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } });
    expect(stored.bunnyVideoId).toBeNull();
  });

  it("is a no-op when the lesson has no video", async () => {
    const instructor = await createUser({ role: Role.INSTRUCTOR });
    const { course, lesson } = await courseWithLesson(instructor.id);

    const response = await request(app)
      .delete(videoUrl(course.id, lesson.moduleId, lesson.id))
      .set("Cookie", authCookie(instructor));

    expect(response.status).toBe(200);
    expect(bunny.deleteVideo).not.toHaveBeenCalled();
  });

  it("refuses an instructor who does not own the course", async () => {
    const owner = await createUser({ role: Role.INSTRUCTOR });
    const other = await createUser({ role: Role.INSTRUCTOR });
    const { course, lesson } = await courseWithLesson(owner.id, { withVideo: true });

    const response = await request(app)
      .delete(videoUrl(course.id, lesson.moduleId, lesson.id))
      .set("Cookie", authCookie(other));

    expect(response.status).toBe(403);
    expect(bunny.deleteVideo).not.toHaveBeenCalled();
  });
});
