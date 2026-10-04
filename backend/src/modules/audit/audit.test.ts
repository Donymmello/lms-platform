import { Role } from "@prisma/client";
import { authenticator } from "otplib";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../app";
import { prisma } from "../../database/prisma";
import { authCookie, createUser } from "../../test/factories";
import { openSecret } from "../../utils/secret-box";

const app = createApp();

/**
 * The audit log exists to answer "who did this". These tests check the two
 * halves of that: the acts that matter get written with the actor on them,
 * and the acts that do not get written are left out so the ones that matter
 * stay findable.
 */

async function events(action?: string) {
  return prisma.auditEvent.findMany({
    where: action ? { action } : {},
    orderBy: { createdAt: "desc" },
  });
}

describe("what gets recorded", () => {
  it("names the admin who changed someone's role, and what it changed from", async () => {
    const admin = await createUser({ role: Role.ADMIN });
    const target = await createUser({ role: Role.STUDENT });

    await request(app)
      .patch(`/api/v1/users/${target.id}/role`)
      .set("Cookie", authCookie(admin))
      .send({ role: "INSTRUCTOR" });

    const [event] = await events("user.role_changed");
    expect(event).toMatchObject({
      actorId: admin.id,
      actorEmail: admin.email,
      targetType: "user",
      targetId: target.id,
    });
    // The new role alone would not answer "who made this account an admin".
    expect(event!.metadata).toMatchObject({ from: "STUDENT", to: "INSTRUCTOR" });
  });

  it("records an account being switched off, and switching it back on", async () => {
    const admin = await createUser({ role: Role.ADMIN });
    const target = await createUser();

    const deactivate = () =>
      request(app)
        .patch(`/api/v1/users/${target.id}/status`)
        .set("Cookie", authCookie(admin))
        .send({ isActive: false });

    await deactivate();
    expect(await events("user.deactivated")).toHaveLength(1);

    await request(app)
      .patch(`/api/v1/users/${target.id}/status`)
      .set("Cookie", authCookie(admin))
      .send({ isActive: true });
    expect(await events("user.activated")).toHaveLength(1);
  });

  // Not every audited act is an admin acting on someone else. This one is a
  // user acting on their own account, and it is the case that catches the
  // actor being read too early: `auditContext` is established before
  // `authenticate` runs, so capturing `req.user` at that moment gives an
  // empty actor on every self-service event.
  it("names the user who acted on their own account, not an admin", async () => {
    const student = await createUser({ role: Role.STUDENT });
    const cookie = authCookie(student);

    await request(app).post("/api/v1/auth/two-factor/setup").set("Cookie", cookie);
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: student.id } });
    await request(app)
      .post("/api/v1/auth/two-factor/enable")
      .set("Cookie", cookie)
      .send({ code: authenticator.generate(openSecret(stored.twoFactorSecret!)) });

    const [event] = await events("auth.two_factor_enabled");
    expect(event).toMatchObject({ actorId: student.id, actorEmail: student.email });
  });

  it("leaves ordinary reads out of the log entirely", async () => {
    const admin = await createUser({ role: Role.ADMIN });

    await request(app).get("/api/v1/users").set("Cookie", authCookie(admin));
    await request(app).get("/api/v1/public/courses");

    expect(await events()).toHaveLength(0);
  });
});

describe("GET /audit", () => {
  it("REFUSES an instructor, because the log is about who was promoted", async () => {
    const instructor = await createUser({ role: Role.INSTRUCTOR });

    const response = await request(app).get("/api/v1/audit").set("Cookie", authCookie(instructor));

    expect(response.status).toBe(403);
  });

  it("REFUSES an anonymous request", async () => {
    expect((await request(app).get("/api/v1/audit")).status).toBe(401);
  });

  it("gives an admin the entries newest first, and narrows by action", async () => {
    const admin = await createUser({ role: Role.ADMIN });
    const target = await createUser();

    await request(app)
      .patch(`/api/v1/users/${target.id}/role`)
      .set("Cookie", authCookie(admin))
      .send({ role: "INSTRUCTOR" });
    await request(app)
      .patch(`/api/v1/users/${target.id}/status`)
      .set("Cookie", authCookie(admin))
      .send({ isActive: false });

    const all = await request(app).get("/api/v1/audit").set("Cookie", authCookie(admin));
    expect(all.status).toBe(200);
    expect(all.body.data.events).toHaveLength(2);
    // Newest first: the question is usually "what just happened".
    expect(all.body.data.events[0].action).toBe("user.deactivated");

    const filtered = await request(app)
      .get("/api/v1/audit")
      .query({ action: "user.role_changed" })
      .set("Cookie", authCookie(admin));
    expect(filtered.body.data.events).toHaveLength(1);
    expect(filtered.body.data.pagination.total).toBe(1);
  });
});
