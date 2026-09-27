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
import { localVideoStorage } from "../../integrations/local-video-storage";
import { authCookie, createCourse, createLessons, createUser, enroll } from "../../test/factories";
import { buildMp4, mp4Track, playableMp4 } from "../../test/mp4";

const app = createApp();

/**
 * Exercises the no-CDN path: videos kept on this server's disk and streamed by
 * it. The Bunny credentials are cleared for these tests, because that is
 * exactly the situation the local provider exists for.
 */

const originalLibrary = env.BUNNY_STREAM_LIBRARY_ID;
const originalDir = env.LOCAL_VIDEO_DIR;
let storageDir: string;

/**
 * A real (if tiny) MP4: uploads are inspected for a playable video track now,
 * so a buffer of arbitrary bytes would be refused before it ever reached disk.
 * The payload inside it is non-repeating, so a wrong range shows up immediately.
 */
const PAYLOAD = playableMp4(2048);

beforeEach(async () => {
  storageDir = path.join(os.tmpdir(), `lms-videos-${randomUUID()}`);
  env.LOCAL_VIDEO_DIR = storageDir;
  // With no library configured, uploads land locally.
  env.BUNNY_STREAM_LIBRARY_ID = "";
});

afterEach(async () => {
  env.LOCAL_VIDEO_DIR = originalDir;
  env.BUNNY_STREAM_LIBRARY_ID = originalLibrary;
  await fs.rm(storageDir, { recursive: true, force: true }).catch(() => undefined);
});

/** Puts a real file in storage and points a lesson at it. */
async function lessonWithLocalVideo(options: { free?: boolean } = {}) {
  const instructor = await createUser({ role: Role.INSTRUCTOR });
  const course = await createCourse(instructor.id, { status: CourseStatus.PUBLISHED });
  const [lesson] = await createLessons(course.id, 1, {
    withVideo: false,
    freePreviewCount: options.free ? 1 : 0,
  });

  const sourcePath = path.join(os.tmpdir(), `upload-${randomUUID()}.mp4`);
  await fs.writeFile(sourcePath, PAYLOAD);
  const videoId = await localVideoStorage.store(sourcePath, "aula.mp4");
  await fs.unlink(sourcePath).catch(() => undefined);

  await prisma.lesson.update({ where: { id: lesson!.id }, data: { bunnyVideoId: videoId } });
  return { instructor, course, lesson: lesson!, videoId };
}

describe("playback resolution without a CDN", () => {
  it("points at this server's stream route instead of a signed embed", async () => {
    const { course, lesson } = await lessonWithLocalVideo();
    const student = await createUser();
    await enroll(student.id, course.id);

    const response = await request(app)
      .get(`/api/v1/lessons/${lesson.id}/playback`)
      .set("Cookie", authCookie(student));

    expect(response.status).toBe(200);
    expect(response.body.data.kind).toBe("file");
    expect(response.body.data.url).toContain(`/api/v1/lessons/${lesson.id}/stream`);
    // Nothing expires: access is re-checked per request rather than baked into a URL.
    expect(response.body.data.expiresAt).toBeNull();
  });
});

