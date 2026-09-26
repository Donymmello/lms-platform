"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, MailCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/services/api-client";
import { authService } from "@/services/auth.service";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await authService.forgotPassword(email);
      setIsSent(true);
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : "Não foi possível enviar o email. Tenta novamente."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isSent) {
    return (
      <Card>
        <CardHeader>
          <MailCheck className="h-6 w-6 text-primary" />
          <CardTitle>Verifica o teu email</CardTitle>
          {/*
            Worded so it says the same thing whether or not the address is
            registered — the backend deliberately does not reveal which, and
            this screen must not give it away either.
          */}
          <CardDescription>
            Se existir uma conta com <strong>{email}</strong>, enviámos um link para definir uma nova
            palavra-passe. O link expira dentro de uma hora.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline" className="w-full">
            <Link href="/login">Voltar ao início de sessão</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Esqueceste a palavra-passe?</CardTitle>
        <CardDescription>
          Escreve o teu email e enviamos um link para definires uma nova.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              autoComplete="email"
              placeholder="tu@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {error && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Enviar link
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Lembraste-te?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Iniciar sessão
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
