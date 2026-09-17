import fs from "node:fs/promises";
import { NotFoundError } from "../../errors";
import { AuthenticatedUser } from "../../@types/express";
import { bunnyStream } from "../../integrations/bunny-stream";
import { assertCanManage, requireCourse, requireCourseWithContent, toDetailDto } from "./courses.service";
import { requireModuleInCourse } from "./course-modules.service";
import { CourseDetailDto } from "./dtos/course.dto";
import { CreateLessonInput, UpdateLessonInput } from "./schemas/lesson.schema";
import { lessonsRepository } from "./lessons.repository";

async function requireLessonInModule(moduleId: string, lessonId: string) {
  const lesson = await lessonsRepository.findById(lessonId);
  if (!lesson || lesson.moduleId !== moduleId) {
    throw new NotFoundError("Lesson not found");
  }
  return lesson;
}

export const lessonsService = {
  async create(
    courseId: string,
    moduleId: string,
    input: CreateLessonInput,
    actingUser: AuthenticatedUser
  ): Promise<CourseDetailDto> {
    const course = await requireCourse(courseId);
    assertCanManage(course, actingUser);
    await requireModuleInCourse(courseId, moduleId);

    const order = await lessonsRepository.nextOrder(moduleId);
    await lessonsRepository.create({
      title: input.title,
      description: input.description,
      isFreePreview: input.isFreePreview,
      moduleId,
      order,
    });

    return toDetailDto(await requireCourseWithContent(courseId));
  },

  async update(
    courseId: string,
    moduleId: string,
    lessonId: string,
    input: UpdateLessonInput,
    actingUser: AuthenticatedUser
  ): Promise<CourseDetailDto> {
    const course = await requireCourse(courseId);
    assertCanManage(course, actingUser);
    await requireModuleInCourse(courseId, moduleId);
    await requireLessonInModule(moduleId, lessonId);

    await lessonsRepository.update(lessonId, input);
    return toDetailDto(await requireCourseWithContent(courseId));
  },

  async remove(
    courseId: string,
    moduleId: string,
    lessonId: string,
    actingUser: AuthenticatedUser
  ): Promise<CourseDetailDto> {
    const course = await requireCourse(courseId);
    assertCanManage(course, actingUser);
    await requireModuleInCourse(courseId, moduleId);
    await requireLessonInModule(moduleId, lessonId);

    await lessonsRepository.delete(lessonId);
    return toDetailDto(await requireCourseWithContent(courseId));
  },

  /**
   * Replaces the lesson's video: any existing Bunny video is deleted first
   * (best-effort — see bunny-stream.ts), then a new one is created and the
   * uploaded file streamed to it. The local temp file is always cleaned up,
   * success or failure.
   */
  async uploadVideo(
    courseId: string,
    moduleId: string,
    lessonId: string,
    filePath: string,
    actingUser: AuthenticatedUser
  ): Promise<CourseDetailDto> {
    const course = await requireCourse(courseId);
    assertCanManage(course, actingUser);
    await requireModuleInCourse(courseId, moduleId);
    const lesson = await requireLessonInModule(moduleId, lessonId);

    try {
      if (lesson.bunnyVideoId) {
        await bunnyStream.deleteVideo(lesson.bunnyVideoId);
      }

      const videoId = await bunnyStream.createVideo(lesson.title);
      await bunnyStream.uploadVideoFile(videoId, filePath);
      await lessonsRepository.setVideo(lessonId, videoId);
    } finally {
      await fs.unlink(filePath).catch(() => {
        // Temp file cleanup is best-effort — a leftover temp file costs disk, not correctness.
      });
    }

    return toDetailDto(await requireCourseWithContent(courseId));
  },

  async removeVideo(
    courseId: string,
    moduleId: string,
    lessonId: string,
    actingUser: AuthenticatedUser
  ): Promise<CourseDetailDto> {
    const course = await requireCourse(courseId);
    assertCanManage(course, actingUser);
    await requireModuleInCourse(courseId, moduleId);
    const lesson = await requireLessonInModule(moduleId, lessonId);

    if (lesson.bunnyVideoId) {
      await bunnyStream.deleteVideo(lesson.bunnyVideoId);
      await lessonsRepository.setVideo(lessonId, null);
    }

    return toDetailDto(await requireCourseWithContent(courseId));
  },
};

export { requireLessonInModule };
