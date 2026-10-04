import { Role } from "@prisma/client";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../app";
import { prisma } from "../../database/prisma";
import { authCookie, createUser, TEST_PASSWORD } from "../../test/factories";

const app = createApp();

describe("users access control", () => {
  it("requires a session", async () => {
    const response = await request(app).get("/api/v1/users");
    expect(response.status).toBe(401);
  });

  it("refuses a STUDENT and an INSTRUCTOR — user management is ADMIN-only", async () => {
    const student = await createUser();
    const instructor = await createUser({ role: Role.INSTRUCTOR });

    const asStudent = await request(app).get("/api/v1/users").set("Cookie", authCookie(student));
    const asInstructor = await request(app).get("/api/v1/users").set("Cookie", authCookie(instructor));

    expect(asStudent.status).toBe(403);
    expect(asInstructor.status).toBe(403);
  });

  // There used to be a self-service upgrade here, registered ahead of the
  // ADMIN gate: any student could POST this and be publishing courses in the
  // catalogue a second later, with nobody's approval. It was removed, and
  // this is the guard against it coming back by accident — a student who
  // calls it must not come out of it an instructor.
  it("REFUSES a student trying to make themselves an instructor", async () => {
    const student = await createUser({ role: Role.STUDENT });

    const response = await request(app)
      .post("/api/v1/users/me/become-instructor")
      .set("Cookie", authCookie(student));

    expect(response.status).not.toBe(200);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: student.id } });
    expect(after.role).toBe(Role.STUDENT);
  });
});

describe("GET /users", () => {
  it("lists users without ever exposing the password hash", async () => {
    const admin = await createUser({ role: Role.ADMIN });
    await createUser({ email: "aluno@example.test" });

    const response = await request(app).get("/api/v1/users").set("Cookie", authCookie(admin));

    expect(response.status).toBe(200);
    expect(response.body.data.users).toHaveLength(2);
    for (const user of response.body.data.users) {
      expect(user.password).toBeUndefined();
    }
    expect(JSON.stringify(response.body)).not.toContain(TEST_PASSWORD);
    expect(JSON.stringify(response.body)).not.toContain("$2a$");
  });

  it("paginates and reports the totals", async () => {
    const admin = await createUser({ role: Role.ADMIN });
    for (let index = 0; index < 3; index += 1) {
      await createUser();
    }

    const response = await request(app)
      .get("/api/v1/users?page=1&pageSize=2")
      .set("Cookie", authCookie(admin));

    expect(response.body.data.users).toHaveLength(2);
    expect(response.body.data.pagination).toMatchObject({ page: 1, pageSize: 2, total: 4, totalPages: 2 });
  });

  it("filters by role", async () => {
    const admin = await createUser({ role: Role.ADMIN });
    const instructor = await createUser({ role: Role.INSTRUCTOR });
    await createUser();

    const response = await request(app)
      .get("/api/v1/users?role=INSTRUCTOR")
      .set("Cookie", authCookie(admin));

    expect(response.body.data.users).toHaveLength(1);
    expect(response.body.data.users[0].id).toBe(instructor.id);
  });

  it("searches by email", async () => {
    const admin = await createUser({ role: Role.ADMIN });
    const target = await createUser({ email: "procurado@example.test" });
    await createUser({ email: "outro@example.test" });

    const response = await request(app)
      .get("/api/v1/users?search=procurado")
      .set("Cookie", authCookie(admin));

    expect(response.body.data.users).toHaveLength(1);
    expect(response.body.data.users[0].id).toBe(target.id);
  });

  it("rejects an out-of-range pageSize and an unknown role", async () => {
    const admin = await createUser({ role: Role.ADMIN });

    const badSize = await request(app)
      .get("/api/v1/users?pageSize=5000")
      .set("Cookie", authCookie(admin));
    const badRole = await request(app)
      .get("/api/v1/users?role=SUPERUSER")
      .set("Cookie", authCookie(admin));

    expect(badSize.status).toBe(400);
    expect(badRole.status).toBe(400);
  });
});

describe("GET /users/:id", () => {
  it("returns one user, and 404 for an unknown id", async () => {
    const admin = await createUser({ role: Role.ADMIN });
    const target = await createUser();

    const found = await request(app)
      .get(`/api/v1/users/${target.id}`)
      .set("Cookie", authCookie(admin));
    const missing = await request(app)
      .get("/api/v1/users/11111111-1111-4111-8111-111111111111")
      .set("Cookie", authCookie(admin));

    expect(found.status).toBe(200);
    expect(found.body.data.user).toMatchObject({ id: target.id, email: target.email });
    expect(missing.status).toBe(404);
  });
});

describe("PATCH /users/:id/role", () => {
  it("promotes a student to instructor", async () => {
    const admin = await createUser({ role: Role.ADMIN });
    const target = await createUser();

    const response = await request(app)
      .patch(`/api/v1/users/${target.id}/role`)
      .set("Cookie", authCookie(admin))
      .send({ role: Role.INSTRUCTOR });

    expect(response.status).toBe(200);
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: target.id } });
    expect(stored.role).toBe(Role.INSTRUCTOR);
  });

  it("refuses an admin changing their own role, so the last admin cannot lock themselves out", async () => {
    const admin = await createUser({ role: Role.ADMIN });

    const response = await request(app)
      .patch(`/api/v1/users/${admin.id}/role`)
      .set("Cookie", authCookie(admin))
      .send({ role: Role.STUDENT });

    expect(response.status).toBe(403);
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: admin.id } });
    expect(stored.role).toBe(Role.ADMIN);
  });

  it("rejects a role outside the enum", async () => {
    const admin = await createUser({ role: Role.ADMIN });
    const target = await createUser();

    const response = await request(app)
      .patch(`/api/v1/users/${target.id}/role`)
      .set("Cookie", authCookie(admin))
      .send({ role: "SUPERUSER" });

    expect(response.status).toBe(400);
  });
});

describe("PATCH /users/:id/status", () => {
  it("deactivates a user and revokes their refresh tokens immediately", async () => {
    const admin = await createUser({ role: Role.ADMIN });
    const target = await createUser();
    await prisma.refreshToken.create({
      data: {
        userId: target.id,
        tokenHash: "hash-for-a-live-session",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const response = await request(app)
      .patch(`/api/v1/users/${target.id}/status`)
      .set("Cookie", authCookie(admin))
      .send({ isActive: false });

    expect(response.status).toBe(200);
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: target.id } });
    expect(stored.isActive).toBe(false);

    // Without this, a deactivated user could keep minting access tokens from
    // a refresh token they already hold.
    const live = await prisma.refreshToken.findMany({
      where: { userId: target.id, revokedAt: null },
    });
    expect(live).toHaveLength(0);
  });

  it("reactivates a user", async () => {
    const admin = await createUser({ role: Role.ADMIN });
    const target = await createUser({ isActive: false });

    await request(app)
      .patch(`/api/v1/users/${target.id}/status`)
      .set("Cookie", authCookie(admin))
      .send({ isActive: true });

    const stored = await prisma.user.findUniqueOrThrow({ where: { id: target.id } });
    expect(stored.isActive).toBe(true);
  });

  it("refuses an admin deactivating themselves", async () => {
    const admin = await createUser({ role: Role.ADMIN });

    const response = await request(app)
      .patch(`/api/v1/users/${admin.id}/status`)
      .set("Cookie", authCookie(admin))
      .send({ isActive: false });

    expect(response.status).toBe(403);
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: admin.id } });
    expect(stored.isActive).toBe(true);
  });
});
