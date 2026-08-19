import { NotFoundError } from "../../errors";
import { AuthenticatedUser } from "../../@types/express";
import { assertCanManage, requireCourse, requireCourseWithContent, toDetailDto } from "./courses.service";
import { CourseDetailDto } from "./dtos/course.dto";
import { CreateModuleInput, UpdateModuleInput } from "./schemas/module.schema";
import { courseModulesRepository } from "./course-modules.repository";

async function requireModuleInCourse(courseId: string, moduleId: string) {
  const courseModule = await courseModulesRepository.findById(moduleId);
  if (!courseModule || courseModule.courseId !== courseId) {
    throw new NotFoundError("Module not found");
  }
  return courseModule;
}

export const courseModulesService = {
  async create(courseId: string, input: CreateModuleInput, actingUser: AuthenticatedUser): Promise<CourseDetailDto> {
    const course = await requireCourse(courseId);
    assertCanManage(course, actingUser);

    const order = await courseModulesRepository.nextOrder(courseId);
    await courseModulesRepository.create({ title: input.title, courseId, order });

    return toDetailDto(await requireCourseWithContent(courseId));
  },

  async update(
    courseId: string,
    moduleId: string,
    input: UpdateModuleInput,
    actingUser: AuthenticatedUser
  ): Promise<CourseDetailDto> {
    const course = await requireCourse(courseId);
    assertCanManage(course, actingUser);
    await requireModuleInCourse(courseId, moduleId);

    await courseModulesRepository.update(moduleId, input);
    return toDetailDto(await requireCourseWithContent(courseId));
  },

  async remove(courseId: string, moduleId: string, actingUser: AuthenticatedUser): Promise<CourseDetailDto> {
    const course = await requireCourse(courseId);
    assertCanManage(course, actingUser);
    await requireModuleInCourse(courseId, moduleId);

    await courseModulesRepository.delete(moduleId);
    return toDetailDto(await requireCourseWithContent(courseId));
  },
};

export { requireModuleInCourse };
