// Bottom action sheet (mobile-style). Lazy-rendered.
import { motion, AnimatePresence } from "framer-motion";

export interface ActionItem {
  key: string;
  label: string;
  icon?: string;
  onSelect: () => void;
  destructive?: boolean;
}

export function ActionSheet({
  open,
  onClose,
  actions,
}: {
  open: boolean;
  onClose: () => void;
  actions: ActionItem[];
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 32, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 32, opacity: 0 }}
            transition={{ type: "spring", damping: 22, stiffness: 220 }}
            className="w-full max-w-sm rounded-2xl p-2"
            style={{ background: "var(--c-surface-1, #fff)", border: "0.5px solid var(--c-border)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {actions.map((a) => (
              <button
                key={a.key}
                onClick={() => { a.onSelect(); onClose(); }}
                className="flex w-full items-center gap-3 px-3 py-3 rounded-xl text-left text-[14px] hover:bg-[var(--c-surface-2)]"
                style={{ color: a.destructive ? "var(--c-coral, #c0392b)" : "var(--c-text-1)" }}
              >
                {a.icon && <span aria-hidden>{a.icon}</span>}
                <span>{a.label}</span>
              </button>
            ))}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
