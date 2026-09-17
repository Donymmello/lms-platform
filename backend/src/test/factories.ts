import {
  Course,
  CourseStatus,
  Lesson,
  Payment,
  PaymentProvider,
  PaymentStatus,
  Role,
  User,
} from "@prisma/client";
import { prisma } from "../database/prisma";
import { ACCESS_TOKEN_COOKIE } from "../constants/cookies";
import { hashPassword } from "../utils/password";
import { signAccessToken } from "../utils/jwt";

/** Shared across every factory-made user, so tests can log in through the real auth route when they need to. */
export const TEST_PASSWORD = "Str0ng-Test-Pass!";

/**
 * bcrypt at 12 rounds costs ~1s per call, and a suite that creates two or
 * three users per test spends most of its time here. The hash of the shared
 * test password is identical every time, so it is computed once per run and
 * reused — still a real bcrypt hash, so login tests exercise the real
 * comparison path.
 */
let cachedPasswordHash: string | undefined;
async function testPasswordHash(): Promise<string> {
  cachedPasswordHash ??= await hashPassword(TEST_PASSWORD);
  return cachedPasswordHash;
}

let sequence = 0;
function unique(prefix: string): string {
  sequence += 1;
  return `${prefix}-${sequence}`;
}

export async function createUser(overrides: Partial<User> = {}): Promise<User> {
  const suffix = unique("user");
  return prisma.user.create({
    data: {
      name: overrides.name ?? `Test ${suffix}`,
      email: overrides.email ?? `${suffix}@example.test`,
      password: overrides.password ?? (await testPasswordHash()),
      role: overrides.role ?? Role.STUDENT,
      isActive: overrides.isActive ?? true,
    },
  });
}

export function createCourse(instructorId: string, overrides: Partial<Course> = {}): Promise<Course> {
  const suffix = unique("course");
  return prisma.course.create({
    data: {
      title: overrides.title ?? `Course ${suffix}`,
      slug: overrides.slug ?? suffix,
      description: overrides.description ?? "",
      priceCents: overrides.priceCents ?? 0,
      status: overrides.status ?? CourseStatus.PUBLISHED,
      instructorId,
    },
  });
}

/**
 * Creates one module holding `count` lessons, returned in curriculum order.
 * `freePreviewCount` marks the first N of them as free previews, which is
 * the only case where playback is allowed without an enrollment.
 */
export async function createLessons(
  courseId: string,
  count: number,
  options: { freePreviewCount?: number; withVideo?: boolean } = {}
): Promise<Lesson[]> {
  const { freePreviewCount = 0, withVideo = true } = options;

  const courseModule = await prisma.courseModule.create({
    data: { courseId, title: unique("module"), order: 1 },
  });

  const lessons: Lesson[] = [];
  for (let index = 0; index < count; index += 1) {
    lessons.push(
      await prisma.lesson.create({
        data: {
          moduleId: courseModule.id,
          title: `Lesson ${index + 1}`,
          // 0-based, matching `lessonsRepository.nextOrder`.
          order: index,
          isFreePreview: index < freePreviewCount,
          bunnyVideoId: withVideo ? `video-${courseModule.id}-${index}` : null,
        },
      })
    );
  }
  return lessons;
}

export async function enroll(userId: string, courseId: string, paymentId?: string): Promise<void> {
  await prisma.enrollment.create({ data: { userId, courseId, paymentId } });
}

export function createPayment(
  userId: string,
  courseId: string,
  overrides: Partial<Payment> = {}
): Promise<Payment> {
  return prisma.payment.create({
    data: {
      userId,
      courseId,
      provider: overrides.provider ?? PaymentProvider.MPESA,
      status: overrides.status ?? PaymentStatus.COMPLETED,
      amountCents: overrides.amountCents ?? 10_000,
      reference: overrides.reference ?? unique("ref"),
      providerTxnId: overrides.providerTxnId ?? unique("txn"),
      createdAt: overrides.createdAt ?? new Date(),
    },
  });
}

export async function completeLesson(userId: string, lessonId: string): Promise<void> {
  await prisma.lessonProgress.create({ data: { userId, lessonId, completedAt: new Date() } });
}

/**
 * A `Cookie` header that authenticates as `user`. Signed with the app's own
 * helper rather than by posting to /auth/login, so a test about course
 * access doesn't fail because something unrelated broke in login.
 */
export function authCookie(user: Pick<User, "id" | "role">): string {
  return `${ACCESS_TOKEN_COOKIE}=${signAccessToken({ sub: user.id, role: user.role })}`;
}
