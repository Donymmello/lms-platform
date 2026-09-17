"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Circle, Film, Loader2, Lock, PlayCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ApiError } from "@/services/api-client";
import { playbackService } from "@/services/playback.service";
import { progressService } from "@/services/progress.service";
import { publicCoursesService } from "@/services/public-courses.service";
import { CourseDetail, LessonItem } from "@/types/course";
import { CourseProgress } from "@/types/progress";

interface CourseLearnViewProps {
  slug: string;
}

type PlaybackState =
  | { status: "loading" }
  | { status: "ready"; embedUrl: string }
  | { status: "no-video" }
  | { status: "forbidden"; message: string }
  | { status: "error"; message: string };

function findLesson(course: CourseDetail, lessonId: string): LessonItem | null {
  for (const courseModule of course.modules) {
    const lesson = courseModule.lessons.find((l) => l.id === lessonId);
    if (lesson) return lesson;
  }
  return null;
}

function firstLessonId(course: CourseDetail): string | null {
  const sortedModules = [...course.modules].sort((a, b) => a.order - b.order);
  // Prefer the first lesson that actually has a video — landing on an
  // empty player the moment the page loads would be a confusing default.
  for (const courseModule of sortedModules) {
    const lessons = [...courseModule.lessons].sort((a, b) => a.order - b.order);
    const withVideo = lessons.find((l) => l.hasVideo);
    if (withVideo) return withVideo.id;
  }
  for (const courseModule of sortedModules) {
    const lessons = [...courseModule.lessons].sort((a, b) => a.order - b.order);
    if (lessons[0]) return lessons[0].id;
  }
  return null;
}