describe("GET /lessons/:lessonId/stream", () => {
  it("serves the whole file to an enrolled student", async () => {
    const { course, lesson } = await lessonWithLocalVideo();
    const student = await createUser();
    await enroll(student.id, course.id);

    const response = await request(app)
      .get(`/api/v1/lessons/${lesson.id}/stream`)
      .set("Cookie", authCookie(student));

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("video/mp4");
    expect(response.headers["accept-ranges"]).toBe("bytes");
    expect(Buffer.compare(response.body, PAYLOAD)).toBe(0);
  });

  it("honours a range request, so the player can seek", async () => {
    const { course, lesson } = await lessonWithLocalVideo();
    const student = await createUser();
    await enroll(student.id, course.id);

    const response = await request(app)
      .get(`/api/v1/lessons/${lesson.id}/stream`)
      .set("Cookie", authCookie(student))
      .set("Range", "bytes=100-199");

    expect(response.status).toBe(206);
    expect(response.headers["content-range"]).toBe(`bytes 100-199/${PAYLOAD.length}`);
    expect(response.headers["content-length"]).toBe("100");
    expect(Buffer.compare(response.body, PAYLOAD.subarray(100, 200))).toBe(0);
  });

  it("handles an open-ended range", async () => {
    const { course, lesson } = await lessonWithLocalVideo();
    const student = await createUser();
    await enroll(student.id, course.id);

    const response = await request(app)
      .get(`/api/v1/lessons/${lesson.id}/stream`)
      .set("Cookie", authCookie(student))
      .set("Range", "bytes=2000-");

    expect(response.status).toBe(206);
    expect(response.headers["content-range"]).toBe(`bytes 2000-${PAYLOAD.length - 1}/${PAYLOAD.length}`);
  });

  it("REFUSES a student who is not enrolled", async () => {
    const { lesson } = await lessonWithLocalVideo();
    const outsider = await createUser();

    const response = await request(app)
      .get(`/api/v1/lessons/${lesson.id}/stream`)
      .set("Cookie", authCookie(outsider));

    // The whole point: this route must not be a way around the paywall.
    expect(response.status).toBe(403);
  });

  it("REFUSES an anonymous request for a lesson that is not a free preview", async () => {
    const { lesson } = await lessonWithLocalVideo();

    const response = await request(app).get(`/api/v1/lessons/${lesson.id}/stream`);

    expect(response.status).toBe(403);
  });

  it("serves a free preview to anyone, as the signed-URL route does", async () => {
    const { lesson } = await lessonWithLocalVideo({ free: true });

    const response = await request(app).get(`/api/v1/lessons/${lesson.id}/stream`);

    expect(response.status).toBe(200);
  });

  it("hides a DRAFT course behind a 404", async () => {
    const { course, lesson } = await lessonWithLocalVideo();
    await prisma.course.update({ where: { id: course.id }, data: { status: CourseStatus.DRAFT } });
    const student = await createUser();
    await enroll(student.id, course.id);

    const response = await request(app)
      .get(`/api/v1/lessons/${lesson.id}/stream`)
      .set("Cookie", authCookie(student));

    expect(response.status).toBe(404);
  });

  it("404s for a lesson whose video lives at Bunny rather than on disk", async () => {
    const instructor = await createUser({ role: Role.INSTRUCTOR });
    const course = await createCourse(instructor.id);
    const [lesson] = await createLessons(course.id, 1, { withVideo: true });
    const student = await createUser();
    await enroll(student.id, course.id);

    const response = await request(app)
      .get(`/api/v1/lessons/${lesson!.id}/stream`)
      .set("Cookie", authCookie(student));

    expect(response.status).toBe(404);
  });
});

describe("local storage", () => {
  it("refuses a format no browser can play, since nothing transcodes here", async () => {
    const sourcePath = path.join(os.tmpdir(), `upload-${randomUUID()}.avi`);
    await fs.writeFile(sourcePath, PAYLOAD);

    await expect(localVideoStorage.store(sourcePath, "aula.avi")).rejects.toMatchObject({
      statusCode: 400,
    });
    await fs.unlink(sourcePath).catch(() => undefined);
  });

  it("refuses an audio-only file, which is the one no extension check catches", async () => {
    const sourcePath = path.join(os.tmpdir(), `upload-${randomUUID()}.mp4`);
    await fs.writeFile(sourcePath, buildMp4([mp4Track("soun", "mp4a")]));

    // Calls itself video/mp4, ends in .mp4, and plays sound over a blank frame.
    await expect(localVideoStorage.store(sourcePath, "aula.mp4")).rejects.toMatchObject({
      statusCode: 400,
    });
    await fs.unlink(sourcePath).catch(() => undefined);
  });

  it("refuses an id that tries to climb out of the storage directory", async () => {
    expect(() => localVideoStorage.createStream("local:../../etc/passwd")).toThrow();
  });

  it("deletes the file from disk", async () => {
    const { videoId } = await lessonWithLocalVideo();
    expect(await localVideoStorage.sizeOf(videoId)).toBe(PAYLOAD.length);

    await localVideoStorage.remove(videoId);

    await expect(localVideoStorage.sizeOf(videoId)).rejects.toThrow();
  });
});
