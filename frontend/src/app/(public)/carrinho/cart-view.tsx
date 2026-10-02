"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AlertCircle, ArrowRight, Loader2, ShoppingCart, X } from "lucide-react";

import { CourseCover } from "@/components/studio/course-cover";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { ApiError } from "@/services/api-client";
import { paymentsService } from "@/services/payments.service";
import { publicCoursesService } from "@/services/public-courses.service";
import { CourseDetail } from "@/types/course";
import { PaymentProvider } from "@/types/payment";

/**
 * The cart.
 *
 * The courses are fetched rather than remembered: the browser stores only ids,
 * so the prices on this page are the current ones — the ones the server will
 * actually charge — instead of whatever they were when the course was added.
 */

const PROVIDERS: { value: PaymentProvider; label: string }[] = [
  { value: "MPESA", label: "M-Pesa" },
  { value: "EMOLA", label: "e-Mola" },
  // Visa and Mastercard both go through PaySuite's `credit_card` method, so
  // one button covers them: the card network is picked on their page, not here.
  { value: "CARD", label: "Cartão" },
  { value: "PAYPAL", label: "PayPal" },
];

function formatPrice(cents: number): string {
  return (cents / 100).toLocaleString("pt-MZ", { style: "currency", currency: "MZN" });
}

export function CartView() {
  const router = useRouter();
  const { user, isLoading: isLoadingUser } = useAuth();
  const { entries, isHydrated, remove, clear } = useCart();

  const [courses, setCourses] = useState<CourseDetail[] | null>(null);
  const [provider, setProvider] = useState<PaymentProvider>("MPESA");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isHydrated) return;
    if (entries.length === 0) {
      setCourses([]);
      return;
    }

    let cancelled = false;
    Promise.all(entries.map((entry) => publicCoursesService.getBySlug(entry.slug).catch(() => null)))
      .then((loaded) => {
        if (cancelled) return;
        // A course that no longer resolves was unpublished or deleted while it
        // sat in the cart; drop it quietly rather than blocking checkout.
        setCourses(loaded.filter((course): course is CourseDetail => course !== null));
      })
      .catch(() => {
        if (!cancelled) setError("Não foi possível carregar o carrinho.");
      });

    return () => {
      cancelled = true;
    };
  }, [entries, isHydrated]);

  async function handleCheckout() {
    if (!courses || courses.length === 0) return;

    if (!user) {
      router.push("/login?from=/carrinho");
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      const checkout = await paymentsService.checkout(
        courses.map((course) => course.id),
        provider
      );
      // The cart is cleared on the way out rather than on return: the buyer is
      // leaving for the gateway, and coming back to a full cart after paying
      // would invite paying twice.
      clear();
      window.location.href = checkout.redirectUrl;
    } catch (err) {
      setIsSubmitting(false);
      setError(err instanceof ApiError ? err.message : "Não foi possível iniciar o pagamento.");
    }
  }

  if (!isHydrated || !courses) {
    return (
      <div className="flex items-center gap-3 py-20 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">A abrir o carrinho...</span>
      </div>
    );
  }

  if (courses.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border px-8 py-20 text-center">
        <ShoppingCart className="mx-auto h-9 w-9 text-muted-foreground/50" />
        <h2 className="mt-4 font-display text-3xl tracking-tight">O carrinho está vazio</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
          Escolhe cursos no catálogo e eles ficam aqui até decidires pagar.
        </p>
        <Link
          href="/courses"
          className="focus-ring mt-6 inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.03]"
        >
          Ver catálogo
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  const total = courses.reduce((sum, course) => sum + course.priceCents, 0);
  const hasFree = courses.some((course) => course.priceCents === 0);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <ul className="space-y-3">
        {courses.map((course) => (
          <li
            key={course.id}
            className="flex items-center gap-4 rounded-xl border border-border bg-card p-3"
          >
            <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-lg">
              <CourseCover
                slug={course.slug}
                title={course.title}
                thumbnailUrl={course.thumbnailUrl}
                coverKey={course.coverKey}
              />
            </div>

            <div className="min-w-0 flex-1">
              <Link
                href={`/courses/${course.slug}`}
                className="focus-ring line-clamp-2 rounded text-sm font-medium leading-snug hover:text-primary"
              >
                {course.title}
              </Link>
              <p className="mt-0.5 text-xs text-muted-foreground">{course.instructor.name}</p>
            </div>

            <span className="shrink-0 text-sm tabular-nums">
              {course.priceCents === 0 ? "Grátis" : formatPrice(course.priceCents)}
            </span>

            <button
              type="button"
              onClick={() => remove(course.id)}
              aria-label={`Remover ${course.title}`}
              className="focus-ring grid h-9 w-9 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="space-y-4 rounded-xl border border-border bg-card p-5">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="font-display text-2xl tabular-nums">{formatPrice(total)}</span>
          </div>

          {hasFree && (
            <p className="text-xs text-muted-foreground">
              Os cursos gratuitos não precisam de pagamento. Abre a página do curso e inscreve-te
              directamente.
            </p>
          )}

          <div className="space-y-2">
            <p className="text-[0.7rem] uppercase tracking-[0.2em] text-muted-foreground">
              Método de pagamento
            </p>
            <div className="grid grid-cols-2 gap-2">
              {PROVIDERS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setProvider(option.value)}
                  aria-pressed={provider === option.value}
                  className={`focus-ring min-h-11 rounded-lg border px-2 text-xs font-medium transition-colors ${
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

          {/*
            One charge for the whole cart, which is the point: each M-Pesa
            payment is a confirmation on the buyer's phone, and three courses
            would otherwise be three.
          */}
          <button
            type="button"
            onClick={() => void handleCheckout()}
            disabled={isSubmitting || isLoadingUser}
            className="focus-ring inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.02] disabled:pointer-events-none disabled:opacity-60"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {user ? "Pagar tudo" : "Entrar para pagar"}
          </button>

          {error && (
            <p role="alert" className="flex items-start gap-2 text-sm font-medium text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}
