// Stream store — tracks composed items, cursor, loading flag, and
// whether the chatbot overlay has commandeered the surface.
import { create } from "zustand";
import type { StreamItem } from "@/lib/stream.functions";

interface StreamState {
  items: StreamItem[];
  cursor: string | null;
  loading: boolean;
  chatbot_override_active: boolean;
  reset: () => void;
  prepend: (next: StreamItem[]) => void;
  append: (next: StreamItem[]) => void;
  setCursor: (c: string | null) => void;
  setLoading: (b: boolean) => void;
  setChatbotOverride: (b: boolean) => void;
}

function dedupe(list: StreamItem[]): StreamItem[] {
  const seen = new Set<string>();
  const out: StreamItem[] = [];
  for (const i of list) {
    if (seen.has(i.key)) continue;
    seen.add(i.key);
    out.push(i);
  }
  return out;
}

export const useStreamStore = create<StreamState>((set) => ({
  items: [],
  cursor: null,
  loading: false,
  chatbot_override_active: false,
  reset: () => set({ items: [], cursor: null, loading: false }),
  prepend: (next) =>
    set((s) => ({ items: dedupe([...next, ...s.items]) })),
  append: (next) =>
    set((s) => ({ items: dedupe([...s.items, ...next]) })),
  setCursor: (c) => set({ cursor: c }),
  setLoading: (b) => set({ loading: b }),
  setChatbotOverride: (b) => set({ chatbot_override_active: b }),
}));
