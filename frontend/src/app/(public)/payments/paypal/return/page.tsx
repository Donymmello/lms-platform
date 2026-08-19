"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ApiError } from "@/services/api-client";
import { paymentsService } from "@/services/payments.service";
import { CheckoutResult } from "@/types/payment";

/**
 * Landing page after the buyer approves on PayPal's hosted page. Unlike
 * PaySuite, PayPal requires an explicit server-side "capture" call to
 * actually move the money — this page triggers that call once, then shows
 * the result. The async webhook (payments.controller.ts) is a backstop for
 * the (rare) case the buyer's browser never makes it back here.
 */
function PaypalReturnContent() {
  const searchParams = useSearchParams();
  const reference = searchParams.get("reference");
  const [result, setResult] = useState<CheckoutResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!reference) return;
    let cancelled = false;

    paymentsService
      .capturePaypal(reference)
      .then((checkout) => {
        if (!cancelled) setResult(checkout);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Não foi possível confirmar o pagamento.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [reference]);

  if (!reference) {
    return <p className="text-muted-foreground">Referência de pagamento em falta.</p>;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <XCircle className="h-10 w-10 text-destructive" />
        <p className="text-sm font-medium text-destructive">{error}</p>
        <Button asChild variant="outline">
          <Link href="/courses">Voltar ao catálogo</Link>
        </Button>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-muted-foreground">A confirmar o pagamento com o PayPal...</p>
      </div>
    );
  }

  if (result.status === "COMPLETED") {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <CheckCircle2 className="h-10 w-10 text-emerald-600" />
        <p className="text-lg font-semibold">Pagamento confirmado</p>
        <Button asChild>
          <Link href="/student/courses">Ir para os meus cursos</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <Loader2 className="h-10 w-10 text-muted-foreground" />
      <p className="text-lg font-semibold">Pagamento pendente</p>
      <p className="text-muted-foreground">
        Vamos confirmar assim que o PayPal notificar. Verifica &quot;Os meus cursos&quot; dentro de instantes.
      </p>
      <Button asChild variant="outline">
        <Link href="/student/courses">Ir para os meus cursos</Link>
      </Button>
    </div>
  );
}

export default function PaypalReturnPage() {
  return (
    <Suspense fallback={<div className="py-16 text-center text-muted-foreground">A carregar...</div>}>
      <PaypalReturnContent />
    </Suspense>
  );
}
