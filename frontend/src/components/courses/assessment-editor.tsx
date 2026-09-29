"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Loader2, Plus, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/shared/confirm-button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/services/api-client";
import { assessmentsService } from "@/services/assessments.service";
import { AssessmentDraft } from "@/types/assessment";

/**
 * Builds a module's quiz. A save replaces the whole thing, which is why this is
 * a form and not a pile of per-question endpoints — but it also means past
 * attempts lose their per-question detail, so the page says so before saving.
 */

interface DraftOption {
  text: string;
  isCorrect: boolean;
}

interface DraftQuestion {
  prompt: string;
  options: DraftOption[];
}

/** A question with nothing filled in: two options, because one is not a choice. */
function emptyQuestion(): DraftQuestion {
  return {
    prompt: "",
    options: [
      { text: "", isCorrect: true },
      { text: "", isCorrect: false },
    ],
  };
}

/**
 * True/false is not a separate question type, just a question whose two options
 * are named — so the shortcut is pure data, and nothing downstream knows.
 */
function trueFalseQuestion(): DraftQuestion {
  return {
    prompt: "",
    options: [
      { text: "Verdadeiro", isCorrect: true },
      { text: "Falso", isCorrect: false },
    ],
  };
}

export function AssessmentEditor({
  moduleId,
  backHref,
}: {
  moduleId: string;
  backHref: string;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [passScore, setPassScore] = useState(70);
  const [questions, setQuestions] = useState<DraftQuestion[]>([emptyQuestion()]);
  const [exists, setExists] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;

    assessmentsService
      .getForEditing(moduleId)
      .then((assessment) => {
        if (cancelled) return;
        setExists(true);
        setTitle(assessment.title);
        setPassScore(assessment.passScore);
        setQuestions(
          assessment.questions.map((question) => ({
            prompt: question.prompt,
            options: question.options.map((option) => ({
              text: option.text,
              isCorrect: option.isCorrect,
            })),
          }))
        );
      })
      .catch((err) => {
        if (cancelled) return;
        // A 404 is the ordinary case: this module has no quiz yet.
        if (!(err instanceof ApiError && err.statusCode === 404)) {
          setError(err instanceof ApiError ? err.message : "Não foi possível abrir a avaliação.");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [moduleId]);

  function updateQuestion(index: number, change: Partial<DraftQuestion>) {
    setQuestions((current) =>
      current.map((question, i) => (i === index ? { ...question, ...change } : question))
    );
  }

  function updateOption(questionIndex: number, optionIndex: number, change: Partial<DraftOption>) {
    setQuestions((current) =>
      current.map((question, i) =>
        i === questionIndex
          ? {
              ...question,
              options: question.options.map((option, j) =>
                j === optionIndex ? { ...option, ...change } : option
              ),
            }
          : question
      )
    );
  }

  async function handleSave() {
    setError(null);
    setSaved(false);

    const draft: AssessmentDraft = {
      title: title.trim(),
      passScore,
      questions: questions.map((question) => ({
        prompt: question.prompt.trim(),
        options: question.options
          .map((option) => ({ text: option.text.trim(), isCorrect: option.isCorrect }))
          .filter((option) => option.text.length > 0),
      })),
    };

    // Checked here as well as on the server, because a list of field errors is
    // a worse way to learn this than a single sentence.
    if (!draft.title) return setError("A avaliação precisa de um título.");
    for (const [index, question] of draft.questions.entries()) {
      const position = index + 1;
      if (!question.prompt) return setError(`A pergunta ${position} está sem enunciado.`);
      if (question.options.length < 2) {
        return setError(`A pergunta ${position} precisa de pelo menos duas opções com texto.`);
      }
      if (!question.options.some((option) => option.isCorrect)) {
        return setError(`A pergunta ${position} não tem nenhuma opção correcta.`);
      }
      if (!question.options.some((option) => !option.isCorrect)) {
        return setError(`A pergunta ${position} tem todas as opções correctas, portanto não pergunta nada.`);
      }
    }

    setIsSaving(true);
    try {
      await assessmentsService.save(moduleId, draft);
      setExists(true);
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível guardar a avaliação.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    setError(null);
    setIsSaving(true);
    try {
      await assessmentsService.remove(moduleId);
      router.push(backHref);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível eliminar a avaliação.");
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 py-20 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">A carregar...</span>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar ao curso
      </Link>

      <div className="space-y-3">
        <h1 className="font-display text-2xl tracking-tight">
          {exists ? "Editar avaliação" : "Nova avaliação"}
        </h1>
        <p className="text-sm text-muted-foreground">
          O aluno pode repetir sem limite e conta a melhor nota. Nada fica trancado por não passar.
        </p>
      </div>

      <div className="space-y-3 rounded-xl border border-border p-4">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Título</span>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Avaliação do módulo"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Nota mínima (%)</span>
          <Input
            type="number"
            min={1}
            max={100}
            value={passScore}
            onChange={(e) => setPassScore(Number(e.target.value))}
            className="w-28"
          />
        </label>
      </div>

      <div className="space-y-4">
        {questions.map((question, questionIndex) => {
          const correctCount = question.options.filter((option) => option.isCorrect).length;

          return (
            <div key={questionIndex} className="space-y-3 rounded-xl border border-border p-4">
              <div className="flex items-start gap-2">
                <span className="mt-2.5 shrink-0 text-xs text-muted-foreground">
                  {questionIndex + 1}.
                </span>
                <Input
                  value={question.prompt}
                  onChange={(e) => updateQuestion(questionIndex, { prompt: e.target.value })}
                  placeholder="Enunciado da pergunta"
                  className="flex-1"
                />
                <ConfirmButton
                  disabled={questions.length === 1}
                  onConfirm={() =>
                    setQuestions((current) => current.filter((_, i) => i !== questionIndex))
                  }
                  confirmLabel="Eliminar?"
                  aria-label={`Eliminar pergunta ${questionIndex + 1}`}
                  className="inline-flex h-9 items-center justify-center rounded-md px-2 transition-colors hover:bg-secondary disabled:pointer-events-none disabled:opacity-40"
                  armedClassName="bg-destructive/10 text-destructive"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </ConfirmButton>
              </div>

              <p className="pl-5 text-xs text-muted-foreground">
                {correctCount > 1
                  ? "Várias opções correctas: o aluno vê caixas e tem de acertar o conjunto todo."
                  : "Uma opção correcta: o aluno escolhe uma."}
              </p>

              <div className="space-y-2 pl-5">
                {question.options.map((option, optionIndex) => (
                  <div key={optionIndex} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        updateOption(questionIndex, optionIndex, { isCorrect: !option.isCorrect })
                      }
                      aria-pressed={option.isCorrect}
                      aria-label={option.isCorrect ? "Marcar como errada" : "Marcar como correcta"}
                      className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border transition-colors ${
                        option.isCorrect
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border text-muted-foreground hover:border-muted-foreground"
                      }`}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <Input
                      value={option.text}
                      onChange={(e) => updateOption(questionIndex, optionIndex, { text: e.target.value })}
                      placeholder={`Opção ${optionIndex + 1}`}
                      className="h-9 flex-1 text-sm"
                    />
                    <button
                      type="button"
                      disabled={question.options.length <= 2}
                      onClick={() =>
                        updateQuestion(questionIndex, {
                          options: question.options.filter((_, j) => j !== optionIndex),
                        })
                      }
                      aria-label={`Remover opção ${optionIndex + 1}`}
                      className="focus-ring grid h-9 w-9 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary disabled:pointer-events-none disabled:opacity-30"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    updateQuestion(questionIndex, {
                      options: [...question.options, { text: "", isCorrect: false }],
                    })
                  }
                >
                  <Plus className="h-3 w-3" />
                  Opção
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setQuestions((current) => [...current, emptyQuestion()])}
        >
          <Plus className="h-3 w-3" />
          Pergunta
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setQuestions((current) => [...current, trueFalseQuestion()])}
        >
          <Plus className="h-3 w-3" />
          Verdadeiro / Falso
        </Button>
      </div>

      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
      {saved && <p className="text-sm font-medium text-primary">Avaliação guardada.</p>}

      {exists && (
        <p className="text-xs text-muted-foreground">
          Guardar substitui as perguntas. As notas já obtidas mantêm-se, mas as respostas pergunta a
          pergunta dessas tentativas deixam de poder ser revistas.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
        <Button disabled={isSaving} onClick={() => void handleSave()}>
          {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
          Guardar
        </Button>

        {exists && (
          <ConfirmButton
            disabled={isSaving}
            onConfirm={() => void handleDelete()}
            confirmLabel="Eliminar avaliação?"
            aria-label="Eliminar avaliação"
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md px-3 text-sm transition-colors hover:bg-secondary disabled:pointer-events-none disabled:opacity-50"
            armedClassName="bg-destructive/10 text-destructive"
          >
            <Trash2 className="h-4 w-4 text-destructive" />
            Eliminar
          </ConfirmButton>
        )}
      </div>
    </div>
  );
}
