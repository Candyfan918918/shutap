// AliasOverlay — sheet shown when the alias pill is tapped.
// Four sections: profile, bookmarks, journal, settings. Stub navigation
// links — the underlying features ship over time.
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  onClose: () => void;
  authed: boolean;
}

export function AliasOverlay({ open, onClose, authed }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/45 flex items-start justify-end"
          onClick={onClose}
        >
          <motion.div
            initial={{ x: 32, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 32, opacity: 0 }}
            transition={{ type: "spring", damping: 24, stiffness: 240 }}
            className="w-full max-w-xs h-full overflow-y-auto p-5 space-y-1"
            style={{ background: "var(--c-surface-1)", borderLeft: "0.5px solid var(--c-border)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <p
              className="text-[10px] uppercase tracking-[0.1em] mb-2"
              style={{ color: "var(--c-text-3)" }}
            >
              Your bench
            </p>
            {!authed ? (
              <Link
                to="/auth"
                onClick={onClose}
                className="block w-full text-center py-3 rounded-full font-medium text-[13px]"
                style={{ background: "var(--c-pink-soft)", color: "var(--c-pink-ink)" }}
              >
                Sign in to claim a seat
              </Link>
            ) : (
              <>
                <Row to="/_authenticated/profile" label="Profile" hint="Alias, scores, history" onClose={onClose} />
                <Row to="/_authenticated/saved" label="Bookmarks" hint="Stories you marked" onClose={onClose} />
                <Row to="/_authenticated/journal" label="Journal" hint="Private notes the room won't see" onClose={onClose} />
                <Row to="/_authenticated/settings" label="Settings" hint="Notifications, privacy" onClose={onClose} />
                <button
                  type="button"
                  onClick={async () => { await supabase.auth.signOut(); onClose(); }}
                  className="mt-4 w-full text-left text-[12px] px-3 py-2 rounded-lg"
                  style={{ color: "var(--c-text-3)" }}
                >
                  Sign out
                </button>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Row({ to, label, hint, onClose }: { to: string; label: string; hint: string; onClose: () => void }) {
  return (
    <Link
      to={to as any}
      onClick={onClose}
      className="block px-3 py-3 rounded-xl hover:bg-[var(--c-surface-2)]"
    >
      <div className="text-[13px] font-medium" style={{ color: "var(--c-text-1)" }}>
        {label}
      </div>
      <div className="text-[11px]" style={{ color: "var(--c-text-3)" }}>
        {hint}
      </div>
    </Link>
  );
}
