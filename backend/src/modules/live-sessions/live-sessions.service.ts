import { LiveSession } from "@prisma/client";
import { NotFoundError } from "../../errors";
import { AuthenticatedUser } from "../../@types/express";
import { assertCanAccessCourse, assertCanManage, requireCourse } from "../courses/courses.service";
import { LiveSessionDto } from "./dtos/live-session.dto";
import { liveSessionsRepository } from "./live-sessions.repository";
import { CreateLiveSessionInput, UpdateLiveSessionInput } from "./schemas/live-session.schema";

function isLiveNow(session: LiveSession, now: Date): boolean {
  const start = session.startsAt.getTime();
  return now.getTime() >= start && now.getTime() < start + session.durationMinutes * 60_000;
}

/**
 * `joinUrl` is withheld unless the caller may actually attend. Everything
 * else about a session is safe to show, so a student who is not yet enrolled
 * could still be told a course has live classes without being handed the way
 * into them.
 */
function toDto(session: LiveSession, canJoin: boolean, now: Date): LiveSessionDto {
  return {
    id: session.id,
    courseId: session.courseId,
    title: session.title,
    description: session.description,
    startsAt: session.startsAt,
    durationMinutes: session.durationMinutes,
    joinUrl: canJoin ? session.joinUrl : null,
    isLive: isLiveNow(session, now),
  };
}

/** Loads a session and the course it belongs to, 404ing on either being absent. */
async function requireSessionWithCourse(sessionId: string) {
  const session = await liveSessionsRepository.findById(sessionId);
  if (!session) {
    throw new NotFoundError("Live session not found");
  }
  return { session, course: await requireCourse(session.courseId) };
}

export const liveSessionsService = {
  /** Every scheduled session for a course, soonest first. Requires enrolment (or owning the course). */
  async listForCourse(courseId: string, actingUser: AuthenticatedUser): Promise<LiveSessionDto[]> {
    const course = await requireCourse(courseId);
    await assertCanAccessCourse(
      course,
      actingUser,
      "You need to be enrolled in this course to see its live classes"
    );

    const now = new Date();
    const sessions = await liveSessionsRepository.findManyForCourse(courseId);
    return sessions.map((session) => toDto(session, true, now));
  },

  async create(
    courseId: string,
    input: CreateLiveSessionInput,
    actingUser: AuthenticatedUser
  ): Promise<LiveSessionDto> {
    const course = await requireCourse(courseId);
    assertCanManage(course, actingUser);

    const created = await liveSessionsRepository.create(courseId, input);
    return toDto(created, true, new Date());
  },

  async update(
    sessionId: string,
    input: UpdateLiveSessionInput,
    actingUser: AuthenticatedUser
  ): Promise<LiveSessionDto> {
    const { session, course } = await requireSessionWithCourse(sessionId);
    assertCanManage(course, actingUser);

    const updated = await liveSessionsRepository.update(session.id, input);
    return toDto(updated, true, new Date());
  },

  async remove(sessionId: string, actingUser: AuthenticatedUser): Promise<void> {
    const { session, course } = await requireSessionWithCourse(sessionId);
    assertCanManage(course, actingUser);

    await liveSessionsRepository.delete(session.id);
  },
};
