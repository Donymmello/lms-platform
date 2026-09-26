"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Eye, EyeOff, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/services/api-client";
import { authService } from "@/services/auth.service";

/** Mirrors the backend's rules, so a weak password is caught before a round trip. */
function passwordProblem(password: string): string | null {
  if (password.length < 8) return "A palavra-passe tem de ter pelo menos 8 caracteres.";
  if (!/[a-z]/.test(password)) return "A palavra-passe tem de ter uma letra minúscula.";
  if (!/[A-Z]/.test(password)) return "A palavra-passe tem de ter uma letra maiúscula.";
  if (!/[0-9]/.test(password)) return "A palavra-passe tem de ter um número.";
  return null;
}

export function ResetPasswordForm() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const problem = passwordProblem(password);
    if (problem) return setError(problem);
    if (password !== confirmation) return setError("As palavras-passe não coincidem.");

    setError(null);
    setIsSubmitting(true);
    try {
      await authService.resetPassword(token, password);
      setIsDone(true);
    } catch (caught) {
      setIsSubmitting(false);
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Não foi possível definir a nova palavra-passe. Tenta novamente."
      );
    }
  }

  if (!token) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Link inválido</CardTitle>
          <CardDescription>
            Este endereço não traz um código de recuperação. Pede um link novo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <Link href="/forgot-password">Pedir novo link</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (isDone) {
    return (
      <Card>
        <CardHeader>
          <CheckCircle2 className="h-6 w-6 text-primary" />
          <CardTitle>Palavra-passe alterada</CardTitle>
          <CardDescription>
            Já podes iniciar sessão com a nova palavra-passe. As sessões antigas foram terminadas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="w-full" onClick={() => router.push("/login")}>
            Iniciar sessão
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nova palavra-passe</CardTitle>
        <CardDescription>Escolhe uma palavra-passe que ainda não tenhas usado aqui.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="password">Nova palavra-passe</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                className="pr-10"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword((previous) => !previous)}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                aria-label={showPassword ? "Ocultar palavra-passe" : "Mostrar palavra-passe"}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Mínimo 8 caracteres, com maiúscula, minúscula e número.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmation">Confirmar palavra-passe</Label>
            <Input
              id="confirmation"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
            />
          </div>

          {error && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Guardar
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
