"use client";

import { useEffect, useState } from "react";
import { Loader2, Radio, Trash2, Video } from "lucide-react";

import { ApiError } from "@/services/api-client";
import { liveSessionsService } from "@/services/live-sessions.service";
import { LiveSession } from "@/types/live-session";

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("pt-PT", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * `datetime-local` gives and takes a local wall-clock string with no zone, so
 * both directions go through the Date the browser already knows how to build.
 */
function toLocalInputValue(date: Date): string {
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

const EMPTY_FORM = { title: "", joinUrl: "", startsAt: "", durationMinutes: 60 };

export function LiveSessionsManager({ courseId }: { courseId: string }) {
  const [sessions, setSessions] = useState<LiveSession[] | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    liveSessionsService
      .listForCourse(courseId)
      .then((result) => {
        if (!cancelled) setSessions(result);
      })
      .catch((caught) => {
        if (cancelled) return;
        setSessions([]);
        setError(caught instanceof ApiError ? caught.message : "Não foi possível carregar as sessões.");
      });

    return () => {
      cancelled = true;
    };
  }, [courseId]);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const created = await liveSessionsService.create(courseId, {
        title: form.title,
        joinUrl: form.joinUrl,
        // The input is local wall-clock time; send the real instant.
        startsAt: new Date(form.startsAt).toISOString(),
        durationMinutes: Number(form.durationMinutes),
      });
      setSessions((current) =>
        [...(current ?? []), created].sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      );
      setForm(EMPTY_FORM);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Não foi possível agendar a sessão.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(sessionId: string) {
    setError(null);
    const previous = sessions;
    setSessions((current) => (current ?? []).filter((session) => session.id !== sessionId));
    try {
      await liveSessionsService.remove(sessionId);
    } catch (caught) {
      setSessions(previous ?? null);
      setError(caught instanceof ApiError ? caught.message : "Não foi possível apagar a sessão.");
    }
  }

  const inputClass =
    "focus-ring h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/60";

  return (
    <div className="space-y-8">
      <form onSubmit={handleCreate} className="space-y-4 rounded-xl border border-border bg-card p-5">
        <h2 className="text-base font-semibold">Agendar sessão</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5 sm:col-span-2">
            <span className="text-xs text-muted-foreground">Título</span>
            <input
              required
              minLength={3}
              className={inputClass}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Sessão de dúvidas do módulo 1"
            />
          </label>

          <label className="space-y-1.5 sm:col-span-2">
            <span className="text-xs text-muted-foreground">Link da reunião</span>
            <input
              required
              type="url"
              className={inputClass}
              value={form.joinUrl}
              onChange={(e) => setForm({ ...form, joinUrl: e.target.value })}
              placeholder="https://zoom.us/j/..."
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-xs text-muted-foreground">Início</span>
            <input
              required
              type="datetime-local"
              min={toLocalInputValue(new Date())}
              className={inputClass}
              value={form.startsAt}
              onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-xs text-muted-foreground">Duração (minutos)</span>
            <input
              required
              type="number"
              min={1}
              max={1440}
              className={inputClass}
              value={form.durationMinutes}
              onChange={(e) => setForm({ ...form, durationMinutes: Number(e.target.value) })}
            />
          </label>
        </div>

        {error && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.02] disabled:pointer-events-none disabled:opacity-60"
        >
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Agendar
        </button>
      </form>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Sessões agendadas</h2>

        {!sessions ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />A carregar...
          </div>
        ) : sessions.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
            Ainda não agendaste nenhuma sessão para este curso.
          </p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {sessions.map((session) => (
              <li key={session.id} className="flex items-center gap-3 px-4 py-3">
                <span
                  className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${
                    session.isLive
                      ? "bg-primary text-primary-foreground"
                      : "border border-border text-muted-foreground"
                  }`}
                >
                  {session.isLive ? <Radio className="h-3.5 w-3.5" /> : <Video className="h-3.5 w-3.5" />}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{session.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {session.isLive ? "A decorrer agora · " : ""}
                    {formatWhen(session.startsAt)} · {session.durationMinutes} min
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => void handleDelete(session.id)}
                  aria-label={`Apagar ${session.title}`}
                  className="shrink-0 rounded-full p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
