/*
 * Demo data for reviewing the student area. Every row it creates carries an
 * id starting with `5eed` so `seed-demo.ts --clean` can remove exactly what
 * it added and nothing else. Run inside the backend container:
 *   docker exec lms_backend npx ts-node --transpile-only seed-demo.ts
 *   docker exec lms_backend npx ts-node --transpile-only seed-demo.ts --clean
 */
import { CourseStatus } from "@prisma/client";
import { prisma } from "./src/database/prisma";

const STUDENT_EMAIL = "dony@lms.com";

/** `5eed` prefix = "seed", so cleanup can target these rows precisely. */
function id(suffix: string): string {
  return `5eed0000-0000-4000-8000-${suffix.padStart(12, "0")}`;
}

const FREE_COURSE_ID = id("c3");

interface LessonSpec {
  title: string;
  minutes: number;
  withVideo?: boolean;
  free?: boolean;
}

interface ModuleSpec {
  title: string;
  lessons: LessonSpec[];
}

const JAVA_MODULES: ModuleSpec[] = [
  {
    title: "Primeiros passos",
    lessons: [
      { title: "Instalar o JDK e o IntelliJ", minutes: 8, free: true },
      { title: "O teu primeiro programa", minutes: 12, free: true },
      { title: "Variáveis e tipos primitivos", minutes: 15 },
      { title: "Operadores e expressões", minutes: 11 },
    ],
  },
  {
    title: "Orientação a objetos",
    lessons: [
      { title: "Classes, objetos e construtores", minutes: 19 },
      { title: "Herança e polimorfismo", minutes: 23 },
      { title: "Interfaces na prática", minutes: 17, withVideo: false },
    ],
  },
];

const REACT_MODULES: ModuleSpec[] = [
  {
    title: "Fundamentos",
    lessons: [
      { title: "O que é um componente", minutes: 9, free: true },
      { title: "JSX sem mistério", minutes: 13 },
      { title: "Props e composição", minutes: 16 },
    ],
  },
  {
    title: "Estado e efeitos",
    lessons: [
      { title: "useState do zero", minutes: 21 },
      { title: "useEffect e o ciclo de vida", minutes: 26 },
    ],
  },
];

const UI_MODULES: ModuleSpec[] = [
  {
    title: "Bases do desenho de interfaces",
    lessons: [
      { title: "Hierarquia visual", minutes: 10, free: true },
      { title: "Escalas tipográficas", minutes: 14 },
      { title: "Cor com intenção", minutes: 12 },
      { title: "Espaçamento e ritmo", minutes: 18 },
    ],
  },
];

async function seedModules(courseId: string, prefix: string, specs: ModuleSpec[]): Promise<string[]> {
  const lessonIds: string[] = [];

  for (const [moduleIndex, spec] of specs.entries()) {
    const moduleId = id(`${prefix}m${moduleIndex}`);
    await prisma.courseModule.create({
      data: { id: moduleId, courseId, title: spec.title, order: moduleIndex },
    });

    for (const [lessonIndex, lesson] of spec.lessons.entries()) {
      const lessonId = id(`${prefix}l${moduleIndex}${lessonIndex}`);
      await prisma.lesson.create({
        data: {
          id: lessonId,
          moduleId,
          title: lesson.title,
          description: "",
          // 0-based, matching lessonsRepository.nextOrder.
          order: lessonIndex,
          isFreePreview: lesson.free ?? false,
          durationSeconds: lesson.minutes * 60 + 30,
          bunnyVideoId: lesson.withVideo === false ? null : `demo-${lessonId}`,
        },
      });
      lessonIds.push(lessonId);
    }
  }

  return lessonIds;
}

async function seed(): Promise<void> {
  const student = await prisma.user.findUnique({ where: { email: STUDENT_EMAIL } });
  if (!student) throw new Error(`No user with email ${STUDENT_EMAIL}`);

  const java = await prisma.course.findFirst({ where: { slug: "java" } });
  const react = await prisma.course.findFirst({ where: { slug: "introducao-a-react" } });
  if (!java || !react) throw new Error("Expected the existing 'java' and 'introducao-a-react' courses");

  // A third, free course so the catalogue shows the "Grátis" badge next to
  // the padlocked paid ones.
  const free = await prisma.course.create({
    data: {
      id: FREE_COURSE_ID,
      title: "Fundamentos de UI",
      slug: "fundamentos-de-ui",
      description:
        "Os princípios que separam uma interface que funciona de uma que apenas existe: hierarquia, tipografia, cor e ritmo.",
      priceCents: 0,
      status: CourseStatus.PUBLISHED,
      instructorId: java.instructorId,
    },
  });

  const javaLessons = await seedModules(java.id, "a", JAVA_MODULES);
  await seedModules(react.id, "b", REACT_MODULES);
  const uiLessons = await seedModules(free.id, "c", UI_MODULES);

  // Three enrolments, one per shelf: part-done, untouched, finished.
  await prisma.enrollment.create({
    data: { id: id("e1"), userId: student.id, courseId: java.id },
  });
  await prisma.enrollment.create({
    data: { id: id("e2"), userId: student.id, courseId: react.id },
  });
  await prisma.enrollment.create({
    data: { id: id("e3"), userId: student.id, courseId: free.id },
  });

  // Java: 3 of 7 done => 43%, so it becomes the hero and fills "Continuar a ver".
  for (const [index, lessonId] of javaLessons.slice(0, 3).entries()) {
    await prisma.lessonProgress.create({
      data: { id: id(`p1${index}`), userId: student.id, lessonId, completedAt: new Date() },
    });
  }

  // Fundamentos de UI: everything done => 100%, fills "Concluídos".
  for (const [index, lessonId] of uiLessons.entries()) {
    await prisma.lessonProgress.create({
      data: { id: id(`p2${index}`), userId: student.id, lessonId, completedAt: new Date() },
    });
  }

  // React is left untouched => 0%, fills "Por começar".

  console.log("Seeded:");
  console.log(`  ${javaLessons.length} aulas em Java (3 concluídas)`);
  console.log(`  5 aulas em Introdução a react (0 concluídas)`);
  console.log(`  ${uiLessons.length} aulas em Fundamentos de UI (todas concluídas)`);
  console.log(`  3 inscrições para ${STUDENT_EMAIL}`);
}

async function clean(): Promise<void> {
  const like = { startsWith: "5eed" };
  const progress = await prisma.lessonProgress.deleteMany({ where: { id: like } });
  const enrollments = await prisma.enrollment.deleteMany({ where: { id: like } });
  const lessons = await prisma.lesson.deleteMany({ where: { id: like } });
  const modules = await prisma.courseModule.deleteMany({ where: { id: like } });
  const courses = await prisma.course.deleteMany({ where: { id: like } });

  console.log(
    `Removed: ${progress.count} progresso, ${enrollments.count} inscrições, ` +
      `${lessons.count} aulas, ${modules.count} módulos, ${courses.count} cursos`
  );
}

async function main(): Promise<void> {
  try {
    if (process.argv.includes("--clean")) {
      await clean();
    } else {
      // Re-running should replace, not duplicate.
      await clean();
      await seed();
    }
  } finally {
    await prisma.$disconnect();
  }
}

void main();
