// Category picker overlay — invoked from long-press "Nominate for Hall of Fame".
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { HOF_CATEGORIES, type HofEntityType } from "@/lib/hof-categories";
import { nominateToHOF } from "@/lib/hof.functions";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  entityType: HofEntityType;
  entityId: string;
}

export function NominateActionSheet({ open, onClose, entityType, entityId }: Props) {
  const [pending, setPending] = useState<string | null>(null);
  const nominate = useServerFn(nominateToHOF);

  const eligible = HOF_CATEGORIES.filter((c) => c.appliesTo.includes(entityType));

  const submit = async (category: string) => {
    setPending(category);
    try {
      const r = await nominate({ data: { entity_type: entityType, entity_id: entityId, category } });
      if (r.ok) toast(r.line);
      else toast("The court did not record that. Try again.");
    } catch {
      toast("The court did not record that. Try again.");
    } finally {
      setPending(null);
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] bg-black/45 flex items-end sm:items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 32, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 32, opacity: 0 }}
            transition={{ type: "spring", damping: 22, stiffness: 220 }}
            className="w-full max-w-md rounded-2xl p-3"
            style={{ background: "var(--c-surface-1, #fff)", border: "0.5px solid var(--c-border)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-2 pt-1 pb-2">
              <p className="text-[10px] uppercase tracking-[0.1em]" style={{ color: "var(--c-text-3)" }}>
                Nominate for Hall of Fame
              </p>
              <p className="text-[12px] mt-0.5" style={{ color: "var(--c-text-2)" }}>
                Pick the category that fits.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-1.5 max-h-[60vh] overflow-y-auto">
              {eligible.map((c) => (
                <button
                  key={c.key}
                  disabled={pending !== null}
                  onClick={() => submit(c.key)}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-left disabled:opacity-50"
                  style={{ background: "var(--c-surface-2)", color: "var(--c-text-1)" }}
                >
                  <span className="text-lg">{c.emoji}</span>
                  <span className="text-[12px] leading-tight">{c.label}</span>
                </button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
