import { CourseStatus, Role } from "@prisma/client";
import { ForbiddenError, NotFoundError } from "../../errors";
import { AuthenticatedUser } from "../../@types/express";
import { CourseWithDetailRelations } from "../courses/courses.repository";
import { requireCourseWithContent } from "../courses/courses.service";
import { enrollmentsRepository } from "../enrollments/enrollments.repository";
import { resolveAccess } from "../playback/playback.service";
import { playbackRepository } from "../playback/playback.repository";
import { CourseProgressDto, CourseProgressSummaryDto } from "./dtos/progress.dto";
import { progressRepository } from "./progress.repository";

function percentOf(completed: number, total: number): number {
  return total === 0 ? 0 : Math.round((completed / total) * 100);
}

export const progressService = {
  /** Marks (or unmarks) a lesson complete for the acting user. Same access rule as watching it. */
  async toggleComplete(
    lessonId: string,
    completed: boolean,
    actingUser: AuthenticatedUser
  ): Promise<{ lessonId: string; completed: boolean }> {
    const lesson = await playbackRepository.findLessonWithCourse(lessonId);

    // Same shape as playback.service.getSignedUrl: a lesson on a DRAFT (or
    // nonexistent) course is a plain 404, not a leak of "it exists but you
    // can't see it"; only once it's genuinely reachable does a lack of
    // access become a 403.
    if (!lesson || lesson.course.status !== CourseStatus.PUBLISHED) {
      throw new NotFoundError("Lesson not found");
    }

    const canAccess = await resolveAccess(lesson, actingUser);
    if (!canAccess) {
      throw new ForbiddenError("You need to be enrolled in this course to track progress on this lesson");
    }

    await progressRepository.setCompleted(actingUser.id, lessonId, completed);
    return { lessonId, completed };
  },

  /** Full progress breakdown for one course — the student course player's progress bar + "continue" lesson. */
  async getCourseProgress(courseId: string, actingUser: AuthenticatedUser): Promise<CourseProgressDto> {
    const course = await requireCourseWithContent(courseId);

    const isManager =
      actingUser.role === Role.ADMIN ||
      (actingUser.role === Role.INSTRUCTOR && course.instructorId === actingUser.id);

    if (!isManager) {
      const enrollment = await enrollmentsRepository.findByUserAndCourse(actingUser.id, courseId);
      if (!enrollment) {
        throw new ForbiddenError("You need to be enrolled in this course to see your progress");
      }
    }

    // `detailInclude` already orders modules and, within each, lessons — so
    // this flatMap is the course's real curriculum order.
    const lessons = course.modules.flatMap(
      (courseModule: CourseWithDetailRelations["modules"][number]) => courseModule.lessons
    );
    const lessonIds = lessons.map((lesson: CourseWithDetailRelations["modules"][number]["lessons"][number]) => lesson.id);

    const completedLessonIds = await progressRepository.findCompletedLessonIds(actingUser.id, lessonIds);
    const completedSet = new Set(completedLessonIds);
    const resumeLesson =
      lessons.find(
        (lesson: CourseWithDetailRelations["modules"][number]["lessons"][number]) => !completedSet.has(lesson.id)
      ) ?? lessons[0] ?? null;

    return {
      courseId,
      totalLessons: lessonIds.length,
      completedLessons: completedLessonIds.length,
      percent: percentOf(completedLessonIds.length, lessonIds.length),
      completedLessonIds,
      resumeLessonId: resumeLesson ? resumeLesson.id : null,
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
