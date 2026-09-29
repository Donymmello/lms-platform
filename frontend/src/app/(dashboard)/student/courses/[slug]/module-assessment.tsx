"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Check, Loader2, RotateCcw, X } from "lucide-react";

import { ApiError } from "@/services/api-client";
import { assessmentsService } from "@/services/assessments.service";
import { AssessmentForTaking, AttemptResult } from "@/types/assessment";

/**
 * The end-of-module quiz, taken in place of the video.
 *
 * Nothing here knows which option is correct until an attempt comes back
 * graded — the server does not send the answer key beforehand, so there is
 * nothing in the page for a curious student to read.
 */
export function ModuleAssessment({ moduleId }: { moduleId: string }) {
  const [assessment, setAssessment] = useState<AssessmentForTaking | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setAssessment(null);
    setError(null);
    setResult(null);
    setSelected({});

    assessmentsService
      .getForTaking(moduleId)
      .then((loaded) => {
        if (!cancelled) setAssessment(loaded);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Não foi possível abrir a avaliação.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [moduleId]);

  function toggle(questionId: string, optionId: string, multiple: boolean) {
    setSelected((current) => {
      const picked = current[questionId] ?? [];
      if (!multiple) {
        // Single-answer: picking replaces, and picking the same one again clears
        // it, so a misclick is recoverable without a "none" option.
        return { ...current, [questionId]: picked.includes(optionId) ? [] : [optionId] };
      }
      return {
        ...current,
        [questionId]: picked.includes(optionId)
          ? picked.filter((id) => id !== optionId)
          : [...picked, optionId],
      };
    });
  }

  async function handleSubmit() {
    if (!assessment) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const graded = await assessmentsService.submitAttempt(
        moduleId,
        assessment.questions.map((question) => ({
          questionId: question.id,
          selectedOptionIds: selected[question.id] ?? [],
        }))
      );
      setResult(graded);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível submeter a avaliação.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleRetry() {
    setResult(null);
    setSelected({});
  }

  if (error && !assessment) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        <AlertCircle className="h-4 w-4 shrink-0" />
        {error}
      </div>
    );
  }

  if (!assessment) {
    return (
      <div className="flex items-center gap-3 py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">A abrir a avaliação...</span>
      </div>
    );
  }

  const answeredCount = assessment.questions.filter(
    (question) => (selected[question.id] ?? []).length > 0
  ).length;
  const verdictByQuestion = new Map(result?.questions.map((question) => [question.questionId, question]));

  return (
    <div className="space-y-6">
      <header className="space-y-1.5">
        <p className="text-[0.7rem] uppercase tracking-[0.22em] text-primary">Avaliação do módulo</p>
        <h2 className="font-display text-2xl leading-tight">{assessment.title}</h2>
        <p className="text-sm text-muted-foreground">
          {assessment.questions.length}{" "}
          {assessment.questions.length === 1 ? "pergunta" : "perguntas"} · nota mínima{" "}
          {assessment.passScore}%
          {assessment.bestScore !== null && ` · melhor nota ${assessment.bestScore}%`}
        </p>
        {/* Said up front, because it changes how someone approaches a quiz. */}
        <p className="text-xs text-muted-foreground">
          Podes repetir quantas vezes quiseres, e conta sempre a melhor nota.
        </p>
      </header>

      {result && (
        <div
          role="status"
          aria-live="polite"
          className={`rounded-xl border p-4 ${
            result.passed
              ? "border-primary/40 bg-primary/10"
              : "border-border bg-secondary/40"
          }`}
        >
          <p className="font-display text-3xl leading-none">{result.score}%</p>
          <p className="mt-1.5 text-sm">
            {result.passed ? "Passaste." : `Não chegaste aos ${result.passScore}%.`}{" "}
            <span className="text-muted-foreground">
              {result.correctCount} de {result.totalQuestions} certas · melhor nota {result.bestScore}%
            </span>
          </p>
          <button
            type="button"
            onClick={handleRetry}
            className="focus-ring mt-3 inline-flex min-h-11 items-center gap-2 rounded-full border border-border px-4 py-2 text-sm transition-colors hover:border-primary/50"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Tentar de novo
          </button>
        </div>
      )}

      <ol className="space-y-5">
        {assessment.questions.map((question, index) => {
          const verdict = verdictByQuestion.get(question.id);
          const picked = verdict ? verdict.selectedOptionIds : selected[question.id] ?? [];

          return (
            <li key={question.id} className="space-y-2.5 rounded-xl border border-border/60 p-4">
              <div className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0 text-xs text-muted-foreground">{index + 1}.</span>
                <div className="space-y-0.5">
                  <p className="text-sm leading-relaxed">{question.prompt}</p>
                  {question.multiple && (
                    <p className="text-xs text-muted-foreground">Selecciona todas as que se aplicam.</p>
                  )}
                </div>
                {verdict && (
                  <span className="ml-auto shrink-0">
                    {verdict.correct ? (
                      <Check className="h-4 w-4 text-primary" />
                    ) : (
                      <X className="h-4 w-4 text-destructive" />
                    )}
                    {/* The tick and cross are the only thing marking a verdict; without this a screen reader hears nothing. */}
                    <span className="sr-only">{verdict.correct ? "Correcta" : "Errada"}</span>
                  </span>
                )}
              </div>

              <div className="space-y-1.5 pl-5">
                {question.options.map((option) => {
                  const isPicked = picked.includes(option.id);
                  // Only after grading is there anything to say about correctness.
                  const isAnswer = verdict?.correctOptionIds.includes(option.id) ?? false;

                  return (
                    <label
                      key={option.id}
                      className={`flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background ${
                        verdict
                          ? isAnswer
                            ? "border-primary/50 bg-primary/10"
                            : isPicked
                              ? "border-destructive/40 bg-destructive/5"
                              : "border-border/50"
                          : isPicked
                            ? "border-primary/50 bg-primary/10"
                            : "border-border/60 hover:border-muted-foreground"
                      } ${verdict ? "cursor-default" : ""}`}
                    >
                      <input
                        type={question.multiple ? "checkbox" : "radio"}
                        name={question.id}
                        checked={isPicked}
                        disabled={Boolean(verdict)}
                        onChange={() => toggle(question.id, option.id, question.multiple)}
                        className="h-3.5 w-3.5 shrink-0"
                      />
                      <span>{option.text}</span>
                      {verdict && isAnswer && (
                        <span className="ml-auto shrink-0">
                          <Check className="h-3.5 w-3.5 text-primary" />
                          <span className="sr-only">Resposta correcta</span>
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ol>

      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      {!result && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={isSubmitting || answeredCount === 0}
            className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.02] disabled:pointer-events-none disabled:opacity-50"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Submeter
          </button>
          <span className="text-xs text-muted-foreground">
            {answeredCount} de {assessment.questions.length} respondidas
          </span>
        </div>
      )}
    </div>
  );
}
