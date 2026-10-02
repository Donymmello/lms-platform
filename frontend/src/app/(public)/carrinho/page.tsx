import type { Metadata } from "next";
import { CartView } from "./cart-view";

export const metadata: Metadata = {
  title: "Carrinho | LMS",
};

export default function CartPage() {
  return (
    <div className="mx-auto max-w-shelf px-6 py-12 lg:px-10 lg:py-16">
      <header className="mb-8">
        <p className="text-[0.7rem] uppercase tracking-[0.24em] text-primary">Carrinho</p>
        <h1 className="mt-3 font-display text-4xl leading-tight tracking-tight sm:text-5xl">
          Pagas tudo de uma vez
        </h1>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
          Uma confirmação no telemóvel, não uma por curso.
        </p>
      </header>

      <CartView />
    </div>
  );
}
