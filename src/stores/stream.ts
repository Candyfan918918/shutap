// Stream store — tracks composed items, cursor, loading flag, and
// chatbot override state (response + items pinned by the chatbot).
import { create } from "zustand";
import type { StreamItem } from "@/lib/stream.functions";

interface StreamState {
  items: StreamItem[];
  cursor: string | null;
  loading: boolean;
  chatbot_override_active: boolean;
  override_items: StreamItem[];
  override_response: string | null;
  override_set_at: number | null;
  reset: () => void;
  prepend: (next: StreamItem[]) => void;
  append: (next: StreamItem[]) => void;
  setCursor: (c: string | null) => void;
  setLoading: (b: boolean) => void;
  setOverride: (args: { response: string; items: StreamItem[] }) => void;
  clearOverride: () => void;
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
  override_items: [],
  override_response: null,
  override_set_at: null,
  reset: () => set({ items: [], cursor: null, loading: false }),
  prepend: (next) => set((s) => ({ items: dedupe([...next, ...s.items]) })),
  append: (next) => set((s) => ({ items: dedupe([...s.items, ...next]) })),
  setCursor: (c) => set({ cursor: c }),
  setLoading: (b) => set({ loading: b }),
  setOverride: ({ response, items }) =>
    set({
      chatbot_override_active: true,
      override_items: items,
      override_response: response,
      override_set_at: Date.now(),
    }),
  clearOverride: () =>
    set({
      chatbot_override_active: false,
      override_items: [],
      override_response: null,
      override_set_at: null,
    }),
}));
