import { create } from "zustand";

/**
 * The cart, kept in this browser rather than on the server.
 *
 * It holds nothing that matters until checkout: the server prices the courses
 * and refuses a cart it does not like, so losing a cart costs a few clicks
 * and nothing else. A server-side cart would mean a model, endpoints and a
 * sync path, to carry a list of ids between devices.
 *
 * Only ids and slugs are stored. Titles and prices are fetched by the cart
 * page, so what the buyer reads is the current price — the one the server will
 * actually charge — rather than whatever it was when they added it.
 */

export interface CartEntry {
  id: string;
  slug: string;
}

const STORAGE_KEY = "lms.cart";

/**
 * Every access is guarded: a private window, blocked site data or a cleared
 * profile makes these throw rather than return empty.
 */
function read(): CartEntry[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is CartEntry =>
        typeof entry === "object" && entry !== null && typeof (entry as CartEntry).id === "string"
    );
  } catch {
    return [];
  }
}

function write(entries: CartEntry[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // The cart still works for this page view; it just will not survive a
    // reload. Not worth telling anyone about.
  }
}

interface CartState {
  entries: CartEntry[];
  /** False until the browser's copy has been read, so the badge does not flash a zero. */
  isHydrated: boolean;
  hydrate: () => void;
  add: (entry: CartEntry) => void;
  remove: (id: string) => void;
  clear: () => void;
  has: (id: string) => boolean;
}

export const useCartStore = create<CartState>((set, get) => ({
  entries: [],
  isHydrated: false,

  // Reading localStorage during render would break server rendering, so this
  // runs from an effect instead.
  hydrate: () => {
    if (get().isHydrated) return;
    set({ entries: read(), isHydrated: true });
  },

  add: (entry) => {
    const entries = get().entries;
    // Adding twice is a double click, not two purchases.
    if (entries.some((existing) => existing.id === entry.id)) return;
    const next = [...entries, entry];
    write(next);
    set({ entries: next });
  },

  remove: (id) => {
    const next = get().entries.filter((entry) => entry.id !== id);
    write(next);
    set({ entries: next });
  },

  clear: () => {
    write([]);
    set({ entries: [] });
  },

  has: (id) => get().entries.some((entry) => entry.id === id),
}));
