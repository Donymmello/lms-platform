"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  ClipboardCheck,
  Film,
  Loader2,
  Paperclip,
  Plus,
  Radio,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/shared/confirm-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/services/api-client";
import { coursesService } from "@/services/courses.service";
import { CourseDetail, CourseModuleItem, LessonItem } from "@/types/course";
import { CourseFormValues, courseFormSchema } from "@/validators/course.validator";

// Kept in sync with the server-side limit in backend/src/middlewares/videoUpload.ts
// — checked client-side purely so a huge file fails fast with a clear
// message instead of after a slow upload.
const MAX_VIDEO_BYTES = 500 * 1024 * 1024;
/** Mirrors the server's own limit in materialUpload.ts. */
const MAX_MATERIAL_BYTES = 50 * 1024 * 1024;
/** Mirrors the server's allowlist in local-material-storage.ts — no .html or .svg, which would run script on the API's origin. */
const MATERIAL_EXTENSIONS =
  ".pdf,.zip,.txt,.csv,.md,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.odp,.png,.jpg,.jpeg,.gif,.webp";

interface CourseEditorProps {
  courseId: string;
  /**
   * The area this editor is mounted under — "/admin" or "/instructor".
   * Both roles author courses with the same screens; the backend already
   * scopes what each one may touch, so only the links differ.
   */
  basePath: string;
}

