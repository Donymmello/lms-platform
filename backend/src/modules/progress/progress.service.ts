import { CourseStatus } from "@prisma/client";
import { ForbiddenError, NotFoundError } from "../../errors";
import { AuthenticatedUser } from "../../@types/express";
import { CourseWithDetailRelations } from "../courses/courses.repository";
import { assertCanAccessCourse, requireCourseWithContent } from "../courses/courses.service";
import { enrollmentsRepository } from "../enrollments/enrollments.repository";
import { resolveAccess } from "../playback/playback.service";
import { playbackRepository } from "../playback/playback.repository";
import { CourseProgressDto, CourseProgressSummaryDto } from "./dtos/progress.dto";
import { progressRepository } from "./progress.repository";

function percentOf(completed: number, total: number): number {
  return total === 0 ? 0 : Math.round((completed / total) * 100);
}

/**
 * Watching the last tenth of a lesson is credits, end cards and goodbyes. A
 * student who reaches it has finished, and holding the tick back until the
 * very last frame just means it never arrives.
 */
const COMPLETE_AT_RATIO = 0.9;

/**
 * The lesson has to be reachable before any progress on it can be recorded.
 * A lesson on a DRAFT (or nonexistent) course is a plain 404, not a leak of
 * "it exists but you can't see it"; only once it is genuinely reachable does
 * a lack of access become a 403.
 */
async function requireTrackableLesson(lessonId: string, actingUser: AuthenticatedUser) {
  const lesson = await playbackRepository.findLessonWithCourse(lessonId);

  if (!lesson || lesson.course.status !== CourseStatus.PUBLISHED) {
    throw new NotFoundError("Lesson not found");
  }

  if (!(await resolveAccess(lesson, actingUser))) {
    throw new ForbiddenError("You need to be enrolled in this course to track progress on this lesson");
  }

  return lesson;
}

export const progressService = {
  /** Marks (or unmarks) a lesson complete for the acting user. Same access rule as watching it. */
  async toggleComplete(
    lessonId: string,
    completed: boolean,
    actingUser: AuthenticatedUser
  ): Promise<{ lessonId: string; completed: boolean }> {
    await requireTrackableLesson(lessonId, actingUser);

    await progressRepository.setCompleted(actingUser.id, lessonId, completed);
    return { lessonId, completed };
  },

  /**
   * Records how far the player has got, and completes the lesson once that
   * passes the threshold — so progress reflects what was actually watched
   * instead of whether anyone remembered to press a button.
   *
   * The position comes from the client because only the client knows it; the
   * threshold is applied here so there is one rule rather than one per player.
   * A student who inflates their own progress bar has fooled nobody but
   * themselves, so this is not a trust boundary — but the numbers are still
   * clamped, because a position past the end of the video is meaningless.
   */
  async recordPosition(
    lessonId: string,
    input: { positionSeconds: number; durationSeconds: number },
    actingUser: AuthenticatedUser
  ): Promise<{ lessonId: string; positionSeconds: number; completed: boolean }> {
    await requireTrackableLesson(lessonId, actingUser);

    const positionSeconds = Math.min(Math.round(input.positionSeconds), Math.round(input.durationSeconds));
    const completed = positionSeconds >= input.durationSeconds * COMPLETE_AT_RATIO;

    await progressRepository.savePosition(actingUser.id, lessonId, positionSeconds, completed);
    return { lessonId, positionSeconds, completed };
  },

  /** Full progress breakdown for one course — the student course player's progress bar + "continue" lesson. */
  async getCourseProgress(courseId: string, actingUser: AuthenticatedUser): Promise<CourseProgressDto> {
    const course = await requireCourseWithContent(courseId);

    await assertCanAccessCourse(
      course,
      actingUser,
      "You need to be enrolled in this course to see your progress"
    );

    // `detailInclude` already orders modules and, within each, lessons — so
    // this flatMap is the course's real curriculum order.
    const lessons = course.modules.flatMap(
      (courseModule: CourseWithDetailRelations["modules"][number]) => courseModule.lessons
    );
    const lessonIds = lessons.map((lesson: CourseWithDetailRelations["modules"][number]["lessons"][number]) => lesson.id);

    const rows = await progressRepository.findProgressFor(actingUser.id, lessonIds);
    const completedLessonIds = rows.filter((row) => row.completedAt !== null).map((row) => row.lessonId);
    const completedSet = new Set(completedLessonIds);

    const lessonPositions: Record<string, number> = {};
    for (const row of rows) {
      if (row.positionSeconds > 0) lessonPositions[row.lessonId] = row.positionSeconds;
    }

    // Where they left off beats where the curriculum says to go next: a
    // student who skipped ahead to lesson 5 expects to land back on 5. Only
    // unfinished lessons count, so the last thing they completed does not
    // keep pulling them back to it.
    const lastTouched = rows
      .filter((row) => row.completedAt === null && lessonIds.includes(row.lessonId))
      .sort((a, b) => b.lastAccessedAt.getTime() - a.lastAccessedAt.getTime())[0];

    const resumeLesson =
      (lastTouched && lessons.find((lesson: { id: string }) => lesson.id === lastTouched.lessonId)) ??
      lessons.find(
        (lesson: CourseWithDetailRelations["modules"][number]["lessons"][number]) => !completedSet.has(lesson.id)
      ) ??
      lessons[0] ??
      null;

    return {
      courseId,
      totalLessons: lessonIds.length,
      completedLessons: completedLessonIds.length,
      percent: percentOf(completedLessonIds.length, lessonIds.length),
      completedLessonIds,
      lessonPositions,
      resumeLessonId: resumeLesson ? resumeLesson.id : null,
      resumePositionSeconds: resumeLesson ? lessonPositions[resumeLesson.id] ?? 0 : 0,
    };
  },

  /** One summary row per course the acting user is enrolled in — powers progress bars on "Os meus cursos" in one round trip. */
  async getMySummary(actingUser: AuthenticatedUser): Promise<CourseProgressSummaryDto[]> {
    const enrollments = await enrollmentsRepository.findManyForUser(actingUser.id);
    const courseIds = enrollments.map((enrollment) => enrollment.courseId);

    const [completedCounts, totalCounts] = await Promise.all([
      progressRepository.countCompletedByCourse(actingUser.id, courseIds),
      progressRepository.countLessonsByCourse(courseIds),
    ]);

    return enrollments.map((enrollment) => {
      const total = totalCounts[enrollment.courseId] ?? 0;
      const completed = completedCounts[enrollment.courseId] ?? 0;
      return {
        courseId: enrollment.courseId,
        totalLessons: total,
        completedLessons: completed,
        percent: percentOf(completed, total),
      };
    });
  },
};
