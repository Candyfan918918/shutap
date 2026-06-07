import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { AnonymityGuarantee } from "@/components/identity/AnonymityGuarantee";

export const Route = createFileRoute("/_authenticated/spill/")({
  component: SpillLanding,
  head: () => ({
    meta: [
      { title: "☕ Spill The Tea — what actually happened?" },
      { name: "description", content: "Anonymous. We hide names. No pressure. Start anywhere." },
    ],
  }),
});

function SpillLanding() {
  return (
    <div className="min-h-screen bg-background text-foreground bg-grain">
      <header className="sticky top-0 z-30 backdrop-blur-md bg-background/75 border-b border-border">
        <div className="mx-auto max-w-2xl px-4 py-3 flex items-center justify-between">
          <Link to="/" className="text-sm text-muted-foreground">← Home</Link>
          <span className="text-xs font-semibold tracking-widest text-primary">☕ SPILL THE TEA</span>
          <span className="w-12" />
        </div>
      </header>
      <main className="mx-auto max-w-xl px-5 pt-10 pb-24 text-center">
        <div className="flex justify-center mb-6">
          <AnonymityGuarantee variant="pill" />
        </div>
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-7xl"
        >
          👀
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="mt-4 text-4xl sm:text-5xl font-black tracking-tight text-balance leading-tight"
        >
          Okay…
          <br />
          what <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">ACTUALLY</span> happened?
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="mt-4 text-muted-foreground text-balance"
        >
          Start anywhere.
          <br />
          The beginning. The worst part. The text message that ruined everything.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="mt-10 space-y-3"
        >
          <Link
            to="/spill/start"
            search={{ voice: 0 }}
            className="block w-full py-4 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground font-bold text-lg shadow-2xl shadow-primary/20"
          >
            Okay so basically… →
          </Link>
          <Link
            to="/spill/start"
            search={{ voice: 1 }}
            className="block w-full py-3 rounded-full bg-surface-elevated border border-border font-semibold text-sm hover:border-primary/40 transition"
          >
            🎙 Tell it out loud
          </Link>
        </motion.div>

        <p className="mt-10 text-xs text-muted-foreground leading-relaxed">
          🔒 Anonymous. We hide names.
          <br />
          Your secrets are safe. No pressure.
        </p>
      </main>
    </div>
  );
}
