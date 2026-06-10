// StreamShell — single-surface scroller. AliasPill (fixed top-right) +
// ChatbotPill (fixed bottom-center). No header, tabs, or sidebar.
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getMyProfile } from "@/lib/profile.functions";
import { AliasPill } from "./AliasPill";
import { AliasOverlay } from "./AliasOverlay";
import { ChatbotPill } from "./ChatbotPill";
import { StreamList } from "./StreamList";

export function StreamShell() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [overlay, setOverlay] = useState(false);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => { if (alive) setAuthed(!!data.session); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setAuthed(!!s));
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, []);

  const fetchMe = useServerFn(getMyProfile);
  const meQ = useQuery({
    queryKey: ["me", "stream-pill"],
    enabled: !!authed,
    queryFn: () => (fetchMe as unknown as () => Promise<any>)(),
    staleTime: 60_000,
  });
  const me = meQ.data as any;

  return (
    <div className="min-h-screen w-full" style={{ background: "var(--c-surface, #fff)" }}>
      {authed && (
        <AliasPill
          fixed
          emoji={me?.emoji}
          nationality={me?.nationality}
          emotion={me?.emotion}
          creature={me?.creature}
          onClick={() => setOverlay(true)}
        />
      )}

      <StreamList anonymous={authed === false} />

      <ChatbotPill />
      <AliasOverlay open={overlay} onClose={() => setOverlay(false)} authed={!!authed} />
    </div>
  );
}