export function CourseLearnView({ slug }: CourseLearnViewProps) {
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [courseError, setCourseError] = useState<string | null>(null);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [playback, setPlayback] = useState<PlaybackState>({ status: "loading" });
  // Stays null for a visitor who can watch free previews but isn't actually
  // enrolled — course-level progress requires enrollment (or owning it), so
  // a failed fetch here just means "no progress UI", not an error to show.
  const [progress, setProgress] = useState<CourseProgress | null>(null);
  const [isTogglingComplete, setIsTogglingComplete] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setCourse(null);
    setProgress(null);
    setSelectedLessonId(null);

    publicCoursesService
      .getBySlug(slug)
      .then(async (result) => {
        if (cancelled) return;
        setCourse(result);

        let resumeLessonId: string | null = null;
        try {
          const courseProgress = await progressService.getCourseProgress(result.id);
          if (cancelled) return;
          setProgress(courseProgress);
          resumeLessonId = courseProgress.resumeLessonId;
        } catch {
          // Not enrolled (or not the owner/admin) — progress stays hidden.
        }

        if (!cancelled) {
          setSelectedLessonId(resumeLessonId ?? firstLessonId(result));
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setCourseError(err instanceof ApiError ? err.message : "Não foi possível carregar o curso.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const selectedLesson = useMemo(
    () => (course && selectedLessonId ? findLesson(course, selectedLessonId) : null),
    [course, selectedLessonId]
  );

  useEffect(() => {
    if (!selectedLesson) return;

    if (!selectedLesson.hasVideo) {
      setPlayback({ status: "no-video" });
      return;
    }

    let cancelled = false;
    setPlayback({ status: "loading" });

    playbackService
      .getSignedUrl(selectedLesson.id)
      .then((result) => {
        if (!cancelled) setPlayback({ status: "ready", embedUrl: result.embedUrl });
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.statusCode === 403) {
          setPlayback({ status: "forbidden", message: err.message });
        } else if (err instanceof ApiError && err.statusCode === 404) {
          setPlayback({ status: "no-video" });
        } else {
          setPlayback({
            status: "error",
            message: err instanceof ApiError ? err.message : "Não foi possível carregar o vídeo.",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedLesson]);

  async function handleToggleComplete() {
    if (!course || !selectedLesson) return;
    const nextCompleted = !progress?.completedLessonIds.includes(selectedLesson.id);

    setIsTogglingComplete(true);
    try {
      await progressService.setLessonComplete(selectedLesson.id, nextCompleted);
      setProgress(await progressService.getCourseProgress(course.id));
    } catch {
      // Marking progress is a nice-to-have on top of watching the video —
      // a failed toggle isn't worth a disruptive error banner here.
    } finally {
      setIsTogglingComplete(false);
    }
  }

  if (courseError) {
    return <p className="text-sm font-medium text-destructive">{courseError}</p>;
  }

  if (!course) {
    return (
      <div className="flex justify-center py-16 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const sortedModules = [...course.modules].sort((a, b) => a.order - b.order);
  const isSelectedLessonComplete = Boolean(
    selectedLesson && progress?.completedLessonIds.includes(selectedLesson.id)
  );

  return (
    <div className="space-y-6">
      <div>
        <Link href="/student/courses" className="text-sm text-muted-foreground hover:text-foreground">
          ← Os meus cursos
        </Link>
        <h1 className="mt-2 text-2xl font-bold">{course.title}</h1>
        <p className="text-muted-foreground">Por {course.instructor.name}</p>
      </div>

      {progress && <ProgressBar percent={progress.percent} completed={progress.completedLessons} total={progress.totalLessons} />}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <VideoPlayer playback={playback} courseSlug={course.slug} />
          {selectedLesson && (
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-semibold">{selectedLesson.title}</h2>
                {selectedLesson.description && (
                  <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
                    {selectedLesson.description}
                  </p>
                )}
              </div>
              {progress && (
                <Button
                  variant={isSelectedLessonComplete ? "outline" : "default"}
                  size="sm"
                  disabled={isTogglingComplete}
                  onClick={handleToggleComplete}
                  className="shrink-0"
                >
                  {isTogglingComplete ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : isSelectedLessonComplete ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : null}
                  {isSelectedLessonComplete ? "Concluída" : "Marcar como concluída"}
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground">Conteúdo do curso</h2>
          {sortedModules.map((courseModule) => (
            <div key={courseModule.id} className="rounded-lg border border-border">
              <p className="border-b border-border px-3 py-2 text-sm font-medium">{courseModule.title}</p>
              <ul className="divide-y divide-border">
                {[...courseModule.lessons]
                  .sort((a, b) => a.order - b.order)
                  .map((lesson) => {
                    const isComplete = Boolean(progress?.completedLessonIds.includes(lesson.id));
                    return (
                      <li key={lesson.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedLessonId(lesson.id)}
                          className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-secondary/60 ${
                            lesson.id === selectedLessonId ? "bg-secondary/80 font-medium" : ""
                          }`}
                        >
                          {progress ? (
                            isComplete ? (
                              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                            ) : (
                              <Circle className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
                            )
                          ) : lesson.hasVideo ? (
                            <Film className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          ) : (
                            <span className="h-3.5 w-3.5 shrink-0" />
                          )}
                          <span className="flex-1">{lesson.title}</span>
                          {lesson.isFreePreview ? (
                            <PlayCircle className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          ) : (
                            <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          )}
                        </button>
                      </li>
                    );
                  })}
                {courseModule.lessons.length === 0 && (
                  <li className="px-3 py-2 text-sm text-muted-foreground">Sem aulas.</li>
                )}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ProgressBar({ percent, completed, total }: { percent: number; completed: number; total: number }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">Progresso</span>
        <span className="text-muted-foreground">
          {completed} de {total} {total === 1 ? "aula" : "aulas"} · {percent}%
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-emerald-600 transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function VideoPlayer({ playback, courseSlug }: { playback: PlaybackState; courseSlug: string }) {
  if (playback.status === "loading") {
    return (
      <div className="flex aspect-video items-center justify-center rounded-lg bg-secondary/60">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (playback.status === "no-video") {
    return (
      <div className="flex aspect-video flex-col items-center justify-center gap-2 rounded-lg bg-secondary/60 text-center">
        <Film className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Esta aula ainda não tem vídeo disponível.</p>
      </div>
    );
  }

  if (playback.status === "forbidden") {
    return (
      <div className="flex aspect-video flex-col items-center justify-center gap-3 rounded-lg bg-secondary/60 p-6 text-center">
        <Lock className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{playback.message}</p>
        <Link href={`/courses/${courseSlug}`} className="text-sm font-medium underline">
          Ver detalhes de inscrição
        </Link>
      </div>
    );
  }

  if (playback.status === "error") {
    return (
      <div className="flex aspect-video flex-col items-center justify-center gap-2 rounded-lg bg-secondary/60 p-6 text-center">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-sm text-destructive">{playback.message}</p>
      </div>
    );
  }

  return (
    <div className="aspect-video overflow-hidden rounded-lg bg-black">
      <iframe
        key={playback.embedUrl}
        src={playback.embedUrl}
        className="h-full w-full"
        allow="accelerometer; gyroscope; encrypted-media; picture-in-picture;"
        allowFullScreen
      />
    </div>
  );
}
