// Stream-scoped soft gate hook. Wraps the existing identity-ceremony gate
// store so card actions can fire a single call when the user is anonymous.
import { useGateStore, type PendingActionType } from "@/stores/gate";

export function useSoftGate() {
  const enqueue = useGateStore((s) => s.enqueue);
  return (type: PendingActionType, opts?: { entityId?: string; verdictKind?: string }) => {
    enqueue({ type, entityId: opts?.entityId, verdictKind: opts?.verdictKind });
  };
}
