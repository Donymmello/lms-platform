"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Loader2 } from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { ApiError } from "@/services/api-client";
import { usersService } from "@/services/users.service";

const BUTTON =
  "inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.03] disabled:pointer-events-none disabled:opacity-60";

// There is no table behind this — the request lives in the audit log and in the
// admins' mailboxes — so there is nothing to ask the server about on load. This
// remembers the submission for this browser only, which is enough to stop the
// form re-appearing on a refresh and inviting a second request.
const SENT_KEY = "lms.instructor-request-sent";

function readSent(): boolean {
  try {
    return window.localStorage.getItem(SENT_KEY) === "1";
  } catch {
    // Private windows and blocked site data throw rather than return null.
    return false;
  }
}

function Sent() {
  return (
    <p className="flex items-center gap-2 text-sm font-medium text-primary">
      <span className="grid h-5 w-5 place-items-center rounded-full bg-primary text-primary-foreground">
        <Check className="h-3 w-3" />
      </span>
      Pedido recebido. Damos notícias por email.
    </p>
  );
}

export function InstructorRequestForm() {
  const { user, isLoading } = useAuth();
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // In an effect, not in the initial state: localStorage does not exist while
  // the server renders, and reading it during render makes the first paint
  // disagree with the markup that was sent.
  useEffect(() => setSent(readSent()), []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await usersService.requestInstructorAccess(message.trim());
      try {
        window.localStorage.setItem(SENT_KEY, "1");
      } catch {
        // Not being able to remember it is not a failure worth showing.
      }
      setSent(true);
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : "Não foi possível enviar o teu pedido."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <button type="button" disabled className={BUTTON}>
        <Loader2 className="h-4 w-4 animate-spin" />
      </button>
    );
  }

  // An account first — the admin needs something to promote.
  if (!user) {
    return (
      <div className="space-y-3">
        <Link className={BUTTON} href="/login?from=/ensinar">
          Entrar para pedir
          <ArrowRight className="h-4 w-4" />
        </Link>
        <p className="text-xs text-muted-foreground">
          Ainda sem conta? <Link href="/register" className="underline">Cria uma</Link>.
        </p>
      </div>
    );
  }

  if (user.role !== "STUDENT") {
    return (
      <div className="space-y-3">
        <p className="flex items-center gap-2 text-sm font-medium text-primary">
          <span className="grid h-5 w-5 place-items-center rounded-full bg-primary text-primary-foreground">
            <Check className="h-3 w-3" />
          </span>
          Já podes ensinar
        </p>
        <Link className={BUTTON} href="/instructor">
          Ir para o painel
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  if (sent) return <Sent />;

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-3">
      <label htmlFor="instructor-message" className="block text-sm font-medium">
        O que queres ensinar?
      </label>
      <textarea
        id="instructor-message"
        name="message"
        required
        minLength={10}
        maxLength={2000}
        rows={4}
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        placeholder="Conta-nos o tema, para quem é, e o que já fizeste nessa área."
        className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm leading-relaxed outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30"
      />
      <button type="submit" className={BUTTON} disabled={isSubmitting || message.trim().length < 10}>
        {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
        Enviar pedido
        {!isSubmitting && <ArrowRight className="h-4 w-4" />}
      </button>
      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Um administrador analisa e activa a tua conta. Continuas com acesso aos cursos em que estás
        inscrito.
      </p>
    </form>
  );
}
