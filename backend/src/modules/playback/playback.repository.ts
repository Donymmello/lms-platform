import { CourseStatus } from "@prisma/client";
import { prisma } from "../../database/prisma";

export interface LessonWithCourseContext {
  id: string;
  isFreePreview: boolean;
  bunnyVideoId: string | null;
  course: {
    id: string;
    status: CourseStatus;
    instructorId: string;
  };
}

export const playbackRepository = {
  async findLessonWithCourse(lessonId: string): Promise<LessonWithCourseContext | null> {
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        module: {
          include: {
            course: { select: { id: true, status: true, instructorId: true } },
          },
        },
      },
    });

    if (!lesson) return null;

    return {
      id: lesson.id,
      isFreePreview: lesson.isFreePreview,
      bunnyVideoId: lesson.bunnyVideoId,
      course: lesson.module.course,
    };
  },
};
