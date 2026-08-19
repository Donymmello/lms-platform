import { NotFoundError } from "../../errors";
import { AuthenticatedUser } from "../../@types/express";
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
};
