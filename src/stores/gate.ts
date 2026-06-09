// Gate store — holds the pending action while the identity ceremony plays.
// Nothing is executed until the ceremony resolves and the action is replayed.
import { create } from "zustand";

export type PendingActionType =
  | "vote"
  | "judgment"
  | "relate"
  | "comment"
  | "teaser"
  | "hof_dramatic"
  | "hof_relatable"
  | "hof_surprising"
  | "claim"
  | "claim_final"
  | "bookmark"
  | "follow"
  | "spill"
  | "scan";

export interface PendingAction {
  type: PendingActionType;
  entityId?: string;       // postId / caseId where applicable
  verdictKind?: string;    // for vote
  draftText?: string;      // for comment
  context?: { category?: string; relationshipType?: string };
}

interface GateState {
  open: boolean;
  pending: PendingAction | null;
  enqueue: (action: PendingAction) => void;
  close: () => void;
}

export const useGateStore = create<GateState>((set) => ({
  open: false,
  pending: null,
  enqueue: (action) => set({ open: true, pending: action }),
  close: () => set({ open: false, pending: null }),
}));
