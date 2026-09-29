"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Loader2 } from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { ApiError } from "@/services/api-client";
import { usersService } from "@/services/users.service";
import { useAuthStore } from "@/store/auth.store";

const BUTTON =
  "inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.03] disabled:pointer-events-none disabled:opacity-60";

export function BecomeInstructorCta() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const setUser = useAuthStore((state) => state.setUser);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleBecomeInstructor() {
    setError(null);
    setIsSubmitting(true);
    try {
      const updated = await usersService.becomeInstructor();
      setUser(updated);
      router.push("/instructor");
      // The session cookies were replaced server-side; refresh so every
      // server component re-reads the new role rather than the cached one.
      router.refresh();
    } catch (caught) {
      setIsSubmitting(false);
      setError(
        caught instanceof ApiError ? caught.message : "Não foi possível activar a tua conta de instrutor."
      );
    }
  }

  if (isLoading) {
    return (
      <button type="button" disabled className={BUTTON}>
        <Loader2 className="h-4 w-4 animate-spin" />
      </button>
    );
  }

  // A visitor has to have an account first — same funnel as enrolling.
  if (!user) {
    return (
      <button type="button" className={BUTTON} onClick={() => router.push("/login?from=/ensinar")}>
        Entrar para começar
        <ArrowRight className="h-4 w-4" />
      </button>
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
        <button type="button" className={BUTTON} onClick={() => router.push("/instructor")}>
          Ir para o painel
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        className={BUTTON}
        onClick={handleBecomeInstructor}
        disabled={isSubmitting}
      >
        {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
        Começar a ensinar
        {!isSubmitting && <ArrowRight className="h-4 w-4" />}
      </button>
      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Continuas a ter acesso aos cursos em que estás inscrito.
      </p>
    </div>
  );
}
