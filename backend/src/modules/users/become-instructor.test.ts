import { Role } from "@prisma/client";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../app";
import { ACCESS_TOKEN_COOKIE } from "../../constants/cookies";
import { prisma } from "../../database/prisma";
import { verifyAccessToken } from "../../utils/jwt";
import { authCookie, createCourse, createUser } from "../../test/factories";

const app = createApp();

const URL = "/api/v1/users/me/become-instructor";

/** Pulls the access token out of the Set-Cookie header so its claims can be read. */
function accessTokenFrom(response: request.Response): string | null {
  const raw = response.headers["set-cookie"];
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const cookie = list.find((entry) => entry.startsWith(`${ACCESS_TOKEN_COOKIE}=`));
  return cookie ? cookie.split(";")[0]!.split("=")[1]! : null;
}

describe("POST /users/me/become-instructor", () => {
  it("upgrades the acting student and re-issues a token that already says INSTRUCTOR", async () => {
    const student = await createUser();

    const response = await request(app).post(URL).set("Cookie", authCookie(student));

    expect(response.status).toBe(200);
    expect(response.body.data.user.role).toBe(Role.INSTRUCTOR);

    const stored = await prisma.user.findUniqueOrThrow({ where: { id: student.id } });
    expect(stored.role).toBe(Role.INSTRUCTOR);

    // The role is a JWT claim, so without a fresh token the caller would keep
    // being refused by checkRole until the old one expired.
    const token = accessTokenFrom(response);
    expect(token).not.toBeNull();
    expect(verifyAccessToken(token!).role).toBe(Role.INSTRUCTOR);
  });

  it("lets the new instructor use an INSTRUCTOR-only route straight away", async () => {
    const student = await createUser();

    const upgrade = await request(app).post(URL).set("Cookie", authCookie(student));
    const freshCookie = (upgrade.headers["set-cookie"] as unknown as string[]).map(
      (entry) => entry.split(";")[0]!
    );

    const courses = await request(app).get("/api/v1/courses").set("Cookie", freshCookie);

    expect(courses.status).toBe(200);
  });

  it("requires a session", async () => {
    const response = await request(app).post(URL);
    expect(response.status).toBe(401);
  });

  it("is idempotent for someone who already teaches", async () => {
    const instructor = await createUser({ role: Role.INSTRUCTOR });
    const course = await createCourse(instructor.id);

    const response = await request(app).post(URL).set("Cookie", authCookie(instructor));

    expect(response.status).toBe(200);
    expect(response.body.data.user.role).toBe(Role.INSTRUCTOR);
    // Their courses are untouched.
    expect(await prisma.course.count({ where: { instructorId: instructor.id } })).toBe(1);
    expect(course.instructorId).toBe(instructor.id);
  });

  it("never demotes an admin who calls it", async () => {
    const admin = await createUser({ role: Role.ADMIN });

    const response = await request(app).post(URL).set("Cookie", authCookie(admin));

    expect(response.status).toBe(200);
    expect(response.body.data.user.role).toBe(Role.ADMIN);

    const stored = await prisma.user.findUniqueOrThrow({ where: { id: admin.id } });
    expect(stored.role).toBe(Role.ADMIN);
    expect(verifyAccessToken(accessTokenFrom(response)!).role).toBe(Role.ADMIN);
  });

  it("cannot be used to reach ADMIN-only routes", async () => {
    const student = await createUser();

    const upgrade = await request(app).post(URL).set("Cookie", authCookie(student));
    const freshCookie = (upgrade.headers["set-cookie"] as unknown as string[]).map(
      (entry) => entry.split(";")[0]!
    );

    const users = await request(app).get("/api/v1/users").set("Cookie", freshCookie);

    expect(users.status).toBe(403);
  });

  it("upgrades only the caller, never another account", async () => {
    const student = await createUser();
    const bystander = await createUser();

    await request(app).post(URL).set("Cookie", authCookie(student));

    const stored = await prisma.user.findUniqueOrThrow({ where: { id: bystander.id } });
    expect(stored.role).toBe(Role.STUDENT);
  });
});
