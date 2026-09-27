import fs from "node:fs/promises";
import path from "node:path";
import { NotFoundError } from "../../errors";
import { AuthenticatedUser } from "../../@types/express";
import { bunnyStream } from "../../integrations/bunny-stream";
import { localMaterialStorage, materialContentType } from "../../integrations/local-material-storage";
import { isLocalVideoId, localVideoStorage } from "../../integrations/local-video-storage";
import { isBunnyConfigured } from "../../integrations/video-provider";
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
    originalName: string,
    actingUser: AuthenticatedUser
  ): Promise<CourseDetailDto> {
    const course = await requireCourse(courseId);
    assertCanManage(course, actingUser);
    await requireModuleInCourse(courseId, moduleId);
    const lesson = await requireLessonInModule(moduleId, lessonId);

    try {
      await removeStoredVideo(lesson.bunnyVideoId);

      // Whichever provider is configured now; a library can hold videos from
      // both, because each id says where it lives.
      let videoId: string;
      if (isBunnyConfigured()) {
        videoId = await bunnyStream.createVideo(lesson.title);
        await bunnyStream.uploadVideoFile(videoId, filePath);
      } else {
        videoId = await localVideoStorage.store(filePath, originalName);
      }

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
      await removeStoredVideo(lesson.bunnyVideoId);
      await lessonsRepository.setVideo(lessonId, null);
    }

    return toDetailDto(await requireCourseWithContent(courseId));
  },

  /** Attaches a downloadable to a lesson — slides, a worksheet, exercise files. */
  async addMaterial(
    courseId: string,
    moduleId: string,
    lessonId: string,
    file: { path: string; originalname: string; size: number },
    actingUser: AuthenticatedUser
  ): Promise<CourseDetailDto> {
    const course = await requireCourse(courseId);
    assertCanManage(course, actingUser);
    await requireModuleInCourse(courseId, moduleId);
    await requireLessonInModule(moduleId, lessonId);

    try {
      const storedName = await localMaterialStorage.store(file.path, file.originalname);
      await lessonsRepository.addMaterial({
        lessonId,
        // The name is kept for display only. `storedName` is what touches the
        // filesystem, and it is generated rather than taken from the upload.
        fileName: path.basename(file.originalname),
        contentType: materialContentType(file.originalname),
        sizeBytes: file.size,
        storedName,
      });
    } finally {
      await fs.unlink(file.path).catch(() => {
        // Temp file cleanup is best-effort — a leftover temp file costs disk, not correctness.
      });
    }

    return toDetailDto(await requireCourseWithContent(courseId));
  },

  async removeMaterial(
    courseId: string,
    moduleId: string,
    lessonId: string,
    materialId: string,
    actingUser: AuthenticatedUser
  ): Promise<CourseDetailDto> {
    const course = await requireCourse(courseId);
    assertCanManage(course, actingUser);
    await requireModuleInCourse(courseId, moduleId);
    await requireLessonInModule(moduleId, lessonId);

    const material = await lessonsRepository.findMaterial(materialId);
    // Belonging to *this* lesson matters: the id alone would otherwise let the
    // owner of one course delete a material from another.
    if (!material || material.lessonId !== lessonId) {
      throw new NotFoundError("Material not found");
    }

    await lessonsRepository.deleteMaterial(materialId);
    await localMaterialStorage.remove(material.storedName);

    return toDetailDto(await requireCourseWithContent(courseId));
  },
};

/** Deletes wherever the video actually lives, which the id itself records. */
async function removeStoredVideo(videoId: string | null): Promise<void> {
  if (!videoId) return;
  if (isLocalVideoId(videoId)) {
    await localVideoStorage.remove(videoId);
  } else {
    await bunnyStream.deleteVideo(videoId);
  }
}

export { requireLessonInModule };