export function CourseEditor({ courseId, basePath }: CourseEditorProps) {
  const router = useRouter();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);

  useEffect(() => {
    let cancelled = false;
    coursesService
      .getById(courseId)
      .then((result) => {
        if (!cancelled) setCourse(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Não foi possível carregar o curso.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  async function handleToggleStatus() {
    if (!course) return;
    setIsTogglingStatus(true);
    try {
      const nextStatus = course.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED";
      setCourse(await coursesService.updateStatus(courseId, nextStatus));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível atualizar o estado.");
    } finally {
      setIsTogglingStatus(false);
    }
  }

  async function handleDelete() {
    if (!course) return;

    setIsDeleting(true);
    try {
      await coursesService.remove(courseId);
      router.push(`${basePath}/courses`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível eliminar o curso.");
      setIsDeleting(false);
    }
  }

  if (isLoading) {
    return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;
  }

  if (!course) {
    return (
      <p className="text-sm text-destructive">{error ?? "Curso não encontrado."}</p>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`${basePath}/courses`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Cursos
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`${basePath}/courses/${courseId}/live`}>
              <Radio className="h-3.5 w-3.5" />
              Aulas ao vivo
            </Link>
          </Button>
          <Badge variant={course.status === "PUBLISHED" ? "success" : "secondary"}>
            {course.status === "PUBLISHED" ? "Publicado" : "Rascunho"}
          </Badge>
          <Button variant="outline" size="sm" disabled={isTogglingStatus} onClick={handleToggleStatus}>
            {isTogglingStatus && <Loader2 className="h-3 w-3 animate-spin" />}
            {course.status === "PUBLISHED" ? "Despublicar" : "Publicar"}
          </Button>
          <ConfirmButton
            disabled={isDeleting}
            onConfirm={() => void handleDelete()}
            confirmLabel="Confirmar?"
            className="inline-flex h-8 items-center justify-center gap-1 rounded-md bg-destructive px-3 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:pointer-events-none disabled:opacity-50"
          >
            {isDeleting && <Loader2 className="h-3 w-3 animate-spin" />}
            Eliminar
          </ConfirmButton>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      <CourseInfoForm course={course} onSaved={setCourse} />

      <ModulesSection course={course} basePath={basePath} onCourseChange={setCourse} onError={setError} />
    </div>
  );
}

function CourseInfoForm({
  course,
  onSaved,
}: {
  course: CourseDetail;
  onSaved: (course: CourseDetail) => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<CourseFormValues>({
    resolver: zodResolver(courseFormSchema),
    defaultValues: {
      title: course.title,
      description: course.description,
      thumbnailUrl: course.thumbnailUrl ?? undefined,
      priceCents: course.priceCents,
    },
  });

  async function onSubmit(values: CourseFormValues) {
    setFormError(null);
    try {
      onSaved(await coursesService.update(course.id, values));
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Não foi possível guardar as alterações.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Detalhes do curso</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Título</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <textarea
                      rows={4}
                      className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="thumbnailUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>URL da imagem de capa</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="priceCents"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Preço (centavos)</FormLabel>
                  <FormControl>
                    <Input type="number" min={0} step={1} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {formError && (
              <p role="alert" className="text-sm font-medium text-destructive">
                {formError}
              </p>
            )}

            <Button type="submit" size="sm" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="h-3 w-3 animate-spin" />}
              Guardar alterações
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

function ModulesSection({
  course,
  basePath,
  onCourseChange,
  onError,
}: {
  course: CourseDetail;
  basePath: string;
  onCourseChange: (course: CourseDetail) => void;
  onError: (message: string) => void;
}) {
  const [newModuleTitle, setNewModuleTitle] = useState("");
  const [isAddingModule, setIsAddingModule] = useState(false);

  function handleApiError(err: unknown, fallback: string) {
    onError(err instanceof ApiError ? err.message : fallback);
  }

  async function handleAddModule() {
    if (!newModuleTitle.trim()) return;
    setIsAddingModule(true);
    try {
      onCourseChange(await coursesService.createModule(course.id, newModuleTitle.trim()));
      setNewModuleTitle("");
    } catch (err) {
      handleApiError(err, "Não foi possível criar o módulo.");
    } finally {
      setIsAddingModule(false);
    }
  }

  const sortedModules = [...course.modules].sort((a, b) => a.order - b.order);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Módulos e aulas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {sortedModules.length === 0 && (
          <p className="text-sm text-muted-foreground">Ainda sem módulos.</p>
        )}

        {sortedModules.map((courseModule, index) => (
          <ModuleCard
            key={courseModule.id}
            courseId={course.id}
            basePath={basePath}
            courseModule={courseModule}
            isFirst={index === 0}
            isLast={index === sortedModules.length - 1}
            previousModule={index > 0 ? sortedModules[index - 1] ?? null : null}
            nextModule={index < sortedModules.length - 1 ? sortedModules[index + 1] ?? null : null}
            onCourseChange={onCourseChange}
            onError={onError}
          />
        ))}

        <div className="flex gap-2 border-t border-border pt-4">
          <Input
            placeholder="Título do novo módulo"
            value={newModuleTitle}
            onChange={(e) => setNewModuleTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddModule()}
          />
          <Button variant="outline" disabled={isAddingModule || !newModuleTitle.trim()} onClick={handleAddModule}>
            {isAddingModule ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Módulo
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ModuleCard({
  courseId,
  basePath,
  courseModule,
  isFirst,
  isLast,
  previousModule,
  nextModule,
  onCourseChange,
  onError,
}: {
  courseId: string;
  basePath: string;
  courseModule: CourseModuleItem;
  isFirst: boolean;
  isLast: boolean;
  previousModule: CourseModuleItem | null;
  nextModule: CourseModuleItem | null;
  onCourseChange: (course: CourseDetail) => void;
  onError: (message: string) => void;
}) {
  const [title, setTitle] = useState(courseModule.title);
  const [newLessonTitle, setNewLessonTitle] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  function handleApiError(err: unknown, fallback: string) {
    onError(err instanceof ApiError ? err.message : fallback);
  }

  async function handleTitleBlur() {
    const trimmed = title.trim();
    if (!trimmed || trimmed === courseModule.title) {
      setTitle(courseModule.title);
      return;
    }
    try {
      onCourseChange(await coursesService.updateModule(courseId, courseModule.id, { title: trimmed }));
    } catch (err) {
      handleApiError(err, "Não foi possível renomear o módulo.");
      setTitle(courseModule.title);
    }
  }

  async function handleMove(direction: "up" | "down") {
    const sibling = direction === "up" ? previousModule : nextModule;
    if (!sibling) return;
    setIsBusy(true);
    try {
      const currentOrder = courseModule.order;
      await coursesService.updateModule(courseId, courseModule.id, { order: sibling.order });
      onCourseChange(await coursesService.updateModule(courseId, sibling.id, { order: currentOrder }));
    } catch (err) {
      handleApiError(err, "Não foi possível reordenar o módulo.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleDelete() {
    setIsBusy(true);
    try {
      onCourseChange(await coursesService.removeModule(courseId, courseModule.id));
    } catch (err) {
      handleApiError(err, "Não foi possível eliminar o módulo.");
      setIsBusy(false);
    }
  }

  async function handleAddLesson() {
    if (!newLessonTitle.trim()) return;
    setIsBusy(true);
    try {
      onCourseChange(
        await coursesService.createLesson(courseId, courseModule.id, { title: newLessonTitle.trim() })
      );
      setNewLessonTitle("");
    } catch (err) {
      handleApiError(err, "Não foi possível criar a aula.");
    } finally {
      setIsBusy(false);
    }
  }

  const sortedLessons = [...courseModule.lessons].sort((a, b) => a.order - b.order);

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex items-center gap-2">
        {/*
          Reorder controls. 28px each rather than the 44px the guidelines ask
          for: two stacked 44px targets are 88px tall, which does not fit a
          compact editor row. This is a real improvement on the 12px icons
          that were here, but on a phone reordering is still fiddly — the
          proper fix is a drag handle, or folding these into an overflow menu
          below tablet width, and that is its own piece of work.
        */}
        <div className="flex flex-col gap-0.5">
          <button
            className="focus-ring grid h-7 w-7 place-items-center rounded text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
            disabled={isFirst || isBusy}
            onClick={() => handleMove("up")}
            aria-label="Mover módulo para cima"
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
          <button
            className="focus-ring grid h-7 w-7 place-items-center rounded text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
            disabled={isLast || isBusy}
            onClick={() => handleMove("down")}
            aria-label="Mover módulo para baixo"
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </button>
        </div>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleTitleBlur}
          className="h-9 font-medium"
        />
        <ConfirmButton
          disabled={isBusy}
          onConfirm={() => void handleDelete()}
          confirmLabel="Eliminar módulo?"
          aria-label="Eliminar módulo"
          className="inline-flex h-8 items-center justify-center gap-1 rounded-md px-2 text-sm transition-colors hover:bg-secondary disabled:pointer-events-none disabled:opacity-50"
          armedClassName="bg-destructive/10 text-destructive"
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </ConfirmButton>
      </div>

      <div className="mt-3 space-y-2 pl-6">
        {sortedLessons.map((lesson, index) => (
          <LessonRow
            key={lesson.id}
            courseId={courseId}
            moduleId={courseModule.id}
            lesson={lesson}
            isFirst={index === 0}
            isLast={index === sortedLessons.length - 1}
            previousLesson={index > 0 ? sortedLessons[index - 1] ?? null : null}
            nextLesson={index < sortedLessons.length - 1 ? sortedLessons[index + 1] ?? null : null}
            onCourseChange={onCourseChange}
            onError={onError}
          />
        ))}

        <div className="flex gap-2 pt-1">
          <Input
            placeholder="Título da nova aula"
            value={newLessonTitle}
            onChange={(e) => setNewLessonTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddLesson()}
            className="h-8 text-sm"
          />
          <Button
            variant="outline"
            size="sm"
            disabled={isBusy || !newLessonTitle.trim()}
            onClick={handleAddLesson}
          >
            {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
            Aula
          </Button>
        </div>

        {/* The quiz sits at the end of the module, which is where a student meets it. */}
        <div className="flex items-center gap-2 border-t border-border/60 pt-3">
          <ClipboardCheck className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          {courseModule.assessment ? (
            <>
              <span className="min-w-0 flex-1 truncate text-sm">{courseModule.assessment.title}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {courseModule.assessment.questionCount}{" "}
                {courseModule.assessment.questionCount === 1 ? "pergunta" : "perguntas"}
              </span>
              <Button asChild variant="outline" size="sm">
                <Link href={`${basePath}/courses/${courseId}/modules/${courseModule.id}/assessment`}>
                  Editar
                </Link>
              </Button>
            </>
          ) : (
            <>
              <span className="flex-1 text-sm text-muted-foreground">Sem avaliação</span>
              <Button asChild variant="outline" size="sm">
                <Link href={`${basePath}/courses/${courseId}/modules/${courseModule.id}/assessment`}>
                  <Plus className="h-3 w-3" />
                  Avaliação
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function LessonRow({
  courseId,
  moduleId,
  lesson,
  isFirst,
  isLast,
  previousLesson,
  nextLesson,
  onCourseChange,
  onError,
}: {
  courseId: string;
  moduleId: string;
  lesson: LessonItem;
  isFirst: boolean;
  isLast: boolean;
  previousLesson: LessonItem | null;
  nextLesson: LessonItem | null;
  onCourseChange: (course: CourseDetail) => void;
  onError: (message: string) => void;
}) {
  const [title, setTitle] = useState(lesson.title);
  const [isBusy, setIsBusy] = useState(false);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [isUploadingMaterial, setIsUploadingMaterial] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const materialInputRef = useRef<HTMLInputElement>(null);

  function handleApiError(err: unknown, fallback: string) {
    onError(err instanceof ApiError ? err.message : fallback);
  }

  async function handleTitleBlur() {
    const trimmed = title.trim();
    if (!trimmed || trimmed === lesson.title) {
      setTitle(lesson.title);
      return;
    }
    try {
      onCourseChange(await coursesService.updateLesson(courseId, moduleId, lesson.id, { title: trimmed }));
    } catch (err) {
      handleApiError(err, "Não foi possível renomear a aula.");
      setTitle(lesson.title);
    }
  }

  async function handleToggleFreePreview() {
    setIsBusy(true);
    try {
      onCourseChange(
        await coursesService.updateLesson(courseId, moduleId, lesson.id, {
          isFreePreview: !lesson.isFreePreview,
        })
      );
    } catch (err) {
      handleApiError(err, "Não foi possível atualizar a aula.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleMove(direction: "up" | "down") {
    const sibling = direction === "up" ? previousLesson : nextLesson;
    if (!sibling) return;
    setIsBusy(true);
    try {
      const currentOrder = lesson.order;
      await coursesService.updateLesson(courseId, moduleId, lesson.id, { order: sibling.order });
      onCourseChange(
        await coursesService.updateLesson(courseId, moduleId, sibling.id, { order: currentOrder })
      );
    } catch (err) {
      handleApiError(err, "Não foi possível reordenar a aula.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleDelete() {
    setIsBusy(true);
    try {
      onCourseChange(await coursesService.removeLesson(courseId, moduleId, lesson.id));
    } catch (err) {
      handleApiError(err, "Não foi possível eliminar a aula.");
      setIsBusy(false);
    }
  }

  function handleVideoButtonClick() {
    fileInputRef.current?.click();
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset so selecting the same file again still fires onChange.
    e.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("video/")) {
      onError("Só são aceites ficheiros de vídeo.");
      return;
    }
    if (file.size > MAX_VIDEO_BYTES) {
      onError("O vídeo excede o limite de 500MB.");
      return;
    }

    setIsUploadingVideo(true);
    try {
      onCourseChange(await coursesService.uploadLessonVideo(courseId, moduleId, lesson.id, file));
    } catch (err) {
      handleApiError(err, "Não foi possível carregar o vídeo.");
    } finally {
      setIsUploadingVideo(false);
    }
  }

  async function handleMaterialSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset so selecting the same file again still fires onChange.
    e.target.value = "";
    if (!file) return;

    if (file.size > MAX_MATERIAL_BYTES) {
      onError("O ficheiro excede o limite de 50MB.");
      return;
    }

    setIsUploadingMaterial(true);
    try {
      onCourseChange(await coursesService.addLessonMaterial(courseId, moduleId, lesson.id, file));
    } catch (err) {
      handleApiError(err, "Não foi possível anexar o ficheiro.");
    } finally {
      setIsUploadingMaterial(false);
    }
  }

  async function handleRemoveMaterial(materialId: string) {
    setIsUploadingMaterial(true);
    try {
      onCourseChange(
        await coursesService.removeLessonMaterial(courseId, moduleId, lesson.id, materialId)
      );
    } catch (err) {
      handleApiError(err, "Não foi possível remover o ficheiro.");
    } finally {
      setIsUploadingMaterial(false);
    }
  }

  async function handleRemoveVideo() {
    setIsUploadingVideo(true);
    try {
      onCourseChange(await coursesService.removeLessonVideo(courseId, moduleId, lesson.id));
    } catch (err) {
      handleApiError(err, "Não foi possível remover o vídeo.");
    } finally {
      setIsUploadingVideo(false);
    }
  }

  return (
    <div className="rounded-md bg-secondary/40 px-2 py-1.5">
      <div className="flex items-center gap-2">
      <div className="flex flex-col gap-0.5">
        <button
          className="focus-ring grid h-7 w-7 place-items-center rounded text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
          disabled={isFirst || isBusy}
          onClick={() => handleMove("up")}
          aria-label="Mover aula para cima"
        >
          <ArrowUp className="h-3 w-3" />
        </button>
        <button
          className="focus-ring grid h-7 w-7 place-items-center rounded text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
          disabled={isLast || isBusy}
          onClick={() => handleMove("down")}
          aria-label="Mover aula para baixo"
        >
          <ArrowDown className="h-3 w-3" />
        </button>
      </div>
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={handleTitleBlur}
        className="h-8 flex-1 text-sm"
      />
      <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={lesson.isFreePreview}
          disabled={isBusy}
          onChange={handleToggleFreePreview}
          className="h-3.5 w-3.5"
        />
        Pré-visualização gratuita
      </label>

      {/*
        Narrower than video/* on purpose: without a CDN nothing transcodes, so
        the browser has to play the file exactly as uploaded. .avi and .mkv are
        refused by the server anyway — better not to offer them in the picker.
      */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".mp4,.m4v,.mov,.webm,video/mp4,video/quicktime,video/webm"
        onChange={handleFileSelected}
        className="hidden"
      />
      {lesson.hasVideo ? (
        <div className="flex shrink-0 items-center gap-1">
          <Badge variant="success" className="gap-1">
            <Film className="h-3 w-3" />
            Vídeo
          </Badge>
          <ConfirmButton
            disabled={isUploadingVideo}
            onConfirm={() => void handleRemoveVideo()}
            confirmLabel="Remover vídeo?"
            aria-label="Remover vídeo"
            className="inline-flex h-8 items-center justify-center gap-1 rounded-md px-2 text-sm transition-colors hover:bg-secondary disabled:pointer-events-none disabled:opacity-50"
            armedClassName="bg-destructive/10 text-destructive"
          >
            {isUploadingVideo ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <X className="h-3.5 w-3.5 text-destructive" />
            )}
          </ConfirmButton>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          disabled={isUploadingVideo}
          onClick={handleVideoButtonClick}
          className="shrink-0"
        >
          {isUploadingVideo ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="h-3.5 w-3.5" />
          )}
          Vídeo
        </Button>
      )}
      {!lesson.hasVideo && (
        <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
          MP4 (H.264) ou WebM
        </span>
      )}

      <ConfirmButton
        disabled={isBusy}
        onConfirm={() => void handleDelete()}
        confirmLabel="Eliminar aula?"
        aria-label="Eliminar aula"
        className="inline-flex h-8 items-center justify-center gap-1 rounded-md px-2 text-sm transition-colors hover:bg-secondary disabled:pointer-events-none disabled:opacity-50"
        armedClassName="bg-destructive/10 text-destructive"
      >
        <Trash2 className="h-3.5 w-3.5 text-destructive" />
      </ConfirmButton>
      </div>

      {/* --- Materials: everything that goes with the lesson but isn't the video. --- */}
      <input
        ref={materialInputRef}
        type="file"
        accept={MATERIAL_EXTENSIONS}
        onChange={handleMaterialSelected}
        className="hidden"
      />
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 pl-6">
        {lesson.materials.map((material) => (
          <span
            key={material.id}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-background/60 py-0.5 pl-2 pr-0.5 text-xs"
          >
            <Paperclip className="h-3 w-3 shrink-0 text-muted-foreground" />
            <span className="max-w-[14rem] truncate" title={material.fileName}>
              {material.fileName}
            </span>
            <span className="shrink-0 text-muted-foreground">{formatBytes(material.sizeBytes)}</span>
            <ConfirmButton
              disabled={isUploadingMaterial}
              onConfirm={() => void handleRemoveMaterial(material.id)}
              confirmLabel="Remover?"
              aria-label={`Remover ${material.fileName}`}
              className="inline-flex h-5 items-center justify-center rounded-full px-1 transition-colors hover:bg-secondary disabled:pointer-events-none disabled:opacity-50"
              armedClassName="bg-destructive/10 text-destructive"
            >
              <X className="h-3 w-3 text-destructive" />
            </ConfirmButton>
          </span>
        ))}

        <button
          type="button"
          disabled={isUploadingMaterial}
          onClick={() => materialInputRef.current?.click()}
          className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground disabled:opacity-50"
        >
          {isUploadingMaterial ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Paperclip className="h-3 w-3" />
          )}
          Anexar material
        </button>
      </div>
    </div>
  );
}

/** Rounded to whole units — the point is "is this a big download?", not the exact byte count. */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
