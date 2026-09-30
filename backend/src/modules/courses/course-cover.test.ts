import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Role } from "@prisma/client";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../app";
import { env } from "../../config/env";
import { prisma } from "../../database/prisma";
import { authCookie, createCourse, createUser } from "../../test/factories";

const app = createApp();

/**
 * Course covers: uploaded by the instructor, read by anyone.
 *
 * The interesting half is what must not work — a file the extension lies
 * about, and a key no course points at.
 */

const originalDir = env.LOCAL_COVER_DIR;
let storageDir: string;

/** A real one-pixel PNG, so the magic-byte check has something honest to pass. */
const PNG = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6300010000050001" +
    "0d0a2db40000000049454e44ae426082",
  "hex"
);

beforeEach(() => {
  storageDir = path.join(os.tmpdir(), `lms-covers-${randomUUID()}`);
  env.LOCAL_COVER_DIR = storageDir;
});

afterEach(async () => {
  env.LOCAL_COVER_DIR = originalDir;
  await fs.rm(storageDir, { recursive: true, force: true }).catch(() => undefined);
});

async function upload(courseId: string, instructor: Parameters<typeof authCookie>[0], body = PNG, name = "capa.png") {
  return request(app)
    .post(`/api/v1/courses/${courseId}/cover`)
    .set("Cookie", authCookie(instructor))
    .attach("file", body, name);
}

describe("POST /courses/:courseId/cover", () => {
  it("stores the image and puts its key on the course", async () => {
    const instructor = await createUser({ role: Role.INSTRUCTOR });
    const course = await createCourse(instructor.id);

    const response = await upload(course.id, instructor);

    expect(response.status).toBe(200);
    const key = response.body.data.course.coverKey;
    expect(key).toMatch(/^[0-9a-f-]{36}\.png$/);
    // The stored name is generated, never the uploaded one.
    expect(key).not.toContain("capa");
    await expect(fs.stat(path.join(storageDir, key))).resolves.toBeTruthy();
  });

  it("REFUSES a file whose extension lies about what it is", async () => {
    const instructor = await createUser({ role: Role.INSTRUCTOR });
    const course = await createCourse(instructor.id);

    // Passes the extension filter, fails the magic bytes — renaming a file is
    // free, and this one would be served back with an image content type.
    const response = await upload(course.id, instructor, Buffer.from("<svg onload=alert(1)>"), "nao-e.png");

    expect(response.status).toBe(400);
    expect((await prisma.course.findUnique({ where: { id: course.id } }))?.coverKey).toBeNull();
  });

  it("REFUSES an instructor who does not own the course", async () => {
    const owner = await createUser({ role: Role.INSTRUCTOR });
    const course = await createCourse(owner.id);
    const other = await createUser({ role: Role.INSTRUCTOR });

    expect((await upload(course.id, other)).status).toBe(403);
  });

  it("deletes the previous file when a cover is replaced", async () => {
    const instructor = await createUser({ role: Role.INSTRUCTOR });
    const course = await createCourse(instructor.id);

    const first = (await upload(course.id, instructor)).body.data.course.coverKey;
    const second = (await upload(course.id, instructor)).body.data.course.coverKey;

    expect(second).not.toBe(first);
    await expect(fs.stat(path.join(storageDir, first))).rejects.toThrow();
    await expect(fs.stat(path.join(storageDir, second))).resolves.toBeTruthy();
  });
});

describe("GET /public/covers/:key", () => {
  it("serves the image to anyone, with a cache that never expires", async () => {
    const instructor = await createUser({ role: Role.INSTRUCTOR });
    const course = await createCourse(instructor.id);
    const key = (await upload(course.id, instructor)).body.data.course.coverKey;

    // No cookie: the catalogue is public, so a cover has nothing to authorise.
    const response = await request(app).get(`/api/v1/public/covers/${key}`);

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("image/png");
    expect(response.headers["cache-control"]).toContain("immutable");
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(Buffer.compare(response.body, PNG)).toBe(0);
  });

  it("404s for a key no course points at", async () => {
    const instructor = await createUser({ role: Role.INSTRUCTOR });
    const course = await createCourse(instructor.id);
    const key = (await upload(course.id, instructor)).body.data.course.coverKey;

    await request(app).delete(`/api/v1/courses/${course.id}/cover`).set("Cookie", authCookie(instructor));

    // The row no longer claims it, so the URL stops resolving even if a file
    // were left behind on disk.
    expect((await request(app).get(`/api/v1/public/covers/${key}`)).status).toBe(404);
  });

  it("rejects a key that is not shaped like one, without touching the disk", async () => {
    for (const key of ["../../etc/passwd", "nope.png", "x.svg"]) {
      const response = await request(app).get(`/api/v1/public/covers/${encodeURIComponent(key)}`);
      expect([400, 404]).toContain(response.status);
    }
  });
});

describe("DELETE /courses/:courseId/cover", () => {
  it("clears the key and removes the file", async () => {
    const instructor = await createUser({ role: Role.INSTRUCTOR });
    const course = await createCourse(instructor.id);
    const key = (await upload(course.id, instructor)).body.data.course.coverKey;

    const response = await request(app)
      .delete(`/api/v1/courses/${course.id}/cover`)
      .set("Cookie", authCookie(instructor));

    expect(response.status).toBe(200);
    expect(response.body.data.course.coverKey).toBeNull();
    await expect(fs.stat(path.join(storageDir, key))).rejects.toThrow();
  });
});
