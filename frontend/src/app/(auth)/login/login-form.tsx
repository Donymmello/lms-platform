"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Eye, EyeOff, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { homePathForRole } from "@/lib/routes";
import { User } from "@/types/auth";
import { ApiError } from "@/services/api-client";
import { authService } from "@/services/auth.service";
import { useAuthStore } from "@/store/auth.store";
import { LoginFormValues, loginSchema } from "@/validators/auth.validator";

export function LoginForm() {
  const router = useRouter();
  const setUser = useAuthStore((state) => state.setUser);
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  /** Non-null once the password has been accepted and a code is owed. */
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  async function handleVerify(event: React.FormEvent) {
    event.preventDefault();
    if (!challengeToken) return;

    setFormError(null);
    setIsVerifying(true);
    try {
      goHome(await authService.verifyTwoFactor(challengeToken, code));
    } catch (error) {
      setIsVerifying(false);
      setFormError(error instanceof ApiError ? error.message : "Código inválido. Tenta novamente.");
    }
  }

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  function goHome(user: User) {
    setUser(user);
    router.push(homePathForRole(user.role));
    router.refresh();
  }

  async function onSubmit(values: LoginFormValues) {
    setFormError(null);
    try {
      const result = await authService.login(values);

      // The password was right but no session exists yet: the account has a
      // second factor and the code decides.
      if ("requiresTwoFactor" in result) {
        setChallengeToken(result.challengeToken);
        return;
      }

      goHome(result.user);
    } catch (error) {
      setFormError(
        error instanceof ApiError ? error.message : "Não foi possível entrar. Tenta novamente."
      );
    }
  }

  if (challengeToken) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Verificação em dois passos</CardTitle>
          <CardDescription>
            Escreve o código de 6 dígitos da tua aplicação de autenticação, ou um dos códigos de
            recuperação.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleVerify} className="space-y-4" noValidate>
            <Input
              autoFocus
              inputMode="text"
              autoComplete="one-time-code"
              placeholder="123456"
              className="text-center text-lg tracking-[0.3em]"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />

            {formError && (
              <p role="alert" className="text-sm font-medium text-destructive">
                {formError}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={isVerifying}>
              {isVerifying && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirmar
            </Button>
          </form>

          <button
            type="button"
            onClick={() => {
              setChallengeToken(null);
              setCode("");
              setFormError(null);
            }}
            className="mt-6 w-full text-center text-sm text-muted-foreground hover:text-foreground"
          >
            Voltar atrás
          </button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Entrar</CardTitle>
        <CardDescription>Introduz os teus dados para aceder à plataforma.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" autoComplete="email" placeholder="tu@exemplo.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>Palavra-passe</FormLabel>
                    <Link
                      href="/forgot-password"
                      className="text-xs text-muted-foreground hover:text-primary"
                    >
                      Esqueceste-te?
                    </Link>
                  </div>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        className="pr-10"
                        {...field}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                        aria-label={showPassword ? "Ocultar palavra-passe" : "Mostrar palavra-passe"}
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
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

            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Entrar
            </Button>
          </form>
        </Form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Ainda não tens conta?{" "}
          <Link href="/register" className="font-medium text-primary hover:underline">
            Criar conta
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
