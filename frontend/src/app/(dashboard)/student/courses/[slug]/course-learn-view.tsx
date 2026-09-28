"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  ClipboardCheck,
  Download,
  Film,
  Loader2,
  Lock,
  Play,
} from "lucide-react";

import { apiUrl, ApiError } from "@/services/api-client";
import { LiveSessionsPanel } from "./live-sessions-panel";
import { ModuleAssessment } from "./module-assessment";
import { playbackService } from "@/services/playback.service";
import { progressService } from "@/services/progress.service";
import { publicCoursesService } from "@/services/public-courses.service";
import { CourseDetail, LessonItem } from "@/types/course";
import { SignedPlayback } from "@/types/playback";
import { CourseProgress } from "@/types/progress";

interface CourseLearnViewProps {
  slug: string;
}

type PlaybackState =
  | { status: "loading" }
  | { status: "ready"; source: SignedPlayback }
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

/** Rounded to whole units — the point is "is this a big download?", not the exact byte count. */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(seconds: number | null): string | null {
  if (!seconds) return null;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
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
  // Non-null means the module's quiz has taken over the view from the player.
  const [assessmentModuleId, setAssessmentModuleId] = useState<string | null>(null);

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
        if (!cancelled) setPlayback({ status: "ready", source: result });
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.statusCode === 403) {
          setPlayback({ status: "forbidden", message: err.message });
        } else if (err instanceof ApiError && err.statusCode === 404) {
          setPlayback({ status: "no-video" });
        } else {
          // A 5xx is the server's problem, not the learner's: its message
          // describes internal configuration and must not be shown to them.
          const isServerFault = err instanceof ApiError && err.statusCode >= 500;
          setPlayback({
            status: "error",
            message:
              err instanceof ApiError && !isServerFault
                ? err.message
                : "O vídeo está indisponível de momento. Tenta mais tarde.",
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

  /**
   * The player reports where it got to; the server decides whether that
   * finishes the lesson. Only a change in that answer is worth re-reading the
   * whole course progress for — the ten-second beats in between would be a
   * request per beat for nothing.
   */
  const handlePosition = useCallback(
    async (lessonId: string, positionSeconds: number, durationSeconds: number) => {
      if (!course) return;
      try {
        const { completed } = await progressService.recordPosition(lessonId, positionSeconds, durationSeconds);
        if (completed && !progress?.completedLessonIds.includes(lessonId)) {
          setProgress(await progressService.getCourseProgress(course.id));
        }
      } catch {
        // Same reasoning as the manual toggle: losing a position report is not
        // worth interrupting someone who is watching a lesson.
      }
    },
    [course, progress]
  );

  if (courseError) {
    return (
      <div className="mx-auto max-w-shelf px-6 py-12 lg:px-10">
        <p
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
        >
          {courseError}
        </p>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="flex items-center justify-center gap-3 py-32 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">A abrir a sala...</span>
      </div>
    );
  }

  const sortedModules = [...course.modules].sort((a, b) => a.order - b.order);
  const isSelectedLessonComplete = Boolean(
    selectedLesson && progress?.completedLessonIds.includes(selectedLesson.id)
  );

  return (
    <div>
      {/* --- Stage: the video gets the full width and a warm bloom behind it. --- */}
      <div className={`relative border-b border-border/60 bg-black ${assessmentModuleId ? "hidden" : ""}`}>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        <div className="mx-auto max-w-[78rem] px-0 sm:px-6 lg:px-10">
          <VideoPlayer
            playback={playback}
            courseSlug={course.slug}
            lessonId={selectedLesson?.id ?? null}
            startAt={selectedLesson ? progress?.lessonPositions[selectedLesson.id] ?? 0 : 0}
            onPosition={handlePosition}
          />
        </div>
      </div>

      <div className="mx-auto max-w-shelf px-6 py-8 lg:px-10 lg:py-10">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <Link
              href="/student/courses"
              className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-primary"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Os meus cursos
            </Link>
            <h1 className="mt-2 truncate font-display text-3xl tracking-tight sm:text-4xl">{course.title}</h1>
            <p className="text-sm text-muted-foreground">Por {course.instructor.name}</p>
          </div>

          {progress && progress.totalLessons > 0 && (
            <ProgressDial
              percent={progress.percent}
              completed={progress.completedLessons}
              total={progress.totalLessons}
            />
          )}
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-10">
          {/* --- Now playing, or the module quiz when one is open --- */}
          <div className="space-y-5">
            {assessmentModuleId ? (
              <ModuleAssessment moduleId={assessmentModuleId} />
            ) : selectedLesson ? (
              <>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 space-y-1">
                    <p className="text-[0.7rem] uppercase tracking-[0.2em] text-primary">A reproduzir</p>
                    <h2 className="font-display text-2xl tracking-tight">{selectedLesson.title}</h2>
                  </div>

                  {progress && (
                    <button
                      type="button"
                      disabled={isTogglingComplete}
                      onClick={handleToggleComplete}
                      className={`inline-flex shrink-0 items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-all disabled:opacity-60 ${
                        isSelectedLessonComplete
                          ? "border border-primary/40 bg-primary/10 text-primary hover:bg-primary/15"
                          : "bg-primary text-primary-foreground hover:scale-[1.03]"
                      }`}
                    >
                      {isTogglingComplete ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : isSelectedLessonComplete ? (
                        <Check className="h-4 w-4" />
                      ) : null}
                      {isSelectedLessonComplete ? "Concluída" : "Marcar como concluída"}
                    </button>
                  )}
                </div>

                {selectedLesson.description && (
                  <p className="max-w-2xl whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                    {selectedLesson.description}
                  </p>
                )}

                {selectedLesson.materials.length > 0 && (
                  <div className="max-w-2xl space-y-2">
                    <p className="text-[0.7rem] uppercase tracking-[0.2em] text-muted-foreground">
                      Materiais da aula
                    </p>
                    <ul className="space-y-1.5">
                      {selectedLesson.materials.map((material) => (
                        <li key={material.id}>
                          {/*
                            A plain link rather than a fetch: the download goes
                            straight to the API, and a top-level navigation
                            carries the SameSite=Lax session cookie, which is
                            what the access check on the other end needs.
                          */}
                          <a
                            href={apiUrl(`/lessons/${selectedLesson.id}/materials/${material.id}`)}
                            className="inline-flex items-center gap-2 rounded-lg border border-border/70 px-3 py-2 text-sm transition-colors hover:border-primary/50 hover:bg-secondary/40"
                          >
                            <Download className="h-3.5 w-3.5 shrink-0 text-primary" />
                            <span className="truncate">{material.fileName}</span>
                            <span className="shrink-0 text-xs text-muted-foreground">
                              {formatBytes(material.sizeBytes)}
                            </span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Este curso ainda não tem aulas.</p>
            )}
          </div>

          {/* --- Lesson rail --- */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <LiveSessionsPanel courseId={course.id} />

            <h2 className="mb-3 text-[0.7rem] uppercase tracking-[0.2em] text-muted-foreground">
              Conteúdo do curso
            </h2>

            <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
              {sortedModules.map((courseModule, moduleIndex) => (
                <div key={courseModule.id} className="overflow-hidden rounded-xl border border-border bg-card">
                  <div className="flex items-baseline gap-2.5 border-b border-border px-4 py-3">
                    <span className="font-display text-lg leading-none text-primary/70">
                      {String(moduleIndex + 1).padStart(2, "0")}
                    </span>
                    <p className="text-sm font-medium leading-snug">{courseModule.title}</p>
                  </div>

                  <ul>
                    {[...courseModule.lessons]
                      .sort((a, b) => a.order - b.order)
                      .map((lesson) => {
                        const isComplete = Boolean(progress?.completedLessonIds.includes(lesson.id));
                        const isActive = lesson.id === selectedLessonId;
                        const duration = formatDuration(lesson.durationSeconds);

                        return (
                          <li key={lesson.id}>
                            <button
                              type="button"
                              onClick={() => {
                                setAssessmentModuleId(null);
                                setSelectedLessonId(lesson.id);
                              }}
                              aria-current={isActive ? "true" : undefined}
                              className={`group relative flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                                isActive ? "bg-primary/[0.09]" : "hover:bg-secondary/70"
                              }`}
                            >
                              {isActive && <span className="absolute inset-y-0 left-0 w-[2px] bg-primary" />}

                              <span
                                className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[0.65rem] transition-colors ${
                                  isComplete
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : isActive
                                      ? "border-primary text-primary"
                                      : "border-border text-muted-foreground group-hover:border-muted-foreground"
                                }`}
                              >
                                {isComplete ? (
                                  <Check className="h-3 w-3" />
                                ) : isActive ? (
                                  <Play className="h-2.5 w-2.5 translate-x-[0.5px] fill-current" />
                                ) : (
                                  lesson.order + 1
                                )}
                              </span>

                              <span
                                className={`flex-1 truncate text-[0.85rem] ${
                                  isActive ? "font-medium text-foreground" : "text-muted-foreground"
                                }`}
                              >
                                {lesson.title}
                              </span>

                              {duration && (
                                <span className="shrink-0 text-[0.7rem] tabular-nums text-muted-foreground/70">
                                  {duration}
                                </span>
                              )}

                              {!lesson.hasVideo && (
                                <Film className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
                              )}
                            </button>
                          </li>
                        );
                      })}

                    {courseModule.lessons.length === 0 && (
                      <li className="px-4 py-3 text-sm text-muted-foreground">Sem aulas.</li>
                    )}

                    {courseModule.assessment && (
                      <li className="border-t border-border/60">
                        <button
                          type="button"
                          onClick={() => setAssessmentModuleId(courseModule.id)}
                          aria-current={assessmentModuleId === courseModule.id ? "true" : undefined}
                          className={`group relative flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                            assessmentModuleId === courseModule.id
                              ? "bg-primary/[0.09]"
                              : "hover:bg-secondary/70"
                          }`}
                        >
                          {assessmentModuleId === courseModule.id && (
                            <span className="absolute inset-y-0 left-0 w-[2px] bg-primary" />
                          )}
                          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-border text-muted-foreground group-hover:border-muted-foreground">
                            <ClipboardCheck className="h-3 w-3" />
                          </span>
                          <span
                            className={`flex-1 truncate text-[0.85rem] ${
                              assessmentModuleId === courseModule.id
                                ? "font-medium text-foreground"
                                : "text-muted-foreground"
                            }`}
                          >
                            {courseModule.assessment.title}
                          </span>
                          <span className="shrink-0 text-[0.7rem] tabular-nums text-muted-foreground/70">
                            {courseModule.assessment.questionCount}
                          </span>
                        </button>
                      </li>
                    )}
                  </ul>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

/** Compact progress ring — reads at a glance next to the course title. */
function ProgressDial({ percent, completed, total }: { percent: number; completed: number; total: number }) {
  const radius = 20;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="flex items-center gap-3">
      <div className="relative h-12 w-12">
        <svg viewBox="0 0 48 48" className="h-full w-full -rotate-90">
          <circle cx="24" cy="24" r={radius} fill="none" strokeWidth="3" className="stroke-secondary" />
          <circle
            cx="24"
            cy="24"
            r={radius}
            fill="none"
            strokeWidth="3"
            strokeLinecap="round"
            className="stroke-primary transition-[stroke-dashoffset] duration-700 ease-out"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - (percent / 100) * circumference}
          />
        </svg>
        <span className="absolute inset-0 grid place-items-center text-[0.7rem] font-medium tabular-nums">
          {percent}%
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        {completed} de {total}
        <br />
        {total === 1 ? "aula" : "aulas"}
      </p>
    </div>
  );
}

function VideoPlayer({
  playback,
  courseSlug,
  lessonId,
  startAt,
  onPosition,
}: {
  playback: PlaybackState;
  courseSlug: string;
  lessonId: string | null;
  startAt: number;
  onPosition: (lessonId: string, positionSeconds: number, durationSeconds: number) => void;
}) {
  const shell =
    "flex aspect-video flex-col items-center justify-center gap-3 bg-[hsl(30_9%_4%)] px-6 text-center sm:rounded-b-2xl";

  if (playback.status === "loading") {
    return (
      <div className={shell}>
        <Loader2 className="h-7 w-7 animate-spin text-primary/70" />
      </div>
    );
  }

  if (playback.status === "no-video") {
    return (
      <div className={shell}>
        <Film className="h-9 w-9 text-muted-foreground/60" />
        <p className="text-sm text-muted-foreground">Esta aula ainda não tem vídeo disponível.</p>
      </div>
    );
  }

  if (playback.status === "forbidden") {
    return (
      <div className={shell}>
        <Lock className="h-9 w-9 text-muted-foreground/60" />
        <p className="max-w-sm text-sm text-muted-foreground">{playback.message}</p>
        <Link
          href={`/courses/${courseSlug}`}
          className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.03]"
        >
          Ver detalhes de inscrição
        </Link>
      </div>
    );
  }

  if (playback.status === "error") {
    return (
      <div className={shell}>
        <AlertCircle className="h-9 w-9 text-destructive" />
        <p className="text-sm text-destructive">{playback.message}</p>
      </div>
    );
  }

  // A Bunny video arrives as a player to embed; one stored on our own server
  // is a plain file this browser can play directly.
  if (playback.source.kind === "file") {
    return (
      <LocalVideo
        key={playback.source.url}
        url={playback.source.url}
        shell={shell}
        startAt={startAt}
        // A Bunny embed is a cross-origin iframe this page cannot read the
        // playhead from, so auto-tracking only covers videos we serve
        // ourselves. The manual "concluída" button stays for the rest.
        onPosition={lessonId ? (position, duration) => onPosition(lessonId, position, duration) : undefined}
      />
    );
  }

  return (
    <div className="aspect-video overflow-hidden bg-black sm:rounded-b-2xl">
      <iframe
        key={playback.source.url}
        src={playback.source.url}
        className="h-full w-full"
        allow="accelerometer; gyroscope; encrypted-media; picture-in-picture;"
        allowFullScreen
      />
    </div>
  );
}

/**
 * A video served from our own server, played by the browser directly.
 *
 * `crossOrigin="use-credentials"` matters: the stream route lives on the API's
 * origin and re-checks the session on every request, so without it the request
 * goes out anonymous and a paid lesson answers 403.
 *
 * Uploads are inspected for a real video track now, but files that predate that
 * check — and WebM, which is never parsed — can still turn out to be sound with
 * no picture. The browser's own answer to that is an audio control bar with no
 * fullscreen button and no shape, which reads as a broken player rather than as
 * a bad file, so say what happened instead.
 */
/**
 * `timeupdate` fires several times a second; reporting every one of them would
 * be a request per 250ms. Ten seconds is close enough that nobody notices the
 * lost tail, and the unmount flush below covers the rest.
 */
const REPORT_EVERY_SECONDS = 10;

function LocalVideo({
  url,
  shell,
  startAt,
  onPosition,
}: {
  url: string;
  shell: string;
  startAt: number;
  onPosition?: (positionSeconds: number, durationSeconds: number) => void;
}) {
  const [hasPicture, setHasPicture] = useState(true);

  // Held in a ref so the unmount flush can read the final values without the
  // effect re-running — and re-reporting — on every render.
  const latest = useRef({ position: 0, duration: 0, reported: 0, onPosition });
  latest.current.onPosition = onPosition;

  const flush = useCallback((position: number, duration: number) => {
    if (duration <= 0) return;
    latest.current.reported = position;
    latest.current.onPosition?.(position, duration);
  }, []);

  useEffect(() => {
    // Picking another lesson unmounts this player without firing `pause`, so
    // without this the seconds since the last beat would be lost.
    return () => {
      const { position, duration, reported } = latest.current;
      if (duration > 0 && Math.abs(position - reported) >= 1) {
        latest.current.onPosition?.(position, duration);
      }
    };
  }, []);

  function handleLoadedMetadata(video: HTMLVideoElement) {
    setHasPicture(video.videoWidth > 0);
    latest.current.duration = video.duration;

    // Resuming right at the end would drop them on the final frame with
    // nothing left to watch; that case starts over instead.
    if (startAt > 0 && startAt < video.duration - 5) {
      video.currentTime = startAt;
      latest.current.position = startAt;
      latest.current.reported = startAt;
    }
  }

  function handleTimeUpdate(video: HTMLVideoElement) {
    latest.current.position = video.currentTime;
    latest.current.duration = video.duration;
    if (video.currentTime - latest.current.reported >= REPORT_EVERY_SECONDS) {
      flush(video.currentTime, video.duration);
    }
  }

  if (!hasPicture) {
    return (
      <div className={shell}>
        <AlertCircle className="h-9 w-9 text-muted-foreground/60" />
        <p className="max-w-sm text-sm text-muted-foreground">
          Este ficheiro não traz imagem, apenas som. Pede ao instrutor para carregar o vídeo de novo.
        </p>
      </div>
    );
  }

  return (
    <div className="aspect-video overflow-hidden bg-black sm:rounded-b-2xl">
      <video
        src={url}
        // object-contain keeps a portrait or 4:3 recording in proportion inside
        // the 16:9 stage rather than stretching it to fill.
        className="h-full w-full object-contain"
        controls
        controlsList="nodownload"
        crossOrigin="use-credentials"
        playsInline
        preload="metadata"
        onLoadedMetadata={(event) => handleLoadedMetadata(event.currentTarget)}
        onTimeUpdate={(event) => handleTimeUpdate(event.currentTarget)}
        onPause={(event) => flush(event.currentTarget.currentTime, event.currentTarget.duration)}
        onEnded={(event) => flush(event.currentTarget.duration, event.currentTarget.duration)}
      />
    </div>
  );
}
