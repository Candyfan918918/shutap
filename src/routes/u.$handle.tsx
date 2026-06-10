// Public profile page: /u/$handle
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getProfileByHandle } from "@/lib/profile.functions";
import { listAuthorPublicPosts, getChaosHistory } from "@/lib/posts/public.functions";
import { listSavedPosts } from "@/lib/saved.functions";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { TabBar } from "@/components/profile/TabBar";
import { StoriesGrid } from "@/components/profile/StoriesGrid";
import { ChaosHistory } from "@/components/profile/ChaosHistory";
import { SavedTea } from "@/components/profile/SavedTea";
import { BadgesGrid } from "@/components/profile/BadgesGrid";
import { HofBadges } from "@/components/hof/HofBadges";

type Tab = "stories" | "history" | "saved" | "badges";

export const Route = createFileRoute("/u/$handle")({
  component: ProfilePage,
  errorComponent: ({ error }) => (
    <div className="min-h-screen grid place-items-center text-center px-6">
      <div>
        <div className="text-5xl mb-3">🫥</div>
        <div className="text-muted-foreground">{error.message}</div>
        <Link to="/" className="text-primary underline text-sm mt-4 inline-block">go home</Link>
      </div>
    </div>
  ),
  notFoundComponent: () => (
    <div className="min-h-screen grid place-items-center text-center px-6">
      <div>
        <div className="text-5xl mb-3">🕳️</div>
        <div className="font-medium">user vanished</div>
        <div className="text-muted-foreground text-sm mt-1">this handle doesn't exist (or never did).</div>
        <Link to="/" className="text-primary underline text-sm mt-4 inline-block">go home</Link>
      </div>
    </div>
  ),
  head: ({ params }) => ({
    meta: [
      { title: `@${params.handle} · Tea Spilling` },
      { name: "description", content: `@${params.handle}'s relationship chaos profile.` },
    ],
  }),
});

function ProfilePage() {
  const { handle } = Route.useParams();
  const fetchProfile = useServerFn(getProfileByHandle);
  const fetchPosts = useServerFn(listAuthorPublicPosts);
  const fetchHistory = useServerFn(getChaosHistory);
  const fetchSaved = useServerFn(listSavedPosts);

  const sessionQuery = useQuery({
    queryKey: ["session"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
    staleTime: 60_000,
  });
  const viewerId = sessionQuery.data?.id ?? null;

  const profileQuery = useQuery({
    queryKey: ["profile", handle, viewerId],
    queryFn: () => fetchProfile({ data: { handle } }),
  });

  const profile = profileQuery.data;
  const [tab, setTab] = useState<Tab>("stories");

  const postsQuery = useQuery({
    enabled: !!profile,
    queryKey: ["profile_posts", profile?.id, viewerId],
    queryFn: () => fetchPosts({ data: { authorId: profile!.id } }),
  });
  const historyQuery = useQuery({
    enabled: !!profile && tab === "history",
    queryKey: ["chaos_history", profile?.id],
    queryFn: () => fetchHistory({ data: { userId: profile!.id } }),
  });
  const savedQuery = useQuery({
    enabled: !!profile?.isMe && tab === "saved",
    queryKey: ["saved", profile?.id],
    queryFn: () => fetchSaved({ data: {} }),
  });

  if (profileQuery.isLoading) {
    return <div className="min-h-screen grid place-items-center text-muted-foreground">loading…</div>;
  }
  if (!profile) throw notFound();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 bg-background/85  border-b border-border">
        <div className="mx-auto max-w-2xl px-4 py-3 flex items-center justify-between">
          <Link to="/" className="p-1 -ml-1 text-muted-foreground"><ChevronLeft className="w-5 h-5" /></Link>
          <div className="font-medium text-sm">@{profile.handle}</div>
          <span className="w-6" />
        </div>
      </header>

      <main className="mx-auto max-w-2xl">
        <ProfileHeader p={profile} onChanged={() => profileQuery.refetch()} />

        <TabBar
          tabs={[
            { id: "stories", label: "Stories", emoji: "☕" },
            { id: "history", label: "Chaos", emoji: "📊" },
            ...(profile.isMe ? [{ id: "saved" as Tab, label: "Saved", emoji: "🔖" }] : []),
            { id: "badges", label: "Badges", emoji: "🏆" },
          ]}
          active={tab}
          onChange={setTab}
        />

        <div className="pb-24">
          {tab === "stories" && <StoriesGrid posts={postsQuery.data ?? []} isMe={profile.isMe} />}
          {tab === "history" && <ChaosHistory rows={historyQuery.data ?? []} />}
          {tab === "saved" && profile.isMe && <SavedTea rows={savedQuery.data ?? []} isMe />}
          {tab === "badges" && <BadgesGrid badges={profile.badges} />}
        </div>
      </main>
    </div>
  );
}
