"use client";

import { useState } from "react";
import { Copy, Loader2, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmButton } from "@/components/shared/confirm-button";
import { ApiError } from "@/services/api-client";
import { authService } from "@/services/auth.service";
import { TwoFactorSetup } from "@/types/auth";

type Stage =
  | { name: "idle" }
  | { name: "pairing"; setup: TwoFactorSetup }
  | { name: "saved"; codes: string[] };

export function TwoFactorPanel() {
  const [stage, setStage] = useState<Stage>({ name: "idle" });
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function fail(caught: unknown, fallback: string) {
    setError(caught instanceof ApiError ? caught.message : fallback);
  }

  async function run(work: () => Promise<void>, fallback: string) {
    setError(null);
    setIsBusy(true);
    try {
      await work();
    } catch (caught) {
      fail(caught, fallback);
    } finally {
      setIsBusy(false);
    }
  }

  if (stage.name === "saved") {
    return (
      <Card>
        <CardHeader>
          <ShieldCheck className="h-6 w-6 text-primary" />
          <CardTitle>Guarda estes códigos</CardTitle>
          <CardDescription>
            Cada um serve uma vez, se perderes o telemóvel. <strong>Não voltam a ser mostrados</strong>,
            por isso guarda-os agora num sítio seguro.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-card p-4 font-mono text-sm">
            {stage.codes.map((recoveryCode) => (
              <li key={recoveryCode}>{recoveryCode}</li>
            ))}
          </ul>

          <Button
            variant="outline"
            className="w-full"
            onClick={() => void navigator.clipboard?.writeText(stage.codes.join("\n"))}
          >
            <Copy className="h-4 w-4" />
            Copiar todos
          </Button>

          <Button className="w-full" onClick={() => setStage({ name: "idle" })}>
            Já guardei
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (stage.name === "pairing") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Emparelhar aplicação</CardTitle>
          <CardDescription>
            Lê o código com o Google Authenticator, Authy ou equivalente, e escreve os 6 dígitos que
            aparecerem.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={stage.setup.qrCodeDataUrl}
            alt="Código QR para emparelhar a aplicação de autenticação"
            className="mx-auto h-48 w-48 rounded-lg bg-white p-2"
          />

          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer">Não consegues ler o código?</summary>
            <p className="mt-2 break-all font-mono">{stage.setup.otpauthUrl}</p>
          </details>

          <div className="space-y-2">
            <Label htmlFor="code">Código da aplicação</Label>
            <Input
              id="code"
              autoFocus
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              className="text-center text-lg tracking-[0.3em]"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>

          {error && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          )}

          <Button
            className="w-full"
            disabled={isBusy}
            onClick={() =>
              void run(async () => {
                const codes = await authService.confirmTwoFactorSetup(code);
                setCode("");
                setStage({ name: "saved", codes });
              }, "Não foi possível ativar a verificação em dois passos.")
            }
          >
            {isBusy && <Loader2 className="h-4 w-4 animate-spin" />}
            Ativar
          </Button>

          <button
            type="button"
            onClick={() => {
              setStage({ name: "idle" });
              setCode("");
              setError(null);
            }}
            className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
          >
            Cancelar
          </button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Verificação em dois passos</CardTitle>
        <CardDescription>
          Acrescenta um código temporário ao teu início de sessão. Mesmo que alguém descubra a tua
          palavra-passe, não entra sem o telemóvel.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        )}

        <Button
          className="w-full"
          disabled={isBusy}
          onClick={() =>
            void run(async () => {
              setStage({ name: "pairing", setup: await authService.beginTwoFactorSetup() });
            }, "Não foi possível iniciar a configuração.")
          }
        >
          {isBusy && <Loader2 className="h-4 w-4 animate-spin" />}
          Ativar verificação em dois passos
        </Button>

        <details className="rounded-xl border border-border p-4">
          <summary className="cursor-pointer text-sm text-muted-foreground">
            Já tenho ativa e quero desligar
          </summary>

          <div className="mt-4 space-y-3">
            <div className="space-y-2">
              <Label htmlFor="disable-password">Palavra-passe</Label>
              <Input
                id="disable-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="disable-code">Código da aplicação</Label>
              <Input
                id="disable-code"
                inputMode="text"
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>

            {/* Both are required: knowing only one is the case 2FA exists for. */}
            <ConfirmButton
              disabled={isBusy}
              confirmLabel="Confirmar desativação?"
              className="inline-flex h-10 w-full items-center justify-center rounded-md border border-border text-sm font-medium transition-colors hover:border-destructive/50"
              armedClassName="bg-destructive/10 text-destructive"
              onConfirm={() =>
                void run(async () => {
                  await authService.disableTwoFactor(password, code);
                  setPassword("");
                  setCode("");
                }, "Não foi possível desativar.")
              }
            >
              Desativar
            </ConfirmButton>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}
