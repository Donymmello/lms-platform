"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { paymentsService } from "@/services/payments.service";
import { MyPayment } from "@/types/payment";

const POLL_INTERVAL_MS = 2500;
const MAX_ATTEMPTS = 16; // ~40s of polling before giving up

/**
 * Landing page after a PaySuite (M-Pesa/e-Mola) hosted checkout. PaySuite
 * doesn't hand us a confirmed status on this redirect — the webhook is the
 * source of truth and can arrive a few seconds after the browser gets here
 * — so this page just polls "os meus pagamentos" until the status settles.
 */
function ReturnContent() {
  const searchParams = useSearchParams();
  const reference = searchParams.get("reference");
  const [payment, setPayment] = useState<MyPayment | null>(null);
  const [gaveUp, setGaveUp] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!reference) return;
    let cancelled = false;
    let attempt = 0;

    async function tick() {
      try {
        const payments = await paymentsService.listMine();
        if (cancelled) return;
        const match = payments.find((p) => p.reference === reference) ?? null;
        setPayment(match);
        if (match && match.status !== "PENDING") return;
      } catch {
        if (!cancelled) setError("Não foi possível verificar o estado do pagamento.");
        return;
      }

      attempt += 1;
      if (attempt >= MAX_ATTEMPTS) {
        if (!cancelled) setGaveUp(true);
        return;
      }
      setTimeout(() => {
        if (!cancelled) void tick();
      }, POLL_INTERVAL_MS);
    }

    void tick();
    return () => {
      cancelled = true;
    };
  }, [reference]);

  if (!reference) {
    return <p className="text-muted-foreground">Referência de pagamento em falta.</p>;
  }

  if (error) {
    return (
      <p role="alert" className="text-sm font-medium text-destructive">
        {error}
      </p>
    );
  }

  if (payment?.status === "COMPLETED") {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <CheckCircle2 className="h-10 w-10 text-emerald-600" />
        <div>
          <p className="text-lg font-semibold">Pagamento confirmado</p>
          {/* A payment can cover a cart, so name one course or count them. */}
          <p className="text-muted-foreground">
            {payment.items.length === 1
              ? `Já estás inscrito em ${payment.items[0]!.courseTitle}.`
              : `Já estás inscrito nos ${payment.items.length} cursos que pagaste.`}
          </p>
        </div>
        <Button asChild>
          <Link href="/student/courses">Ir para os meus cursos</Link>
        </Button>
      </div>
    );
  }

  if (payment?.status === "FAILED" || payment?.status === "CANCELLED") {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <XCircle className="h-10 w-10 text-destructive" />
        <div>
          <p className="text-lg font-semibold">O pagamento não foi concluído</p>
          <p className="text-muted-foreground">Podes tentar novamente a partir da página do curso.</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/courses">Voltar ao catálogo</Link>
        </Button>
      </div>
    );
  }

  if (gaveUp) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <Loader2 className="h-10 w-10 text-muted-foreground" />
        <div>
          <p className="text-lg font-semibold">Ainda a processar</p>
          <p className="text-muted-foreground">
            Alguns pagamentos móveis demoram um pouco mais a confirmar. Verifica de novo em &quot;Os meus
            cursos&quot; dentro de instantes.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/student/courses">Ir para os meus cursos</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      <p className="text-muted-foreground">A confirmar o teu pagamento...</p>
    </div>
  );
}

export default function PaymentReturnPage() {
  return (
    <Suspense fallback={<div className="py-16 text-center text-muted-foreground">A carregar...</div>}>
      <ReturnContent />
    </Suspense>
  );
}
