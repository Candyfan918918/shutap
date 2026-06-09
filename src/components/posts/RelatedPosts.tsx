import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { getRelatedPosts, type RelatedPost } from "@/lib/posts/community.functions";

export function RelatedPosts({ postId, autoLoad = false }: { postId: string; autoLoad?: boolean }) {
  const fetchRelated = useServerFn(getRelatedPosts);
  const [items, setItems] = useState<RelatedPost[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!autoLoad || loaded) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetchRelated({ data: { postId, limit: 4 } });
        if (!cancelled) { setItems(r); setLoaded(true); }
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [autoLoad, loaded, postId, fetchRelated]);

  if (!autoLoad || items.length === 0) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border bg-card p-4"
    >
      <div className="flex items-baseline justify-between mb-3">
        <p className="text-sm font-medium">🍿 More stories like this</p>
        <Link to="/" className="text-[11px] text-muted-foreground hover:text-foreground">see all</Link>
      </div>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {items.map((p) => (
          <li key={p.id}>
            <Link
              to="/post/$postId"
              params={{ postId: p.id }}
              className="block rounded-xl border border-border bg-surface-elevated p-3 hover:border-primary/50 transition"
            >
              <p className="text-xs font-medium line-clamp-2">{p.title}</p>
              <div className="mt-1.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                {p.scoreCategory && <span className="px-1.5 py-0.5 rounded-full bg-background border border-border">{p.scoreCategory}</span>}
                <span>💬 {p.commentCount}</span>
                {p.score != null && <span>🔥 {p.score}</span>}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </motion.section>
  );
}
