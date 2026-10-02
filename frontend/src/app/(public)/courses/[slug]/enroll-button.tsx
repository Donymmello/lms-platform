"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Check, Loader2, ShoppingCart } from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { ApiError } from "@/services/api-client";
import { enrollmentsService } from "@/services/enrollments.service";
import { paymentsService } from "@/services/payments.service";
import { PaymentProvider } from "@/types/payment";

interface EnrollButtonProps {
  courseId: string;
  courseSlug: string;
  priceCents: number;
}

const PRIMARY_BUTTON =
  "inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.02] disabled:pointer-events-none disabled:opacity-60";
const GHOST_BUTTON =
  "inline-flex w-full items-center justify-center gap-2 rounded-full border border-border px-6 py-3 text-sm font-medium transition-colors hover:border-primary/50";

const PROVIDERS: { value: PaymentProvider; label: string }[] = [
  { value: "MPESA", label: "M-Pesa" },
  { value: "EMOLA", label: "e-Mola" },
  { value: "PAYPAL", label: "PayPal" },
];

export function EnrollButton({ courseId, courseSlug, priceCents }: EnrollButtonProps) {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const { add, has: isInCart } = useCart();
  const [provider, setProvider] = useState<PaymentProvider>("MPESA");
  const [status, setStatus] = useState<"checking" | "idle" | "submitting" | "enrolled">("checking");
  const [error, setError] = useState<string | null>(null);
  const isPaid = priceCents > 0;
  const inCart = isInCart(courseId);

  /**
   * Asks up front whether this course is already theirs. Without it the page
   * offered to enrol someone who enrolled weeks ago, and only the 409 from
   * pressing the button gave the game away.
   *
   * `GET /enrollments/me` returns the whole list rather than answering about
   * one course, which is fine at the size a student's library actually reaches.
   */
  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      setStatus("idle");
      return;
    }

    let cancelled = false;
    enrollmentsService
      .listMine()
      .then((enrollments) => {
        if (cancelled) return;
        setStatus(enrollments.some((enrollment) => enrollment.course.id === courseId) ? "enrolled" : "idle");
      })
      .catch(() => {
        // Falling back to offering enrolment is the safe way to be wrong: the
        // server refuses a duplicate anyway, and this branch handles the 409.
        if (!cancelled) setStatus("idle");
      });

    return () => {
      cancelled = true;
    };
  }, [courseId, isLoading, user]);

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
      const checkout = await paymentsService.checkout([courseId], provider);
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

  if (isLoading || status === "checking") {
    return (
      <button type="button" disabled className={PRIMARY_BUTTON}>
        <Loader2 className="h-4 w-4 animate-spin" />
      </button>
    );
  }

  if (!user) {
    return (
      <button
        type="button"
        className={PRIMARY_BUTTON}
        onClick={() => router.push(`/login?from=/courses/${courseSlug}`)}
      >
        Entrar para te inscreveres
      </button>
    );
  }

  if (status === "enrolled") {
    return (
      <div className="space-y-3">
        <p className="flex items-center gap-2 text-sm font-medium text-primary">
          <span className="grid h-5 w-5 place-items-center rounded-full bg-primary text-primary-foreground">
            <Check className="h-3 w-3" />
          </span>
          Já estás inscrito
        </p>
        <Link href={`/student/courses/${courseSlug}`} className={GHOST_BUTTON}>
          Ir para a aula
        </Link>
      </div>
    );
  }

  if (!isPaid) {
    return (
      <div className="space-y-2">
        <button
          type="button"
          className={PRIMARY_BUTTON}
          onClick={handleFreeEnroll}
          disabled={status === "submitting"}
        >
          {status === "submitting" && <Loader2 className="h-4 w-4 animate-spin" />}
          Inscrever-me
        </button>
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
      {/*
        Two ways to buy, as Udemy has them. "Comprar agora" is one course in
        one charge; the cart is for someone picking several, which matters here
        because each charge is a separate confirmation on their phone.
      */}
      <button
        type="button"
        onClick={() => {
          if (inCart) {
            router.push("/carrinho");
            return;
          }
          add({ id: courseId, slug: courseSlug });
        }}
        className={GHOST_BUTTON}
      >
        <ShoppingCart className="h-4 w-4" />
        {inCart ? "Ver carrinho" : "Adicionar ao carrinho"}
      </button>

      <div className="space-y-2">
        <p className="text-[0.7rem] uppercase tracking-[0.2em] text-muted-foreground">
          Ou paga só este agora
        </p>
        <div className="grid grid-cols-3 gap-2">
          {PROVIDERS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setProvider(option.value)}
              aria-pressed={provider === option.value}
              className={`rounded-lg border px-2 py-2.5 text-xs font-medium transition-colors ${
                provider === option.value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-muted-foreground hover:text-foreground"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        className={PRIMARY_BUTTON}
        onClick={handleCheckout}
        disabled={status === "submitting"}
      >
        {status === "submitting" && <Loader2 className="h-4 w-4 animate-spin" />}
        Pagar e inscrever-me
      </button>

      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
