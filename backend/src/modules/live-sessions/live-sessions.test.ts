import { Role } from "@prisma/client";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../app";
import { prisma } from "../../database/prisma";
import { authCookie, createCourse, createUser, enroll } from "../../test/factories";

const app = createApp();

function inHours(hours: number): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

const JOIN_URL = "https://zoom.us/j/9876543210?pwd=exemplo";

async function scheduleSession(courseId: string, overrides: Partial<{ startsAt: Date; durationMinutes: number }> = {}) {
  return prisma.liveSession.create({
    data: {
      courseId,
      title: "Sessão ao vivo",
      description: "",
      joinUrl: JOIN_URL,
      startsAt: overrides.startsAt ?? inHours(24),
      durationMinutes: overrides.durationMinutes ?? 60,
    },
  });
}

describe("GET /live-sessions/courses/:courseId", () => {
  it("lists the course's sessions for an enrolled student, soonest first", async () => {
    const instructor = await createUser({ role: Role.INSTRUCTOR });
    const course = await createCourse(instructor.id);
    const later = await scheduleSession(course.id, { startsAt: inHours(48) });
    const sooner = await scheduleSession(course.id, { startsAt: inHours(2) });

    const student = await createUser();
    await enroll(student.id, course.id);

    const response = await request(app)
      .get(`/api/v1/live-sessions/courses/${course.id}`)
      .set("Cookie", authCookie(student));

    expect(response.status).toBe(200);
    expect(response.body.data.sessions.map((s: { id: string }) => s.id)).toEqual([sooner.id, later.id]);
    expect(response.body.data.sessions[0].joinUrl).toBe(JOIN_URL);
  });

  it("refuses a student who is not enrolled, and leaks no meeting link", async () => {
    const instructor = await createUser({ role: Role.INSTRUCTOR });
    const course = await createCourse(instructor.id);
    await scheduleSession(course.id);
    const outsider = await createUser();

    const response = await request(app)
      .get(`/api/v1/live-sessions/courses/${course.id}`)
      .set("Cookie", authCookie(outsider));

    expect(response.status).toBe(403);
    expect(JSON.stringify(response.body)).not.toContain("zoom.us");
  });

  it("requires a session", async () => {
    const instructor = await createUser({ role: Role.INSTRUCTOR });
    const course = await createCourse(instructor.id);
    await scheduleSession(course.id);

    const response = await request(app).get(`/api/v1/live-sessions/courses/${course.id}`);

    expect(response.status).toBe(401);
    expect(JSON.stringify(response.body)).not.toContain("zoom.us");
  });

  it("lets the owning instructor and an admin read without enrolling", async () => {
    const instructor = await createUser({ role: Role.INSTRUCTOR });
    const admin = await createUser({ role: Role.ADMIN });
    const course = await createCourse(instructor.id);
    await scheduleSession(course.id);

    const asInstructor = await request(app)
      .get(`/api/v1/live-sessions/courses/${course.id}`)
      .set("Cookie", authCookie(instructor));
    const asAdmin = await request(app)
      .get(`/api/v1/live-sessions/courses/${course.id}`)
      .set("Cookie", authCookie(admin));

    expect(asInstructor.status).toBe(200);
    expect(asAdmin.status).toBe(200);
  });

  it("refuses an instructor who does not own the course", async () => {
    const owner = await createUser({ role: Role.INSTRUCTOR });
    const other = await createUser({ role: Role.INSTRUCTOR });
    const course = await createCourse(owner.id);
    await scheduleSession(course.id);

    const response = await request(app)
      .get(`/api/v1/live-sessions/courses/${course.id}`)
      .set("Cookie", authCookie(other));

    expect(response.status).toBe(403);
  });

  it("flags a session as live only while it is actually running", async () => {
    const instructor = await createUser({ role: Role.INSTRUCTOR });
    const course = await createCourse(instructor.id);
    // Started 10 minutes ago, runs for 60 => live now.
    const running = await scheduleSession(course.id, { startsAt: inHours(-10 / 60), durationMinutes: 60 });
    // Started 3 hours ago, ran for 60 minutes => finished.
    const finished = await scheduleSession(course.id, { startsAt: inHours(-3), durationMinutes: 60 });
    // Tomorrow => not yet.
    const upcoming = await scheduleSession(course.id, { startsAt: inHours(24) });

    const response = await request(app)
      .get(`/api/v1/live-sessions/courses/${course.id}`)
      .set("Cookie", authCookie(instructor));

    const byId = Object.fromEntries(
      response.body.data.sessions.map((s: { id: string; isLive: boolean }) => [s.id, s.isLive])
    );
    expect(byId[running.id]).toBe(true);
    expect(byId[finished.id]).toBe(false);
    expect(byId[upcoming.id]).toBe(false);
  });
});

