import { CourseStatus, Role } from "@prisma/client";
import { ForbiddenError, NotFoundError } from "../../errors";
import { AuthenticatedUser } from "../../@types/express";
import { bunnyStream } from "../../integrations/bunny-stream";
import { enrollmentsRepository } from "../enrollments/enrollments.repository";
import { progressRepository } from "../progress/progress.repository";
import { LessonWithCourseContext, playbackRepository } from "./playback.repository";

/**
 * Shared access rule for a lesson: free preview → anyone; else the acting
 * user must be the ADMIN, the owning INSTRUCTOR, or actually enrolled.
 * Exported so the progress module (marking a lesson complete, reading a
 * course's progress) enforces the exact same rule instead of drifting from
 * it.
 */
async function resolveAccess(
  lesson: LessonWithCourseContext,
  actingUser: AuthenticatedUser | undefined
): Promise<boolean> {
  if (lesson.isFreePreview) return true;
  if (!actingUser) return false;
  if (actingUser.role === Role.ADMIN) return true;
  if (actingUser.role === Role.INSTRUCTOR && lesson.course.instructorId === actingUser.id) return true;

  const enrollment = await enrollmentsRepository.findByUserAndCourse(actingUser.id, lesson.course.id);
  return Boolean(enrollment);
}

export const playbackService = {
  async getSignedUrl(
    lessonId: string,
    actingUser: AuthenticatedUser | undefined
  ): Promise<{ embedUrl: string; expiresAt: Date }> {
    const lesson = await playbackRepository.findLessonWithCourse(lessonId);

    // A DRAFT course's lessons aren't watchable by anyone — treat both
    // "doesn't exist" and "not published" as a plain 404 rather than
    // leaking which draft courses exist.
    if (!lesson || lesson.course.status !== CourseStatus.PUBLISHED) {
      throw new NotFoundError("Lesson not found");
    }
    if (!lesson.bunnyVideoId) {
      throw new NotFoundError("This lesson doesn't have a video yet");
    }

    const canWatch = await resolveAccess(lesson, actingUser);
    if (!canWatch) {
      throw new ForbiddenError("You need to be enrolled in this course to watch this lesson");
    }

    // Best-effort "continue where you left off" bookkeeping — never for an
    // anonymous free-preview viewer (there's no user to attach it to), and
    // never allowed to fail the playback request itself.
    if (actingUser) {
      progressRepository.touchAccess(actingUser.id, lesson.id).catch(() => {
        // A missed "last accessed" touch costs a stale resume position, not correctness.
      });
    }

    return bunnyStream.getSignedEmbedUrl(lesson.bunnyVideoId);
  },
};

export { resolveAccess };
