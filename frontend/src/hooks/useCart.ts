"use client";

import { useEffect } from "react";
import { useCartStore } from "@/store/cart.store";

/**
 * Reads the cart and makes sure it has been loaded from this browser first.
 *
 * The hydration is here rather than in the store so the store stays free of
 * React, and so reading `localStorage` never happens during a server render.
 */
export function useCart() {
  const entries = useCartStore((state) => state.entries);
  const isHydrated = useCartStore((state) => state.isHydrated);
  const hydrate = useCartStore((state) => state.hydrate);
  const add = useCartStore((state) => state.add);
  const remove = useCartStore((state) => state.remove);
  const clear = useCartStore((state) => state.clear);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return {
    entries,
    isHydrated,
    count: entries.length,
    add,
    remove,
    clear,
    has: (id: string) => entries.some((entry) => entry.id === id),
  };
}