describe("POST /live-sessions/courses/:courseId", () => {
  it("schedules a session on the instructor's own course", async () => {
    const instructor = await createUser({ role: Role.INSTRUCTOR });
    const course = await createCourse(instructor.id);

    const response = await request(app)
      .post(`/api/v1/live-sessions/courses/${course.id}`)
      .set("Cookie", authCookie(instructor))
      .send({ title: "Aula ao vivo 1", joinUrl: JOIN_URL, startsAt: inHours(5).toISOString() });

    expect(response.status).toBe(201);
    const stored = await prisma.liveSession.findFirstOrThrow({ where: { courseId: course.id } });
    expect(stored).toMatchObject({ title: "Aula ao vivo 1", joinUrl: JOIN_URL, durationMinutes: 60 });
  });

  it("refuses a STUDENT outright and an instructor who does not own the course", async () => {
    const owner = await createUser({ role: Role.INSTRUCTOR });
    const other = await createUser({ role: Role.INSTRUCTOR });
    const student = await createUser();
    const course = await createCourse(owner.id);
    await enroll(student.id, course.id);

    const body = { title: "Intrusa", joinUrl: JOIN_URL, startsAt: inHours(5).toISOString() };

    const asStudent = await request(app)
      .post(`/api/v1/live-sessions/courses/${course.id}`)
      .set("Cookie", authCookie(student))
      .send(body);
    const asOtherInstructor = await request(app)
      .post(`/api/v1/live-sessions/courses/${course.id}`)
      .set("Cookie", authCookie(other))
      .send(body);

    expect(asStudent.status).toBe(403);
    expect(asOtherInstructor.status).toBe(403);
    expect(await prisma.liveSession.count()).toBe(0);
  });

  it("rejects a meeting link that is not http(s)", async () => {
    const instructor = await createUser({ role: Role.INSTRUCTOR });
    const course = await createCourse(instructor.id);

    // Stored verbatim this would come back out into an anchor the student clicks.
    const response = await request(app)
      .post(`/api/v1/live-sessions/courses/${course.id}`)
      .set("Cookie", authCookie(instructor))
      .send({
        title: "Link perigoso",
        joinUrl: "javascript:alert(document.cookie)",
        startsAt: inHours(5).toISOString(),
      });

    expect(response.status).toBe(400);
    expect(await prisma.liveSession.count()).toBe(0);
  });

  it("rejects a missing link, a short title and an absurd duration", async () => {
    const instructor = await createUser({ role: Role.INSTRUCTOR });
    const course = await createCourse(instructor.id);
    const url = `/api/v1/live-sessions/courses/${course.id}`;
    const cookie = authCookie(instructor);

    const noLink = await request(app)
      .post(url)
      .set("Cookie", cookie)
      .send({ title: "Sem link", startsAt: inHours(5).toISOString() });
    const shortTitle = await request(app)
      .post(url)
      .set("Cookie", cookie)
      .send({ title: "ab", joinUrl: JOIN_URL, startsAt: inHours(5).toISOString() });
    const tooLong = await request(app)
      .post(url)
      .set("Cookie", cookie)
      .send({
        title: "Maratona",
        joinUrl: JOIN_URL,
        startsAt: inHours(5).toISOString(),
        durationMinutes: 5000,
      });

    expect(noLink.status).toBe(400);
    expect(shortTitle.status).toBe(400);
    expect(tooLong.status).toBe(400);
  });
});

describe("PATCH and DELETE /live-sessions/:sessionId", () => {
  it("reschedules a session", async () => {
    const instructor = await createUser({ role: Role.INSTRUCTOR });
    const course = await createCourse(instructor.id);
    const session = await scheduleSession(course.id);
    const newStart = inHours(72);

    const response = await request(app)
      .patch(`/api/v1/live-sessions/${session.id}`)
      .set("Cookie", authCookie(instructor))
      .send({ startsAt: newStart.toISOString(), durationMinutes: 90 });

    expect(response.status).toBe(200);
    const stored = await prisma.liveSession.findUniqueOrThrow({ where: { id: session.id } });
    expect(stored.durationMinutes).toBe(90);
    expect(stored.startsAt.toISOString()).toBe(newStart.toISOString());
  });

  it("deletes a session", async () => {
    const instructor = await createUser({ role: Role.INSTRUCTOR });
    const course = await createCourse(instructor.id);
    const session = await scheduleSession(course.id);

    const response = await request(app)
      .delete(`/api/v1/live-sessions/${session.id}`)
      .set("Cookie", authCookie(instructor));

    expect(response.status).toBe(204);
    expect(await prisma.liveSession.count()).toBe(0);
  });

  it("refuses an instructor editing or deleting someone else's session", async () => {
    const owner = await createUser({ role: Role.INSTRUCTOR });
    const other = await createUser({ role: Role.INSTRUCTOR });
    const course = await createCourse(owner.id);
    const session = await scheduleSession(course.id);

    const patched = await request(app)
      .patch(`/api/v1/live-sessions/${session.id}`)
      .set("Cookie", authCookie(other))
      .send({ title: "Roubada" });
    const deleted = await request(app)
      .delete(`/api/v1/live-sessions/${session.id}`)
      .set("Cookie", authCookie(other));

    expect(patched.status).toBe(403);
    expect(deleted.status).toBe(403);
    expect(await prisma.liveSession.count()).toBe(1);
  });

  it("404s for a session that does not exist", async () => {
    const instructor = await createUser({ role: Role.INSTRUCTOR });

    const response = await request(app)
      .delete("/api/v1/live-sessions/11111111-1111-4111-8111-111111111111")
      .set("Cookie", authCookie(instructor));

    expect(response.status).toBe(404);
  });

  it("goes away with its course", async () => {
    const instructor = await createUser({ role: Role.INSTRUCTOR });
    const course = await createCourse(instructor.id);
    await scheduleSession(course.id);

    await request(app).delete(`/api/v1/courses/${course.id}`).set("Cookie", authCookie(instructor));

    expect(await prisma.liveSession.count()).toBe(0);
  });
});
