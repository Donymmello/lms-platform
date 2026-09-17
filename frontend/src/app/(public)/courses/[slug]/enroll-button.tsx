"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { ApiError } from "@/services/api-client";
import { enrollmentsService } from "@/services/enrollments.service";
import { paymentsService } from "@/services/payments.service";
import { PaymentProvider } from "@/types/payment";

interface EnrollButtonProps {
  courseId: string;
  courseSlug: string;
  priceCents: number;
}

const PROVIDERS: { value: PaymentProvider; label: string }[] = [
  { value: "MPESA", label: "M-Pesa" },
  { value: "EMOLA", label: "e-Mola" },
  { value: "PAYPAL", label: "PayPal" },
];

export function EnrollButton({ courseId, courseSlug, priceCents }: EnrollButtonProps) {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [provider, setProvider] = useState<PaymentProvider>("MPESA");
  const [status, setStatus] = useState<"idle" | "submitting" | "enrolled">("idle");
  const [error, setError] = useState<string | null>(null);
  const isPaid = priceCents > 0;

  async function handleFreeEnroll() {
    setError(null);
    setStatus("submitting");
    try {
      await enrollmentsService.enroll(courseId);
      setStatus("enrolled");
    } catch (err) {
      if (err instanceof ApiError && err.statusCode === 409) {
        // Already enrolled — treat as success rather than an error.
        setStatus("enrolled");
        return;
      }
      setStatus("idle");
      setError(err instanceof ApiError ? err.message : "Não foi possível concluir a inscrição.");
    }
  }

  async function handleCheckout() {
    setError(null);
    setStatus("submitting");
    try {
      const checkout = await paymentsService.checkout(courseId, provider);
      // Full browser navigation — the destination is the gateway's own
      // hosted checkout page (PaySuite) or approval page (PayPal), not a
      // route inside this app.
      window.location.href = checkout.redirectUrl;
    } catch (err) {
      setStatus("idle");
      if (err instanceof ApiError && err.statusCode === 409) {
        setStatus("enrolled");
        return;
      }
      setError(err instanceof ApiError ? err.message : "Não foi possível iniciar o pagamento.");
    }
  }

  if (isLoading) {
    return (
      <Button disabled className="w-full">
        <Loader2 className="h-4 w-4 animate-spin" />
      </Button>
    );
  }

  if (!user) {
    return (
      <Button className="w-full" onClick={() => router.push(`/login?from=/courses/${courseSlug}`)}>
        Entrar para te inscreveres
      </Button>
    );
  }

  if (status === "enrolled") {
    return (
      <div className="space-y-2">
        <p className="flex items-center gap-2 text-sm font-medium text-emerald-700">
          <CheckCircle2 className="h-4 w-4" /> Já estás inscrito
        </p>
        <Button asChild variant="outline" className="w-full">
          <Link href={`/student/courses/${courseSlug}`}>Ir para a aula</Link>
        </Button>
      </div>
    );
  }

  if (!isPaid) {
    return (
      <div className="space-y-2">
        <Button className="w-full" onClick={handleFreeEnroll} disabled={status === "submitting"}>
          {status === "submitting" && <Loader2 className="h-4 w-4 animate-spin" />}
          Inscrever-me
        </Button>
        {error && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <p className="text-sm font-medium">Método de pagamento</p>
        <div className="grid grid-cols-3 gap-2">
          {PROVIDERS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setProvider(option.value)}
              className={`rounded-md border px-2 py-2 text-sm font-medium transition-colors ${
                provider === option.value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-input hover:bg-secondary"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <Button className="w-full" onClick={handleCheckout} disabled={status === "submitting"}>
        {status === "submitting" && <Loader2 className="h-4 w-4 animate-spin" />}
        Pagar e inscrever-me
      </Button>

      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
