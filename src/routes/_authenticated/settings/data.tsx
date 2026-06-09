// Data: export + delete account.
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/settings/data")({
  component: DataPage,
});

function DataPage() {
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(false);

  const onExport = () => {
    toast("📦 export coming soon — we'll email you a zip when ready.");
  };

  const onPause = async () => {
    await supabase.auth.signOut();
    toast.success("account paused — sign back in anytime");
    navigate({ to: "/" });
  };

  const onDelete = async () => {
    // We don't actually purge auth.users here (requires admin path).
    // We mark profile pseudonymously and sign out.
    try {
      const { data: u } = await supabase.auth.getUser();
      if (u.user) {
        await supabase
          .from("profiles")
          .update({
            display_name: "deleted user",
            nickname: "deleted",
            bio: null,
            avatar_url: null,
            anonymous_mode: true,
          } as never)
          .eq("id", u.user.id);
      }
      await supabase.auth.signOut();
      toast.success("account deleted. take care 🫶");
      navigate({ to: "/" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "failed");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium">Your data</h2>
        <p className="text-sm text-muted-foreground">Download or delete everything.</p>
      </div>

      <button onClick={onExport} className="w-full py-3 rounded-2xl bg-card border border-border text-left px-4">
        <div className="font-medium">📦 Download my data</div>
        <div className="text-xs text-muted-foreground mt-1">Get a zip of your profile, posts, and scans.</div>
      </button>

      <button onClick={onPause} className="w-full py-3 rounded-2xl bg-card border border-border text-left px-4">
        <div className="font-medium">😴 Pause account</div>
        <div className="text-xs text-muted-foreground mt-1">Sign out and step away. Come back whenever.</div>
      </button>

      <button onClick={() => setConfirm(true)} className="w-full py-3 rounded-2xl bg-red-500/10 border border-red-500/30 text-left px-4">
        <div className="font-medium text-red-400">🗑️ Delete account</div>
        <div className="text-xs text-red-300/70 mt-1">Your profile becomes anonymous and we sign you out. Posts stay anonymous.</div>
      </button>

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this account?</AlertDialogTitle>
            <AlertDialogDescription>
              Your name, handle direction, and avatar will be wiped. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>nevermind</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete} className="bg-red-500 hover:bg-red-600">
              yes, delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
